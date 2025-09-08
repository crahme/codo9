// sync_real_data.mjs
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Client } from "pg";
import fetch from "node-fetch"; // ✅ ensure node-fetch v3+ installed

// ----------------- ENV LOADER -----------------
function loadEnv() {
  try {
    const envPath = path.join(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      for (const line of content.split(/\r?\n/)) {
        if (!line || line.trim().startsWith("#")) continue;
        const [key, ...rest] = line.split("=");
        if (!key) continue;
        process.env[key.trim()] = process.env[key.trim()] || rest.join("=").trim().replace(/^"|"$/g, "");
      }
    }
  } catch (err) {
    console.warn("Warning: failed to parse .env file:", err.message);
  }
}
loadEnv();

// ----------------- DATE HELPERS -----------------
function formatDateYYYYMMDD(d) {
  return d.toISOString().split("T")[0];
}
function addDays(date, days) {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

// ----------------- RETRY HELPER -----------------
async function retry(fn, attempts = 5, initialDelay = 2000) {
  let delay = initialDelay;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === attempts - 1) throw err;
      console.warn(`⚠️ ${err.message}, retrying in ${Math.round(delay/1000)}s...`);
      await new Promise(r => setTimeout(r, delay));
      delay *= 2;
    }
  }
}

// ----------------- CLOUD OCEAN API -----------------
class CloudOceanAPI {
  constructor(apiKey, baseUrl) {
    this.apiKey = process.env.API_Key;
    this.baseUrl = baseUrl || process.env.CLOUD_OCEAN_BASE_URL || "https://api.develop.rve.ca/v1";
  }

  async getModuleConsumption({ module_uuid, measuring_point_uuids, start_date, end_date }) {
    const result = {};
    for (const id of measuring_point_uuids) result[id] = 0;
    if (!this.apiKey) return result;

    const url = `${this.baseUrl}/modules/${module_uuid}/consumption`;
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
            Authorization: `Bearer ${this.apiKey}`,
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

// ----------------- POSTGRES HELPERS -----------------
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

// Keep createSchema, insertDevice, insertConsumptionRecord, insertInvoice, queryCount
// same as original snippet above

// ----------------- MAIN SYNC FUNCTION -----------------
export async function sync_real_data() {
  const apiKey = process.env.API_Key;
  const dbUrl = process.env.NETLIFY_DATABASE_URL;
  if (!dbUrl) {
    console.error("NETLIFY_DATABASE_URL is required");
    return false;
  }

  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    await withTransaction(client, () => createSchema(client));

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

    const real_consumption = await cloud_ocean.getModuleConsumption({
      module_uuid,
      measuring_point_uuids: measuring_points.map(mp => mp.uuid),
      start_date,
      end_date,
    });

    const has_real_data = Object.values(real_consumption).some(v => v > 0);

    if (has_real_data) {
      console.log("✅ Real data retrieved, populating consumption...");
      // Populate consumption records as before
    } else {
      console.warn("⚠️ No real data, generating demo consumption records...");
      // Populate demo records as before
    }

    // Generate invoices, summary, and device mapping as in original code

    return true;
  } catch (err) {
    console.error("Error syncing data:", err.message);
    return false;
  } finally {
    await client.end();
  }
}

// ----------------- RUN DIRECTLY -----------------
const isMain = path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url);
if (isMain) {
  const success = await sync_real_data();
  console.log(success ? "✅ Data sync completed successfully!" : "❌ Data sync failed!");
  process.exit(success ? 0 : 1);
}
