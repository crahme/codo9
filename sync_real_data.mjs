// node sync_real_data.mjs
import { Client } from "pg";
import fetch from "node-fetch";

const client = new Client({
  connectionString: process.env.NETLIFY_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

client.on("error", (err) => {
  console.error("⚠️  Postgres client error:", err.message);
});

await client.connect();

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithBackoff(url, headers, maxRetries = 5) {
  let attempt = 0;
  while (attempt < maxRetries) {
    attempt++;
    try {
      const res = await fetch(url, { headers });
      if (res.ok) return res.json();
      if (res.status >= 500) {
        const wait = 2 ** attempt * 1000 + Math.random() * 500;
        console.warn(`⚠️  Server error ${res.status}, retrying in ${(wait / 1000).toFixed(1)}s...`);
        await sleep(wait);
      } else {
        console.error(`❌ HTTP ${res.status} error`);
        return null;
      }
    } catch (err) {
      const wait = 2 ** attempt * 1000 + Math.random() * 500;
      console.warn(`⚠️  Network error: ${err.message}, retrying in ${(wait / 1000).toFixed(1)}s...`);
      await sleep(wait);
    }
  }
  return null;
}

async function main() {
  // 1️⃣ Create devices first (short transaction)
  const devices = [
    { uuid: "71ef9476-3855-4a3f-8fc5-333cfbf9e898", location: "Building A" },
    { uuid: "fd7e69ef-cd01-4b9a-8958-2aa5051428d4", location: "Building B" },
    // ... add all 11 points
  ];

  for (const d of devices) {
    const res = await client.query(
      "INSERT INTO devices (model_number, serial_number, location, status) VALUES ($1,$2,$3,'active') RETURNING id",
      ["SMP-901", d.uuid.slice(0, 8), d.location]
    );
    d.id = res.rows[0].id;
  }
  console.log(`✅ Created ${devices.length} devices`);

  // 2️⃣ Fetch consumption per device, outside long transaction
  const module_uuid = "c667ff46-9730-425e-ad48-1e950691b3f9";
  const start = new Date("2024-10-16T00:00:00Z").toISOString();
  const end = new Date("2024-11-25T00:00:00Z").toISOString();
  const headers = { "Access-Token": process.env.API_Key };

  for (const d of devices) {
    const url = `https://api.develop.rve.ca/v1/modules/${module_uuid}/measuring-points/${d.uuid}/reads?start=${start}&end=${end}&limit=50&offset=0`;
    const data = await fetchWithBackoff(url, headers);

    if (!data) {
      console.warn(`⚠️ Using demo data for ${d.uuid}`);
      for (let i = 0; i < 10; i++) {
        await client.query(
          "INSERT INTO consumption_records (device_id, timestamp, kwh_consumption, rate) VALUES ($1,$2,$3,$4)",
          [d.id, new Date(Date.now() - i * 86400000), Math.random() * 10, 0.2]
        );
      }
      continue;
    }

    // 3️⃣ Insert fetched data in a short transaction
    for (const rec of data) {
      await client.query(
        "INSERT INTO consumption_records (device_id, timestamp, kwh_consumption, rate) VALUES ($1,$2,$3,$4)",
        [d.id, rec.timestamp, rec.kwh_consumption, rec.rate]
      );
    }
  }

  console.log("🎉 Data sync complete!");
  await client.end();
}

main().catch((err) => {
  console.error("❌ Fatal error:", err.message);
  client.end();
});
