// src/services/CloudOceanService.js
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

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

  // Safe fetch: returns null on non-JSON or HTTP errors, retries 503
  async fetchWithExponentialBackoff(url, options, attempt = 1) {
    try {
      const response = await fetch(url, options);
      const text = await response.text();

      let data = null;
      try {
        data = JSON.parse(text);
      } catch {
        logger.warn(`Non-JSON response at ${url}: ${text.slice(0, 200)}...`);
      }

      if (!response.ok) {
        logger.warn(`Request failed (${response.status}) at ${url}`);
        if (response.status === 503 && attempt < this.maxRetries) {
          const delay = this.baseDelay * Math.pow(2, attempt - 1);
          logger.info(`Retrying in ${delay / 1000}s... (attempt ${attempt}/${this.maxRetries})`);
          await this.sleep(delay);
          return this.fetchWithExponentialBackoff(url, options, attempt + 1);
        }
        return null; // safely return null for 500 / other errors
      }

      return data;
    } catch (error) {
      if (error.name === "TypeError" && attempt < this.maxRetries) {
        const delay = this.baseDelay * Math.pow(2, attempt - 1);
        logger.info(`Network error, retrying in ${delay / 1000}s... (attempt ${attempt}/${this.maxRetries})`);
        await this.sleep(delay);
        return this.fetchWithExponentialBackoff(url, options, attempt + 1);
      }
      logger.error(`Fetch failed for ${url}: ${error.message}`);
      return null;
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

      if (!data || !Array.isArray(data) || data.length === 0) break;

      allData = allData.concat(data);
      if (data.length < limit) break;
      offset += limit;
    }
    return allData;
  }

  findLargestNumeric(obj) {
    let max = -Infinity;
    function traverse(o) {
      if (o == null) return;
      if (typeof o === "number") {
        if (o > max) max = o;
      } else if (Array.isArray(o)) {
        o.forEach(traverse);
      } else if (typeof o === "object") {
        for (const key of Object.keys(o)) traverse(o[key]);
      }
    }
    traverse(obj);
    return max === -Infinity ? 0 : max;
  }

  async getReads(point, startDate, endDate, limit = 50) {
    const url = `${this.baseUrl}/modules/${this.moduleId}/measuring-points/${point.uuid}/reads`;
    const fullUrl = new URL(url);
    fullUrl.searchParams.set("start", startDate);
    fullUrl.searchParams.set("end", endDate);

    const allReads = await this.getAllPages(fullUrl.toString(), limit);
    const largestCumulative = this.findLargestNumeric(allReads);
    return { date: endDate, cumulative_kwh: largestCumulative };
  }

  async getCdr(point, startDate, endDate, limit = 50) {
    const url = `${this.baseUrl}/modules/${this.moduleId}/measuring-points/${point.uuid}/cdr`;
    const fullUrl = new URL(url);
    fullUrl.searchParams.set("start", startDate);
    fullUrl.searchParams.set("end", endDate);

    const allData = await this.getAllPages(fullUrl.toString(), limit);

    const sessions = [];
    allData.forEach((item) => {
      if (Array.isArray(item)) sessions.push(...item);
      else if (typeof item === "object") sessions.push(item);
    });

    if (!sessions.length) {
      return this.fillMissingDays(startDate, endDate).map((date) => ({
        date,
        daily_kwh: 0,
      }));
    }

    const dailyMap = {};
    for (const s of sessions) {
      const date = s.start_time?.split("T")[0] || s.date?.split("T")[0];
      if (!date) continue;
      const energy = this.findLargestNumeric(s);
      dailyMap[date] = (dailyMap[date] || 0) + energy;
    }

    const allDates = this.fillMissingDays(startDate, endDate);
    return allDates.map((date) => ({
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

  async getConsumptionData(startDate, endDate, limit = 50) {
    const measuringPoints = [
      { uuid: "71ef9476-3855-4a3f-8fc5-333cfbf9e898", name: "EV Charger Station 01", location: "Building A - Level 1" },
      { uuid: "fd7e69ef-cd01-4b9a-8958-2aa5051428d4", name: "EV Charger Station 02", location: "Building A - Level 2" },
      { uuid: "b7423cbc-d622-4247-bb9a-8d125e5e2351", name: "EV Charger Station 03", location: "Building B - Parking Garage" },
    ];

    const results = await Promise.all(
      measuringPoints.map(async (point) => {
        logger.info(`Fetching reads and daily CDR for ${point.name} (${point.location})`);

        const read = await this.getReads(point, startDate, endDate, limit);
        const cdrArray = await this.getCdr(point, startDate, endDate, limit);

        const totalReads = read?.cumulative_kwh || 0;
        const totalCdr = cdrArray?.reduce((sum, d) => sum + d.daily_kwh, 0) || 0;

        if (totalReads === 0 && totalCdr === 0) {
          logger.warn(`Skipping ${point.name} — no consumption data`);
          return null;
        }

        return {
          uuid: point.uuid,
          name: point.name,
          location: point.location,
          readsConsumption: totalReads,
          cdrDaily: cdrArray,
          cdrConsumption: totalCdr,
          total: totalReads + totalCdr,
        };
      })
    );

    const filtered = results.filter(Boolean);

    const totals = {
      totalReads: filtered.reduce((sum, d) => sum + d.readsConsumption, 0),
      totalCdr: filtered.reduce((sum, d) => sum + d.cdrConsumption, 0),
      grandTotal: filtered.reduce((sum, d) => sum + d.total, 0),
    };

    logger.info(`Fetched data for ${filtered.length}/${measuringPoints.length} stations`);
    return { devices: filtered, totals };
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

      if (data.devices.length === 0) {
        console.log("⚡ No stations with consumption data to display");
        return;
      }

      console.log("\n⚡ Daily Energy per Station:\n");
      data.devices.forEach((d) => {
        console.log(`${d.name} (${d.location}):`);
        console.table(
          d.cdrDaily.map((row, i) => ({
            Date: row.date,
            "Reads kWh": i === d.cdrDaily.length - 1 ? d.readsConsumption.toFixed(2) : "0.00",
            "CDR kWh": row.daily_kwh.toFixed(2),
            "Total kWh": (row.daily_kwh + (i === d.cdrDaily.length - 1 ? d.readsConsumption : 0)).toFixed(2),
          }))
        );
      });

      console.log("\n⚡ Totals:");
      console.table(
        data.devices.map((d) => ({
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
