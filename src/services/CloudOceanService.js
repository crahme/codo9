// // src/services/CloudOceanService.js
// import dotenv from "dotenv";
// import path from "path";
// import { fileURLToPath } from "url";

// dotenv.config();

// // Simple logger
// const logger = {
//   info: (...args) => console.log("[INFO]", ...args),
//   warn: (...args) => console.warn("[WARN]", ...args),
//   error: (...args) => console.error("[ERROR]", ...args),
// };

// export class CloudOceanService {
//   constructor() {
//     this.baseUrl = "https://api.develop.rve.ca/v1";
//     this.moduleId = "c667ff46-9730-425e-ad48-1e950691b3f9";
//     this.headers = {
//       "Access-Token": `${process.env.API_Key}`, // use your actual env var
//       "Content-Type": "application/json",
//     };
//     this.maxRetries = 3;
//     this.baseDelay = 4000;
//   }

//   async sleep(ms) {
//     return new Promise((resolve) => setTimeout(resolve, ms));
//   }

//   async fetchWithExponentialBackoff(url, options, attempt = 1) {
//     try {
//       const response = await fetch(url, options);
//       const data = await response.json();

//       if (!response.ok) {
//         logger.warn(
//           `Request failed (${response.status}): ${JSON.stringify(data)}`
//         );

//         if (response.status === 503 && attempt < this.maxRetries) {
//           const delay = this.baseDelay * Math.pow(2, attempt - 1);
//           logger.info(
//             `Retrying in ${delay / 1000}s... (attempt ${attempt}/${this.maxRetries})`
//           );
//           await this.sleep(delay);
//           return this.fetchWithExponentialBackoff(url, options, attempt + 1);
//         }

//         throw new Error(
//           `HTTP ${response.status}: ${data.detail || response.statusText}`
//         );
//       }

//       return data;
//     } catch (error) {
//       if (error.name === "TypeError" && attempt < this.maxRetries) {
//         const delay = this.baseDelay * Math.pow(2, attempt - 1);
//         logger.info(
//           `Network error, retrying in ${delay / 1000}s... (attempt ${attempt}/${this.maxRetries})`
//         );
//         await this.sleep(delay);
//         return this.fetchWithExponentialBackoff(url, options, attempt + 1);
//       }
//       throw error;
//     }
//   }

//   async getConsumptionData(startDate, endDate, limit = 50, offset = 0) {
//     const measuringPoints = [
//       { uuid: "71ef9476-3855-4a3f-8fc5-333cfbf9e898", name: "EV Charger Station 01", location: "Building A - Level 1" },
//       { uuid: "fd7e69ef-cd01-4b9a-8958-2aa5051428d4", name: "EV Charger Station 02", location: "Building A - Level 2" },
//       { uuid: "b7423cbc-d622-4247-bb9a-8d125e5e2351", name: "EV Charger Station 03", location: "Building B - Parking Garage" },
//       { uuid: "88f4f9b6-ce65-48c4-86e6-1969a64ad44c", name: "EV Charger Station 04", location: "Building B - Ground Floor" },
//       { uuid: "df428bf7-dd2d-479c-b270-f8ac5c1398dc", name: "EV Charger Station 05", location: "Building C - East Wing" },
//       { uuid: "7744dcfc-a059-4257-ac96-6650feef9c87", name: "EV Charger Station 06", location: "Building C - West Wing" },
//       { uuid: "b1445e6d-3573-403a-9f8e-e82f70556f7c", name: "EV Charger Station 07", location: "Building D - Main Entrance" },
//       { uuid: "ef296fba-4fcc-4dcb-8eda-e6d1772cd819", name: "EV Charger Station 08", location: "Building D - Loading Dock" },
//       { uuid: "50206eae-41b8-4a84-abe4-434c7f79ae0a", name: "EV Charger Station 09", location: "Outdoor Lot - Section A" },
//       { uuid: "de2d9680-f132-4529-b9a9-721265456a86", name: "EV Charger Station 10", location: "Outdoor Lot - Section B" },
//       { uuid: "bd36337c-8139-495e-b026-f987b79225b8", name: "EV Charger Station 11", location: "Visitor Parking - Main Gate" },
//     ];

//     const consumptionData = [];
//     const totalStations = measuringPoints.length;

//     for (const point of measuringPoints) {
//       try {
//         logger.info(`Fetching data for ${point.name} (${point.location})`);

//         const url = new URL(
//           `${this.baseUrl}/modules/${this.moduleId}/measuring-points/${point.uuid}/reads`
//         );
//         url.searchParams.set("start", startDate);
//         url.searchParams.set("end", endDate);
//         url.searchParams.set("limit", limit.toString());
//         url.searchParams.set("offset", offset.toString());

//         const data = await this.fetchWithExponentialBackoff(url.toString(), {
//           method: "GET",
//           headers: this.headers,
//         });

//         if (Array.isArray(data) && data.length > 0) {
//           const sortedReads = data.sort(
//             (a, b) => new Date(a.time_stamp) - new Date(b.time_stamp)
//           );

//           const consumption = Math.max(
//             0,
//             sortedReads[sortedReads.length - 1].cumulative_kwh - sortedReads[0].cumulative_kwh
//           );

