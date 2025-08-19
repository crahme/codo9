import axios from 'axios';
import 'dotenv/config'; // Ensure environment variables are loaded
import winston from 'winston';
const logger = winston.createLogger({
  transports: [new winston.transports.Console()],
});

function toYMD(date) {
  if (date instanceof Date) return date.toISOString().slice(0, 10);
  if (typeof date === 'string') return date.slice(0, 10);
  const d = new Date(date);
  if (!isNaN(d)) return d.toISOString().slice(0, 10);
  throw new Error('Invalid date provided');
}

function toISO(date) {
  if (date instanceof Date) return date.toISOString();
  const d = new Date(date);
  if (!isNaN(d)) return d.toISOString();
  throw new Error('Invalid date provided');
}

class CloudOceanAPI {
  constructor(apiKey) {
    this.baseUrl = process.env.CLOUD_OCEAN_BASE_URL || 'https://api.develop.rve.ca';
    const envKeyRaw = (apiKey || process.env.CLOUD_OCEAN_API_KEY || process.env.API_Key || process.env.API_KEY || '').trim();
    if (!envKeyRaw) throw new Error('API key is required');
    const cleanApiKey = envKeyRaw.replace(/^Bearer\s+/i, '');

    this.headers = {
      'X-API-Key': cleanApiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    this.accessTokenHeaders = {
      'Access-Token': cleanApiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    this.accessTokenHeadersBearer = {
      'Access-Token': `Bearer ${cleanApiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    this.bearerHeaders = {
      'Authorization': `Bearer ${cleanApiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
      this.authorizationRawHeaders = {
      'Authorization': envKeyRaw,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  async requestWithFallback(endpoint, params) {
    // Prefer Authorization header (raw), then Authorization Bearer, then Access-Token (raw), Access-Token (Bearer), and finally X-API-Key
    try {
      logger.debug('Trying Authorization header (raw)');
      return await axios.get(endpoint, { headers: this.authorizationRawHeaders, params });
    } catch (err) {
      const status = err?.response?.status;
      if (status !== 401) throw err;
      logger.debug('Authorization (raw) failed with 401, trying Authorization Bearer...');
    }
    try {
      logger.debug('Trying Authorization header (Bearer)');
      return await axios.get(endpoint, { headers: this.bearerHeaders, params });
    } catch (err) {
      const status = err?.response?.status;
      if (status !== 401) throw err;
      logger.debug('Authorization Bearer failed with 401, trying Access-Token (raw)...');
    }
    try {
      logger.debug('Trying Access-Token header (raw)');
      return await axios.get(endpoint, { headers: this.accessTokenHeaders, params });
    } catch (err) {
      const status = err?.response?.status;
      if (status !== 401) throw err;
      logger.debug('Access-Token (raw) failed with 401, trying Access-Token (Bearer)...');
    }
    try {
      logger.debug('Trying Access-Token header (Bearer)');
      return await axios.get(endpoint, { headers: this.accessTokenHeadersBearer, params });
    } catch (err) {
      const status = err?.response?.status;
      if (status !== 401) throw err;
      logger.debug('Access-Token (Bearer) failed with 401, trying X-API-Key...');
    }
    logger.debug('Trying X-API-Key header');
    return await axios.get(endpoint, { headers: this.headers, params });
  }

  async getMeasuringPointReads(moduleUuid, measuringPointUuid, startDate, endDate) {
    const endpoint = `${this.baseUrl}/v1/modules/${moduleUuid}/measuring-points/${measuringPointUuid}/reads`;
    const params = {
      start: toYMD(startDate),
      end: toYMD(endDate),
      start_date: toYMD(startDate),
      end_date: toYMD(endDate),
      limit: 50,
      offset: 0,
    };

    logger.debug(`Fetching reads for measuring point ${measuringPointUuid}`);
    logger.debug(`Request URL: ${endpoint}`);
    logger.debug(`Request params: ${JSON.stringify(params)}`);

    try {
      const response = await this.requestWithFallback(endpoint, params);
      const data = response.data?.data || [];
      logger.info(`Successfully fetched ${data.length} reads for measuring point ${measuringPointUuid}`);
      return data;
    } catch (e) {
      const status = e?.response?.status;
      if (status === 401) {
        logger.warn('Cloud Ocean API authentication failed - API key may lack required permissions for measuring point data access');
        return [];
      }
      logger.error(`Error fetching measuring point reads: ${e.message}`);
      return [];
    }
  }

  async getMeasuringPointCdr(moduleUuid, measuringPointUuid, startDate, endDate) {
    const endpoint = `${this.baseUrl}/v1/modules/${moduleUuid}/measuring-points/${measuringPointUuid}/cdr`;
    const params = {
      start: toYMD(startDate),
      end: toYMD(endDate),
      start_date: toYMD(startDate),
      end_date: toYMD(endDate),
      limit: 50,
      offset: 0,
    };

    logger.debug(`Fetching CDR for measuring point ${measuringPointUuid}`);

    try {
      const response = await this.requestWithFallback(endpoint, params);
      const data = response.data?.data || [];
      logger.info(`Successfully fetched ${data.length} CDR records for measuring point ${measuringPointUuid}`);
      return data;
    } catch (e) {
      const status = e?.response?.status;
      if (status === 401) {
        logger.warn('Cloud Ocean API authentication failed for CDR - API key may lack required permissions');
        return [];
      }
      logger.error(`Error fetching measuring point CDR: ${e.message}`);
      return [];
    }
  }

  async getAllMeasuringPointsData(moduleUuid, measuringPointUuids, startDate, endDate) {
    const data = {};
    for (const mpUuid of measuringPointUuids) {
      try {
        logger.info(`Fetching data for measuring point: ${mpUuid}`);
        const reads = await this.getMeasuringPointReads(moduleUuid, mpUuid, startDate, endDate);
        const cdr = await this.getMeasuringPointCdr(moduleUuid, mpUuid, startDate, endDate);
        data[mpUuid] = { reads, cdr };
        logger.info(`Successfully fetched data for measuring point: ${mpUuid}`);
        logger.debug(`Read count: ${reads.length}, CDR count: ${cdr.length}`);
      } catch (e) {
        logger.error(`Failed to fetch data for measuring point ${mpUuid}: ${e.message}`);
        data[mpUuid] = { reads: [], cdr: [], error: e.message };
      }
    }
    return data;
  }

  async getModuleConsumption(moduleUuid, measuringPointUuids, startDate, endDate) {
    const consumptionData = {};
    try {
      const allData = await this.getAllMeasuringPointsData(moduleUuid, measuringPointUuids, startDate, endDate);
      for (const mpUuid of measuringPointUuids) {
        const data = allData[mpUuid];
        if (data.error) {
          consumptionData[mpUuid] = 0.0;
          logger.warn(`Error fetching data for measuring point ${mpUuid}`);
          continue;
        }
        const totalConsumption = (data.reads || []).reduce(
          (sum, read) => sum + parseFloat(read.consumption || 0), 0
        );
        consumptionData[mpUuid] = totalConsumption;
        logger.info(`Calculated consumption for ${mpUuid}: ${totalConsumption} kWh`);
      }
    } catch (e) {
      logger.error(`Error fetching consumption data: ${e.message}`);
      for (const mpUuid of measuringPointUuids) {
        consumptionData[mpUuid] = 0.0;
      }
    }
    return consumptionData;
  }

  async validateMeasuringPoint(moduleUuid, measuringPointUuid) {
    const endpoint = `${this.baseUrl}/v1/modules/${moduleUuid}/measuring-points/${measuringPointUuid}`;
    try {
      const response = await this.requestWithFallback(endpoint, undefined);
      return response.status === 200;
    } catch (e) {
      const status = e?.response?.status;
      if (status === 401) {
        logger.warn('Cloud Ocean API authentication failed while validating measuring point');
      }
      return false;
    }
  }

  async getDeviceConsumption(deviceId, startDate, endDate) {
    const endpoint = `${this.baseUrl}/v1/devices/${deviceId}/consumption`;
    const params = {
      start_date: toISO(startDate),
      end_date: toISO(endDate),
      start: toISO(startDate),
      end: toISO(endDate),
    };
    try {
      const response = await this.requestWithFallback(endpoint, params);
      return response.data.data;
    } catch (e) {
      const status = e?.response?.status;
      if (status === 404) {
        logger.warn(`Device consumption not found for device ${deviceId}`);
        return [];
      }
      if (status === 401) {
        logger.warn('Cloud Ocean API authentication failed for device consumption - API key may lack required permissions');
        return [];
      }
      logger.error(`Error fetching consumption data: ${e.message}`);
      return [];
    }
  }

  async getDeviceInfo(deviceId) {
    const endpoint = `${this.baseUrl}/v1/devices/${deviceId}`;
    try {
      const response = await this.requestWithFallback(endpoint, undefined);
      return response.data.data;
    } catch (e) {
      const status = e?.response?.status;
      if (status === 404) {
        logger.warn(`Device not found: ${deviceId}`);
        return null;
      }
      if (status === 401) {
        logger.warn('Cloud Ocean API authentication failed while fetching device info - API key may lack required permissions');
        return null;
      }
      logger.error(`Error fetching device info: ${e.message}`);
      return null;
    }
  }
}

export default CloudOceanAPI;
