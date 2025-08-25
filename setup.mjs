'use strict';

// Load environment variables first
import dotenv from 'dotenv';
dotenv.config();

// Check if DATABASE_URL exists
if (!process.env.NETLIFY_DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not defined.');
    console.error('Please make sure you have a .env file with your Neon database connection string.');
    process.exit(1);
}

console.log('Using database:', process.env.DATABASE_URL.replace(/:[^:]*@/, ':****@'));

// Import Sequelize
import { Sequelize, DataTypes } from 'sequelize';

// Create sequelize instance
const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    dialectOptions: {
        ssl: {
            require: true,
            rejectUnauthorized: false
        }
    },
    logging: false, // Set to true to see SQL queries
});

// Define Device model
const Device = sequelize.define('Device', {
    model_number: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    serial_number: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    location: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    status: {
        type: DataTypes.STRING,
        defaultValue: 'active',
    },
    max_amperage: {
        type: DataTypes.FLOAT,
    },
    evse_count: {
        type: DataTypes.INTEGER,
    },
}, {
    tableName: 'devices'
});

// Define ConsumptionRecord model
const ConsumptionRecord = sequelize.define('ConsumptionRecord', {
    timestamp: {
        type: DataTypes.DATE,
        allowNull: false,
    },
    kwh_consumption: {
        type: DataTypes.FLOAT,
        allowNull: false,
    },
    rate: {
        type: DataTypes.FLOAT,
        allowNull: false,
    },
}, {
    tableName: 'consumption_records'
});

// Define relationships
Device.hasMany(ConsumptionRecord, { foreignKey: 'device_id' });
ConsumptionRecord.belongsTo(Device, { foreignKey: 'device_id' });

async function quickSetup() {
    try {
        console.log('Starting database setup...');
        
        // Test connection first
        await sequelize.authenticate();
        console.log('✅ Connected to database successfully');

        // Clear existing data and recreate schema
        console.log('Syncing database schema...');
        await sequelize.sync({ force: true });
        console.log('✅ Database schema synced');

        // All 11 measuring points
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

        // Create devices
        const devicesData = measuring_points.map((mp) => ({
            model_number: 'SMP-901',
            serial_number: mp.uuid.slice(0, 8).toUpperCase(),
            location: mp.location,
            status: 'active',
            max_amperage: 32.0,
            evse_count: 2,
        }));

        const devices = await Device.bulkCreate(devicesData);
        console.log(`✅ Created ${devices.length} devices`);

        // Create consumption records for the last 7 days
        const days = 7; // Reduced from 40 to make it faster
        const rate = 0.12;
        const consumptionRows = [];

        for (const device of devices) {
            for (let i = 0; i < days; i++) {
                const recordDate = new Date();
                recordDate.setDate(recordDate.getDate() - i);
                
                // Random consumption between 30-50 kWh
                const consumption = 30 + (Math.random() * 20);
                
                consumptionRows.push({
                    device_id: device.id,
                    timestamp: recordDate,
                    kwh_consumption: Math.round(consumption * 100) / 100,
                    rate,
                });
            }
        }

        // Insert consumption records
        await ConsumptionRecord.bulkCreate(consumptionRows);
        console.log('✅ Created consumption records');

        // Print summary
        const totalDevices = await Device.count();
        const totalConsumptionRecords = await ConsumptionRecord.count();

        console.log('\n' + '='.repeat(50));
        console.log('DATABASE SETUP COMPLETE');
        console.log('='.repeat(50));
        console.log(`Total devices: ${totalDevices}`);
        console.log(`Total consumption records: ${totalConsumptionRecords}`);

        // Show first 3 devices
        const sampleDevices = await Device.findAll({ limit: 3 });
        console.log('\nSample devices:');
        for (const device of sampleDevices) {
            console.log(`  ${device.serial_number}: ${device.location}`);
        }

        return true;

    } catch (err) {
        console.error('❌ Error setting up database:', err.message);
        if (err.parent) {
            console.error('❌ Database error:', err.parent.message);
        }
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

// Run the setup
quickSetup().then((success) => {
    if (success) {
        console.log('\n✅ Database setup completed successfully!');
        process.exit(0);
    } else {
        console.log('\n❌ Database setup failed!');
        process.exit(1);
    }
}).catch((err) => {
    console.error('❌ Unhandled error:', err);
    process.exit(1);
});