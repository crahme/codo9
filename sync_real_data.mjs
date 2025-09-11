import { setTimeout } from 'timers/promises';
import { fileURLToPath } from 'url';
import path from 'path';
import pino from 'pino';
import dotenv from 'dotenv';
import { Sequelize, Model, DataTypes } from 'sequelize';

// Initialize logger and load environment variables
const logger = pino({ level: 'info' });
dotenv.config();

// Constants for database
const DATABASE_URL = process.env.NETLIFY_DATABASE_URL;
const MODULE_UUID = "c667ff46-9730-425e-ad48-1e950691b3f9";

// Database setup
const sequelize = new Sequelize(DATABASE_URL, {
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

// Define models
class Device extends Model {}
class ConsumptionRecord extends Model {}
class Invoice extends Model {}

// Initialize models
Device.init({
    model_number: DataTypes.STRING,
    serial_number: DataTypes.STRING,
    location: DataTypes.STRING,
    status: DataTypes.STRING,
    max_amperage: DataTypes.FLOAT,
    evse_count: DataTypes.INTEGER
}, { sequelize, modelName: 'Device' });

ConsumptionRecord.init({
    device_id: DataTypes.INTEGER,
    timestamp: DataTypes.DATE,
    kwh_consumption: DataTypes.FLOAT,
    rate: DataTypes.FLOAT
}, { sequelize, modelName: 'ConsumptionRecord' });

Invoice.init({
    device_id: DataTypes.INTEGER,
    invoice_number: DataTypes.STRING,
    billing_period_start: DataTypes.DATE,
    billing_period_end: DataTypes.DATE,
    total_kwh: DataTypes.FLOAT,
    total_amount: DataTypes.FLOAT,
    status: DataTypes.STRING
}, { sequelize, modelName: 'Invoice' });

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

        // Create devices from measuring points
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
        const startDate = new Date(2024, 9, 16); // Note: month is 0-based in JS
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
            for (let i = 0; i < devices.length; i++) {
                const device = devices[i];
                const mp = MEASURING_POINTS[i];
                const totalConsumption = realConsumption[mp.uuid] || 0;

                if (totalConsumption > 0) {
                    const dailyConsumption = totalConsumption / 30;
                    for (let day = 0; day < 30; day++) {
                        const recordDate = new Date(startDate);
                        recordDate.setDate(startDate.getDate() + day);
                        
                        const variation = 0.8 + (day % 5) * 0.1;
                        const consumption = dailyConsumption * variation;

                        await ConsumptionRecord.create({
                            device_id: device.id,
                            timestamp: recordDate,
                            kwh_consumption: Math.round(consumption * 100) / 100,
                            rate: 0.12
                        });
                    }
                }
            }
        } else {
            // Create demo data
            logger.warn("No real data available, creating demo records...");
            
            const baseConsumption = {
                'Building A': 45.0,
                'Building B': 38.0,
                'Building C': 42.0,
                'Building D': 35.0,
                'Outdoor Lot': 30.0,
                'Visitor Parking': 25.0
            };

            for (const device of devices) {
                for (let i = 0; i < 40; i++) {
                    const recordDate = new Date(startDate);
                    recordDate.setDate(startDate.getDate() + i);

                    const locationKey = device.location.split(' - ')[0];
                    const dailyBase = baseConsumption[locationKey] || 35.0;

                    const dayVariation = 0.8 + (i % 7) * 0.1;
                    const deviceVariation = 0.9 + (device.id % 3) * 0.2;
                    const randomVariation = 0.85 + (i % 4) * 0.15;

                    const consumption = dailyBase * dayVariation * deviceVariation * randomVariation;

                    await ConsumptionRecord.create({
                        device_id: device.id,
                        timestamp: recordDate,
                        kwh_consumption: Math.round(consumption * 100) / 100,
                        rate: 0.12
                    });
                }
            }
        }

        // Create invoices
        for (const device of devices) {
            for (let month = 0; month < 2; month++) {
                const invoiceStart = new Date(2024, 9 + month, 1);
                const invoiceEnd = month === 0 
                    ? new Date(2024, 9, 31)
                    : new Date(2024, 10, 25);

                const records = await ConsumptionRecord.findAll({
                    where: {
                        device_id: device.id,
                        timestamp: {
                            [Sequelize.Op.between]: [invoiceStart, invoiceEnd]
                        }
                    }
                });

                const totalKwh = records.reduce((sum, record) => sum + record.kwh_consumption, 0);
                const totalAmount = Math.round(totalKwh * 0.12 * 100) / 100;

                await Invoice.create({
                    device_id: device.id,
                    invoice_number: `INV-${device.serial_number}-2024${10 + month}`,
                    billing_period_start: invoiceStart,
                    billing_period_end: invoiceEnd,
                    total_kwh: totalKwh,
                    total_amount: totalAmount,
                    status: 'pending'
                });
            }
        }

        // Print summary
        const deviceCount = await Device.count();
        const recordCount = await ConsumptionRecord.count();
        const invoiceCount = await Invoice.count();
        const totalConsumption = await ConsumptionRecord.sum('kwh_consumption');

        logger.info('===== DATABASE SYNC COMPLETE =====');
        logger.info(`Total devices: ${deviceCount}`);
        logger.info(`Total consumption records: ${recordCount}`);
        logger.info(`Total invoices: ${invoiceCount}`);
        logger.info(`Total consumption: ${totalConsumption.toFixed(2)} kWh`);

        return true;
    } catch (error) {
        logger.error('Sync failed:', error);
        return false;
    }
}

// Run if called directly
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    try {
        const success = await syncRealData();
        process.exit(success ? 0 : 1);
    } catch (error) {
        logger.error(error);
        process.exit(1);
    }
}

export { syncRealData, CloudOceanAPI };