// src/scripts/rve-to-contentful.js
import dotenv from "dotenv";
dotenv.config();

import { CloudOceanService } from "../services/CloudOceanService.js";
import contentful from "contentful-management";
import PDFDocument from "pdfkit";
import fs from "fs";

// --- Contentful setup ---
const client = contentful.createClient({
  accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN,
});

async function getEnvironment() {
  const space = await client.getSpace(process.env.CONTENTFUL_SPACE_ID);
  return await space.getEnvironment(process.env.CONTENTFUL_ENVIRONMENT || "master");
}

// --- Create line item entries in Contentful ---
async function createLineItemEntries(env, lineItems) {
  const createdItems = [];

  for (const item of lineItems) {
    const entry = await env.createEntry("lineItem", {
      fields: {
        date: { "en-US": item.date },
        startTime: { "en-US": item.startTime },
        endTime: { "en-US": item.endTime },
        energyConsumed: { "en-US": item.energyConsumed },
        unitPrice: { "en-US": item.unitPrice },
        amount: { "en-US": item.amount },
      },
    });
    await entry.publish();
    createdItems.push({ sys: { type: "Link", linkType: "Entry", id: entry.sys.id } });
  }

  return createdItems;
}

// --- Create or update invoice entry ---
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

  // Create line items first
  const lineItemLinks = await createLineItemEntries(env, invoiceData.lineItems);

  // Set invoice fields
  entry.fields["syndicateName"] = { "en-US": "RVE Cloud Ocean" };
  entry.fields["slug"] = { "en-US": `/${invoiceData.invoiceNumber.toLowerCase()}` };
  entry.fields["address"] = { "en-US": "123 EV Way, Montreal, QC" };
  entry.fields["contact"] = { "en-US": "contact@rve.ca" };
  entry.fields["invoiceNumber"] = { "en-US": invoiceData.invoiceNumber };
  entry.fields["invoiceDate"] = { "en-US": invoiceData.invoiceDate };
  entry.fields["clientName"] = { "en-US": "John Doe" };
  entry.fields["clientEmail"] = { "en-US": "john.doe@example.com" };
  entry.fields["chargerSerialNumber"] = { "en-US": invoiceData.chargerSerialNumber };
  entry.fields["billingPeriodStart"] = { "en-US": invoiceData.billingPeriodStart };
  entry.fields["billingPeriodEnd"] = { "en-US": invoiceData.billingPeriodEnd };
  entry.fields["environmentalImpactText"] = { "en-US": invoiceData.environmentalImpactText || "" };
  entry.fields["paymentDueDate"] = { "en-US": invoiceData.paymentDueDate };
  entry.fields["lineItems"] = { "en-US": lineItemLinks };

  const updatedEntry = await entry.update();
  await updatedEntry.publish();
  console.log(`[INFO] Invoice ${invoiceId} published successfully`);
}

// --- Generate PDF of invoice ---
function generateInvoicePDF(invoiceData, filePath = "./invoice.pdf") {
  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(fs.createWriteStream(filePath));

  doc.fontSize(18).text("Invoice", { align: "center" });
  doc.moveDown();
  doc.fontSize(12).text(`Syndicate: RVE Cloud Ocean`);
  doc.text(`Invoice Number: ${invoiceData.invoiceNumber}`);
  doc.text(`Invoice Date: ${invoiceData.invoiceDate}`);
  doc.text(`Billing Period: ${invoiceData.billingPeriodStart} to ${invoiceData.billingPeriodEnd}`);
  doc.text(`Charger Serial Number: ${invoiceData.chargerSerialNumber}`);
  doc.text(`Client: John Doe (${invoiceData.clientEmail})`);
  doc.text(`Payment Due: ${invoiceData.paymentDueDate}`);
  doc.moveDown();

  // Table header
  doc.text("Date", 50);
  doc.text("Start Time", 120);
  doc.text("End Time", 220);
  doc.text("Energy (kWh)", 320);
  doc.text("Unit Price", 400);
  doc.text("Amount", 470);
  doc.moveDown();

  invoiceData.lineItems.forEach(item => {
    doc.text(item.date, 50);
    doc.text(item.startTime.slice(11, 19), 120); // show only time hh:mm:ss
    doc.text(item.endTime.slice(11, 19), 220);
    doc.text(item.energyConsumed, 320);
    doc.text(item.unitPrice, 400);
    doc.text(item.amount, 470);
  });

  doc.moveDown();
  const totalAmount = invoiceData.lineItems.reduce((sum, item) => sum + parseFloat(item.amount), 0);
  doc.text(`Total Amount: $${totalAmount.toFixed(2)}`, { align: "right" });

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

    // Create line items: one per station, covering entire billing period
    const lineItems = consumptionData.map(station => ({
      date: new Date().toISOString().split("T")[0],
      startTime: new Date(`${startDate}T00:00:00Z`).toISOString(),
      endTime: new Date(`${endDate}T23:59:59Z`).toISOString(),
      energyConsumed: station.consumption.toFixed(2),
      unitPrice: (process.env.RATE_PER_KWH || 0.15).toFixed(2),
      amount: (station.consumption * (process.env.RATE_PER_KWH || 0.15)).toFixed(2),
    }));

    const invoiceData = {
      invoiceNumber: "fac-2024-001",
      invoiceDate: new Date().toISOString().split("T")[0],
      chargerSerialNumber: "CHG-001",
      billingPeriodStart: startDate,
      billingPeriodEnd: endDate,
      environmentalImpactText: "CO2 emissions reduced thanks to EV usage.",
      paymentDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      lineItems,
    };

    console.log("[INFO] Writing invoice to Contentful...");
    await createOrUpdateInvoice(invoiceData.invoiceNumber, invoiceData);

    console.log("[INFO] Generating PDF...");
    generateInvoicePDF(invoiceData);

    console.log("[INFO] Done ✅");

  } catch (err) {
    console.error("❌ Error:", err.message);
  }
})();
