// sync_real_data.mjs
// Translated from the provided Python script to ES Module JavaScript.
// Uses environment variables: API_Key and NETLIFY_DATABASE_URL
// - API_Key: for Cloud Ocean API
// - NETLIFY_DATABASE_URL: Postgres connection string
// Includes a lightweight .env loader to populate process.env if needed.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Client } from "pg";

function loadEnv() {
  // Lightweight .env loader in case the environment variables aren't already set
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
        if (!(key in process.env)) {
          process.env[key] = val;
        }
      }
    }
  } catch (err) {
    console.warn("Warning: failed to parse .env file:", err.message);
  }
}

loadEnv();

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

class CloudOceanAPI {
  constructor(apiKey) {
    this.apiKey = process.env.API_Key;
    // Optional: allow overriding base URL via env if available
    this.baseUrl = process.env.CLOUD_OCEAN_BASE_URL || null;
  }

  async getModuleConsumption({ module_uuid, measuring_point_uuids, start_date, end_date }) {
    // Returns an object mapping measuring_point_uuid -> total_consumption_kwh
    // If no real API is configured, gracefully return zeros, so the demo path runs.
    const result = {};
    for (const id of measuring_point_uuids) result[id] = 0;

    if (!this.baseUrl || !this.apiKey || typeof fetch === "undefined") {
      return result; // Fallback to zero data
    }

    try {
      const url = `${this.baseUrl.replace(/\/$/, "")}/module/consumption`;
      const body = {
        module_uuid,
        measuring_point_uuids,
        start_date: formatDateYYYYMMDD(start_date),
        end_date: formatDateYYYYMMDD(end_date),
      };
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Access-Token": `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        console.warn(`CloudOcean API request failed with status ${res.status}`);
        return result;
      }
      const data = await res.json();
      // Expecting data in shape { [uuid]: number }
      if (data && typeof data === "object") {
        for (const id of measuring_point_uuids) {
          if (typeof data[id] === "number") result[id] = data[id];
        }
      }
      return result;
    } catch (err) {
      console.warn("CloudOcean API request error:", err.message);
      return result;
    }
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
  // Drop in dependency order
  await client.query(`
    DROP TABLE IF EXISTS consumption_records;
    DROP TABLE IF EXISTS invoices;
    DROP TABLE IF EXISTS devices;
  `);

  // Create tables
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
    [
      device.model_number,
      device.serial_number,
      device.location,
      device.status,
      device.max_amperage,
      device.evse_count,
    ]
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
    [
      invoice.device_id,
      invoice.invoice_number,
      invoice.billing_period_start,
      invoice.billing_period_end,
      invoice.total_kwh,
      invoice.total_amount,
      invoice.status,
    ]
  );
}

async function queryCount(client, table) {
  const res = await client.query(`SELECT COUNT(*) AS c FROM ${table}`);
  return Number(res.rows[0].c);
}

