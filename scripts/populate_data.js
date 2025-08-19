/*
Script to populate the database with sample data for testing
Translated from Python populate_data.py to Node.js using Sequelize models.
*/

import { Op } from 'sequelize';
import { Device, ConsumptionRecord, Invoice } from 'models.js';

function round2(n) {
  return Math.round(n * 100) / 100;
}

function randUniform(min, max) {
  return Math.random() * (max - min) + min;
}

async function populateSampleData() {
  const sequelize = Device.sequelize;
  if (!sequelize) {
    console.error('Sequelize instance not found from models.');
    process.exit(1);
  }

  // Drop and recreate all tables
  await sequelize.sync({ force: true });

  // Add sample devices
  const devicePayloads = [
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

  const devices = await Device.bulkCreate(devicePayloads, { returning: true });
  console.log(`Added ${devices.length} devices`);

  // Add sample consumption records for the past 90 days from 2024-10-01
  const baseDate = new Date('2024-10-01T00:00:00Z');
  const consumptionRecords = [];

  for (const device of devices) {
    for (let i = 0; i < 90; i++) {
      const date = new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000);
      const kwh = round2(randUniform(15.0, 55.0));
      const rate = 0.12; // $0.12 per kWh
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
      const startMonth = 9 + month; // 0-based: 9 = October
      const startDate = new Date(Date.UTC(2024, startMonth, 1, 0, 0, 0));
      let endDate;
      if (month === 2) {
        // December end
        endDate = new Date(Date.UTC(2024, 11, 31, 23, 59, 59));
      } else {
        // Day before the first of next month
        const nextMonth = new Date(Date.UTC(2024, startMonth + 1, 1, 0, 0, 0));
        endDate = new Date(nextMonth.getTime() - 1000); // subtract 1s
      }

      const total_kwh = await ConsumptionRecord.sum('kwh_consumption', {
        where: {
          device_id: device.id,
          timestamp: { [Op.gte]: startDate, [Op.lte]: endDate },
        },
      }) || 0;

      const total_amount = round2(total_kwh * 0.12);
      const invoiceNumber = `INV-${device.serial_number}-2024${String(10 + month).padStart(2, '0')}`;

      invoices.push({
        device_id: device.id,
        invoice_number: invoiceNumber,
        billing_period_start: startDate,
        billing_period_end: endDate,
        total_kwh: total_kwh,
        total_amount: total_amount,
        status: 'pending',
      });
    }
  }

  await Invoice.bulkCreate(invoices);
  console.log(`Added ${invoices.length} invoices`);

  // Summary
  const totalDevices = await Device.count();
  const totalRecords = await ConsumptionRecord.count();
  const totalInvoices = await Invoice.count();
  const totalConsumption = (await ConsumptionRecord.sum('kwh_consumption')) || 0;

  console.log('\nDatabase populated successfully!');
  console.log(`Total devices: ${totalDevices}`);
  console.log(`Total consumption records: ${totalRecords}`);
  console.log(`Total invoices: ${totalInvoices}`);
  console.log(`Total consumption: ${round2(totalConsumption).toFixed(2)} kWh`);

  await sequelize.close();
}

if (require.main === module) {
  populateSampleData().catch((err) => {
    console.error('Error populating sample data:', err);
    process.exit(1);
  });
}
