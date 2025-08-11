const axios = require('axios');
const winston = require('winston');
const apiKey = process.env.API_Key;
const logger = winston.createLogger({
  transports: [new winston.transports.Console()],
});

class CloudOceanAPI {
  constructor(apiKey) {
    this.baseUrl = 'https://api.develop.rve.ca';
    if (!apiKey) throw new Error('API key is required');
    let cleanApiKey = apiKey.startsWith('Bearer ') ? apiKey.replace('Bearer ', '') : apiKey;

    this.headers = {
      'X-API-Key': cleanApiKey,
      'Content-Type': 'application/json',
    };
    this.accessTokenHeaders = {
      'Access-Token': `Bearer ${cleanApiKey}`,
      'Content-Type': 'application/json',
    };
    this.bearerHeaders = {
      'Authorization': `Bearer ${cleanApiKey}`,
      'Content-Type': 'application/json',
    };
  }

  async requestWithFallback(endpoint, params) {
    // Try X-API-Key, then Authorization Bearer, then Access-Token
    try {
      return await axios.get(endpoint, { headers: this.headers, params });
    } catch (err) {
      const status = err?.response?.status;
      if (status !== 401) throw err;
    }
    try {
      return await axios.get(endpoint, { headers: this.bearerHeaders, params });
    } catch (err) {
      const status = err?.response?.status;
      if (status !== 401) throw err;
    }
    // Final fallback
    return await axios.get(endpoint, { headers: this.accessTokenHeaders, params });
  }

  async getMeasuringPointReads(moduleUuid, measuringPointUuid, startDate, endDate) {
    const endpoint = `${this.baseUrl}/v1/modules/${moduleUuid}/measuring-points/${measuringPointUuid}/reads`;
    const params = {
      start: startDate.toISOString().slice(0, 10),
      end: endDate.toISOString().slice(0, 10),
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
      start: startDate.toISOString().slice(0, 10),
      end: endDate.toISOString().slice(0, 10),
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
      const response = await axios.get(endpoint, { headers: this.headers });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  async getDeviceConsumption(deviceId, startDate, endDate) {
    const endpoint = `${this.baseUrl}/devices/${deviceId}/consumption`;
    const params = {
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
    };
    try {
      const response = await axios.get(endpoint, { headers: this.headers, params });
      return response.data.data;
    } catch (e) {
      logger.error(`Error fetching consumption data: ${e.message}`);
      throw e;
    }
  }

  async getDeviceInfo(deviceId) {
    const endpoint = `${this.baseUrl}/devices/${deviceId}`;
    try {
      const response = await axios.get(endpoint, { headers: this.headers });
      return response.data.data;
    } catch (e) {
      logger.error(`Error fetching device info: ${e.message}`);
      throw e;
    }
  }
}

module.exports = CloudOceanAPI;
