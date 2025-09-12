import { setTimeout } from 'timers/promises';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { Client } from 'pg';
import dotenv from 'dotenv';
import pino from 'pino';
import { Sequelize, Model, DataTypes } from 'sequelize';
// Initialize logger and load environment variables
const logger = pino({ 
    level: process.env.LOG_LEVEL || 'info',
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true
        }
    }
});
dotenv.config();
const sequelize = new Sequelize(process.env.NETLIFY_DATABASE_URL, {
    dialect: 'postgres',
    logging: msg => logger.debug(msg),
    ssl: true,
    dialectOptions: {
        ssl: {
            require: true,
            rejectUnauthorized: false
        }
    }
});

const API_HEADERS = {
    'Access-Token': `${process.env.API_Key}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
};
// Constants
const MEASURING_POINTS = [
    { uuid: "71ef9476-3855-4a3f-8fc5-333cfbf9e898", name: "EV Charger Station 01", location: "Building A - Level 1" },
    { uuid: "fd7e69ef-cd01-4b9a-8958-2aa5051428d4", name: "EV Charger Station 02", location: "Building A - Level 2" },
    { uuid: "b7423cbc-d622-4247-bb9a-8d125e5e2351", name: "EV Charger Station 03", location: "Building B - Parking Garage" },
    { uuid: "88f4f9b6-ce65-48c4-86e6-1969a64ad44c", name: "EV Charger Station 04", location: "Building B - Ground Floor" },
    { uuid: "df428bf7-dd2d-479c-b270-f8ac5c1398dc", name: "EV Charger Station 05", location: "Building C - East Wing" },
    { uuid: "7744dcfc-a059-4257-ac96-6650feef9c87", name: "EV Charger Station 06", location: "Building C - West Wing" },
    { uuid: "b1445e6d-3573-403a-9f8e-e82f70556f7c", name: "EV Charger Station 07", location: "Building D - Main Entrance" },
    { uuid: "ef296fba-4fcc-4dcb-8eda-e6d1772cd819", name: "EV Charger Station 08", location: "Building D - Loading Dock" },
    { uuid: "50206eae-41b8-4a84-abe4-434c7f79ae0a", name: "EV Charger Station 09", location: "Outdoor Lot - Section A" },
    { uuid: "de2d9680-f132-4529-b9a9-721265456a86", name: "EV Charger Station 10", location: "Outdoor Lot - Section B" },
    { uuid: "bd36337c-8139-495e-b026-f987b79225b8", name: "EV Charger Station 11", location: "Visitor Parking - Main Gate" }
];

const MODULE_UUID = "c667ff46-9730-425e-ad48-1e950691b3f9";
const RETRY_CONFIG = { maxAttempts: 3, initialDelay: 2000, maxDelay: 10000 };

// Database Models
class Device extends Model {}
Device.init({
    model_number: DataTypes.STRING,
    serial_number: DataTypes.STRING,
    location: DataTypes.STRING,
    status: DataTypes.STRING,
    max_amperage: DataTypes.FLOAT,
    evse_count: DataTypes.INTEGER
}, { sequelize, modelName: 'Device' });

class ConsumptionRecord extends Model {}
ConsumptionRecord.init({
    device_id: DataTypes.INTEGER,
    timestamp: DataTypes.DATE,
    kwh_consumption: DataTypes.FLOAT,
    rate: DataTypes.FLOAT
}, { sequelize, modelName: 'ConsumptionRecord' });

class CloudOceanAPI {
    constructor() {
        this.apiKey = process.env.API_Key;
        this.baseUrl = process.env.CLOUD_OCEAN_BASE_URL || "https://api.develop.rve.ca/v1";
        
        if (!this.apiKey) {
            throw new Error('API_Key not set in environment variables');
        }
        this.headers = { ...API_HEADERS };
        logger.debug('API Configuration:', {
            baseUrl: this.baseUrl,
            hasApiKey: !!this.apiKey,
            headers: Object.keys(this.headers)
        });
    }

    async fetchWithRetry(url, options) {
        let delay = RETRY_CONFIG.initialDelay;
        
        for (let attempt = 1; attempt <= RETRY_CONFIG.maxAttempts; attempt++) {
            try {
                logger.debug(`Making request to: ${url}`);
                const response = await fetch(url, options);
                
                if (response.ok) {
                    const data = await response.json();
                    logger.debug(`Successful response from ${url}`);
                    return data;
                }
                
                const errorBody = await response.text();
                logger.warn(`Request failed (${response.status}): ${errorBody}`);
                
                if (response.status === 401) {
                    throw new Error(`Authentication failed - please check your API key`);
                }
                
                if (attempt === RETRY_CONFIG.maxAttempts) {
                    throw new Error(`Failed after ${attempt} attempts: ${response.status} ${response.statusText}`);
                }
                
                delay = Math.min(delay * 2, RETRY_CONFIG.maxDelay);
                logger.info(`Retrying in ${delay/1000}s... (attempt ${attempt}/${RETRY_CONFIG.maxAttempts})`);
                await setTimeout(delay);
                
            } catch (error) {
                if (attempt === RETRY_CONFIG.maxAttempts) throw error;
                logger.warn(`Attempt ${attempt} failed: ${error.message}`);
            }
        }
    }

       async getModuleConsumption(moduleUuid, measuringPoints, startDate, endDate) {
        const result = {};
        for (const point of measuringPoints) {
            try {
                const url = new URL(`${this.baseUrl}/modules/${moduleUuid}/measuring-points/${point.uuid}/reads`);
                url.searchParams.set('start', startDate.toISOString().split('T')[0]);
                url.searchParams.set('end', endDate.toISOString().split('T')[0]);

                const data = await this.fetchWithRetry(url.toString(), {
                    method: 'GET',
                    headers: this.headers
                });

                if (Array.isArray(data) && data.length > 0) {
                    // Sort readings by timestamp
                    const sortedData = data.sort((a, b) => 
                        new Date(a.time_stamp) - new Date(b.time_stamp)
                    );

                    // Calculate consumption as difference between last and first reading
                    const firstReading = sortedData[0].cumulative_kwh;
                    const lastReading = sortedData[sortedData.length - 1].cumulative_kwh;
                    const consumption = Math.max(0, lastReading - firstReading);

                    result[point.uuid] = consumption;
                    logger.info(`Fetched consumption for ${point.name}: ${consumption.toFixed(2)} kWh`);
                    logger.debug(`First reading: ${firstReading}, Last reading: ${lastReading}`);
                } else {
                    logger.warn(`No readings found for ${point.name}`);
                    result[point.uuid] = 0;
                }
            } catch (error) {
                logger.error(`Failed to fetch data for ${point.name} (${point.uuid}): ${error.message}`);
                result[point.uuid] = 0;
            }
        }

        // Log total consumption
        const totalConsumption = Object.values(result).reduce((sum, val) => sum + val, 0);
        logger.info(`Total consumption across all points: ${totalConsumption.toFixed(2)} kWh`);

        return result;
    }
}

async function syncRealData() {
    const dbUrl = process.env.NETLIFY_DATABASE_URL;
    if (!dbUrl) {
        throw new Error('NETLIFY_DATABASE_URL is not set in environment variables');
    }

    const api = new CloudOceanAPI();
    logger.info('Starting data sync...');

    try {
        const startDate = new Date(Date.UTC(2024, 9, 16));
        const endDate = new Date(Date.UTC(2024, 10, 25));
        
        logger.info(`Fetching consumption data for date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

        const consumption = await api.getModuleConsumption(
            MODULE_UUID,
            MEASURING_POINTS,
            startDate,
            endDate
        );

        const totalConsumption = Object.values(consumption).reduce((sum, val) => sum + val, 0);
        logger.info(`Total consumption across all points: ${totalConsumption.toFixed(2)} kWh`);

        return true;
    } catch (error) {
        logger.error('Sync failed:', error.stack || error.message);
        return false;
    }
}

// Run if called directly
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    syncRealData()
        .then(success => {
            logger.info(success ? '✅ Data sync completed successfully!' : '❌ Data sync failed!');
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            logger.error('Fatal error:', error);
            process.exit(1);
        });
}

export { syncRealData, CloudOceanAPI };