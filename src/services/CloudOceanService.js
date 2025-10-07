import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const logger = {
    info: (...args) => console.log("[INFO]", ...args),
    warn: (...args) => console.warn("[WARN]", ...args),
    error: (...args) => console.error("[ERROR]", ...args),
};

export class CloudOceanService {
    // ...existing constructor and other methods...

    async validateApiData(point, startDate, endDate) {
        logger.info(`Validating data for ${point.name}...`);
        
        try {
            // Get both reads and CDR data
            const read = await this.getReads(point, startDate, endDate);
            const cdrArray = await this.getCdr(point, startDate, endDate);

            // Log detailed validation
            console.table({
                'Station Name': point.name,
                'Days with Data': cdrArray.filter(d => d.daily_kwh > 0).length,
                'Total Days': cdrArray.length,
                'Has Readings': read.cumulative_kwh > 0 ? 'Yes' : 'No',
                'CDR Total': cdrArray.reduce((sum, d) => sum + d.daily_kwh, 0).toFixed(2),
                'Reads Total': read.cumulative_kwh.toFixed(2)
            });

            // Return validation results
            return {
                hasReadings: read.cumulative_kwh > 0,
                hasCdrRecords: cdrArray.some(d => d.daily_kwh > 0),
                daysWithData: cdrArray.filter(d => d.daily_kwh > 0).length,
                totalDays: cdrArray.length
            };
        } catch (error) {
            logger.error(`Validation failed for ${point.name}: ${error.message}`);
            return {
                hasReadings: false,
                hasCdrRecords: false,
                daysWithData: 0,
                totalDays: 0,
                error: error.message
            };
        }
    }

    async validateAllStations(startDate, endDate) {
        const measuringPoints = [
            { uuid: "71ef9476-3855-4a3f-8fc5-333cfbf9e898", name: "EV Charger Station 01", location: "Building A - Level 1" },
            { uuid: "fd7e69ef-cd01-4b9a-8958-2aa5051428d4", name: "EV Charger Station 02", location: "Building A - Level 2" },
            { uuid: "b7423cbc-d622-4247-bb9a-8d125e5e2351", name: "EV Charger Station 03", location: "Building B - Parking Garage" }
        ];

        logger.info(`Starting validation for all stations from ${startDate} to ${endDate}`);
        
        const results = [];
        for (const point of measuringPoints) {
            const validation = await this.validateApiData(point, startDate, endDate);
            results.push({
                station: point.name,
                location: point.location,
                ...validation
            });
        }

        // Log summary
        console.log('\nValidation Summary:');
        console.table(results);

        return results;
    }
}

// Update runner section
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const service = new CloudOceanService();
    (async () => {
        try {
            const startDate = "2024-10-16";
            const endDate = "2024-11-25";

            // Run validation first
            console.log('\nValidating API Data...');
            await service.validateAllStations(startDate, endDate);

            // Then fetch consumption data
            console.log('\nFetching Consumption Data...');
            const data = await service.getConsumptionData(startDate, endDate);

            // ...existing console.log statements...
        } catch (err) {
            console.error("❌ Runner error:", err.message);
        }
    })();
}