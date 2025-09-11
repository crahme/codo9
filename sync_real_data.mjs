import { setTimeout } from 'timers/promises';
import { fileURLToPath } from 'url';
import path from 'path';
import pino from 'pino';
import dotenv from 'dotenv';
import { Sequelize, Model, DataTypes } from 'sequelize';

// Initialize logger and load environment variables
const logger = pino({ level: 'info' });
dotenv.config();

// Constants
const MODULE_UUID = "c667ff46-9730-425e-ad48-1e950691b3f9";
const MEASURING_POINTS = [
    {
        uuid: "71ef9476-3855-4a3f-8fc5-333cfbf9e898",
        name: "EV Charger Station 01",
        location: "Building A - Level 1"
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
    // ... other measuring points (copy from Python version)
];

// Database Models
class Device extends Model {}
class ConsumptionRecord extends Model {}
class Invoice extends Model {}

// Database setup
const sequelize = new Sequelize(process.env.NETLIFY_DATABASE_URL, {
    dialect: 'postgres',
    logging: false,
    ssl: true,
    dialectOptions: {
        ssl: {
            require: true,
            rejectUnauthorized: false
        }
    }
});

// Initialize models
Device.init({
    model_number: DataTypes.STRING,
    serial_number: DataTypes.STRING,
    location: DataTypes.STRING,
    status: DataTypes.STRING,
    max_amperage: DataTypes.FLOAT,
    evse_count: DataTypes.INTEGER
}, { sequelize });

ConsumptionRecord.init({
    device_id: DataTypes.INTEGER,
    timestamp: DataTypes.DATE,
    kwh_consumption: DataTypes.FLOAT,
    rate: DataTypes.FLOAT
}, { sequelize });

Invoice.init({
    device_id: DataTypes.INTEGER,
    invoice_number: DataTypes.STRING,
    billing_period_start: DataTypes.DATE,
    billing_period_end: DataTypes.DATE,
    total_kwh: DataTypes.FLOAT,
    total_amount: DataTypes.FLOAT,
    status: DataTypes.STRING
}, { sequelize });

// Cloud Ocean API class
class CloudOceanAPI {
    constructor() {
        this.apiKey = process.env.API_Key;
        this.baseUrl = process.env.CLOUD_OCEAN_BASE_URL || "https://api.develop.rve.ca/v1";
    }

    async getModuleConsumption(moduleUuid, measuringPointUuids, startDate, endDate) {
        const result = {};
        for (const mpUuid of measuringPointUuids) {
            try {
                const url = new URL(`${this.baseUrl}/modules/${moduleUuid}/measuring-points/${mpUuid}/reads`);
                url.searchParams.set('start', startDate.toISOString().split('T')[0]);
                url.searchParams.set('end', endDate.toISOString().split('T')[0]);

                const response = await fetch(url.toString(), {
                    headers: {
                        'Access-Token': this.apiKey,
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const data = await response.json();
                result[mpUuid] = parseFloat(data.consumption) || 0;
            } catch (error) {
                logger.error(`Failed to fetch data for measuring point ${mpUuid}: ${error.message}`);
                result[mpUuid] = 0;
            }
        }
        return result;
    }
}

async function syncRealData() {
    try {
        await sequelize.sync({ force: true });
        const cloudOcean = new CloudOceanAPI();

        // Create devices
        const devices = [];
        for (const mp of MEASURING_POINTS) {
            const device = await Device.create({
                model_number: 'SMP-901',
                serial_number: mp.uuid.substring(0, 8).toUpperCase(),
                location: mp.location,
                status: 'active',
                max_amperage: 32.0,
                evse_count: 2
            });
            devices.push(device);
        }

        logger.info(`Created ${devices.length} devices with real measuring point UUIDs`);

        // Fetch real consumption data
        const startDate = new Date(2024, 9, 16);
        const endDate = new Date(2024, 10, 25);

        const measuringPointUuids = MEASURING_POINTS.map(mp => mp.uuid);
        const realConsumption = await cloudOcean.getModuleConsumption(
            MODULE_UUID,
            measuringPointUuids,
            startDate,
            endDate
        );

        // Process consumption data
        const hasRealData = Object.values(realConsumption).some(v => v > 0);

        if (hasRealData) {
            // Create consumption records based on real data
            // ... (similar to Python version)
        } else {
            // Create demo data
            // ... (similar to Python version)
        }

        // Create invoices
        // ... (similar to Python version)

        // Print summary
        const deviceCount = await Device.count();
        const recordCount = await ConsumptionRecord.count();
        const invoiceCount = await Invoice.count();
        
        logger.info('===== DATABASE SYNC COMPLETE =====');
        logger.info(`Total devices: ${deviceCount}`);
        logger.info(`Total consumption records: ${recordCount}`);
        logger.info(`Total invoices: ${invoiceCount}`);

        return true;
    } catch (error) {
        logger.error('Sync failed:', error);
        return false;
    }
}

// Run if called directly
if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
    try {
        const success = await syncRealData();
        process.exit(success ? 0 : 1);
    } catch (error) {
        logger.error(error);
        process.exit(1);
    }
}

export { syncRealData, CloudOceanAPI };