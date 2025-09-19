import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const logger = {
info: (...args) => console.log("\[INFO]", ...args),
warn: (...args) => console.warn("\[WARN]", ...args),
error: (...args) => console.error("\[ERROR]", ...args),
};

export class CloudOceanService {
constructor() {
this.baseUrl = "[https://api.develop.rve.ca/v1](https://api.develop.rve.ca/v1)";
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
const contentType = response.headers.get("content-type") || "";
let data;


  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    const text = await response.text();
    logger.error(`[ERROR] Non-JSON response from ${url}: ${text}`);
    data = { error: text };
  }

  if (!response.ok) {
    logger.warn(`Request failed (${response.status}): ${JSON.stringify(data)}`);
    if (response.status === 503 && attempt < this.maxRetries) {
      const delay = this.baseDelay * Math.pow(2, attempt - 1);
      logger.info(`Retrying in ${delay / 1000}s... (attempt ${attempt}/${this.maxRetries})`);
      await this.sleep(delay);
      return this.fetchWithExponentialBackoff(url, options, attempt + 1);
    }
    throw new Error(`HTTP ${response.status}: ${data.detail || data.error || response.statusText}`);
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
  if (data.length < limit) break;
  offset += limit;
}
return allData;


}

// Robust function to detect the largest numeric value recursively
findLargestNumeric(obj) {
let max = -Infinity;


function traverse(o) {
  if (o == null) return;
  if (typeof o === "number") {
    if (o > max) max = o;
  } else if (Array.isArray(o)) {
    o.forEach(traverse);
  } else if (typeof o === "object") {
    for (const key of Object.keys(o)) {
      traverse(o[key]);
    }
  }
}

traverse(obj);
return max === -Infinity ? 0 : max;


}

async getReads(point, startDate, endDate, limit = 50) {
try {
const url = `${this.baseUrl}/modules/${this.moduleId}/measuring-points/${point.uuid}/reads`;
const fullUrl = new URL(url);
fullUrl.searchParams.set("start", startDate);
fullUrl.searchParams.set("end", endDate);


  const allReads = await this.getAllPages(fullUrl.toString(), limit);
  const largestCumulative = this.findLargestNumeric(allReads);

  return { date: endDate, cumulative_kwh: largestCumulative };
} catch (err) {
  logger.error(`[getReads] Failed for ${point.name}: ${err.message}`);
  return { date: endDate, cumulative_kwh: 0 };
}


}

async getCdr(point, startDate, endDate, limit = 50) {
try {
const url = `${this.baseUrl}/modules/${this.moduleId}/measuring-points/${point.uuid}/cdr`;
const fullUrl = new URL(url);
fullUrl.searchParams.set("start", startDate);
fullUrl.searchParams.set("end", endDate);


  const allData = await this.getAllPages(fullUrl.toString(), limit);

  const sessions = [];
  allData.forEach(item => {
    if (Array.isArray(item)) sessions.push(...item);
    else if (typeof item === "object") sessions.push(item);
  });

  if (!sessions.length) {
    return this.fillMissingDays(startDate, endDate).map(date => ({
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
  return allDates.map(date => ({
    date,
    daily_kwh: dailyMap[date] || 0,
  }));
} catch (err) {
  logger.error(`[getCdr] Failed for ${point.name}: ${err.message}`);
  return this.fillMissingDays(startDate, endDate).map(date => ({
    date,
    daily_kwh: 0,
  }));
}


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


const results = await Promise.all(measuringPoints.map(async point => {
  logger.info(`Fetching reads and daily CDR for ${point.name} (${point.location})`);

  const read = await this.getReads(point, startDate, endDate, limit);
  const cdrArray = await this.getCdr(point, startDate, endDate, limit);

  const totalReads = read.cumulative_kwh;
  const totalCdr = cdrArray.reduce((sum, d) => sum + d.daily_kwh, 0);

  return {
    uuid: point.uuid,
    name: point.name,
    location: point.location,
    readsConsumption: totalReads,
    cdrDaily: cdrArray,
    cdrConsumption: totalCdr,
    total: totalReads + totalCdr,
  };
}));

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
const _filename = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === _filename) {
const service = new CloudOceanService();
(async () => {
try {
const startDate = "2024-10-16";
const endDate = "2024-11-25";


  const data = await service.getConsumptionData(startDate, endDate);

  console.log("\n⚡ Daily Energy per Station:\n");
  data.devices.forEach(d => {
    console.log(`${d.name} (${d.location}):`);
    console.table(d.cdrDaily.map((row, i) => ({
      Date: row.date,
      "Reads kWh": i === d.cdrDaily.length - 1 ? d.readsConsumption.toFixed(2) : '0.00',
      "CDR kWh": row.daily_kwh.toFixed(2),
      "Total kWh": (row.daily_kwh + (i === d.cdrDaily.length - 1 ? d.readsConsumption : 0)).toFixed(2),
    })));
  });

  console.log("\n⚡ Totals:");
  console.table(data.devices.map(d => ({
    Name: d.name,
    Reads_kWh: d.readsConsumption.toFixed(2),
    CDR_kWh: d.cdrConsumption.toFixed(2),
    Total_kWh: d.total.toFixed(2),
  })));

  console.log(`Reads Total: ${data.totals.totalReads.toFixed(2)} kWh`);
  console.log(`CDR Total: ${data.totals.totalCdr.toFixed(2)} kWh`);
  console.log(`Grand Total: ${data.totals.grandTotal.toFixed(2)} kWh`);
} catch (err) {
  console.error("❌ Runner error:", err.message);
}
})();}