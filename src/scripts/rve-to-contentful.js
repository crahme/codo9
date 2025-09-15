// src/scripts/rve-to-contentful.js
import dotenv from 'dotenv';
dotenv.config();

import { createClient } from 'contentful-management';
import CloudOceanService from '../services/CloudOceanService.js';
import PDFDocument from 'pdfkit';
import fs from 'fs';

// ----------------- Helpers -----------------

function parseDate(envVar, fallback) {
  const d = new Date(envVar);
  return isNaN(d.getTime()) ? fallback : d;
}

function formatCurrency(amount) {
  return `${amount.toFixed(2)} ${process.env.CURRENCY || 'USD'}`;
}

// ----------------- Contentful Setup -----------------

const client = createClient({
  accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN,
});

const spaceId = process.env.CONTENTFUL_SPACE_ID;
const environmentId = process.env.CONTENTFUL_ENVIRONMENT_ID || 'master';

// ----------------- Fetch RVE Data -----------------

async function fetchConsumptionData(startDate, endDate) {
  console.info('[INFO] Fetching consumption data from RVE API...');

  const stations = await CloudOceanService.getStations();
  const lineItems = [];

  for (const station of stations) {
    try {
      console.info(`[INFO] Fetching data for ${station.name}`);

      const data = await CloudOceanService.getConsumptionData(
        station.id,
        startDate.toISOString(),
        endDate.toISOString()
      );

      if (!data || !data.kwh) {
        console.warn(`[WARN] No consumption data for ${station.name}, skipping...`);
        continue;
      }

      const energyConsumed = Number(data.kwh) || 0;
      const unitPrice = Number(process.env.UNIT_PRICE || 0.15);
      const amount = energyConsumed * unitPrice;

      lineItems.push({
        date: startDate.toISOString().split('T')[0], // YYYY-MM-DD
        energyConsumed: energyConsumed.toFixed(3),
        unitPrice: unitPrice.toFixed(2),
        amount: amount.toFixed(2),
      });

      console.info(`[INFO] ${station.name}: ${energyConsumed.toFixed(2)} kWh`);

    } catch (err) {
      console.warn(
        `[WARN] Failed for ${station.name}: ${err.message || err}`
      );
    }
  }

  if (!lineItems.length) {
    throw new Error('No consumption data fetched.');
  }

  return lineItems;
}

// ----------------- Contentful Invoice -----------------

async function createOrUpdateInvoice(lineItems) {
  const space = await client.getSpace(spaceId);
  const env = await space.getEnvironment(environmentId);

  // Find invoice by title
  const entries = await env.getEntries({
    content_type: 'invoice',
    'fields.title': 'RVE CLOUD OCEAN',
  });

  let invoice;
  if (entries.items.length > 0) {
    invoice = entries.items[0];
    console.info(`[INFO] Updating invoice: ${invoice.fields.title['en-US']}`);
  } else {
    invoice = await env.createEntry('invoice', {
      fields: {
        title: { 'en-US': 'RVE CLOUD OCEAN' },
      },
    });
    console.info('[INFO] Created new invoice entry.');
  }

  // Update invoice fields
  const totalAmount = lineItems.reduce((sum, li) => sum + parseFloat(li.amount), 0);

  invoice.fields.lineItems = {
    'en-US': lineItems.map((li) => ({
      date: { 'en-US': li.date },
      energyConsumed: { 'en-US': li.energyConsumed.toString() },
      unitPrice: { 'en-US': li.unitPrice.toString() },
      amount: { 'en-US': li.amount.toString() },
    })),
  };

  invoice.fields.totalAmount = { 'en-US': totalAmount.toFixed(2) };

  const updatedInvoice = await invoice.update();
  console.info('[INFO] Invoice updated in Contentful.');

  const publishedInvoice = await updatedInvoice.publish();
  console.info('[INFO] Invoice published successfully.');

  return publishedInvoice;
}

// ----------------- PDF Generation -----------------

function generatePDF(invoice, lineItems) {
  const pdfPath = `./invoice_${invoice.sys.id}.pdf`;
  const doc = new PDFDocument();

  doc.pipe(fs.createWriteStream(pdfPath));

  doc.fontSize(18).text('Invoice: RVE CLOUD OCEAN', { underline: true });
  doc.moveDown();

  doc.fontSize(12).text(`Invoice ID: ${invoice.sys.id}`);
  doc.text(`Total Amount: ${formatCurrency(parseFloat(invoice.fields.totalAmount['en-US']))}`);
  doc.moveDown();

  doc.fontSize(14).text('Line Items');
  doc.moveDown();

  // Table header
  doc.fontSize(12).text('Date\tEnergy (kWh)\tUnit Price\tAmount');
  doc.moveDown(0.5);

  lineItems.forEach((li) => {
    doc.text(
      `${li.date}\t${li.energyConsumed}\t${formatCurrency(parseFloat(li.unitPrice))}\t${formatCurrency(parseFloat(li.amount))}`
    );
  });

  doc.end();

  console.info(`[INFO] PDF generated at ${pdfPath}`);
}

// ----------------- Main -----------------

async function main() {
  try {
    // Fallback: last 30 days
    const defaultEnd = new Date();
    const defaultStart = new Date();
    defaultStart.setDate(defaultEnd.getDate() - 30);

    const startDate = parseDate(process.env.START_DATE, defaultStart);
    const endDate = parseDate(process.env.END_DATE, defaultEnd);

    console.info(`[INFO] Using date range: ${startDate.toISOString()} → ${endDate.toISOString()}`);

    const lineItems = await fetchConsumptionData(startDate, endDate);

    const invoice = await createOrUpdateInvoice(lineItems);

    generatePDF(invoice, lineItems);

    console.info('[INFO] Done ✅');
  } catch (err) {
    console.error('❌ Error:', err);
  }
}

main();
