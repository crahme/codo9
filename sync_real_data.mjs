// sync_real_data.mjs
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Client } from "pg";

// ------------------
// Load .env manually
// ------------------
function loadEnv() {
  try {
    const envPath = path.join(process.cwd(), ".env");
    if (!fs.existsSync(envPath)) return;

    const content = fs.readFileSync(envPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      if (!line || line.trim().startsWith("#")) continue;
      const idx = line.indexOf("=");
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim().replace(/^"|"$/g, "");
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch (err) {
    console.warn("⚠️ Failed to load .env:", err.message);
  }
}
loadEnv();

// ------------------
// Date utilities
// ------------------
function formatDateYYYYMMDD(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function addDays(date, days) {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

// ------------------
// CloudOcean API
// ------------------
class CloudOceanAPI {
  constructor(apiKey) {
    this.apiKey = apiKey || process.env.API_Key;
    this.baseUrl = process.env.CLOUD_OCEAN_BASE_URL || "https://api.develop.rve.ca";
  }

  async fetchWithRetry(url, options = {}, maxAttempts = 5) {
    let attempt = 0;
    let delay = 2000;
    while (attempt < maxAttempts) {
      try {
        const res = await fetch(url, options);
        if (res.ok) return await res.json();

        if (res.status >= 500) {
          console.warn(`⚠️ Server error ${res.status}, retrying in ${delay / 1000}s...`);
          await new Promise(r => setTimeout(r, delay));
          attempt++;
          delay *= 2; // exponential backoff
        } else {
          console.error(`❌ Failed request: ${res.status} ${res.statusText}`);
          return null;
        }
      } catch (err) {
        console.warn(`⚠️ Fetch error: ${err.message}, retrying in ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
        attempt++;
        delay *= 2;
      }
    }
    console.error(`❌ Giving up after ${maxAttempts} attempts`);
    return null;
  }

  async getModuleConsumption({ module_uuid, measuring_point_uuids, start_date, end_date }) {
    const results = [];

    for (const point_uuid of measuring_point_uuids) {
      const url = `${this.baseUrl.replace(/\/$/, "")}/v1/modules/${module_uuid}/measuring-points/${point_uuid}/reads?start=${encodeURIComponent(start_date.toISOString())}&end=${encodeURIComponent(end_date.toISOString())}&limit=50&offset=0`;

      console.log("➡️  Requesting:", url);

      const data = await this.fetchWithRetry(url, {
        headers: {
          "Content-Type": "application/json",
          "Access-Token": `Bearer ${this.apiKey}`,
          Accept: "application/json",
        },
      });

      results.push({ point_uuid, data });
    }

    return results;
  }
}

// ------------------
// Postgres utilities
// ------------------
async function safeConnect(dbUrl) {
  if (!dbUrl) {
    console.warn("⚠️ NETLIFY_DATABASE_URL not set, skipping DB connection");
    return null;
  }

  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    return client;
  } catch (err) {
    console.warn(`⚠️ Could not connect to PostgreSQL: ${err.message}`);
    return null;
  }
}

async function withTransaction(client, fn) {
  if (!client) return fn();
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

// ------------------
// Schema / Inserts
// ------------------
async function createSchema(client) {
  if (!client) return;
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
  if (!client) return Math.floor(Math.random() * 1000); // fake ID
  const res = await client.query(
    `INSERT INTO devices (model_number, serial_number, location, status, max_amperage, evse_count)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [device.model_number, device.serial_number, device.location, device.status, device.max_amperage, device.evse_count]
  );
  return res.rows[0].id;
}

async function insertConsumptionRecord(client, record) {
  if (!client) return;
  await client.query(
    `INSERT INTO consumption_records (device_id, timestamp, kwh_consumption, rate) VALUES ($1,$2,$3,$4)`,
    [record.device_id, record.timestamp, record.kwh_consumption, record.rate]
  );
}

async function insertInvoice(client, invoice) {
  if (!client) return;
  await client.query(
    `INSERT INTO invoices (device_id, invoice_number, billing_period_start, billing_period_end, total_kwh, total_amount, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [invoice.device_id, invoice.invoice_number, invoice.billing_period_start, invoice.billing_period_end, invoice.total_kwh, invoice.total_amount, invoice.status]
  );
}

// ------------------
// Main sync function
// ------------------
export async function sync_real_data() {
  const dbUrl = process.env.NETLIFY_DATABASE_URL;
  const apiKey = process.env.API_Key;

  const client = await safeConnect(dbUrl);

  try {
    await withTransaction(client, async () => { await createSchema(client); });

    const cloudOcean = new CloudOceanAPI(apiKey);

    const measuring_points = [
      { uuid: "71ef9476-3855-4a3f-8fc5-333cfbf9e898", location: "Building A - Level 1" },
      { uuid: "fd7e69ef-cd01-4b9a-8958-2aa5051428d4", location: "Building A - Level 2" },
      { uuid: "b7423cbc-d622-4247-bb9a-8d125e5e2351", location: "Building B - Parking Garage" },
      { uuid: "88f4f9b6-ce65-48c4-86e6-1969a64ad44c", location: "Building B - Ground Floor" },
    ];

    const devices = [];
    await withTransaction(client, async () => {
      for (const mp of measuring_points) {
        const id = await insertDevice(client, {
          model_number: "SMP-901",
          serial_number: mp.uuid.slice(0, 8).toUpperCase(),
          location: mp.location,
          status: "active",
          max_amperage: 32,
          evse_count: 2,
        });
        devices.push({ id, location: mp.location });
      }
    });

    console.log(`✅ Created ${devices.length} devices`);

    const start_date = new Date("2024-10-16T00:00:00Z");
    const end_date = new Date("2024-11-25T00:00:00Z");

    const real_consumption = await cloudOcean.getModuleConsumption({
      module_uuid: "c667ff46-9730-425e-ad48-1e950691b3f9",
      measuring_point_uuids: measuring_points.map(mp => mp.uuid),
      start_date,
      end_date,
    });

    const has_real_data = real_consumption.some(r => r.data && r.data.length > 0);

    if (has_real_data) {
      console.log("🎉 Real consumption data received");
      // Insert real consumption into DB if client is available
      await withTransaction(client, async () => {
        for (const r of real_consumption) {
          for (const record of r.data) {
            await insertConsumptionRecord(client, {
              device_id: devices.find(d => d.location === measuring_points.find(mp => mp.uuid === r.point_uuid).location).id,
              timestamp: record.timestamp,
              kwh_consumption: record.kwh,
              rate: record.rate,
            });
          }
        }
      });
    } else {
      console.warn("⚠️ No real data, generating demo data");
      // Demo generation
      for (const device of devices) {
        for (let i = 0; i < 10; i++) {
          const timestamp = addDays(start_date, i);
          await insertConsumptionRecord(client, {
            device_id: device.id,
            timestamp,
            kwh_consumption: Math.random() * 10,
            rate: 0.2,
          });
        }
      }
    }

    console.log("✅ Sync finished");
    return true;
  } catch (err) {
    console.error("❌ Error during sync:", err.message);
    return false;
  } finally {
    if (client) {
      try { await client.end(); } catch (_) {}
    }
  }
}

// ------------------
// Run if main
// ------------------
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const success = await sync_real_data();
  process.exit(success ? 0 : 1);
}
