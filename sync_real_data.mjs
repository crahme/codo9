import { setTimeout } from 'timers/promises';
import { fileURLToPath, pathToFileURL } from 'url';
import dotenv from 'dotenv';
import pino from 'pino';

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
const RETRY_CONFIG = {
    maxAttempts: 5,
    initialDelay: 8000,
    maxDelay: 60000,
    backoffFactor: 1.5
};

class CloudOceanAPI {
    constructor() {
        this.baseUrl = process.env.CLOUD_OCEAN_BASE_URL || "https://api.develop.rve.ca/v1";
        this.headers = {
            'Access-Token': `Bearer ${process.env.API_KEY}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
        
        if (!process.env.API_KEY) {
            throw new Error('API_KEY not set in environment variables');
        }
    }

    async fetchWithBackoff(url, options, attempt = 1) {
        try {
            logger.debug(`Request attempt ${attempt}/${RETRY_CONFIG.maxAttempts} to: ${url}`);
            const response = await fetch(url, options);
            const contentType = response.headers.get('content-type');
            
            if (!response.ok) {
                const errorBody = contentType?.includes('application/json') 
                    ? await response.json()
                    : await response.text();
                
                logger.warn(`Request failed (${response.status}): ${JSON.stringify(errorBody)}`);

                if (response.status === 503 && attempt < RETRY_CONFIG.maxAttempts) {
                    const delay = Math.min(
                        RETRY_CONFIG.initialDelay * Math.pow(RETRY_CONFIG.backoffFactor, attempt - 1),
                        RETRY_CONFIG.maxDelay
                    );
                    const jitter = Math.random() * 1000;
                    
                    logger.info(`Service unavailable. Waiting ${Math.floor((delay + jitter)/1000)}s before retry...`);
                    await setTimeout(delay + jitter);
                    return this.fetchWithBackoff(url, options, attempt + 1);
                }

                throw new Error(`HTTP ${response.status}: ${JSON.stringify(errorBody)}`);
            }

            return response.json();
        } catch (error) {
            if (attempt < RETRY_CONFIG.maxAttempts && 
                (error.name === 'TypeError' || error.name === 'FetchError' || error.message.includes('503'))) {
                const delay = Math.min(
                    RETRY_CONFIG.initialDelay * Math.pow(RETRY_CONFIG.backoffFactor, attempt - 1),
                    RETRY_CONFIG.maxDelay
                );
                logger.warn(`Attempt ${attempt} failed: ${error.message}`);
                await setTimeout(delay);
                return this.fetchWithBackoff(url, options, attempt + 1);
            }
            throw error;
        }
    }

    async getModuleConsumption(moduleUuid, measuringPoints, startDate, endDate) {
        const results = [];
        let successCount = 0;
        const totalPoints = measuringPoints.length;

        for (const point of measuringPoints) {
            try {
                logger.info(`Processing ${point.name}...`);
                const url = new URL(`${this.baseUrl}/modules/${moduleUuid}/measuring-points/${point.uuid}/reads`);
                url.searchParams.set('start', startDate.toISOString().split('T')[0]);
                url.searchParams.set('end', endDate.toISOString().split('T')[0]);

                const data = await this.fetchWithBackoff(url.toString(), {
                    method: 'GET',
                    headers: this.headers
                });

                if (Array.isArray(data) && data.length > 0) {
                    const sortedData = data.sort((a, b) => 
                        new Date(a.time_stamp) - new Date(b.time_stamp)
                    );

                    const firstReading = sortedData[0].cumulative_kwh;
                    const lastReading = sortedData[sortedData.length - 1].cumulative_kwh;
                    const consumption = Math.max(0, lastReading - firstReading);

                    results.push({
                        uuid: point.uuid,
                        name: point.name,
                        location: point.location,
                        consumption,
                        firstReading: sortedData[0],
                        lastReading: sortedData[sortedData.length - 1]
                    });

                    successCount++;
                    logger.info(`Successfully processed ${point.name}: ${consumption.toFixed(2)} kWh`);
                } else {
                    logger.warn(`No readings found for ${point.name}`);
                }
            } catch (error) {
                logger.error(`Failed to process ${point.name}: ${error.message}`);
            }
        }

        if (successCount === 0) {
            throw new Error('Failed to fetch data for any measuring points');
        }

        const totalConsumption = results.reduce((sum, r) => sum + r.consumption, 0);
        logger.info(`Successfully processed ${successCount}/${totalPoints} stations`);
        logger.info(`Total consumption: ${totalConsumption.toFixed(2)} kWh`);

        return results;
    }
}

async function syncRealData() {
    const api = new CloudOceanAPI();
    logger.info('Starting data sync...');

    try {
        const startDate = new Date(Date.UTC(2024, 9, 16));
        const endDate = new Date(Date.UTC(2024, 10, 25));
        
        logger.info(`Fetching consumption data for date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

        const results = await api.getModuleConsumption(
            MODULE_UUID,
            MEASURING_POINTS,
            startDate,
            endDate
        );

        return { success: true, data: results };
    } catch (error) {
        logger.error('Sync failed:', error.stack || error.message);
        return { success: false, error: error.message };
    }
}

// Run if called directly
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    syncRealData()
        .then(result => {
            if (result.success) {
                logger.info('✅ Data sync completed successfully!');
                process.exit(0);
            } else {
                logger.error('❌ Data sync failed:', result.error);
                process.exit(1);
            }
        })
        .catch(error => {
            logger.error('Fatal error:', error);
            process.exit(1);
        });
}

export { syncRealData, CloudOceanAPI };