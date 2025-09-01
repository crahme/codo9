import axios from "axios";

// ==================== CONFIG ====================
const BASE_URL = process.env.CLOUD_OCEAN_BASE_URL; // Adjust if different
const API_KEY = process.env.API_Key;  // Set your API key in env
const MODULE_UUID = "c667ff46-9730-425e-ad48-1e950691b3f9";

const START = "2024-10-16";
const END = "2024-11-25";

// ==================== MEASURING POINTS ====================
const MEASURING_POINTS = [
  { uuid: '71ef9476-3855-4a3f-8fc5-333cfbf9e898', name: 'EV Charger Station 01', location: 'Building A - Level 1' },
  { uuid: 'fd7e69ef-cd01-4b9a-8958-2aa5051428d4', name: 'EV Charger Station 02', location: 'Building A - Level 2' },
  { uuid: 'b7423cbc-d622-4247-bb9a-8d125e5e2351', name: 'EV Charger Station 03', location: 'Building B - Parking Garage' },
  { uuid: '88f4f9b6-ce65-48c4-86e6-1969a64ad44c', name: 'EV Charger Station 04', location: 'Building B - Ground Floor' },
  { uuid: 'df428bf7-dd2d-479c-b270-f8ac5c1398dc', name: 'EV Charger Station 05', location: 'Building C - East Wing' },
  { uuid: '7744dcfc-a059-4257-ac96-6650feef9c87', name: 'EV Charger Station 06', location: 'Building C - West Wing' },
  { uuid: 'b1445e6d-3573-403a-9f8e-e82f70556f7c', name: 'EV Charger Station 07', location: 'Building D - Main Entrance' },
  { uuid: 'ef296fba-4fcc-4dcb-8eda-e6d1772cd819', name: 'EV Charger Station 08', location: 'Building D - Loading Dock' },
  { uuid: '50206eae-41b8-4a84-abe4-434c7f79ae0a', name: 'EV Charger Station 09', location: 'Outdoor Lot - Section A' },
  { uuid: 'de2d9680-f132-4529-b9a9-721265456a86', name: 'EV Charger Station 10', location: 'Outdoor Lot - Section B' },
  { uuid: 'bd36337c-8139-495e-b026-f987b79225b8', name: 'EV Charger Station 11', location: 'Visitor Parking - Main Gate' },
];

// ==================== API CLIENT ====================
const client = axios.create({
  baseURL: BASE_URL,
  headers: {
    Authorization: `Bearer ${API_KEY}`, // ✅ Use Authorization header
    "Content-Type": "application/json",
  },
});

// ==================== MAIN FUNCTION ====================
async function main() {
  console.log("🔎 Fetching reads & CDR for predefined measuring points");
  console.log({ moduleUuid: MODULE_UUID, start: START, end: END });

  let totalReads = 0;
  let totalCdr = 0;
  let totalKwh = 0;

  for (const mp of MEASURING_POINTS) {
    const mpUuid = mp.uuid;

    console.log(`\n📌 Measuring point: ${mpUuid} (${mp.name}) @ ${mp.location}`);

    // ========== Reads ==========
    let reads = [];
    try {
      const res = await client.get(
        `/v1/modules/${MODULE_UUID}/measuring-points/${mpUuid}/reads`,
        { params: { start: START, end: END, limit: 1000, offset: 0 } }
      );
      reads = res.data?.data || [];
      console.log(`   ✅ Reads: ${reads.length}`);
    } catch (e) {
      console.warn(`   ❌ Failed to fetch reads: ${e.message}`);
    }

    // ========== CDR ==========
    let cdr = [];
    try {
      const res = await client.get(
        `/v1/modules/${MODULE_UUID}/measuring-points/${mpUuid}/cdr`,
        { params: { start: START, end: END, limit: 1000, offset: 0 } }
      );
      cdr = res.data?.data || [];
      console.log(`   ✅ CDR: ${cdr.length}`);
    } catch (e) {
      console.warn(`   ❌ Failed to fetch CDR: ${e.message}`);
    }

    // ========== kWh ==========
    const mpKwh = reads.reduce(
      (sum, r) => sum + parseFloat(r.consumption || 0),
      0
    );

    totalReads += reads.length;
    totalCdr += cdr.length;
    totalKwh += mpKwh;

    console.log(`   🔋 kWh: ${mpKwh}`);
  }

  // ==================== SUMMARY ====================
  console.log("\n📊 SUMMARY");
  console.log(`  Total measuring points: ${MEASURING_POINTS.length}`);
  console.log(`  Total reads: ${totalReads}`);
  console.log(`  Total CDR: ${totalCdr}`);
  console.log(`  Total kWh: ${totalKwh}`);
}

// ==================== RUN ====================
main().catch((err) => {
  console.error("❌ Script failed:", err.message);
});
