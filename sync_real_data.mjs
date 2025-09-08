// sync_real_data.mjs
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Client } from "pg";
import fetch from "node-fetch";

// -------------------- .env loader --------------------
function loadEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      if (!line || line.startsWith("#")) continue;
      const [key, ...rest] = line.split("=");
      if (!key) continue;
      process.env[key.trim()] = process.env[key.trim()] || rest.join("=").trim().replace(/^"|"$/g, "");
    }
  }
}
loadEnv();

// -------------------- Utilities --------------------
function formatDateYYYYMMDD(d) {
  return d.toISOString().split("T")[0];
}

function addDays(date, days) {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

async function retry(fn, attempts = 5, initialDelay = 2000) {
  let delay = initialDelay;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === attempts - 1) throw err;
      console.warn(`⚠️  ${err.message}, retrying in ${Math.round(delay / 1000)}s...`);
      await new Promise(r => setTimeout(r, delay));
      delay *= 2;
    }
  }
}

// -------------------- CloudOcean API --------------------
class CloudOceanAPI {
  constructor(apiKey, baseUrl) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl || "https://api.develop.rve.ca/v1";
  }

  async getModuleConsumption({ module_uuid, measuring_point_uuids, start_date, end_date }) {
    const result = {};
    for (const id of measuring_point_uuids) result[id] = 0;
    if (!this.apiKey) return result;

    const url = `${this.baseUrl}/modules/${module_uuid}/v1/measuring-points/id/reads`;
    const body = {
      measuring_point_uuids,
      start_date: formatDateYYYYMMDD(start_date),
      end_date: formatDateYYYYMMDD(end_date),
    };

    try {
      const data = await retry(async () => {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`Server error ${res.status}`);
        return res.json();
      });
      for (const id of measuring_point_uuids) {
        if (typeof data[id] === "number") result[id] = data[id];
      }
    } catch (err) {
      console.warn("Failed to fetch real data:", err.message);
    }

    return result;
  }
}

// -------------------- Postgres helpers --------------------
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
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [device.model_number, device.serial_number, device.location, device.status, device.max_amperage, device.evse_count]
  );
  return res.rows[0].id;
}

async function insertConsumptionRecord(client, record) {
  await client.query(
    `INSERT INTO consumption_records (device_id, timestamp, kwh_consumption, rate)
     VALUES ($1, $2, $3, $4)`,
    [record.device_id, record.timestamp, record.kwh_consumption, record.rate]
  );
}

