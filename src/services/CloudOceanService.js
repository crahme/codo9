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

  // Get daily cumulative reads
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

    if (!Array.isArray(data) || data.length === 0) return this.fillMissingDays(startDate, endDate).map(date => ({ date, cumulative_kwh: 0 }));

    // Convert to daily cumulative readings
    const dailyMap = {};
    for (const r of data) {
      const date = r.time_stamp.split("T")[0];
      dailyMap[date] = Number(r.cumulative_kwh || 0);
    }

    return this.fillMissingDays(startDate, endDate).map(date => ({
      date,
      cumulative_kwh: dailyMap[date] || 0,
    }));
  }

  // Get daily CDR consumption
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

    const sessions =
      Array.isArray(data) ? data :
      Array.isArray(data.cdr) ? data.cdr :
      Array.isArray(data.results) ? data.results :
      Array.isArray(data.cdrSessions) ? data.cdrSessions :
      [];

    if (!sessions.length) {
      return this.fillMissingDays(startDate, endDate).map(date => ({ date, daily_kwh: 0 }));
    }

    const energyField = ["energy_kwh", "kwh", "energy"].find(f => f in sessions[0]);
    if (!energyField) {
      logger.warn(`[WARN] Unknown energy field in CDR sessions for ${point.name}`);
      return this.fillMissingDays(startDate, endDate).map(date => ({ date, daily_kwh: 0 }));
    }

    const dailyMap = {};
    for (const s of sessions) {
      const date = s.start_time?.split("T")[0] || s.date?.split("T")[0];
      if (!date) continue;
      dailyMap[date] = (dailyMap[date] || 0) + Number(s[energyField] || 0);
    }

    return this.fillMissingDays(startDate, endDate).map(date => ({
      date,
      daily_kwh: dailyMap[date] || 0,
    }));
  }

  // Fill missing days between start and end
  fillMissingDays(startDate, endDate) {
    const dates = [];
    let current = new Date(startDate);
    const end = new Date(endDate);
    while (current <= end) {
      dates.push(current.toISOString().split("T")[0]);
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }

  // Get full consumption data including daily reads + daily CDR
  async getConsumptionData(startDate, endDate, limit = 50, offset = 0) {
    const measuringPoints = [
      { uuid: "71ef9476-3855-4a3f-8fc5-333cfbf9e898", name: "EV Charger Station 01", location: "Building A - Level 1" },
      { uuid: "fd7e69ef-cd01-4b9a-8958-2aa5051428d4", name: "EV Charger Station 02", location: "Building A - Level 2" },
      { uuid: "b7423cbc-d622-4247-bb9a-8d125e5e2351", name: "EV Charger Station 03", location: "Building B - Parking Garage" },
    ];

    const promises = measuringPoints.map(async point => {
      logger.info(`Fetching reads and daily CDR for ${point.name} (${point.location})`);

      const [readsArray, cdrArray] = await Promise.all([
        this.getReads(point, startDate, endDate, limit, offset),
        this.getCdr(point, startDate, endDate, limit, offset),
      ]);

      const totalReads = readsArray.length ? readsArray[readsArray.length - 1].cumulative_kwh : 0;
      const totalCdr = cdrArray.reduce((sum, d) => sum + d.daily_kwh, 0);

      // Combine daily reads + daily CDR
      const dailyCombined = readsArray.map((r, idx) => ({
        date: r.date,
        reads_kwh: r.cumulative_kwh,
        cdr_kwh: cdrArray[idx]?.daily_kwh || 0,
        total_kwh: r.cumulative_kwh + (cdrArray[idx]?.daily_kwh || 0),
      }));

      return {
        uuid: point.uuid,
        name: point.name,
        location: point.location,
        readsConsumption: totalReads,
        cdrConsumption: totalCdr,
        total: totalReads + totalCdr,
        daily: dailyCombined,
      };
    });

    const results = await Promise.all(promises);

    const totals = {
      totalReads: results.reduce((sum, d) => sum + d.readsConsumption, 0),
      totalCdr: results.reduce((sum, d) => sum + d.cdrConsumption, 0),
      grandTotal: results.reduce((sum, d) => sum + d.total, 0),
    };

    return { devices: results, totals };
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

      console.log("\n⚡ Daily Energy per Station:");
      data.devices.forEach(device => {
        console.log(`\n${device.name} (${device.location}):`);
        console.table(device.daily.map(d => ({
          Date: d.date,
          "Reads kWh": d.reads_kwh.toFixed(2),
          "CDR kWh": d.cdr_kwh.toFixed(2),
          "Total kWh": d.total_kwh.toFixed(2),
        })));
      });

      console.log("\n⚡ Totals:");
      console.table(
        data.devices.map(d => ({
          Name: d.name,
          Reads_kWh: d.readsConsumption.toFixed(2),
          CDR_kWh: d.cdrConsumption.toFixed(2),
          Total_kWh: d.total.toFixed(2),
        }))
      );

      console.log(`Reads Total: ${data.totals.totalReads.toFixed(2)} kWh`);
      console.log(`CDR Total: ${data.totals.totalCdr.toFixed(2)} kWh`);
      console.log(`Grand Total: ${data.totals.grandTotal.toFixed(2)} kWh`);
    } catch (err) {
      console.error("❌ Runner error:", err.message);
    }
  })();
}
