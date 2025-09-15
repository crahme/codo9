// src/scripts/rve-to-contentful.js
import dotenv from "dotenv";
dotenv.config();

import { CloudOceanService } from "../services/CloudOceanService.js";
import contentful from "contentful-management";
import fs from "fs";
import PDFDocument from "pdfkit";

// --- Contentful setup ---
const client = contentful.createClient({
  accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN,
});

async function getEnvironment() {
  const space = await client.getSpace(process.env.CONTENTFUL_SPACE_ID);
  const env = await space.getEnvironment(process.env.CONTENTFUL_ENVIRONMENT || "master");
  return env;
}

// --- Create line item entries ---
async function createLineItemEntries(env, lineItems) {
  const entries = [];

  for (const item of lineItems) {
    const entry = await env.createEntry("lineItem", {
      fields: {
        date: { "en-US": item.date },
        startTime: { "en-US": item.startTime },
        endTime: { "en-US": item.endTime },
        energyConsumed: { "en-US": item.energyConsumed },
        unitPrice: { "en-US": item.unitPrice },
        amount: { "en-US": item.amount },
      }
    });
    const publishedEntry = await entry.publish();
    entries.push({ sys: { type: "Link", linkType: "Entry", id: publishedEntry.sys.id } });
  }

  return entries;
}

// --- Create or update invoice ---
async function createOrUpdateInvoice(invoiceId, invoiceData) {
  const env = await getEnvironment();

  let entry;
  try {
    entry = await env.getEntry(invoiceId);
    console.log(`[INFO] Updating invoice ${invoiceId}`);
  } catch {
    entry = await env.createEntryWithId("invoice", invoiceId, { fields: {} });
    console.log(`[INFO] Creating invoice ${invoiceId}`);
  }

  // Create line item entries
  const lineItemLinks = await createLineItemEntries(env, invoiceData.lineItems);

  // Set invoice fields
  entry.fields["syndicateName"] = { "en-US": "RVE Cloud Ocean" };
  entry.fields["slug"] = { "en-US": `/fac-2024-001` };
  entry.fields["address"] = { "en-US": "123 EV Way, Montreal, QC" };
  entry.fields["contact"] = { "en-US": "contact@rve.ca" };
  entry.fields["invoiceNumber"] = { "en-US": invoiceData.invoiceNumber };
  entry.fields["invoiceDate"] = { "en-US": invoiceData.invoiceDate };
  entry.fields["clientName"] = { "en-US": "John Doe" };
  entry.fields["clientEmail"] = { "en-US": "john.doe@example.com" };
  entry.fields["chargerSerialNumber"] = { "en-US": invoiceData.chargerSerialNumber };
  entry.fields["billingPeriodStart"] = { "en-US": invoiceData.billingPeriodStart };
  entry.fields["billingPeriodEnd"] = { "en-US": invoiceData.billingPeriodEnd };
  entry.fields["paymentDueDate"] = { "en-US": invoiceData.paymentDueDate };
  entry.fields["lateFeeRate"] = { "en-US": 0 };
  entry.fields["lineItems"] = { "en-US": lineItemLinks };

  const updatedEntry = await entry.update();
  await updatedEntry.publish();
  console.log(`[INFO] Invoice ${invoiceId} published successfully`);
}

// --- Generate PDF ---
function generateInvoicePDF(invoiceData, filePath) {
  const doc = new PDFDocument({ margin: 30, size: "A4" });
  doc.pipe(fs.createWriteStream(filePath));

  doc.fontSize(18).text(`Invoice: ${invoiceData.invoiceNumber}`, { underline: true });
  doc.moveDown();
  doc.fontSize(12).text(`Syndicate Name: RVE Cloud Ocean`);
  doc.text(`Address: 123 EV Way, Montreal, QC`);
  doc.text(`Contact: contact@rve.ca`);
  doc.text(`Client Name: John Doe`);
  doc.text(`Email: john.doe@example.com`);
  doc.text(`Invoice Date: ${invoiceData.invoiceDate.toDateString()}`);
  doc.text(`Charger Serial Number: ${invoiceData.chargerSerialNumber}`);
  doc.text(`Billing Period: ${invoiceData.billingPeriodStart.toDateString()} to ${invoiceData.billingPeriodEnd.toDateString()}`);
  doc.text(`Payment Due Date: ${invoiceData.paymentDueDate.toDateString()}`);
  doc.text(`Late Fee Rate: 0`);
  doc.moveDown();

  // Table header
  doc.fontSize(12).text("Date", 50, doc.y, { continued: true });
  doc.text("Start Time", 120, doc.y, { continued: true });
  doc.text("End Time", 200, doc.y, { continued: true });
  doc.text("Energy (kWh)", 280, doc.y, { continued: true });
  doc.text("Unit Price ($)", 380, doc.y, { continued: true });
  doc.text("Amount ($)", 480, doc.y);
  doc.moveDown();

  // Table rows
  invoiceData.lineItems.forEach(item => {
    doc.text(item.date.toDateString(), 50, doc.y, { continued: true });
    doc.text(item.startTime.toTimeString().split(" ")[0], 120, doc.y, { continued: true });
    doc.text(item.endTime.toTimeString().split(" ")[0], 200, doc.y, { continued: true });
    doc.text(item.energyConsumed.toFixed(2), 280, doc.y, { continued: true });
    doc.text(item.unitPrice.toFixed(2), 380, doc.y, { continued: true });
    doc.text(item.amount.toFixed(2), 480, doc.y);
  });

  doc.end();
  console.log(`[INFO] PDF generated at ${filePath}`);
}

// --- Main runner ---
(async () => {
  const service = new CloudOceanService();

  try {
    const startDate = "2024-10-16";
    const endDate = "2024-11-25";

    console.log("[INFO] Fetching consumption data from RVE API...");
    const consumptionData = await service.getConsumptionData(startDate, endDate);

    // Prepare line items from RVE readings
    const lineItems = consumptionData.flatMap(station =>
      station.readings.map(read => {
        const readingDate = new Date(read.time_stamp);
        return {
          date: readingDate,
          startTime: new Date(readingDate.getTime()),
          endTime: new Date(readingDate.getTime() + (23 * 3600 + 59 * 60 + 59) * 1000),
          energyConsumed: parseFloat(read.value),
          unitPrice: parseFloat(process.env.RATE_PER_KWH || 0.15),
          amount: parseFloat(read.value) * parseFloat(process.env.RATE_PER_KWH || 0.15)
        };
      })
    );

    // Prepare invoice data
    const invoiceData = {
      invoiceNumber: "fac-2024-001",
      invoiceDate: new Date(),
      chargerSerialNumber: "CHG-001",
      billingPeriodStart: new Date(startDate),
      billingPeriodEnd: new Date(endDate),
      paymentDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      lineItems
    };

    console.log("[INFO] Writing invoice to Contentful...");
    await createOrUpdateInvoice(invoiceData.invoiceNumber, invoiceData);

    console.log("[INFO] Generating invoice PDF...");
    generateInvoicePDF(invoiceData, `./invoice_${invoiceData.invoiceNumber}.pdf`);

    console.log("[INFO] Done ✅");

  } catch (err) {
    console.error("❌ Error:", err);
  }
})();