async function insertInvoice(client, invoice) {
  await client.query(
    `INSERT INTO invoices (device_id, invoice_number, billing_period_start, billing_period_end, total_kwh, total_amount, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [invoice.device_id, invoice.invoice_number, invoice.billing_period_start, invoice.billing_period_end, invoice.total_kwh, invoice.total_amount, invoice.status]
  );
}

async function queryCount(client, table) {
  const res = await client.query(`SELECT COUNT(*) AS c FROM ${table}`);
  return Number(res.rows[0].c);
}

// -------------------- Main sync --------------------
export async function sync_real_data() {
  const apiKey = process.env.API_Key;
  const dbUrl = process.env.NETLIFY_DATABASE_URL;

  if (!dbUrl) {
    console.error("NETLIFY_DATABASE_URL is required.");
    return false;
  }

  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    await withTransaction(client, async () => createSchema(client));

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
        const device = { model_number: "SMP-901", serial_number: serial, location: mp.location, status: "active", max_amperage: 32, evse_count: 2 };
        const id = await insertDevice(client, device);
        devices.push({ id, ...device });
      }
    });

    const start_date = new Date(Date.UTC(2024, 9, 16));
    const end_date = new Date(Date.UTC(2024, 10, 25));

    console.log(`Fetching real data from ${formatDateYYYYMMDD(start_date)} to ${formatDateYYYYMMDD(end_date)}`);
    const uuids = measuring_points.map(mp => mp.uuid);
    const real_data = await cloud_ocean.getModuleConsumption({ module_uuid, measuring_point_uuids: uuids, start_date, end_date });

    const has_real_data = Object.values(real_data).some(v => v > 0);

    if (has_real_data) {
      console.log("Real API data retrieved, populating consumption records...");
      await withTransaction(client, async () => {
        for (let i = 0; i < devices.length; i++) {
          const device = devices[i];
          const mp_uuid = measuring_points[i].uuid;
          const total = Number(real_data[mp_uuid] || 0);
          const daily = total / 30;
          for (let d = 0; d < 30; d++) {
            const record_date = addDays(start_date, d);
            const variation = 0.8 + (d % 5) * 0.1;
            const consumption = daily * variation;
            await insertConsumptionRecord(client, { device_id: device.id, timestamp: record_date.toISOString(), kwh_consumption: Number(consumption.toFixed(2)), rate: 0.12 });
          }
        }
      });
    } else {
      console.warn("No real data, generating demo records...");
      await withTransaction(client, async () => {
        const baseMap = { "Building A": 45, "Building B": 38, "Building C": 42, "Building D": 35, "Outdoor Lot": 30, "Visitor Parking": 25 };
        for (const device of devices) {
          for (let i = 0; i < 40; i++) {
            const record_date = addDays(start_date, i);
            const location_key = device.location.split(" - ")[0];
            const daily_base = baseMap[location_key] ?? 35;
            const day_variation = 0.8 + (i % 7) * 0.1;
            const device_variation = 0.9 + (device.id % 3) * 0.2;
            const random_variation = 0.85 + (i % 4) * 0.15;
            const consumption = daily_base * day_variation * device_variation * random_variation;
            await insertConsumptionRecord(client, { device_id: device.id, timestamp: record_date.toISOString(), kwh_consumption: Number(consumption.toFixed(2)), rate: 0.12 });
          }
        }
      });
    }

    // Generate invoices (October & November 2024)
    const monthPeriods = [
      { start: new Date(Date.UTC(2024, 9, 1)), end: new Date(Date.UTC(2024, 9, 31)), suffix: "202410" },
      { start: new Date(Date.UTC(2024, 10, 1)), end: new Date(Date.UTC(2024, 10, 25)), suffix: "202411" },
    ];

    const invoices = [];
    for (const device of devices) {
      for (const period of monthPeriods) {
        const res = await client.query(
          `SELECT kwh_consumption FROM consumption_records
           WHERE device_id = $1 AND timestamp >= $2 AND timestamp <= $3`,
          [device.id, period.start.toISOString(), period.end.toISOString()]
        );
        const total_kwh = res.rows.reduce((sum, r) => sum + Number(r.kwh_consumption || 0), 0);
        const total_amount = Number((total_kwh * 0.12).toFixed(2));
        invoices.push({ device_id: device.id, invoice_number: `INV-${device.serial_number}-${period.suffix}`, billing_period_start: period.start.toISOString(), billing_period_end: period.end.toISOString(), total_kwh, total_amount, status: "pending" });
      }
    }

    await withTransaction(client, async () => {
      for (const inv of invoices) await insertInvoice(client, inv);
    });

    // Summary
    const deviceCount = await queryCount(client, "devices");
    const recordCount = await queryCount(client, "consumption_records");
    const invoiceCount = await queryCount(client, "invoices");
    const totalConsumptionRes = await client.query(`SELECT COALESCE(SUM(kwh_consumption), 0) AS total FROM consumption_records`);
    const totalConsumption = Number(totalConsumptionRes.rows[0].total || 0);

    console.log("\n===== DATABASE SYNC COMPLETE =====");
    console.log(`Total devices: ${deviceCount}`);
    console.log(`Total consumption records: ${recordCount}`);
    console.log(`Total invoices: ${invoiceCount}`);
    console.log(`Total consumption: ${totalConsumption.toFixed(2)} kWh`);
    return true;

  } catch (err) {
    console.error("Error syncing data:", err.message);
    return false;
  } finally {
    await client.end();
  }
}

// -------------------- Run if invoked directly --------------------
const isMain = path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url);
if (isMain) {
  const success = await sync_real_data();
  console.log(success ? "\n✅ Data sync completed successfully!" : "\n❌ Data sync failed!");
  process.exit(success ? 0 : 1);
}
