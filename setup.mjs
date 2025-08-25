'use strict';

// Quick setup script to populate database with all 11 measuring points
// Usage: node setup.js

import 'dotenv/config'; // Load environment variables from .env file
import { Device, ConsumptionRecord, Invoice} from './models.mjs'; // Adjust the import path as needed
import { Op } from 'sequelize';

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

    // All 11 measuring points with data from Cloud Ocean (UUIDs for reference)
    const measuring_points = [
      { uuid: '71ef9476-3855-4a3f-8fc5-333cfbf9e898', name: 'EV Charger Station 01', location: 'Building A - Level 1' },
      { uuid: 'fd7e69ef-cd01-4b9a-8958-2aa5051428d4', name: 'EV Charger Station 02', location: 'Building A - Level 2' },
      { uuid: 'b7423cbc-d622-4247-bb9a-8d125e5e2351', name: 'EV Charger Station 03', location: 'Building B - Parking Garage' },
      { uuid: '88f4f9b6-ce65-48c4-86e6-1969a64ad44c', name: 'EV Charger Station 04', location: 'Building B - Ground Floor' },
      { uuid: 'df428bf7-dd2d-479c-b270-f8ac5c1398dc', name: 'EV Charger Station 05', location: 'Building C - East Wing' },
      { uuid: '7744dcfc-a059-4257-ac96-6650feef9c87', name: 'EV Charger Station 06', location: 'Building C - West Wing' },
      { uuid: 'b1445e6d-3573-403a-9f8e-e82f70556f7c', name: 'EV Charger Station 07', location: 'Building D - Main Entrance' },
      { uuid: 'ef296fba-4fcc-4dcb-8eda-e6d1772cd819', name: 'EV Charger Station 08', location: 'Building D - Loading Dock' },
      { uuid: '50206eae-41b8-4a84-abe4-434c7f79ae0a', name: 'EV Charger Station 09', location: 'Outdoor Lot - Section A' },
      { uuid: 'de2d9680-f132-4529-b9a9-721265456a86', name: 'EV Charger Station 10', location: 'Outdoor Lot - Section B' },
      { uuid: 'bd36337c-8139-495e-b026-f987b79225b8', name: 'EV Charger Station 11', location: 'Visitor Parking - Main Gate' },
    ];

    // Create devices (using first 8 chars of UUID as a serial)
    const devicesData = measuring_points.map((mp) => ({
      model_number: 'SMP-901',
      serial_number: mp.uuid.slice(0, 8).toUpperCase(),
      location: mp.location,
      status: 'active',
      max_amperage: 32.0,
      evse_count: 2,
    }));

    const devices = await Device.bulkCreate(devicesData, { returning: true });
    console.log(`✅ Created ${devices.length} devices with real measuring point UUIDs`);

    // Create consumption records from 2024-10-16 to 2024-11-25 (40 days)
    const startDate = new Date(2024, 9, 16); // months are 0-based (9 = October)
    const days = 40;

    const baseConsumptionMap = {
      'Building A': 45.0,
      'Building B': 38.0,
      'Building C': 42.0,
      'Building D': 35.0,
      'Outdoor Lot': 30.0,
      'Visitor Parking': 25.0,
    };

    const rate = 0.12;
    const consumptionRows = [];

    for (const device of devices) {
      for (let i = 0; i < days; i++) {
        const recordDate = new Date(startDate);
        recordDate.setDate(startDate.getDate() + i);

        const locationKey = String(device.location).split(' - ')[0];
        const dailyBase = baseConsumptionMap[locationKey] ?? 35.0;
        const dayVariation = 0.8 + (i % 7) * 0.1; // Weekly pattern
        const deviceVariation = 0.9 + (device.id % 3) * 0.2; // Device-specific
        const randomVariation = 0.85 + (i % 4) * 0.15; // Daily randomness
        const consumption = dailyBase * dayVariation * deviceVariation * randomVariation;

        consumptionRows.push({
          device_id: device.id,
          timestamp: recordDate,
          kwh_consumption: Math.round(consumption * 100) / 100,
          rate,
        });
      }
    }

    // Batch insert to avoid memory issues
    const batchSize = 1000;
    for (let i = 0; i < consumptionRows.length; i += batchSize) {
      const batch = consumptionRows.slice(i, i + batchSize);
      await ConsumptionRecord.bulkCreate(batch);
      console.log(`✅ Processed ${Math.min(i + batchSize, consumptionRows.length)}/${consumptionRows.length} records`);
    }
    console.log('✅ Created consumption records for all devices');

    // Create invoices for October and November 2024
    const invoices = [];
    for (const device of devices) {
      for (let month = 0; month < 2; month++) { // October and November
        const invoiceStart = new Date(2024, 9 + month, 1);
        const invoiceEnd = month === 0
          ? new Date(2024, 9, 31) // Oct 31, 2024
          : new Date(2024, 10, 25); // Nov 25, 2024

        const periodRecords = await ConsumptionRecord.findAll({
          where: {
            device_id: device.id,
            timestamp: { [Op.gte]: invoiceStart, [Op.lte]: invoiceEnd },
          },
          attributes: ['kwh_consumption'],
        });

        const total_kwh = periodRecords.reduce((sum, r) => sum + (r.kwh_consumption || 0), 0);
        const total_amount = Math.round(total_kwh * rate * 100) / 100;

        invoices.push({
          device_id: device.id,
          invoice_number: `INV-${device.serial_number}-${2024}${String(10 + month).padStart(2, '0')}`,
          billing_period_start: invoiceStart,
          billing_period_end: invoiceEnd,
          total_kwh,
          total_amount,
          status: 'pending',
        });
      }
    }

    await Invoice.bulkCreate(invoices);
    console.log(`✅ Created ${invoices.length} invoices`);

    // Print summary
    const totalDevices = await Device.count();
    const totalConsumptionRecords = await ConsumptionRecord.count();
    const totalInvoices = await Invoice.count();

    const allRecs = await ConsumptionRecord.findAll({ attributes: ['kwh_consumption'] });
    const totalConsumption = allRecs.reduce((sum, r) => sum + (r.kwh_consumption || 0), 0);

    console.log('\n' + '='.repeat(50));
    console.log('DATABASE SETUP COMPLETE');
    console.log('='.repeat(50));
    console.log(`Total devices: ${totalDevices}`);
    console.log(`Total consumption records: ${totalConsumptionRecords}`);
    console.log(`Total invoices: ${totalInvoices}`);
    console.log(`Total consumption: ${totalConsumption.toFixed(2)} kWh`);

    const firstSix = await Device.findAll({ limit: 6, order: [['id', 'ASC']] });
    console.log('\nDevice Mappings (first 6):');
    for (const d of firstSix) {
      console.log(`  ${d.serial_number}: ${d.location}`);
    }
    const remaining = totalDevices - firstSix.length;
    if (remaining > 0) console.log(`  ... and ${remaining} more devices`);

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

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);

if (process.argv[1] === __filename) {
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
}