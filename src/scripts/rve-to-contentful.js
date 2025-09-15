import dotenv from 'dotenv';
dotenv.config();
import pkg from 'contentful-management';
const { createClient } = pkg;
import fs from 'fs';
import PDFDocument from 'pdfkit';
import { CloudOceanService } from '../services/CloudOceanService.js';

dotenv.config();


const INVOICE_ENTRY_ID = 'fac-2024-001'; // your invoice entry
const UNIT_PRICE = 0.15; // example unit price
const service= new CloudOceanService();
const client = createClient({ accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN });

async function fetchConsumptionData() {
  console.log('[INFO] Fetching consumption data from RVE API...');
  const data = await service.getConsumptionData();
  console.table(data.map(d => ({
    Name: d.name,
    Location: d.location,
    Consumption_kWh: d.consumption
  })));
  return data;
}

async function createLineItemEntries(env, consumptionData, billingPeriodStart) {
  const lineItemEntries = [];

  for (const station of consumptionData) {
    const readingDate = station.readingDate
      ? new Date(station.readingDate)
      : new Date(billingPeriodStart);

    if (isNaN(readingDate)) {
      console.warn('[WARN] Invalid date for reading, skipping:', station);
      continue;
    }

    const energyConsumed = Number(station.consumption);
    const amount = Number((energyConsumed * UNIT_PRICE).toFixed(2));

    const entry = await env.createEntry('lineItem', {
      fields: {
        date: { 'en-US': readingDate.toISOString() },
        startTime: { 'en-US': readingDate.toISOString() },
        endTime: { 'en-US': readingDate.toISOString() },
        energyConsumed: { 'en-US': energyConsumed },
        unitPrice: { 'en-US': UNIT_PRICE },
        amount: { 'en-US': amount }
      }
    });

    await entry.publish();
    lineItemEntries.push({ sys: { type: 'Link', linkType: 'Entry', id: entry.sys.id } });
  }

  return lineItemEntries;
}

function generatePDF(invoiceData, lineItems) {
  const doc = new PDFDocument({ margin: 30 });
  const pdfPath = `./invoice_${invoiceData.invoiceNumber}.pdf`;
  doc.pipe(fs.createWriteStream(pdfPath));

  doc.fontSize(18).text(`Invoice: ${invoiceData.invoiceNumber}`, { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Syndicate: ${invoiceData.syndicateName}`);
  doc.text(`Client: ${invoiceData.clientName}`);
  doc.text(`Email: ${invoiceData.clientEmail}`);
  doc.text(`Billing Period: ${invoiceData.billingPeriodStart} to ${invoiceData.billingPeriodEnd}`);
  doc.moveDown();

  doc.text('Line Items:', { underline: true });
  doc.moveDown(0.5);

  const tableTop = doc.y;
  const itemSpacing = 20;

  // Table header
  doc.text('Date', 50, tableTop);
  doc.text('Energy (kWh)', 150, tableTop);
  doc.text('Unit Price ($)', 250, tableTop);
  doc.text('Amount ($)', 350, tableTop);

  let y = tableTop + itemSpacing;

  lineItems.forEach(item => {
    doc.text(new Date(item.fields.date['en-US']).toLocaleDateString(), 50, y);
    doc.text(item.fields.energyConsumed['en-US'], 150, y);
    doc.text(item.fields.unitPrice['en-US'], 250, y);
    doc.text(item.fields.amount['en-US'], 350, y);
    y += itemSpacing;
  });

  doc.end();
  console.log(`[INFO] PDF generated at ${pdfPath}`);
}

async function updateInvoice(consumptionData) {
  const env = await client.getSpace(SPACE_ID).then(space => space.getEnvironment(ENVIRONMENT));

  const invoiceEntry = await env.getEntry(INVOICE_ENTRY_ID);

  // Clean previous line items if any
  invoiceEntry.fields.lineItems = { 'en-US': [] };

  const billingPeriodStart = invoiceEntry.fields.billingPeriodStart['en-US'];
  const lineItems = await createLineItemEntries(env, consumptionData, billingPeriodStart);

  invoiceEntry.fields.lineItems['en-US'] = lineItems;

  await invoiceEntry.update();
  // Refresh entry to avoid version mismatch
  const updatedInvoice = await env.getEntry(invoiceEntry.sys.id);
  await updatedInvoice.publish();

  console.log(`[INFO] Invoice ${invoiceEntry.fields.invoiceNumber['en-US']} updated and published.`);
  return { invoiceEntry: updatedInvoice, lineItems };
}

async function main() {
  try {
    const consumptionData = await fetchConsumptionData();

    const { invoiceEntry, lineItems } = await updateInvoice(consumptionData);

    generatePDF({
      invoiceNumber: invoiceEntry.fields.invoiceNumber['en-US'],
      syndicateName: invoiceEntry.fields.syndicateName['en-US'],
      clientName: invoiceEntry.fields.clientName['en-US'],
      clientEmail: invoiceEntry.fields.clientEmail['en-US'],
      billingPeriodStart: invoiceEntry.fields.billingPeriodStart['en-US'],
      billingPeriodEnd: invoiceEntry.fields.billingPeriodEnd['en-US']
    }, lineItems);

  } catch (err) {
    console.error('❌ Error:', err);
  }
}

main();