export async function sync_real_data() {
  const apiKey = process.env.API_Key; // Use provided environment variable name
  const dbUrl = process.env.NETLIFY_DATABASE_URL;

  if (!dbUrl) {
    console.error("Environment variable NETLIFY_DATABASE_URL is required.");
    return false;
  }

  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();

    await withTransaction(client, async () => {
      await createSchema(client);
    });

    // Initialize API client
    const cloud_ocean = new CloudOceanAPI(apiKey);

    // Configure all measuring points with data from Cloud Ocean
    const module_uuid = "c667ff46-9730-425e-ad48-1e950691b3f9";
    const measuring_points = [
      { uuid: "71ef9476-3855-4a3f-8fc5-333cfbf9e898", name: "EV Charger Station 01", location: "Building A - Level 1" },
      { uuid: "fd7e69ef-cd01-4b9a-8958-2aa5051428d4", name: "EV Charger Station 02", location: "Building A - Level 2" },
      { uuid: "b7423cbc-d622-4247-bb9a-8d125e5e2351", name: "EV Charger Station 03", location: "Building B - Parking Garage" },
      { uuid: "88f4f9b6-ce65-48c4-86e6-1969a64ad44c", name: "EV Charger Station 04", location: "Building B - Ground Floor" },
      { uuid: "df428bf7-dd2d-479c-b270-f8ac5c1398dc", name: "EV Charger Station 05", location: "Building C - East Wing" },
      { uuid: "7744dcfc-a059-4257-ac96-6650feef9c87", name: "EV Charger Station 06", location: "Building C - West Wing" },
      { uuid: "b1445e6d-3573-403a-9f8e-e82f70556f7c", name: "EV Charger Station 07", location: "Building D - Main Entrance" },
      { uuid: "ef296fba-4fcc-4dcb-8eda-e6d1772cd819", name: "EV Charger Station 08", location: "Building D - Loading Dock" },
      { uuid: "50206eae-41b8-4a84-abe4-434c7f79ae0a", name: "EV Charger Station 09", location: "Outdoor Lot - Section A" },
      { uuid: "de2d9680-f132-4529-b9a9-721265456a86", name: "EV Charger Station 10", location: "Outdoor Lot - Section B" },
      { uuid: "bd36337c-8139-495e-b026-f987b79225b8", name: "EV Charger Station 11", location: "Visitor Parking - Main Gate" },
    ];

    // Create devices with real UUIDs-derived serial numbers
    const devices = [];
    await withTransaction(client, async () => {
      for (const mp of measuring_points) {
        const serial = mp.uuid.slice(0, 8).toUpperCase();
        const device = {
          model_number: "SMP-901",
          serial_number: serial,
          location: mp.location,
          status: "active",
          max_amperage: 32.0,
          evse_count: 2,
        };
        const id = await insertDevice(client, device);
        devices.push({ id, ...device });
      }
    });

    console.log(`Created ${devices.length} devices with real measuring point UUIDs`);

    // Date range (explicit YYYY-MM-DD) inclusive: 2024-10-16 to 2024-11-25
    const START_DATE_STR = "2024-10-16";
    const END_DATE_STR = "2024-11-25";
    const start_date = new Date(`${START_DATE_STR}T00:00:00Z`);
    const end_date = new Date(`${END_DATE_STR}T00:00:00Z`);
    const TOTAL_DAYS = Math.floor((end_date - start_date) / (24 * 60 * 60 * 1000)) + 1;

    console.log(
      `Attempting to fetch real data from ${formatDateYYYYMMDD(start_date)} to ${formatDateYYYYMMDD(end_date)}`
    );

    // Real consumption
    const measuring_point_uuids = measuring_points.map((mp) => mp.uuid);
    const real_consumption = await cloud_ocean.getModuleConsumption({
      module_uuid,
      measuring_point_uuids,
      start_date,
      end_date,
    });

    const has_real_data = Object.values(real_consumption).some((v) => Number(v) > 0);

    if (has_real_data) {
      console.log("SUCCESS: Retrieved real consumption data from Cloud Ocean API!");
      console.log("Real consumption data:", real_consumption);

      await withTransaction(client, async () => {
        for (let i = 0; i < devices.length; i++) {
          const device = devices[i];
          const mp_uuid = measuring_points[i].uuid;
          const total_consumption = Number(real_consumption[mp_uuid] || 0);
          if (total_consumption > 0) {
            const daily_consumption = total_consumption / TOTAL_DAYS;
            for (let d = 0; d < TOTAL_DAYS; d++) {
              const record_date = addDays(start_date, d);
              const variation = 0.8 + (d % 5) * 0.1; // 0.8 to 1.2
              const consumption = daily_consumption * variation;
              await insertConsumptionRecord(client, {
                device_id: device.id,
                timestamp: formatDateYYYYMMDD(record_date),
                kwh_consumption: Number(consumption.toFixed(2)),
                rate: 0.12,
              });
            }
          }
        }
      });

      console.log("Created consumption records based on real API data");
    } else {
      console.warn("WARNING: API returned zero consumption for all measuring points");
      console.warn("This could mean:");
      console.warn("1. No actual consumption data in the specified time period");
      console.warn("2. API authentication issues");
      console.warn("3. Insufficient permissions for the API key");
      console.warn("4. Different date format or endpoint requirements");

      console.log("Creating demonstration records to show system functionality...");

      await withTransaction(client, async () => {
        for (const device of devices) {
          for (let i = 0; i < TOTAL_DAYS; i++) { // inclusive days from 2024-10-16 to 2024-11-25
            const record_date = addDays(start_date, i);

            const base_consumption_map = {
              "Building A": 45.0,
              "Building B": 38.0,
              "Building C": 42.0,
              "Building D": 35.0,
              "Outdoor Lot": 30.0,
              "Visitor Parking": 25.0,
            };

            const location_key = String(device.location).split(" - ")[0];
            const daily_base = base_consumption_map[location_key] ?? 35.0;

            const day_variation = 0.8 + (i % 7) * 0.1; // Weekly pattern
            const device_variation = 0.9 + (device.id % 3) * 0.2; // Device-specific
            const random_variation = 0.85 + (i % 4) * 0.15; // Daily randomness

            const consumption = daily_base * day_variation * device_variation * random_variation;

            await insertConsumptionRecord(client, {
              device_id: device.id,
              timestamp: formatDateYYYYMMDD(record_date),
              kwh_consumption: Number(consumption.toFixed(2)),
              rate: 0.12,
            });
          }
        }
      });

      console.log("Created demonstration consumption records");
    }

    // Create invoices for October and November 2024
    const invoices = [];

    const monthPeriods = [
      { start: "2024-10-01", end: "2024-10-31", suffix: "202410" },
      { start: "2024-11-01", end: "2024-11-25", suffix: "202411" }, // Match our data range
    ];

    for (const device of devices) {
      for (const period of monthPeriods) {
        const res = await client.query(
          `SELECT kwh_consumption FROM consumption_records
           WHERE device_id = $1 AND timestamp >= $2 AND timestamp <= $3`,
          [device.id, period.start, period.end]
        );
        const total_kwh = res.rows.reduce((sum, r) => sum + Number(r.kwh_consumption || 0), 0);
        const total_amount = Number((total_kwh * 0.12).toFixed(2));

        invoices.push({
          device_id: device.id,
          invoice_number: `INV-${device.serial_number}-${period.suffix}`,
          billing_period_start: period.start,
          billing_period_end: period.end,
          total_kwh,
          total_amount,
          status: "pending",
        });
      }
    }

    await withTransaction(client, async () => {
      for (const inv of invoices) {
        await insertInvoice(client, inv);
      }
    });

    console.log(`Created ${invoices.length} invoices`);

    // Summary
    const deviceCount = await queryCount(client, "devices");
    const recordCount = await queryCount(client, "consumption_records");
    const invoiceCount = await queryCount(client, "invoices");

    const totalConsumptionRes = await client.query(
      `SELECT COALESCE(SUM(kwh_consumption), 0) AS total FROM consumption_records`
    );
    const totalConsumption = Number(totalConsumptionRes.rows[0].total || 0);

    console.log("\n==================================================");
    console.log("DATABASE SYNC COMPLETE");
    console.log("==================================================");
    console.log(`Total devices: ${deviceCount}`);
    console.log(`Total consumption records: ${recordCount}`);
    console.log(`Total invoices: ${invoiceCount}`);
    console.log(`Total consumption: ${totalConsumption.toFixed(2)} kWh`);

    console.log("\nDevice Mappings:");
    const deviceMapRes = await client.query(
      `SELECT serial_number, location FROM devices ORDER BY id`
    );
    for (const row of deviceMapRes.rows) {
      console.log(`  ${row.serial_number}: ${row.location}`);
    }

    return true;
  } catch (err) {
    console.error("Error syncing data:", err.message);
    return false;
  } finally {
    try { await client.end(); } catch (_) {}
  }
}

// Run if invoked directly
const isMain = (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url));
if (isMain) {
  const success = await sync_real_data();
  if (success) {
    console.log("\n✅ Data sync completed successfully!");
    process.exit(0);
  } else {
    console.log("\n❌ Data sync failed!");
    process.exit(1);
  }
}
