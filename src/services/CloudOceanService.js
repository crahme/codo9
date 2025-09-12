import { logger } from '../utils/logger.js';

export class CloudOceanService {
    constructor(baseUrl, apiKey) {
        this.baseUrl = 'https://api.develop.rve.ca/v1';
        this.moduleId = 'c667ff46-9730-425e-ad48-1e950691b3f9';
        this.headers = {
            'Access-Token': `Bearer ${process.env.API_Key}`,
            'Content-Type': 'application/json'
        };
        this.maxRetries = 3;
        this.baseDelay = 4000; // 4 seconds
    }

    async fetchWithRetry(url, options, attempt = 1) {
        try {
            const response = await fetch(url, options);
            
            if (!response.ok) {
                const errorData = await response.json();
                logger.warn(`Request failed (${response.status}): ${JSON.stringify(errorData)}`);
                
                if (response.status === 503 && attempt < this.maxRetries) {
                    const delay = this.baseDelay * attempt;
                    logger.info(`Retrying in ${delay/1000}s... (attempt ${attempt}/${this.maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return this.fetchWithRetry(url, options, attempt + 1);
                }
                
                throw new Error(`${response.status} ${response.statusText}`);
            }

            return response.json();
        } catch (error) {
            if (attempt < this.maxRetries) {
                const delay = this.baseDelay * attempt;
                logger.info(`Network error, retrying in ${delay/1000}s... (attempt ${attempt}/${this.maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.fetchWithRetry(url, options, attempt + 1);
            }
            throw new Error(`Failed after ${this.maxRetries} attempts: ${error.message}`);
        }
    }

    async getConsumptionData(startDate, endDate, limit = 50, offset = 0) {
        try {
            const measuringPoints = [
                {
                    "uuid": "71ef9476-3855-4a3f-8fc5-333cfbf9e898",
                    "name": "EV Charger Station 01",
                    "location": "Building A - Level 1"
                },
                {
                    "uuid": "fd7e69ef-cd01-4b9a-8958-2aa5051428d4", 
                    "name": "EV Charger Station 02",
                    "location": "Building A - Level 2"
                },
                {
                    "uuid": "b7423cbc-d622-4247-bb9a-8d125e5e2351",
                    "name": "EV Charger Station 03", 
                    "location": "Building B - Parking Garage"
                },
                {
                    "uuid": "88f4f9b6-ce65-48c4-86e6-1969a64ad44c",
                    "name": "EV Charger Station 04",
                    "location": "Building B - Ground Floor"
                },
                {
                    "uuid": "df428bf7-dd2d-479c-b270-f8ac5c1398dc",
                    "name": "EV Charger Station 05",
                    "location": "Building C - East Wing"
                },
                {
                    "uuid": "7744dcfc-a059-4257-ac96-6650feef9c87",
                    "name": "EV Charger Station 06",
                    "location": "Building C - West Wing"
                },
                {
                    "uuid": "b1445e6d-3573-403a-9f8e-e82f70556f7c",
                    "name": "EV Charger Station 07",
                    "location": "Building D - Main Entrance"
                },
                {
                    "uuid": "ef296fba-4fcc-4dcb-8eda-e6d1772cd819",
                    "name": "EV Charger Station 08",
                    "location": "Building D - Loading Dock"
                },
                {
                    "uuid": "50206eae-41b8-4a84-abe4-434c7f79ae0a",
                    "name": "EV Charger Station 09",
                    "location": "Outdoor Lot - Section A"
                },
                {
                    "uuid": "de2d9680-f132-4529-b9a9-721265456a86",
                    "name": "EV Charger Station 10",
                    "location": "Outdoor Lot - Section B"
                },
                {
                    "uuid": "bd36337c-8139-495e-b026-f987b79225b8",
                    "name": "EV Charger Station 11",
                    "location": "Visitor Parking - Main Gate"
                }
            ]
            
                
                // Add other measuring points as needed
            

            const consumptionData = [];

            for (const point of measuringPoints) {
                const url = new URL(`${this.baseUrl}/modules/${this.moduleId}/measuring-points/${point.uuid}/reads`);
                url.searchParams.set('start', startDate);
                url.searchParams.set('end', endDate);
                url.searchParams.set('limit', limit.toString());
                url.searchParams.set('offset', offset.toString());

                const data = await this.fetchWithRetry(url.toString(), {
                    method: 'GET',
                    headers: this.headers
                });

                // Calculate consumption from readings
                const sortedReads = data.sort((a, b) => 
                    new Date(a.time_stamp) - new Date(b.time_stamp)
                );

                const consumption = sortedReads.length > 0 ? 
                    sortedReads[sortedReads.length - 1].cumulative_kwh - sortedReads[0].cumulative_kwh :
                    0;

                consumptionData.push({
                    uuid: point.uuid,
                    name: point.name,
                    consumption: Math.max(0, consumption),
                    readings: sortedReads.map(read => ({
                        timestamp: read.time_stamp,
                        value: read.cumulative_kwh
                    }))
                });
            }

            return consumptionData;

        } catch (error) {
            logger.error(`Failed to fetch consumption data: ${error.message}`);
            throw error;
        }
    }

    // ...existing calculateTotals method...
}