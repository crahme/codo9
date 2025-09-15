// src/scripts/rve-to-contentful.js
import dotenv from "dotenv";
dotenv.config();

import { CloudOceanService } from "../services/CloudOceanService.js";
import contentful from "contentful-management";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

// --- Contentful setup ---
const client = contentful.createClient({
  accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN,
});

async function getEnvironment() {
  const space = await client.getSpace(process.env.CONTENTFUL_SPACE_ID);
  const env = await space.getEnvironment(process.env.CONTENTFUL_ENVIRONMENT || "master");
  return env;
}

// --- Utility to convert plain text to RichText ---
function toRichText(text) {
  return {
    nodeType: "document",
    data: {},
    content: [
      {
        nodeType: "paragraph",
        data: {},
        content: [
          {
            nodeType: "text",
            value: text,
            marks: [],
            data: {},
          },
        ],
      },
    ],
  };
}

// --- Format date to MM/DD/YYYY HH:MM:SS ---
function formatDateTime(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
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

  // Set invoice fields
  entry.fields["syndicateName"] = { "en-US": "RVE Cloud Ocean" };
  entry.fields["slug"] = { "en-US": `/${invoiceData.invoiceNumber}` };
  entry.fields["address"] = { "en-US": "123 EV Way, Montreal, QC" };
  entry.fields["contact"] = { "en-US": "contact@rve.ca" };
  entry.fields["invoiceNumber"] = { "en-US": invoiceData.invoiceNumber };
  entry.fields["invoiceDate"] = { "en-US": invoiceData.invoiceDate };
  entry.fields["clientName"] = { "en-US": "John Doe" };
  entry.fields["clientEmail"] = { "en-US": "john.doe@example.com" };
  entry.fields["chargerSerialNumber"] = { "en-US": invoiceData.chargerSerialNumber };
  entry.fields["billingPeriodStart"] = { "en-US": invoiceData.billingPeriodStart };
  entry.fields["billingPeriodEnd"] = { "en-US": invoiceData.billingPeriodEnd };
  entry.fields["environmentalImpactText"] = { "en-US": toRichText(invoiceData.environmentalImpactText || "") };
  entry.fields["paymentDueDate"] = { "en-US": invoiceData.paymentDueDate };
  entry.fields["lateFeeRate"] = { "en-US": 0 };

  // --- Store line items directly ---
  entry.fields["lineItems"] = {
    "en-US": invoiceData.lineItems.map(item => ({
      date: formatDateTime(item.date),
      startTime: formatDateTime(item.startTime),
      endTime: formatDateTime(item.endTime),
      energyConsumed: item.energyConsumed,
      unitPrice: item.unitPrice,
      amount: item.amount,
      stationName: item.stationName,
      location: item.location,
    }))
  };

  const updatedEntry = await entry.update();
  await updatedEntry.publish();
  console.log(`[INFO] Invoice ${invoiceId} published successfully`);
}

// --- Generate PDF ---
function generateInvoicePDF(invoiceData) {
  const doc = new PDFDocument();
  const pdfPath = path.join(process.cwd(), `${invoiceData.invoiceNumber}.pdf`);
  doc.pipe(fs.createWriteStream(pdfPath));

  doc.fontSize(18).text("Invoice", { align: "center" });
  doc.moveDown();
  doc.fontSize(12).text(`Invoice Number: ${invoiceData.invoiceNumber}`);
  doc.text(`Invoice Date: ${invoiceData.invoiceDate}`);
  doc.text(`Billing Period: ${invoiceData.billingPeriodStart} - ${invoiceData.billingPeriodEnd}`);
  doc.text(`Charger Serial Number: ${invoiceData.chargerSerialNumber}`);
  doc.text(`Client Name: John Doe`);
  doc.text(`Client Email: john.doe@example.com`);
  doc.text(`Environmental Impact: ${invoiceData.environmentalImpactText}`);
  doc.moveDown();

  // Table header
  doc.fontSize(12).text("Consumption Details:");
  doc.moveDown();
  doc.text("Date | Start Time | End Time | Station | Location | Energy(kWh) | Unit Price | Amount");
  doc.moveDown();

  invoiceData.lineItems.forEach(item => {
    doc.text(
      `${formatDateTime(item.date)} | ${formatDateTime(item.startTime)} | ${formatDateTime(item.endTime)} | ${item.stationName} | ${item.location} | ${item.energyConsumed} | ${item.unitPrice} | ${item.amount}`
    );
  });

  doc.end();
  console.log(`[INFO] PDF generated at ${pdfPath}`);
}

// --- Main runner ---
(async () => {
  const service = new CloudOceanService();

  try {
    const startDate = "2024-10-16";
    const endDate = "2024-11-25";

    console.log("[INFO] Fetching consumption data from RVE API...");
    const consumptionData = await service.getConsumptionData(startDate, endDate);
    const totals = service.calculateTotals(consumptionData);

    // Prepare invoice data
    const invoiceData = {
      invoiceNumber: "fac-2024-001",
      invoiceDate: new Date().toISOString().split("T")[0],
      chargerSerialNumber: "CHG-001",
      billingPeriodStart: startDate,
      billingPeriodEnd: endDate,
      environmentalImpactText: "CO2 emissions reduced thanks to EV usage.",
      paymentDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      lineItems: consumptionData.map(station => ({
        date: station.firstReading.time_stamp,
        startTime: `${station.firstReading.time_stamp}T00:00:00Z`,
        endTime: `${station.lastReading.time_stamp}T23:59:59Z`,
        energyConsumed: station.consumption.toFixed(2),
        unitPrice: (process.env.RATE_PER_KWH || 0.15).toFixed(2),
        amount: (station.consumption * (process.env.RATE_PER_KWH || 0.15)).toFixed(2),
      })),
    };

    console.log("[INFO] Writing invoice to Contentful...");
    await createOrUpdateInvoice(invoiceData.invoiceNumber, invoiceData);

    console.log("[INFO] Generating PDF...");
    generateInvoicePDF(invoiceData);

    console.log("[INFO] Done ✅");

  } catch (err) {
    console.error("❌ Error:", err);
  }
})();
