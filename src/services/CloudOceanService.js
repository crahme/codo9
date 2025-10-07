import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

dotenv.config();

const logger = {
    info: (...args) => console.log("[INFO]", ...args),
    warn: (...args) => console.warn("[WARN]", ...args),
    error: (...args) => console.error("[ERROR]", ...args),
    debug: (...args) => console.debug("[DEBUG]", ...args)
};

export class CloudOceanService {
    constructor() {
        this.baseUrl = 'https://api.develop.rve.ca/v1';
        this.moduleId = 'c667ff46-9730-425e-ad48-1e950691b3f9';
        this.headers = {
            "Access-Token": process.env.API_KEY,
            'Content-Type': 'application/json'
        };
        this.measuringPoints = [
            { uuid: "71ef9476-3855-4a3f-8fc5-333cfbf9e898", name: "EV Charger Station 01", location: "Building A - Level 1" },
            { uuid: "fd7e69ef-cd01-4b9a-8958-2aa5051428d4", name: "EV Charger Station 02", location: "Building A - Level 2" },
            { uuid: "b7423cbc-d622-4247-bb9a-8d125e5e2351", name: "EV Charger Station 03", location: "Building B - Parking Garage" }
        ];
    }

    async getReads(point, startDate, endDate) {
        try {
            const url = new URL(`${this.baseUrl}/modules/${this.moduleId}/measuring-points/${point.uuid}/reads`);
            url.searchParams.set('start', startDate);
            url.searchParams.set('end', endDate);

            logger.debug(`Fetching reads for ${point.name}`);
            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: this.headers
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (Array.isArray(data) && data.length > 0) {
                const sortedData = data.sort((a, b) => 
                    new Date(a.time_stamp) - new Date(b.time_stamp)
                );
                return {
                    cumulative_kwh: sortedData[sortedData.length - 1].cumulative_kwh - sortedData[0].cumulative_kwh,
                    readings: sortedData,
                    firstReading: sortedData[0],
                    lastReading: sortedData[sortedData.length - 1]
                };
            }
            return { cumulative_kwh: 0, readings: [], firstReading: null, lastReading: null };
        } catch (error) {
            logger.error(`Error fetching reads for ${point.name}: ${error.message}`);
            throw error;
        }
    }

    async getCdr(point, startDate, endDate) {
        try {
            const url = new URL(`${this.baseUrl}/modules/${this.moduleId}/measuring-points/${point.uuid}/cdr`);
            url.searchParams.set('start', startDate);
            url.searchParams.set('end', endDate);

            logger.debug(`Fetching CDR for ${point.name}`);
            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: this.headers
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return Array.isArray(data) ? data : [];
        } catch (error) {
            logger.error(`Error fetching CDR for ${point.name}: ${error.message}`);
            throw error;
        }
    }

    async validateMeasuringPoint(point, startDate, endDate) {
        try {
            logger.info(`Validating measuring point ${point.name}...`);
            
            const [readData, cdrData] = await Promise.all([
                this.getReads(point, startDate, endDate),
                this.getCdr(point, startDate, endDate)
            ]);

            const validation = {
                name: point.name,
                location: point.location,
                uuid: point.uuid,
                reads: {
                    count: readData.readings.length,
                    totalConsumption: readData.cumulative_kwh,
                    firstTimestamp: readData.firstReading?.time_stamp,
                    lastTimestamp: readData.lastReading?.time_stamp
                },
                cdr: {
                    count: cdrData.length,
                    totalConsumption: cdrData.reduce((sum, session) => sum + (session.energy_kwh || 0), 0)
                },
                hasData: readData.readings.length > 0 || cdrData.length > 0
            };

            logger.info(`Validation results for ${point.name}:`, validation);
            return validation;

        } catch (error) {
            logger.error(`Validation failed for ${point.name}: ${error.message}`);
            return {
                name: point.name,
                location: point.location,
                uuid: point.uuid,
                error: error.message,
                hasData: false
            };
        }
    }

    async validateAllStations(startDate, endDate) {
        logger.info(`Starting validation for all stations from ${startDate} to ${endDate}`);
        
        const results = [];
        for (const point of this.measuringPoints) {
            const validation = await this.validateMeasuringPoint(point, startDate, endDate);
            results.push(validation);
        }

        // Display results in table format
        console.table(results.map(r => ({
            'Station': r.name,
            'Location': r.location,
            'Has Data': r.hasData,
            'Reads Count': r?.reads?.count || 0,
            'CDR Count': r?.cdr?.count || 0,
            'Total kWh (Reads)': r?.reads?.totalConsumption?.toFixed(2) || 0,
            'Total kWh (CDR)': r?.cdr?.totalConsumption?.toFixed(2) || 0,
            'Error': r.error || ''
        })));

        return results;
    }

    async getConsumptionData(startDate, endDate) {
        const results = [];
        for (const point of this.measuringPoints) {
            try {
                const [readData, cdrData] = await Promise.all([
                    this.getReads(point, startDate, endDate),
                    this.getCdr(point, startDate, endDate)
                ]);

                results.push({
                    station: point.name,
                    location: point.location,
                    consumption: readData.cumulative_kwh,
                    sessions: cdrData.length,
                    dailyData: cdrData
                });
            } catch (error) {
                logger.error(`Error fetching data for ${point.name}: ${error.message}`);
            }
        }
        return results;
    }
}

// Runner section
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const service = new CloudOceanService();
    (async () => {
        try {
            const startDate = "2024-10-16";
            const endDate = "2024-11-25";

            console.log('\nValidating API Data...');
            const validationResults = await service.validateAllStations(startDate, endDate);
            
            if (validationResults.some(r => r.hasData)) {
                console.log('\nFetching Consumption Data...');
                const data = await service.getConsumptionData(startDate, endDate);
                console.log(JSON.stringify(data, null, 2));
            } else {
                console.log('\n❌ No valid data found in any station');
            }
        } catch (err) {
            console.error("❌ Runner error:", err.message);
        }
    })();
}