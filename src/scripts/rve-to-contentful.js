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
    return new Promise(resolve => setTimeout(resolve, ms));
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

  async getAllPages(url, limit = 50) {
    let offset = 0;
    let allData = [];
    while (true) {
      const pageUrl = new URL(url);
      pageUrl.searchParams.set("limit", limit.toString());
      pageUrl.searchParams.set("offset", offset.toString());

      const data = await this.fetchWithExponentialBackoff(pageUrl.toString(), {
        method: "GET",
        headers: this.headers,
      });

      if (!Array.isArray(data) || data.length === 0) break;

      allData = allData.concat(data);
      if (data.length < limit) break; // no more pages
      offset += limit;
    }
    return allData;
  }

  // --- READS ---
  async getReads(point, startDate, endDate, limit = 50) {
    const url = `${this.baseUrl}/modules/${this.moduleId}/measuring-points/${point.uuid}/reads`;
    const fullUrl = new URL(url);
    fullUrl.searchParams.set("start", startDate);
    fullUrl.searchParams.set("end", endDate);

    const allReads = await this.getAllPages(fullUrl.toString(), limit);

    if (!allReads.length) {
      logger.warn(`No reads found for ${point.name}`);
      return 0;
    }

    // detect the cumulative field by looking for the max numeric value
    let maxValue = 0;
    for (const r of allReads) {
      for (const val of Object.values(r)) {
        if (typeof val === "number" && val > maxValue) {
          maxValue = val;
        }
      }
    }

    return maxValue;
  }

  // --- CDR ---
  async getCdr(point, startDate, endDate, limit = 50) {
    const url = `${this.baseUrl}/modules/${this.moduleId}/measuring-points/${point.uuid}/cdr`;
    const fullUrl = new URL(url);
    fullUrl.searchParams.set("start", startDate);
    fullUrl.searchParams.set("end", endDate);

    const allData = await this.getAllPages(fullUrl.toString(), limit);

    // Flatten to sessions
    const sessions = [];
    for (const item of allData) {
      if (Array.isArray(item)) sessions.push(...item);
      else if (typeof item === "object") sessions.push(item);
    }

    if (!sessions.length) {
      logger.warn(`No CDRs found for ${point.name}`);
      return [];
    }

    const cdrSessions = [];
    for (const s of sessions) {
      const start = s.start_time || s.startTime || s.date;
      const end = s.end_time || s.endTime || s.date;
      if (!start) continue;

      let energy = 0;
      for (const val of Object.values(s)) {
        if (typeof val === "number" && val > energy) {
          energy = val;
        }
      }

      cdrSessions.push({
        date: start.split("T")[0],
        startTime: start,
        endTime: end,
        energy,
      });
    }

    return cdrSessions;
  }

  // --- Main Consumption ---
  async getConsumptionData(startDate, endDate, limit = 50) {
    const measuringPoints = [
      { uuid: "71ef9476-3855-4a3f-8fc5-333cfbf9e898", name: "EV Charger Station 01", location: "Building A - Level 1" },
      { uuid: "fd7e69ef-cd01-4b9a-8958-2aa5051428d4", name: "EV Charger Station 02", location: "Building A - Level 2" },
      { uuid: "b7423cbc-d622-4247-bb9a-8d125e5e2351", name: "EV Charger Station 03", location: "Building B - Parking Garage" },
    ];

    const results = await Promise.all(measuringPoints.map(async point => {
      logger.info(`Fetching data for ${point.name} (${point.location})`);

      const readsConsumption = await this.getReads(point, startDate, endDate, limit);
      const cdrSessions = await this.getCdr(point, startDate, endDate, limit);
      const cdrConsumption = cdrSessions.reduce((sum, s) => sum + s.energy, 0);

      return {
        uuid: point.uuid,
        name: point.name,
        location: point.location,
        consumption: readsConsumption,
        cdrConsumption,
        cdrSessions,
      };
    }));

    return results;
  }
}

// 🏃 Runner (debug)
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const service = new CloudOceanService();
  (async () => {
    try {
      const startDate = "2024-10-16";
      const endDate = "2024-11-25";

      const data = await service.getConsumptionData(startDate, endDate);

      console.log("\n⚡ Consumption Data:\n");
      console.dir(data, { depth: null });
    } catch (err) {
      console.error("❌ Runner error:", err.message);
    }
  })();
}
