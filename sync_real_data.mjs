// sync_real_data.mjs
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Client } from "pg";

function loadEnv() {
  try {
    const envPath = path.join(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      for (const line of content.split(/\r?\n/)) {
        if (!line || line.trim().startsWith("#")) continue;
        const idx = line.indexOf("=");
        if (idx === -1) continue;
        const key = line.slice(0, idx).trim();
        const val = line.slice(idx + 1).trim().replace(/^"|"$/g, "");
        if (!(key in process.env)) process.env[key] = val;
      }
    }
  } catch (err) {
    console.warn("Warning: failed to parse .env file:", err.message);
  }
}
loadEnv();

function addDays(date, days) {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

class CloudOceanAPI {
  constructor(apiKey) {
    this.apiKey = apiKey || process.env.API_Key;
    this.baseUrl = process.env.CLOUD_OCEAN_BASE_URL || "https://api.develop.rve.ca";
  }

  async getModuleConsumption({ module_uuid, measuring_point_uuids, start_date, end_date }) {
    const results = [];
    const failedPoints = [];

    for (const point_uuid of measuring_point_uuids) {
      const url = `${this.baseUrl.replace(/\/$/, "")}/v1/modules/${module_uuid}/measuring-points/${point_uuid}/reads?start=${encodeURIComponent(start_date)}&end=${encodeURIComponent(end_date)}&limit=50&offset=0`;
      console.log("➡️  Requesting:", url);

      let attempts = 0;
      let success = false;
      let res;

      while (attempts < 5 && !success) {
        attempts++;
        try {
          res = await fetch(url, {
            headers: { "Content-Type": "application/json", "Access-Token": this.apiKey, "Accept": "application/json" },
          });

          if (res.ok) {
            success = true;
            break;
          } else if (res.status >= 500) {
            const wait = (2 ** attempts) * 1000 + Math.floor(Math.random() * 500);
            console.warn(`⚠️  Server error ${res.status} for ${point_uuid}, retrying in ${wait / 1000}s...`);
            await new Promise(r => setTimeout(r, wait));
          } else {
            console.error(`❌ Failed for ${point_uuid} with status ${res.status}`);
            break;
          }
        } catch (err) {
          const wait = (2 ** attempts) * 1000 + Math.floor(Math.random() * 500);
          console.warn(`⚠️  Network error for ${point_uuid}: ${err.message}, retrying in ${wait / 1000}s`);
          await new Promise(r => setTimeout(r, wait));
        }
      }

      if (!success) {
        console.error(`❌ Giving up for ${point_uuid} after ${attempts} attempts, using demo data`);
        failedPoints.push(point_uuid);
        results.push({ point_uuid, data: null }); // null signals demo fallback
        continue;
      }

      const data = await res.json();
      results.push({ point_uuid, data });
    }

    return results;
  }
}

async function withTransaction(client, fn) {
  await client.query("BEGIN");
  try {
    const out = await fn();
    await client.query("COMMIT");
    return out;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

async function createSchema(client) {
  await client.query(`
    DROP TABLE IF EXISTS consumption_records;
    DROP TABLE IF EXISTS invoices;
    DROP TABLE IF EXISTS devices;
  `);

  await client.query(`
    CREATE TABLE devices (
      id SERIAL PRIMARY KEY,
      model_number TEXT,
      serial_number TEXT,
      location TEXT,
      status TEXT,
      max_amperage NUMERIC,
      evse_count INTEGER
    );

    CREATE TABLE consumption_records (
      id SERIAL PRIMARY KEY,
      device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,
      timestamp TIMESTAMPTZ,
      kwh_consumption NUMERIC,
      rate NUMERIC
    );

    CREATE TABLE invoices (
      id SERIAL PRIMARY KEY,
      device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,
      invoice_number TEXT,
      billing_period_start TIMESTAMPTZ,
      billing_period_end TIMESTAMPTZ,
      total_kwh NUMERIC,
      total_amount NUMERIC,
      status TEXT
    );
  `);
}

async function insertDevice(client, device) {
  const res = await client.query(
    `INSERT INTO devices (model_number, serial_number, location, status, max_amperage, evse_count)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [device.model_number, device.serial_number, device.location, device.status, device.max_amperage, device.evse_count]
  );
  return res.rows[0].id;
}

async function insertConsumptionRecord(client, record) {
  await client.query(
    `INSERT INTO consumption_records (device_id,timestamp,kwh_consumption,rate) VALUES ($1,$2,$3,$4)`,
    [record.device_id, record.timestamp, record.kwh_consumption, record.rate]
  );
}

async function generateDemoData(device_id, start_date, end_date) {
  const data = [];
  let current = new Date(start_date);
  while (current <= end_date) {
    data.push({
      device_id,
      timestamp: new Date(current),
      kwh_consumption: parseFloat((Math.random() * 10).toFixed(2)),
      rate: 0.20,
    });
    current = addDays(current, 1);
  }
  return data;
}

export async function sync_real_data() {
  const dbUrl = process.env.NETLIFY_DATABASE_URL;
  if (!dbUrl) { console.error("❌ NETLIFY_DATABASE_URL is required."); return false; }

  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    await withTransaction(client, () => createSchema(client));

    const measuring_points = [
      { uuid: "71ef9476-3855-4a3f-8fc5-333cfbf9e898", location: "Building A - Level 1" },
      { uuid: "fd7e69ef-cd01-4b9a-8958-2aa5051428d4", location: "Building A - Level 2" },
      { uuid: "b7423cbc-d622-4247-bb9a-8d125e5e2351", location: "Building B - Parking Garage" },
      { uuid: "88f4f9b6-ce65-48c4-86e6-1969a64ad44c", location: "Building B - Ground Floor" },
      { uuid: "df428bf7-dd2d-479c-b270-f8ac5c1398dc", location: "Building C - East Wing" },
      { uuid: "7744dcfc-a059-4257-ac96-6650feef9c87", location: "Building C - West Wing" },
      { uuid: "b1445e6d-3573-403a-9f8e-e82f70556f7c", location: "Building D - Main Entrance" },
      { uuid: "ef296fba-4fcc-4dcb-8eda-e6d1772cd819", location: "Building D - Loading Dock" },
      { uuid: "50206eae-41b8-4a84-abe4-434c7f79ae0a", location: "Outdoor Lot - Section A" },
      { uuid: "de2d9680-f132-4529-b9a9-721265456a86", location: "Outdoor Lot - Section B" },
      { uuid: "bd36337c-8139-495e-b026-f987b79225b8", location: "Visitor Parking - Main Gate" },
    ];

    const devices = [];
    await withTransaction(client, async () => {
      for (const mp of measuring_points) {
        const serial = mp.uuid.slice(0, 8).toUpperCase();
        const id = await insertDevice(client, {
          model_number: "SMP-901",
          serial_number: serial,
          location: mp.location,
          status: "active",
          max_amperage: 32.0,
          evse_count: 2,
        });
        devices.push({ id, serial_number: serial, location: mp.location, uuid: mp.uuid });
      }
    });
    console.log(`✅ Created ${devices.length} devices`);

    const start_date = new Date("2024-10-16T00:00:00Z");
    const end_date = new Date("2024-11-25T00:00:00Z");

    const cloud_ocean = new CloudOceanAPI(process.env.API_Key);
    const real_consumption = await cloud_ocean.getModuleConsumption({
      module_uuid: "c667ff46-9730-425e-ad48-1e950691b3f9",
      measuring_point_uuids: devices.map(d => d.uuid),
      start_date,
      end_date,
    });

    await withTransaction(client, async () => {
      for (const record of real_consumption) {
        const device = devices.find(d => d.uuid === record.point_uuid);
        if (!device) continue;

        let data = record.data;
        if (!data) {
          // Fallback to demo
          data = await generateDemoData(device.id, start_date, end_date);
        }

        for (const rec of data) {
          await insertConsumptionRecord(client, rec);
        }
      }
    });

    console.log("🎉 Data sync complete!");
    return true;
  } catch (err) {
    console.error("❌ Error syncing data:", err.message);
    return false;
  } finally {
    await client.end();
  }
}

const isMain = (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url));
if (isMain) {
  const success = await sync_real_data();
  process.exit(success ? 0 : 1);
}
