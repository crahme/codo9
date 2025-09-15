// src/scripts/rve-to-contentful.js
import dotenv from 'dotenv';
dotenv.config();

import pkg from 'contentful-management';
const { createClient } = pkg;
import{CloudOceanService} from '../services/CloudOceanService.js';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

/**
 * Safely parse a date string into ISO format for Contentful
 */
function parseSafeDate(dateStr) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

/**
 * Format date as MM/DD/YYYY
 */
function formatDateMMDDYYYY(date) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
}

/**
 * Generate a proper invoice PDF with header + line items
 */
function generateInvoicePDF(invoiceTitle, lineItems, metadata) {
  const doc = new PDFDocument({ margin: 40 });
  const filePath = path.join(process.cwd(), `${invoiceTitle.replace(/\s+/g, '_')}.pdf`);
  doc.pipe(fs.createWriteStream(filePath));

  // === Header ===
  doc.fontSize(22).text(invoiceTitle, { align: 'center' }).moveDown();

  doc.fontSize(12);
  doc.text(`Invoice Number: ${metadata.invoiceNumber}`);
  doc.text(`Client Name: ${metadata.clientName}`);
  doc.text(`Billing Period Start: ${metadata.startDate}`);
  doc.text(`Billing Period End: ${metadata.endDate}`);
  doc.moveDown();

  // === Line Items Table Header ===
  doc.fontSize(14).text('Line Items', { underline: true }).moveDown(0.5);

  doc.fontSize(12).text('Date', 50, doc.y, { continued: true });
  doc.text('Start Time', 150, doc.y, { continued: true });
  doc.text('End Time', 250, doc.y, { continued: true });
  doc.text('Unit Price', 350, doc.y, { continued: true });
  doc.text('Total', 450, doc.y);

  doc.moveDown(0.5).moveTo(50, doc.y).lineTo(550, doc.y).stroke();

  // === Table Rows ===
  let grandTotal = 0;
  lineItems.forEach((item) => {
    const date = item.fields.date['en-US']?.split('T')[0] || '';
    const startTime = item.fields.startTime?.['en-US'] || '';
    const endTime = item.fields.endTime?.['en-US'] || '';
    const unitPrice = item.fields.unitPrice?.['en-US'] ?? 0;
    const total = item.fields.total?.['en-US'] ?? 0;

    grandTotal += total;

    doc.text(date, 50, doc.y, { continued: true });
    doc.text(startTime, 150, doc.y, { continued: true });
    doc.text(endTime, 250, doc.y, { continued: true });
    doc.text(unitPrice.toFixed(2), 350, doc.y, { continued: true });
    doc.text(total.toFixed(2), 450, doc.y);
  });

  // === Summary Row ===
  doc.moveDown(1).fontSize(12).text(`Grand Total: ${grandTotal.toFixed(2)}`, 400);

  doc.end();
  console.log(`[INFO] PDF generated: ${filePath}`);
}

/**
 * Fetch consumption data from RVE and map into Contentful line items
 */
async function fetchConsumptionData(cloudOcean, startDate, endDate) {
  console.log('[INFO] Fetching consumption data from RVE API...');

  let data = [];
  try {
    data = await cloudOcean.getConsumptionData(startDate, endDate);
  } catch (err) {
    console.error('❌ Failed to fetch consumption data:', err.message);
    return [];
  }

  const lineItems = data
    .map((record) => {
      const safeDate = parseSafeDate(record.date);
      if (!safeDate) {
        console.warn('⚠️ Skipping record with invalid date:', record);
        return null;
      }

      return {
        fields: {
          date: { 'en-US': safeDate },
          startTime: { 'en-US': record.startTime || '' },
          endTime: { 'en-US': record.endTime || '' },
          unitPrice: { 'en-US': Number(record.unitPrice) || 0 },
          total: { 'en-US': Number(record.total) || 0 },
        },
      };
    })
    .filter(Boolean);

  console.log(`[INFO] Prepared ${lineItems.length} line items.`);
  return lineItems;
}

/**
 * Update (overwrite) invoice entry in Contentful
 */
async function updateInvoiceInContentful(invoiceTitle, lineItems) {
  console.log('[INFO] Updating invoice in Contentful...');

  const client = createClient({ accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN });
  const space = await client.getSpace(process.env.CONTENTFUL_SPACE_ID);
  const env = await space.getEnvironment(process.env.CONTENTFUL_ENVIRONMENT);

  const entries = await env.getEntries({
    content_type: 'invoice',
    'fields.title': invoiceTitle,
  });

  if (!entries.items.length) {
    throw new Error(`Invoice entry "${invoiceTitle}" not found.`);
  }

  const entry = entries.items[0];
  entry.fields.lineItems = { 'en-US': lineItems };

  const updatedEntry = await entry.update();
  console.log('[INFO] Entry updated. Publishing...');

  await updatedEntry.publish();
  console.log('[INFO] Invoice published with new line items.');
  return updatedEntry;
}

/**
 * Main
 */
async function main() {
  const invoiceTitle = 'RVE CLOUD OCEAN';

  // Fixed billing period
  const startDate = new Date('2024-10-16T00:00:00Z');
  const endDate = new Date('2024-11-25T23:59:59Z');

  console.log(`[INFO] Using fixed date range: ${startDate.toISOString()} → ${endDate.toISOString()}`);

  const cloudOcean = new CloudOceanService(
    process.env.RVE_API_BASE_URL,
    process.env.RVE_API_KEY
  );

  const lineItems = await fetchConsumptionData(cloudOcean, startDate, endDate);
  if (!lineItems.length) {
    console.warn('⚠️ No line items to update. Exiting.');
    return;
  }

  const updatedInvoice = await updateInvoiceInContentful(invoiceTitle, lineItems);

  // Prepare metadata for PDF
  const metadata = {
    invoiceNumber: updatedInvoice.sys.id,
    clientName: process.env.CLIENT_NAME || 'Unknown Client',
    startDate: formatDateMMDDYYYY(startDate),
    endDate: formatDateMMDDYYYY(endDate),
  };

  generateInvoicePDF(invoiceTitle, lineItems, metadata);
}

main().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