//           consumptionData.push({
//             uuid: point.uuid,
//             name: point.name,
//             location: point.location,
//             consumption,
//             readings: sortedReads.map(r => ({ timestamp: r.time_stamp, value: r.cumulative_kwh })),
//           });

//           logger.info(`${point.name}: ${consumption.toFixed(2)} kWh`);
//         }
//       } catch (err) {
//         logger.error(`Failed for ${point.name}: ${err.message}`);
//       }
//     }

//     if (consumptionData.length === 0) {
//       throw new Error("No consumption data fetched.");
//     }

//     logger.info(`Fetched data for ${consumptionData.length}/${totalStations} stations`);
//     return consumptionData;
//   }

//   calculateTotals(consumptionData) {
//     const totalConsumption = consumptionData.reduce((sum, s) => sum + s.consumption, 0);
//     return { totalConsumption, totalAmount: totalConsumption * (process.env.RATE_PER_KWH || 0.15) };
//   }
// }

// // 🏃 Runner: executes when file is run directly
// const __filename = fileURLToPath(import.meta.url);
// if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
//   const service = new CloudOceanService();

//   (async () => {
//     try {
//       console.log("[INFO] Runner started ✅");
//       console.log("[INFO] Using API Key:", !!process.env.API_Key);

//       const data = await service.getConsumptionData("2024-10-16", "2024-11-25");

//       console.log("\n📊 Consumption Data:");
//       console.table(data.map(station => ({
//         Name: station.name,
//         Location: station.location,
//         Consumption_kWh: station.consumption.toFixed(2),
//       })));

//       const totals = service.calculateTotals(data);
//       console.log("\n⚡ Totals:");
//       console.log(`Total Consumption: ${totals.totalConsumption.toFixed(2)} kWh`);
//       console.log(`Total Amount: $${totals.totalAmount.toFixed(2)}`);
//     } catch (err) {
//       console.error("❌ Runner error:", err.message);
//     }
//   })();
// }
// src/services/CloudOceanService.js
// src/services/CloudOceanService.js
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

class CloudOceanService {
  constructor() {
    this.apiKey = process.env.API_Ke;
    this.baseUrl = process.env.CLOUD_OCEAN_BASE_URL;
    this.measuringPoints = [
      { id: "station-01", name: "EV Charger Station 01", location: "Building A - Level 1" },
      { id: "station-02", name: "EV Charger Station 02", location: "Building A - Level 2" },
      { id: "station-03", name: "EV Charger Station 03", location: "Building B - Parking Garage" },
      { id: "station-04", name: "EV Charger Station 04", location: "Building B - Ground Floor" },
      { id: "station-05", name: "EV Charger Station 05", location: "Building C - East Wing" },
      { id: "station-06", name: "EV Charger Station 06", location: "Building C - West Wing" },
      { id: "station-07", name: "EV Charger Station 07", location: "Building D - Main Entrance" },
      { id: "station-08", name: "EV Charger Station 08", location: "Building D - Loading Dock" },
      { id: "station-09", name: "EV Charger Station 09", location: "Outdoor Lot - Section A" },
      { id: "station-10", name: "EV Charger Station 10", location: "Outdoor Lot - Section B" },
      { id: "station-11", name: "EV Charger Station 11", location: "Visitor Parking - Main Gate" },
    ];
  }

  async fetchCDRs(startDate, endDate) {
    console.info("[INFO] Runner started ✅");
    console.info("[INFO] Using API Key:", !!this.apiKey);

    const results = [];

    for (const mp of this.measuringPoints) {
      try {
        console.info(`[INFO] Fetching CDRs for ${mp.name} (${mp.location})`);

        const url = `${this.baseUrl}/cdr?measuringPointId=${mp.id}&start=${startDate}&end=${endDate}`;
        const res = await fetch(url, {
          headers: { "Access-Token": ` ${this.apiKey}` },
        });

        if (!res.ok) {
          const errText = await res.text();
          console.warn(`[WARN] Request failed (${res.status}): ${errText}`);
          throw new Error(`HTTP ${res.status}: ${errText}`);
        }

        const cdrs = await res.json();

        // 👇 Debug dump of first CDR to inspect schema
        if (cdrs && cdrs.length > 0) {
          console.log("🔍 First CDR sample for", mp.name, ":", JSON.stringify(cdrs[0], null, 2));
        }

        // Keep for now: placeholder aggregation until we know schema
        const totalKwh = 0.0;
        const totalAmount = 0.0;

        console.info(`[INFO] ${mp.name}: ${totalKwh.toFixed(2)} kWh (${cdrs.length} sessions)`);

        results.push({
          ...mp,
          sessions: cdrs.length,
          totalKwh,
          totalAmount,
          raw: cdrs, // keep raw for debugging if needed
        });
      } catch (err) {
        console.error(`[ERROR] Failed for ${mp.name}: ${err.message}`);
      }
    }

    if (results.every(r => r.sessions === 0)) {
      throw new Error("Runner error: No CDR data fetched for any measuring points.");
    }

    return results;
  }
}

export const cloudOceanService = new CloudOceanService();
export default cloudOceanService;
