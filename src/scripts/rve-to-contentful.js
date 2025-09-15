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
  const createdEntries = [];
  for (const item of lineItems) {
    const entry = await env.createEntry("lineItem", {
      fields: {
        date: { "en-US": new Date(item.date) },
        startTime: { "en-US": new Date(item.startTime) },
        endTime: { "en-US": new Date(item.endTime) },
        energyConsumed: { "en-US": item.energyConsumed },
        unitPrice: { "en-US": item.unitPrice },
        amount: { "en-US": item.amount },
      }
    });
    await entry.publish();
    createdEntries.push({ sys: { type: "Link", linkType: "Entry", id: entry.sys.id } });
  }
  return createdEntries;
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

  // Create line item entries in Contentful
  const lineItemLinks = await createLineItemEntries(env, invoiceData.lineItems);

  // Update invoice fields
  entry.fields["syndicateName"] = { "en-US": "RVE Cloud Ocean" };
  entry.fields["slug"] = { "en-US": `/${invoiceId}` };
  entry.fields["address"] = { "en-US": "123 EV Way, Montreal, QC" };
  entry.fields["contact"] = { "en-US": "contact@rve.ca" };
  entry.fields["invoiceNumber"] = { "en-US": invoiceData.invoiceNumber };
  entry.fields["invoiceDate"] = { "en-US": new Date(invoiceData.invoiceDate) };
  entry.fields["clientName"] = { "en-US": "John Doe" };
  entry.fields["clientEmail"] = { "en-US": "john.doe@example.com" };
  entry.fields["chargerSerialNumber"] = { "en-US": invoiceData.chargerSerialNumber };
  entry.fields["billingPeriodStart"] = { "en-US": new Date(invoiceData.billingPeriodStart) };
  entry.fields["billingPeriodEnd"] = { "en-US": new Date(invoiceData.billingPeriodEnd) };
  entry.fields["paymentDueDate"] = { "en-US": new Date(invoiceData.paymentDueDate) };
  entry.fields["lateFeeRate"] = { "en-US": 0 };
  entry.fields["lineItems"] = { "en-US": lineItemLinks };

  const updatedEntry = await entry.update();
  await updatedEntry.publish();
  console.log(`[INFO] Invoice ${invoiceId} published successfully`);
}

// --- Generate PDF ---
function generateInvoicePDF(invoiceData) {
  const doc = new PDFDocument({ margin: 30 });
  const fileName = `./invoice_${invoiceData.invoiceNumber}.pdf`;
  doc.pipe(fs.createWriteStream(fileName));

  doc.fontSize(20).text(`Invoice: ${invoiceData.invoiceNumber}`, { align: "center" });
  doc.moveDown();

  doc.fontSize(12).text(`Syndicate Name: RVE Cloud Ocean`);
  doc.text(`Address: 123 EV Way, Montreal, QC`);
  doc.text(`Contact: contact@rve.ca`);
  doc.text(`Client Name: John Doe`);
  doc.text(`Email: john.doe@example.com`);
  doc.text(`Invoice Date: ${invoiceData.invoiceDate}`);
  doc.text(`Charger Serial Number: ${invoiceData.chargerSerialNumber}`);
  doc.text(`Billing Period: ${invoiceData.billingPeriodStart} to ${invoiceData.billingPeriodEnd}`);
  doc.text(`Payment Due Date: ${invoiceData.paymentDueDate}`);
  doc.text(`Late Fee Rate: 0`);
  doc.moveDown();

  doc.fontSize(14).text("Consumption Details:");
  doc.moveDown();

  const tableTop = doc.y;
  const itemSpacing = 20;

  // Table headers
  doc.fontSize(12);
  doc.text("Date", 30, tableTop);
  doc.text("Start Time", 100, tableTop);
  doc.text("End Time", 200, tableTop);
  doc.text("Energy (kWh)", 300, tableTop);
  doc.text("Unit Price ($)", 400, tableTop);
  doc.text("Amount ($)", 500, tableTop);

  let i = 0;
  invoiceData.lineItems.forEach(item => {
    const y = tableTop + itemSpacing * (i + 1);
    doc.text(new Date(item.date).toLocaleDateString(), 30, y);
    doc.text(new Date(item.startTime).toLocaleString(), 100, y);
    doc.text(new Date(item.endTime).toLocaleString(), 200, y);
    doc.text(item.energyConsumed.toFixed(2), 300, y);
    doc.text(item.unitPrice.toFixed(2), 400, y);
    doc.text(item.amount.toFixed(2), 500, y);
    i++;
  });

  doc.end();
  console.log(`[INFO] PDF generated at ${fileName}`);
}

// --- Main runner ---
(async () => {
  const service = new CloudOceanService();

  try {
    const startDate = "2024-10-16";
    const endDate = "2024-11-25";

    console.log("[INFO] Fetching consumption data from RVE API...");
    const consumptionData = await service.getConsumptionData(startDate, endDate);

    // Prepare line items from RVE data
    const lineItems = consumptionData.map(station => {
      const energy = parseFloat(station.consumption);
      const unitPrice = parseFloat(process.env.RATE_PER_KWH || 0.15);
      return {
        date: startDate, // You can replace with actual reading date if available
        startTime: `${startDate}T00:00:00Z`,
        endTime: `${startDate}T23:59:59Z`,
        energyConsumed: energy,
        unitPrice: unitPrice,
        amount: energy * unitPrice
      };
    });

    const invoiceData = {
      invoiceNumber: "fac-2024-001",
      invoiceDate: new Date().toISOString().split("T")[0],
      chargerSerialNumber: "CHG-001",
      billingPeriodStart: startDate,
      billingPeriodEnd: endDate,
      paymentDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      lineItems
    };

    console.log("[INFO] Writing invoice to Contentful...");
    await createOrUpdateInvoice(invoiceData.invoiceNumber, invoiceData);

    console.log("[INFO] Generating invoice PDF...");
    generateInvoicePDF(invoiceData);

    console.log("[INFO] Done ✅");

  } catch (err) {
    console.error("❌ Error:", err);
  }
})();
