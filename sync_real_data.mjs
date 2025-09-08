// sync_real_data.mjs
// ES Module script for syncing real or demo data into Postgres.
// Environment variables:
// - API_Key: Cloud Ocean API key
// - NETLIFY_DATABASE_URL: Postgres connection string
// - CLOUD_OCEAN_BASE_URL: API base URL (default: https://api.develop.rve.ca)

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Client } from "pg";

// Load .env file
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

// Utility functions
function addDays(date, days) {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

// CloudOcean API class
class CloudOceanAPI {
  constructor(apiKey) {
    this.apiKey = apiKey || process.env.API_Key;
    this.baseUrl = process.env.CLOUD_OCEAN_BASE_URL || "https://api.develop.rve.ca";
  }

  async getModuleConsumption({ module_uuid, measuring_point_uuids, start_date, end_date }) {
    const results = [];

    for (const point_uuid of measuring_point_uuids) {
      const url = `${this.baseUrl.replace(/\/$/, "")}/v1/modules/${module_uuid}/measuring-points/${point_uuid}/reads?start=${encodeURIComponent(start_date)}&end=${encodeURIComponent(end_date)}&limit=50&offset=0`;

      console.log("➡️  Requesting:", url);

      let attempts = 0;
      let res;

      while (attempts < 5) { // retry up to 5 times
        attempts++;
        try {
          res = await fetch(url, {
            headers: {
              "Content-Type": "application/json",
              "Access-Token": this.apiKey, // Cloud Ocean requires API key directly
              "Accept": "application/json",
            },
          });

          if (res.ok) break; // success
          if (res.status >= 500) {
            console.warn(`⚠️  Server error ${res.status} for ${point_uuid}, retrying in ${attempts * 2}s...`);
            await new Promise(r => setTimeout(r, attempts * 2000));
          } else {
            console.error(`❌ Failed for ${point_uuid} with status ${res.status}`);
            res = null;
            break;
          }
        } catch (err) {
          console.warn(`⚠️  Network error for ${point_uuid}: ${err.message}, retrying in ${attempts * 2}s`);
          await new Promise(r => setTimeout(r, attempts * 2000));
        }
      }

      if (!res || !res.ok) {
        console.error(`❌ Giving up for ${point_uuid}`);
        continue;
      }

      const data = await res.json();
      results.push({ point_uuid, data });
    }

    return results;
  }
}

// Postgres helpers
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
    `INSERT INTO consumption_records (device_id, timestamp, kwh_consumption, rate)
     VALUES ($1,$2,$3,$4)`,
    [record.device_id, record.timestamp, record.kwh_consumption, record.rate]
  );
}

async function insertInvoice(client, invoice) {
  await client.query(
    `INSERT INTO invoices (device_id, invoice_number, billing_period_start, billing_period_end, total_kwh, total_amount, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [invoice.device_id, invoice.invoice_number, invoice.billing_period_start, invoice.billing_period_end, invoice.total_kwh, invoice.total_amount, invoice.status]
  );
}

// Main sync function
export async function sync_real_data() {
  const apiKey = process.env.API_Key;
  const dbUrl = process.env.NETLIFY_DATABASE_URL;

  if (!dbUrl) {
    console.error("❌ NETLIFY_DATABASE_URL is required.");
    return false;
  }

  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    await withTransaction(client, async () => { await createSchema(client); });

    const cloud_ocean = new CloudOceanAPI(apiKey);

    const module_uuid = "c667ff46-9730-425e-ad48-1e950691b3f9";
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
        devices.push({ id, serial_number: serial, location: mp.location });
      }
    });

    console.log(`✅ Created ${devices.length} devices`);

    const start_date = "2024-10-16T00:00:00Z";
    const end_date = "2024-11-25T00:00:00Z";

    const measuring_point_uuids = measuring_points.map(mp => mp.uuid);
    const real_consumption = await cloud_ocean.getModuleConsumption({
      module_uuid, measuring_point_uuids, start_date, end_date
    });

    const has_real_data = real_consumption.length > 0;

    if (has_real_data) {
      console.log("🎉 SUCCESS: Real consumption data received");
      // Insert real data
      await withTransaction(client, async () => {
        for (const r of real_consumption) {
          const device = devices.find(d => d.serial_number === r.point_uuid.slice(0, 8).toUpperCase());
          if (!device || !r.data?.reads) continue;
          for (const read of r.data.reads) {
            await insertConsumptionRecord(client, {
              device_id: device.id,
              timestamp: read.timestamp,
              kwh_consumption: read.kwh_consumption,
              rate: read.rate,
            });
          }
        }
      });
    } else {
      console.warn("⚠️ No real data, generating demo data");
      // Generate demo data
      await withTransaction(client, async () => {
        for (const device of devices) {
          const days = 30;
          for (let i = 0; i < days; i++) {
            const timestamp = addDays(new Date(start_date), i).toISOString();
            await insertConsumptionRecord(client, {
              device_id: device.id,
              timestamp,
              kwh_consumption: Math.random() * 50,
              rate: 0.25,
            });
          }
        }
      });
    }

    console.log("✅ Data sync complete");

    return true;
  } catch (err) {
    console.error("❌ Error syncing data:", err.message);
    return false;
  } finally {
    try { await client.end(); } catch (_) {}
  }
}

// Run if executed directly
const isMain = (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url));
if (isMain) {
  const success = await sync_real_data();
  process.exit(success ? 0 : 1);
}
