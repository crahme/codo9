const axios = require('axios');
const moment = require('moment');
const logger = require('pino')({ level: 'info' });

class CloudOceanAPI {
  constructor(apiKey) {
    this.baseUrl = 'https://api.develop.rve.ca';
    this.headers = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  async getMeasuringPointReads(moduleUuid, measuringPointUuid, startDate, endDate) {
    /**
     * Fetch measuring point reads data from Cloud Ocean platform
     */
    try {
      const endpoint = `${this.baseUrl}/v1/modules/${moduleUuid}/measuring-points/${measuringPointUuid}/reads`;
      const params = {
        start_date: moment(startDate).format('YYYY-MM-DD'),
        end_date: moment(endDate).format('YYYY-MM-DD'),
      };

      logger.debug(`Fetching reads for measuring point ${measuringPointUuid}`);
      const response = await axios.get(endpoint, { headers: this.headers, params });

      const data = response.data?.data || [];
      logger.info(`Successfully fetched ${data.length} reads for measuring point ${measuringPointUuid}`);
      return data;

    } catch (error) {
      logger.error(`Error fetching measuring point reads: ${error.message}`);
      throw error;
    }
  }

  async getMeasuringPointCdr(moduleUuid, measuringPointUuid, startDate, endDate) {
    /**
     * Fetch measuring point CDR (Charge Detail Record) from Cloud Ocean platform
     */
    try {
      const endpoint = `${this.baseUrl}/v1/modules/${moduleUuid}/measuring-points/${measuringPointUuid}/cdr`;
      const params = {
        start_date: moment(startDate).format('YYYY-MM-DD'),
        end_date: moment(endDate).format('YYYY-MM-DD'),
      };

      logger.debug(`Fetching CDR for measuring point ${measuringPointUuid}`);
      const response = await axios.get(endpoint, { headers: this.headers, params });

      const data = response.data?.data || [];
      logger.info(`Successfully fetched ${data.length} CDR records for measuring point ${measuringPointUuid}`);
      return data;

    } catch (error) {
      logger.error(`Error fetching measuring point CDR: ${error.message}`);
      throw error;
    }
  }

  async getAllMeasuringPointsData(moduleUuid, measuringPointUuids, startDate, endDate) {
    /**
     * Fetch both reads and CDR data for multiple measuring points
     * Returns a dictionary with measuring point UUIDs as keys and their data as values
     */
    const data = {};
    for (const mpUuid of measuringPointUuids) {
      try {
        logger.info(`Fetching data for measuring point: ${mpUuid}`);
        const reads = await this.getMeasuringPointReads(moduleUuid, mpUuid, startDate, endDate);
        const cdr = await this.getMeasuringPointCdr(moduleUuid, mpUuid, startDate, endDate);

        data[mpUuid] = {
          reads,
          cdr,
        };

        logger.info(`Successfully fetched data for measuring point: ${mpUuid}`);
        logger.debug(`Read count: ${reads.length}, CDR count: ${cdr.length}`);

      } catch (error) {
        logger.error(`Failed to fetch data for measuring point ${mpUuid}: ${error.message}`);
        data[mpUuid] = { reads: [], cdr: [], error: error.message };
      }
    }
    return data;
  }

  async getModuleConsumption(moduleUuid, measuringPointUuids, startDate, endDate) {
    /**
     * Calculate total consumption for each measuring point in the module
     * Returns a dictionary with measuring point UUIDs as keys and their total consumption as values
     */
    const consumptionData = {};
    try {
      const allData = await this.getAllMeasuringPointsData(moduleUuid, measuringPointUuids, startDate, endDate);

      for (const [mpUuid, data] of Object.entries(allData)) {
        if (data.error) {
          consumptionData[mpUuid] = 0.0;
          logger.warning(`Error fetching data for measuring point ${mpUuid}`);
          continue;
        }

        // Calculate total consumption from reads data
        const totalConsumption = data.reads.reduce((sum, read) => sum + parseFloat(read.consumption || 0), 0);
        consumptionData[mpUuid] = totalConsumption;
        logger.info(`Calculated consumption for ${mpUuid}: ${totalConsumption} kWh`);
      }

    } catch (error) {
      logger.error(`Error fetching consumption data: ${error.message}`);
      // Return empty data on error
      for (const mpUuid of measuringPointUuids) {
        consumptionData[mpUuid] = 0.0;
      }
    }
    return consumptionData;
  }

  async validateMeasuringPoint(moduleUuid, measuringPointUuid) {
    /**
     * Validate if a measuring point exists and is accessible
     */
    try {
      const endpoint = `${this.baseUrl}/v1/modules/${moduleUuid}/measuring-points/${measuringPointUuid}`;
      const response = await axios.get(endpoint, { headers: this.headers });

      return response.status === 200;
    } catch (error) {
      logger.error(`Error validating measuring point: ${error.message}`);
      return false;
    }
  }

  async getDeviceConsumption(deviceId, startDate, endDate) {
    /**
     * Fetch consumption data for a specific device from Cloud Ocean platform
     */
    try {
      const endpoint = `${this.baseUrl}/devices/${deviceId}/consumption`;
      const params = {
        start_date: moment(startDate).toISOString(),
        end_date: moment(endDate).toISOString(),
      };

      const response = await axios.get(endpoint, { headers: this.headers, params });
      return response.data?.data || [];

    } catch (error) {
      logger.error(`Error fetching device consumption data: ${error.message}`);
      throw error;
    }
  }

  async getDeviceInfo(deviceId) {
    /**
     * Fetch device information from Cloud Ocean platform
     */
    try {
      const endpoint = `${this.baseUrl}/devices/${deviceId}`;
      const response = await axios.get(endpoint, { headers: this.headers });

      return response.data?.data || {};
    } catch (error) {
      logger.error(`Error fetching device info: ${error.message}`);
      throw error;
    }
  }
}

module.exports = CloudOceanAPI;
