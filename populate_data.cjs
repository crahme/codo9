'use strict';

// Script to populate the database with sample data for testing
// Usage: node populate_data.js

require('dotenv').config();
const { Device, ConsumptionRecord, Invoice } = require('./models');
const { Op } = require('sequelize');

function randomFloat(min, max, decimals = 2) {
  const factor = Math.pow(10, decimals);
  return Math.round((Math.random() * (max - min) + min) * factor) / factor;
}

async function populateSampleData() {
  const sequelize = Device.sequelize;
  try {
    // Drop and recreate all tables
    await sequelize.sync({ force: true });

    // Add sample devices
    const deviceData = [
      {
        model_number: 'SMP-901',
        serial_number: 'DEV001',
        location: 'Building A - Level 1',
        status: 'active',
        max_amperage: 32.0,
        evse_count: 2,
      },
      {
        model_number: 'SMP-901',
        serial_number: 'DEV002',
        location: 'Building B - Level 2',
        status: 'active',
        max_amperage: 32.0,
        evse_count: 2,
      },
      {
        model_number: 'SMP-901',
        serial_number: 'DEV003',
        location: 'Building C - Parking',
        status: 'active',
        max_amperage: 32.0,
        evse_count: 4,
      },
    ];

    const devices = await Device.bulkCreate(deviceData, { returning: true });
    console.log(`Added ${devices.length} devices`);

    // Add sample consumption records (90 days starting 2024-10-01)
    const baseDate = new Date(2024, 9, 1); // October 1, 2024 (month is 0-based)
    const consumptionRecords = [];
    const rate = 0.12; // $0.12 per kWh

    for (const device of devices) {
      for (let i = 0; i < 90; i++) {
        const date = new Date(baseDate);
        date.setDate(baseDate.getDate() + i);
        const kwh = randomFloat(15.0, 55.0, 2);
        consumptionRecords.push({
          device_id: device.id,
          timestamp: date,
          kwh_consumption: kwh,
          rate: rate,
        });
      }
    }

    await ConsumptionRecord.bulkCreate(consumptionRecords);
    console.log(`Added ${consumptionRecords.length} consumption records`);

    // Add sample invoices for Oct, Nov, Dec 2024
    const invoices = [];
    for (const device of devices) {
      for (let month = 0; month < 3; month++) {
        const startDate = new Date(2024, 9 + month, 1); // Oct=9, Nov=10, Dec=11
        const endDate = month === 2
          ? new Date(2024, 11, 31) // Dec 31, 2024
          : new Date(2024, 9 + month + 1, 0); // Last day of month (day 0 of next month)

        const periodRecords = await ConsumptionRecord.findAll({
          where: {
            device_id: device.id,
            timestamp: { [Op.gte]: startDate, [Op.lte]: endDate },
          },
        });

        const total_kwh = periodRecords.reduce((sum, r) => sum + (r.kwh_consumption || 0), 0);
        const total_amount = Math.round(total_kwh * rate * 100) / 100;

        invoices.push({
          device_id: device.id,
          invoice_number: `INV-${device.serial_number}-${2024}${String(10 + month).padStart(2, '0')}`,
          billing_period_start: startDate,
          billing_period_end: endDate,
          total_kwh,
          total_amount,
          status: 'pending',
        });
      }
    }

    await Invoice.bulkCreate(invoices);
    console.log(`Added ${invoices.length} invoices`);

    // Print summary
    const totalDevices = await Device.count();
    const totalConsumptionRecords = await ConsumptionRecord.count();
    const totalInvoices = await Invoice.count();

    const allRecs = await ConsumptionRecord.findAll({ attributes: ['kwh_consumption'] });
    const totalConsumption = allRecs.reduce((sum, r) => sum + (r.kwh_consumption || 0), 0);

    console.log('\nDatabase populated successfully!');
    console.log(`Total devices: ${totalDevices}`);
    console.log(`Total consumption records: ${totalConsumptionRecords}`);
    console.log(`Total invoices: ${totalInvoices}`);
    console.log(`Total consumption: ${totalConsumption.toFixed(2)} kWh`);
  } catch (err) {
    console.error('Error populating data:', err);
    process.exitCode = 1;
  } finally {
    try {
      await Device.sequelize.close();
    } catch (e) {
      // ignore
    }
  }
}

if (require.main === module) {
  populateSampleData();
}
