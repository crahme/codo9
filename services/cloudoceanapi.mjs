import axios from "axios";
import dotenv from "dotenv";
dotenv.config();
import winston from "winston";

const logger = winston.createLogger({
  transports: [new winston.transports.Console()],
});

// 🔑 Create one axios client with baseURL + Bearer token
const client = axios.create({
  baseURL: process.env.CLOUD_OCEAN_BASE_URL || "https://api.develop.rve.ca",
  headers: {
    "Access-Token": `Bearer ${process.env.API_Key}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
  },
});

function toYMD(date) {
  if (date instanceof Date) return date.toISOString().slice(0, 10);
  if (typeof date === "string") return date.slice(0, 10);
  const d = new Date(date);
  if (!isNaN(d)) return d.toISOString().slice(0, 10);
  throw new Error("Invalid date provided");
}

function toISO(date) {
  if (date instanceof Date) return date.toISOString();
  const d = new Date(date);
  if (!isNaN(d)) return d.toISOString();
  throw new Error("Invalid date provided");
}

export class CloudOceanAPI {
  constructor() {
    if (!process.env.API_Key) {
      throw new Error("API_Key is required");
    }
  }

  async getMeasuringPointReads(moduleUuid, measuringPointUuid, startDate, endDate) {
    const params = {
      API_KEY: '$BEARER{process.env.API_Key}',
      start: toYMD(startDate),
      end: toYMD(endDate),
      start_date: toYMD(startDate),
      end_date: toYMD(endDate),
      limit: 50,
      offset: 0,
    };

    try {
      const res = await client.get(
        `/v1/modules/${moduleUuid}/measuring-points/${measuringPointUuid}/reads`,
        { params }
      );
      logger.log(`Fetched ${res.data?.data?.length || 0} reads for measuring point ${measuringPointUuid}`);
      return res.data?.data || [];
    } catch (err) {
      logger.error(`Error fetching measuring point reads: ${err.message}`);
      return [];
    }
  }

  async getMeasuringPointCdr(moduleUuid, measuringPointUuid, startDate, endDate) {
    const params = {
      start: toYMD(startDate),
      end: toYMD(endDate),
      limit: 50,
      offset: 0,
    };

    try {
      const res = await client.get(
        `/v1/modules/${moduleUuid}/measuring-points/${measuringPointUuid}/cdr`,
        { params }
      );
      const data = res.data?.data || [];
      logger.log("Fetched CDR data:", data);
      return res.data?.data || [];
    } catch (err) {
      logger.error(`Error fetching CDR: ${err.message}`);
      return [];
    }
  }

  async getAllMeasuringPointsData(moduleUuid, measuringPointUuids, startDate, endDate) {
    const results = {};
    for (const mpUuid of measuringPointUuids) {
      try {
        const reads = await this.getMeasuringPointReads(moduleUuid, mpUuid, startDate, endDate);
        const cdr = await this.getMeasuringPointCdr(moduleUuid, mpUuid, startDate, endDate);
        results[mpUuid] = { reads, cdr };
      } catch (err) {
        results[mpUuid] = { reads: [], cdr: [], error: err.message };
      }
    }
    return results;
  }

  async getModuleConsumption(moduleUuid, measuringPointUuids, startDate, endDate) {
    const data = await this.getAllMeasuringPointsData(moduleUuid, measuringPointUuids, startDate, endDate);
    const consumption = {};
    for (const mpUuid of measuringPointUuids) {
      const total = (data[mpUuid]?.reads || []).reduce(
        (sum, read) => sum + parseFloat(read.consumption || 0),
        0
      );
      consumption[mpUuid] = total;
    }
    return consumption;
  }

  async validateMeasuringPoint(moduleUuid, measuringPointUuid) {
    try {
      const res = await client.get(`/v1/modules/${moduleUuid}/measuring-points/${measuringPointUuid}`);
      return res.status === 200;
    } catch {
      return false;
    }
  }

  async getDeviceConsumption(deviceId, startDate, endDate) {
    const params = {
      start: toISO(startDate),
      end: toISO(endDate),
    };
    try {
      const res = await client.get(`/v1/devices/${deviceId}/consumption`, { params });
      return res.data?.data || [];
    } catch (err) {
      logger.error(`Error fetching device consumption: ${err.message}`);
      return [];
    }
  }

  async getDeviceInfo(deviceId) {
    try {
      const res = await client.get(`/v1/devices/${deviceId}`);
      return res.data?.data || null;
    } catch (err) {
      logger.error(`Error fetching device info: ${err.message}`);
      return null;
    }
  }
}
export function listCdr(moduleUuid, measuringPointUuid, startDate, endDate) {
  const api = new CloudOceanAPI();
  return api.getMeasuringPointCdr(moduleUuid, measuringPointUuid, startDate, endDate);
}

export default CloudOceanAPI;
