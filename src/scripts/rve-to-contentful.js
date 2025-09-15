import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import pkg from 'contentful-management';
const { createClient } = pkg;

import { CloudOceanService } from '../services/CloudOceanService.js';
import PDFDocument from 'pdfkit';

const SPACE_ID = process.env.CONTENTFUL_SPACE_ID;
const ENVIRONMENT = process.env.CONTENTFUL_ENVIRONMENT || 'master';
const CONTENTFUL_TOKEN = process.env.CONTENTFUL_MANAGEMENT_TOKEN;
const INVOICE_ENTRY_ID = process.env.CONTENTFUL_INVOICE_ENTRY_ID || 'RVE CLOUD OCEAN';
const PDF_OUTPUT_DIR = './pdfs';

// Initialize Contentful client
const client = createClient({ accessToken: CONTENTFUL_TOKEN });

async function fetchConsumptionData(startDate, endDate) {
  if (!startDate || !endDate) {
    throw new Error('Start date and end date must be defined');
  }

  const stations = await CloudOceanService.getStations(); // fetch station list
  const allReadings = [];

  for (const station of stations) {
    try {
      const readings = await CloudOceanService.fetchConsumptionData(
        station.id,
        startDate.toISOString(),
        endDate.toISOString()
      );

      const processed = readings.map(r => ({
        stationName: station.name,
        date: new Date(r.timestamp),
        energyConsumed: Number(r.kWh),
        unitPrice: Number(r.unitPrice || 0.15),
        amount: Number(r.kWh * (r.unitPrice || 0.15))
      }));

      allReadings.push(...processed);
      console.info(`[INFO] Fetched ${processed.length} readings for ${station.name}`);
    } catch (err) {
      console.warn(`[WARN] Failed for ${station.name}: ${err.message}`);
    }
  }

  if (!allReadings.length) {
    throw new Error('No consumption data fetched.');
  }

  return allReadings;
}

async function createLineItemEntries(environment, lineItems) {
  const createdEntries = [];

  for (const item of lineItems) {
    // Ensure date exists
    if (!item.date || isNaN(item.date.getTime())) {
      console.warn('[WARN] Invalid date for reading:', item);
      continue;
    }

    const entry = await environment.createEntry('lineItem', {
      fields: {
        stationName: { 'en-US': item.stationName },
        date: { 'en-US': item.date.toISOString() },
        energyConsumed: { 'en-US': item.energyConsumed },
        unitPrice: { 'en-US': item.unitPrice },
        amount: { 'en-US': item.amount }
      }
    });

    await entry.publish();
    createdEntries.push(entry);
  }

  return createdEntries;
}

async function createOrUpdateInvoice(lineItems) {
  const space = await client.getSpace(SPACE_ID);
  const environment = await space.getEnvironment(ENVIRONMENT);

  let invoice;
  try {
    invoice = await environment.getEntry(INVOICE_ENTRY_ID);
  } catch {
    // create new invoice if not exists
    invoice = await environment.createEntryWithId('invoice', INVOICE_ENTRY_ID, {
      fields: {
        title: { 'en-US': 'RVE CLOUD OCEAN' },
        lineItems: { 'en-US': [] }
      }
    });
  }

  // Clear existing line items
  invoice.fields.lineItems = { 'en-US': [] };
  await invoice.update();

  // Create new line items and link to invoice
  const createdEntries = await createLineItemEntries(environment, lineItems);

  invoice.fields.lineItems['en-US'] = createdEntries.map(entry => ({
    sys: { type: 'Link', linkType: 'Entry', id: entry.sys.id }
  }));

  // Update and publish invoice safely
  const updatedInvoice = await invoice.update();
  await updatedInvoice.publish();

  console.info(`[INFO] Invoice ${INVOICE_ENTRY_ID} updated with ${createdEntries.length} line items`);

  return updatedInvoice;
}

function generatePDF(invoice, lineItems) {
  if (!fs.existsSync(PDF_OUTPUT_DIR)) fs.mkdirSync(PDF_OUTPUT_DIR);

  const pdfPath = path.join(PDF_OUTPUT_DIR, `${INVOICE_ENTRY_ID}.pdf`);
  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(fs.createWriteStream(pdfPath));

  doc.fontSize(20).text('Invoice: RVE CLOUD OCEAN', { align: 'center' });
  doc.moveDown();

  doc.fontSize(12);
  lineItems.forEach(item => {
    doc.text(
      `${item.stationName} | Date: ${item.date.toDateString()} | kWh: ${item.energyConsumed.toFixed(
        2
      )} | Unit Price: ${item.unitPrice.toFixed(2)} | Amount: ${item.amount.toFixed(2)}`
    );
  });

  const totalAmount = lineItems.reduce((sum, i) => sum + i.amount, 0);
  doc.moveDown();
  doc.fontSize(14).text(`Total Amount: ${totalAmount.toFixed(2)}`, { align: 'right' });

  doc.end();
  console.info(`[INFO] PDF generated at ${pdfPath}`);
  return pdfPath;
}

// Main execution
async function main() {
  try {
    const startDate = new Date(process.env.START_DATE);
    const endDate = new Date(process.env.END_DATE);

    const lineItems = await fetchConsumptionData(startDate, endDate);
    const invoice = await createOrUpdateInvoice(lineItems);
    generatePDF(invoice, lineItems);

    console.info('[INFO] RVE data synced to Contentful successfully');
  } catch (err) {
    console.error('❌ Error:', err);
  }
}

main();
