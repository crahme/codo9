import dotenv from 'dotenv';
dotenv.config();

import { Sequelize, DataTypes } from 'sequelize';

// Check if DATABASE_URL exists
if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not defined.');
    process.exit(1);
}

const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    dialectOptions: {
        ssl: {
            require: true,
            rejectUnauthorized: false
        }
    },
    logging: false,
});

// Define models
const Device = sequelize.define('Device', {
    model_number: DataTypes.STRING,
    serial_number: DataTypes.STRING,
    location: DataTypes.STRING,
    status: DataTypes.STRING,
    max_amperage: DataTypes.FLOAT,
    evse_count: DataTypes.INTEGER,
}, { tableName: 'devices' });

const ConsumptionRecord = sequelize.define('ConsumptionRecord', {
    timestamp: DataTypes.DATE,
    kwh_consumption: DataTypes.FLOAT,
    rate: DataTypes.FLOAT,
}, { tableName: 'consumption_records' });

// Define relationships
Device.hasMany(ConsumptionRecord, { foreignKey: 'device_id' });
ConsumptionRecord.belongsTo(Device, { foreignKey: 'device_id' });

async function populateData() {
    try {
        console.log('Starting data population...');
        
        await sequelize.authenticate();
        console.log('✅ Connected to database');

        // Sync models
        await sequelize.sync();
        console.log('✅ Database synced');

        // Check if devices already exist
        const existingDevices = await Device.count();
        if (existingDevices > 0) {
            console.log(`ℹ️  ${existingDevices} devices already exist. Skipping device creation.`);
        } else {
            // Create devices
            const measuring_points = [
                { uuid: '71ef9476-3855-4a3f-8fc5-333cfbf9e898', location: 'Building A - Level 1' },
                { uuid: 'fd7e69ef-cd01-4b9a-8958-2aa5051428d4', location: 'Building A - Level 2' },
                { uuid: 'b7423cbc-d622-4247-bb9a-8d125e5e2351', location: 'Building B - Parking Garage' },
                { uuid: '88f4f9b6-ce65-48c4-86e6-1969a64ad44c', location: 'Building B - Ground Floor' },
                { uuid: 'df428bf7-dd2d-479c-b270-f8ac5c1398dc', location: 'Building C - East Wing' },
                { uuid: '7744dcfc-a059-4257-ac96-6650feef9c87', location: 'Building C - West Wing' },
                { uuid: 'b1445e6d-3573-403a-9f8e-e82f70556f7c', location: 'Building D - Main Entrance' },
                { uuid: 'ef296fba-4fcc-4dcb-8eda-e6d1772cd819', location: 'Building D - Loading Dock' },
                { uuid: '50206eae-41b8-4a84-abe4-434c7f79ae0a', location: 'Outdoor Lot - Section A' },
                { uuid: 'de2d9680-f132-4529-b9a9-721265456a86', location: 'Outdoor Lot - Section B' },
                { uuid: 'bd36337c-8139-495e-b026-f987b79225b8', location: 'Visitor Parking - Main Gate' },
            ];

            const devicesData = measuring_points.map((mp) => ({
                model_number: 'SMP-901',
                serial_number: mp.uuid.slice(0, 8).toUpperCase(),
                location: mp.location,
                status: 'active',
                max_amperage: 32.0,
                evse_count: 2,
            }));

            await Device.bulkCreate(devicesData);
            console.log('✅ Created 11 devices');
        }

        // Add new consumption records for the current day
        const devices = await Device.findAll();
        const rate = 0.12;
        const consumptionRows = [];

        for (const device of devices) {
            const recordDate = new Date();
            const consumption = 30 + (Math.random() * 20); // 30-50 kWh
            
            consumptionRows.push({
                device_id: device.id,
                timestamp: recordDate,
                kwh_consumption: Math.round(consumption * 100) / 100,
                rate,
            });
        }

        await ConsumptionRecord.bulkCreate(consumptionRows);
        console.log(`✅ Added ${consumptionRows.length} new consumption records`);

        // Print summary
        const totalDevices = await Device.count();
        const totalRecords = await ConsumptionRecord.count();
        
        console.log('\n' + '='.repeat(50));
        console.log('DATA POPULATION COMPLETE');
        console.log('='.repeat(50));
        console.log(`Total devices: ${totalDevices}`);
        console.log(`Total consumption records: ${totalRecords}`);

        return true;

    } catch (err) {
        console.error('❌ Error populating data:', err.message);
        return false;
    } finally {
        try {
            await sequelize.close();
            console.log('✅ Database connection closed');
        } catch (closeErr) {
            console.log('⚠️  Error closing connection:', closeErr.message);
        }
    }
}

// Run the population
populateData().then((success) => {
    if (success) {
        console.log('\n✅ Data population completed successfully!');
        process.exit(0);
    } else {
        console.log('\n❌ Data population failed!');
        process.exit(1);
    }
});