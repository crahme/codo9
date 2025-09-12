import { logger } from '../utils/logger.js';

export class CloudOceanService {
    constructor(baseUrl, apiKey) {
        this.baseUrl = baseUrl;
        this.headers = {
            'Access-Token': `Bearer ${process.env.API_Key}`,
            'Content-Type': 'application/json'
        };
    }

    async getConsumptionData(startDate, endDate) {
        try {
            const url = new URL(`${this.baseUrl}/consumption`);
            url.searchParams.set('start', startDate);
            url.searchParams.set('end', endDate);

            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: this.headers
            });

            if (!response.ok) {
                throw new Error(`API call failed: ${response.statusText}`);
            }

            const data = await response.json();
            
            // Transform API data to match invoice structure
            return data.map(station => ({
                uuid: station.uuid,
                name: station.name,
                consumption: station.cumulative_kwh || 0,
                readings: station.reads.map(read => ({
                    timestamp: read.time_stamp,
                    value: read.value
                }))
            }));
        } catch (error) {
            logger.error(`Failed to fetch consumption data: ${error.message}`);
            throw error;
        }
    }

      calculateTotals(consumptionData, rate) {
        const totalConsumption = consumptionData.reduce(
            (sum, station) => sum + station.consumption, 
            0
        );
        
        return {
            totalConsumption,
            totalAmount: totalConsumption * rate
        };
    }
}