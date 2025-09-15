import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { createClient } from 'contentful-management';
import { CloudOceanService } from '../services/CloudOceanService.js';
import PDFDocument from 'pdfkit';

const SPACE_ID = process.env.CONTENTFUL_SPACE_ID;
const ENVIRONMENT = process.env.CONTENTFUL_ENVIRONMENT || 'master';
const CONTENTFUL_TOKEN = process.env.CONTENTFUL_MANAGEMENT_TOKEN;
const INVOICE_ENTRY_ID = process.env.CONTENTFUL_INVOICE_ENTRY_ID || 'RVE CLOUD OCEAN';
const PDF_OUTPUT_DIR = './pdfs';

const client = createClient({ accessToken: CONTENTFUL_TOKEN });

// Fetch raw consumption data from RVE
async function fetchConsumptionData(startDate, endDate) {
  if (!startDate || !endDate) throw new Error('Start and end dates must be defined');

  const readings = await CloudOceanService.fetchConsumptionData(
    startDate.toISOString(),
    endDate.toISOString()
  );

  if (!readings || !readings.length) throw new Error('No consumption data fetched.');

  const lineItems = [];
  for (const r of readings) {
    try {
      if (!r.timestamp) {
        console.warn(`[WARN] Skipping record with missing timestamp:`, r);
        continue;
      }

      const date = new Date(r.timestamp);
      if (isNaN(date.getTime())) {
        console.warn(`[WARN] Skipping record with invalid date:`, r.timestamp);
        continue;
      }

      const energy = Number(r.kWh);
      const price = Number(r.unitPrice || 0.15);

      if (isNaN(energy) || energy <= 0) {
        console.warn(`[WARN] Skipping record with invalid energy value:`, r.kWh);
        continue;
      }

      lineItems.push({
        date,
        energyConsumed: energy,
        unitPrice: price,
        amount: Number(energy * price)
      });
    } catch (err) {
      console.warn(`[WARN] Skipping malformed record:`, r, err.message);
    }
  }

  return lineItems;
}

// Create line item entries in Contentful
async function createLineItemEntries(environment, lineItems) {
  const createdEntries = [];

  for (const item of lineItems) {
    try {
      const entry = await environment.createEntry('lineItem', {
        fields: {
          date: { 'en-US': item.date.toISOString() },
          energyConsumed: { 'en-US': item.energyConsumed },
          unitPrice: { 'en-US': item.unitPrice },
          amount: { 'en-US': item.amount }
        }
      });

      await entry.publish();
      createdEntries.push(entry);
    } catch (err) {
      console.warn(`[WARN] Failed to create line item entry, skipping.`, item, err.message);
    }
  }

  return createdEntries;
}

// Overwrite or create invoice
async function createOrUpdateInvoice(lineItems) {
  const space = await client.getSpace(SPACE_ID);
  const environment = await space.getEnvironment(ENVIRONMENT);

  let invoice;
  try {
    invoice = await environment.getEntry(INVOICE_ENTRY_ID);
  } catch {
    invoice = await environment.createEntryWithId('invoice', INVOICE_ENTRY_ID, {
      fields: { title: { 'en-US': 'RVE CLOUD OCEAN' }, lineItems: { 'en-US': [] } }
    });
  }

  // clear existing lineItems
  invoice.fields.lineItems = { 'en-US': [] };
  await invoice.update();

  const createdEntries = await createLineItemEntries(environment, lineItems);

  invoice.fields.lineItems['en-US'] = createdEntries.map(entry => ({
    sys: { type: 'Link', linkType: 'Entry', id: entry.sys.id }
  }));

  const updatedInvoice = await invoice.update();
  await updatedInvoice.publish();

  return updatedInvoice;
}

// Generate PDF
function generatePDF(invoice, lineItems) {
  if (!fs.existsSync(PDF_OUTPUT_DIR)) fs.mkdirSync(PDF_OUTPUT_DIR);

  const pdfPath = path.join(PDF_OUTPUT_DIR, `${INVOICE_ENTRY_ID}.pdf`);
  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(fs.createWriteStream(pdfPath));

  doc.fontSize(20).text('Invoice: RVE CLOUD OCEAN', { align: 'center' });
  doc.moveDown();

  lineItems.forEach(item => {
    doc.text(
      `Date: ${item.date.toDateString()} | kWh: ${item.energyConsumed.toFixed(
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
    if (!lineItems.length) {
      console.warn('[WARN] No valid line items found, aborting invoice update.');
      return;
    }

    const invoice = await createOrUpdateInvoice(lineItems);
    generatePDF(invoice, lineItems);

    console.info('[INFO] RVE data synced to Contentful successfully');
  } catch (err) {
    console.error('❌ Error:', err);
  }
}

main();
