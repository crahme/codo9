// src/services/CloudOceanService.js
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const logger = {
  info: (...args) => console.log("[INFO]", ...args),
  warn: (...args) => console.warn("[WARN]", ...args),
  error: (...args) => console.error("[ERROR]", ...args),
};

export class CloudOceanService {
  constructor() {
    this.baseUrl = "https://api.develop.rve.ca/v1";
    this.moduleId = "c667ff46-9730-425e-ad48-1e950691b3f9";
    this.headers = {
      "Access-Token": process.env.API_Key,
      "Content-Type": "application/json",
    };
    this.maxRetries = 3;
    this.baseDelay = 4000;
  }

  async sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async fetchWithExponentialBackoff(url, options, attempt = 1) {
    try {
      const response = await fetch(url, options);
      const data = await response.json();

      if (!response.ok) {
        logger.warn(`Request failed (${response.status}): ${JSON.stringify(data)}`);
        if (response.status === 503 && attempt < this.maxRetries) {
          const delay = this.baseDelay * Math.pow(2, attempt - 1);
          logger.info(`Retrying in ${delay / 1000}s... (attempt ${attempt}/${this.maxRetries})`);
          await this.sleep(delay);
          return this.fetchWithExponentialBackoff(url, options, attempt + 1);
        }
        throw new Error(`HTTP ${response.status}: ${data.detail || response.statusText}`);
      }

      return data;
    } catch (error) {
      if (error.name === "TypeError" && attempt < this.maxRetries) {
        const delay = this.baseDelay * Math.pow(2, attempt - 1);
        logger.info(`Network error, retrying in ${delay / 1000}s... (attempt ${attempt}/${this.maxRetries})`);
        await this.sleep(delay);
        return this.fetchWithExponentialBackoff(url, options, attempt + 1);
      }
      throw error;
    }
  }

  async getReads(point, startDate, endDate, limit = 50, offset = 0) {
    const url = new URL(`${this.baseUrl}/modules/${this.moduleId}/measuring-points/${point.uuid}/reads`);
    url.searchParams.set("start", startDate);
    url.searchParams.set("end", endDate);
    url.searchParams.set("limit", limit.toString());
    url.searchParams.set("offset", offset.toString());

    const data = await this.fetchWithExponentialBackoff(url.toString(), {
      method: "GET",
      headers: this.headers,
    });

    if (!Array.isArray(data) || data.length === 0) return 0;

    const sortedReads = data.sort((a, b) => new Date(a.time_stamp) - new Date(b.time_stamp));
    return sortedReads[sortedReads.length - 1].cumulative_kwh;
  }

  async getCdr(point, startDate, endDate, limit = 50, offset = 0) {
    const url = new URL(`${this.baseUrl}/modules/${this.moduleId}/measuring-points/${point.uuid}/cdr`);
    url.searchParams.set("start", startDate);
    url.searchParams.set("end", endDate);
    url.searchParams.set("limit", limit.toString());
    url.searchParams.set("offset", offset.toString());

    const data = await this.fetchWithExponentialBackoff(url.toString(), {
      method: "GET",
      headers: this.headers,
    });

    // Summing session energy from CDR
    if (Array.isArray(data)) {
      return data.reduce((sum, session) => sum + (session.energy_kwh || 0), 0);
    }
    return 0;
  }

  async getConsumptionData(startDate, endDate, limit = 50, offset = 0) {
  const measuringPoints = [
    { uuid: "71ef9476-3855-4a3f-8fc5-333cfbf9e898", name: "EV Charger Station 01", location: "Building A - Level 1" },
    { uuid: "fd7e69ef-cd01-4b9a-8958-2aa5051428d4", name: "EV Charger Station 02", location: "Building A - Level 2" },
    { uuid: "b7423cbc-d622-4247-bb9a-8d125e5e2351", name: "EV Charger Station 03", location: "Building B - Parking Garage" },
    // … add the rest
  ];

  const results = [];
  const totalStations = measuringPoints.length;

  for (const point of measuringPoints) {
    try {
      logger.info(`Fetching /reads for ${point.name} (${point.location})`);

      const url = new URL(
        `${this.baseUrl}/modules/${this.moduleId}/measuring-points/${point.uuid}/reads`
      );
      url.searchParams.set("start", startDate);
      url.searchParams.set("end", endDate);
      url.searchParams.set("limit", limit.toString());
      url.searchParams.set("offset", offset.toString());

      const data = await this.fetchWithExponentialBackoff(url.toString(), {
        method: "GET",
        headers: this.headers,
      });

      if (Array.isArray(data) && data.length > 0) {
        const sortedReads = data.sort(
          (a, b) => new Date(a.time_stamp) - new Date(b.time_stamp)
        );

        const last = sortedReads[sortedReads.length - 1];

        // Only cumulative total (last meter reading)
        const cumulativeTotal = last.cumulative_kwh || 0;

        results.push({
          uuid: point.uuid,
          name: point.name,
          location: point.location,
          cumulativeTotal,
        });

        logger.info(`${point.name}: Total ${cumulativeTotal.toFixed(2)} kWh`);
      }
    } catch (err) {
      logger.error(`Failed for ${point.name}: ${err.message}`);
    }
  }

  if (results.length === 0) {
    throw new Error("No cumulative data fetched.");
  }

  logger.info(`Fetched data for ${results.length}/${totalStations} stations`);
  return results;
}
}

// 🏃 Runner
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const service = new CloudOceanService();

  (async () => {
    try {
      const startDate = "2024-10-16";
      const endDate = "2024-11-25";

      const data = await service.getConsumptionData(startDate, endDate);

      console.table(data.devices.map(d => ({
        Name: d.name,
        Reads_kWh: d.readsConsumption.toFixed(2),
        CDR_kWh: d.cdrConsumption.toFixed(2),
        Total_kWh: d.total.toFixed(2),
      })));

      console.log("\n⚡ Totals:");
      console.log(`Reads Total: ${data.totals.totalReads.toFixed(2)} kWh`);
      console.log(`CDR Total: ${data.totals.totalCdr.toFixed(2)} kWh`);
      console.log(`Grand Total: ${data.totals.grandTotal.toFixed(2)} kWh`);
    } catch (err) {
      console.error("❌ Runner error:", err.message);
    }
  })();
}
