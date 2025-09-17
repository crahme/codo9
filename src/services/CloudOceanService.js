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
    this.pageLimit = 100; // max items per request
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

  // Helper: Recursively find all numeric values in an object
  extractNumericValues(obj) {
    let numbers = [];
    if (obj == null) return numbers;
    if (typeof obj === "number" && !isNaN(obj)) return [obj];
    if (Array.isArray(obj)) {
      for (const item of obj) numbers = numbers.concat(this.extractNumericValues(item));
    } else if (typeof obj === "object") {
      for (const key in obj) numbers = numbers.concat(this.extractNumericValues(obj[key]));
    }
    return numbers;
  }

  // Robust cumulative reads fetch (pagination + nested detection)
  async getReads(point, startDate, endDate) {
    let offset = 0;
    let lastValue = 0;
    while (true) {
      const url = new URL(`${this.baseUrl}/modules/${this.moduleId}/measuring-points/${point.uuid}/reads`);
      url.searchParams.set("start", startDate);
      url.searchParams.set("end", endDate);
      url.searchParams.set("limit", this.pageLimit);
      url.searchParams.set("offset", offset);

      const data = await this.fetchWithExponentialBackoff(url.toString(), {
        method: "GET",
        headers: this.headers,
      });

      if (!data || (Array.isArray(data) && data.length === 0)) break;

      const values = this.extractNumericValues(data);
      const maxValue = values.length ? Math.max(...values) : 0;

      if (maxValue > lastValue) lastValue = maxValue;

      if (!Array.isArray(data) || data.length < this.pageLimit) break;
      offset += this.pageLimit;
    }
    return lastValue;
  }

  // Robust CDR per day
  async getCdr(point, startDate, endDate) {
    let offset = 0;
    let allSessions = [];
    while (true) {
      const url = new URL(`${this.baseUrl}/modules/${this.moduleId}/measuring-points/${point.uuid}/cdr`);
      url.searchParams.set("start", startDate);
      url.searchParams.set("end", endDate);
      url.searchParams.set("limit", this.pageLimit);
      url.searchParams.set("offset", offset);

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

      if (sessions.length) allSessions = allSessions.concat(sessions);
      if (!sessions.length || sessions.length < this.pageLimit) break;

      offset += this.pageLimit;
    }

    if (!allSessions.length) {
      return this.fillMissingDays(startDate, endDate).map(date => ({ date, daily_kwh: 0 }));
    }

    // Group sessions by date
    const dailyMap = {};
    for (const s of allSessions) {
      const date = s.start_time?.split("T")[0] || s.date?.split("T")[0];
      if (!date) continue;
      const nums = this.extractNumericValues(s);
      const maxEnergy = nums.length ? Math.max(...nums) : 0;
      dailyMap[date] = (dailyMap[date] || 0) + maxEnergy;
    }

    // Fill missing days
    const allDates = this.fillMissingDays(startDate, endDate);
    return allDates.map(date => ({
      date,
      daily_kwh: dailyMap[date] || 0,
    }));
  }

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

  async getConsumptionData(startDate, endDate) {
    const measuringPoints = [
      { uuid: "71ef9476-3855-4a3f-8fc5-333cfbf9e898", name: "EV Charger Station 01", location: "Building A - Level 1" },
      { uuid: "fd7e69ef-cd01-4b9a-8958-2aa5051428d4", name: "EV Charger Station 02", location: "Building A - Level 2" },
      { uuid: "b7423cbc-d622-4247-bb9a-8d125e5e2351", name: "EV Charger Station 03", location: "Building B - Parking Garage" },
    ];

    const promises = measuringPoints.map(async point => {
      logger.info(`Fetching reads and daily CDR for ${point.name} (${point.location})`);

      const [readsTotal, cdrDaily] = await Promise.all([
        this.getReads(point, startDate, endDate),
        this.getCdr(point, startDate, endDate),
      ]);

      const cdrTotal = cdrDaily.reduce((sum, d) => sum + d.daily_kwh, 0);

      return {
        uuid: point.uuid,
        name: point.name,
        location: point.location,
        readsConsumption: readsTotal,
        cdrDaily,
        cdrConsumption: cdrTotal,
        total: readsTotal + cdrTotal,
      };
    });

    const results = await Promise.all(promises);

    const totals = {
      totalReads: results.reduce((sum, d) => sum + d.readsConsumption, 0),
      totalCdr: results.reduce((sum, d) => sum + d.cdrConsumption, 0),
      grandTotal: results.reduce((sum, d) => sum + d.total, 0),
    };

    logger.info(`Fetched data for ${results.length}/${measuringPoints.length} stations`);

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

      console.table(
        data.devices.map(d => ({
          Name: d.name,
          Reads_kWh: d.readsConsumption.toFixed(2),
          CDR_kWh: d.cdrConsumption.toFixed(2),
          Total_kWh: d.total.toFixed(2),
        }))
      );

      console.log("Totals:", {
        Reads: data.totals.totalReads.toFixed(2),
        CDR: data.totals.totalCdr.toFixed(2),
        Grand: data.totals.grandTotal.toFixed(2),
      });
    } catch (err) {
      logger.error(err);
    }
  })();
}
