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

// --- Function to create/update invoice entry ---
async function createOrUpdateInvoice(invoiceSlug, invoiceData) {
  const env = await getEnvironment();

  let entry;
  try {
    entry = await env.getEntry(invoiceSlug);
    console.log(`[INFO] Updating invoice ${invoiceSlug}`);
  } catch {
    entry = await env.createEntryWithId("invoice", invoiceSlug, { fields: {} });
    console.log(`[INFO] Creating invoice ${invoiceSlug}`);
  }

  // Set invoice fields
  entry.fields["syndicateName"] = { "en-US": "RVE Cloud Ocean" };
  entry.fields["slug"] = { "en-US": invoiceSlug };
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

  // --- Line items: array of plain objects ---
  entry.fields["lineItems"] = {
    "en-US": invoiceData.lineItems.map(item => ({
      date: { "en-US": item.date },
      startTime: { "en-US": item.startTime },
      endTime: { "en-US": item.endTime },
      energyConsumed: { "en-US": item.energyConsumed },
      unitPrice: { "en-US": item.unitPrice },
      amount: { "en-US": item.amount },
    }))
  };

  const updatedEntry = await entry.update();
  await updatedEntry.publish();
  console.log(`[INFO] Invoice ${invoiceSlug} published successfully`);
}

// --- PDF generation ---
function generateInvoicePDF(invoiceData, outputPath = "./invoice.pdf") {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  doc.pipe(fs.createWriteStream(outputPath));

  doc.fontSize(20).text("Invoice", { align: "center" });
  doc.moveDown();

  doc.fontSize(12);
  doc.text(`Invoice Number: ${invoiceData.invoiceNumber}`);
  doc.text(`Invoice Date: ${invoiceData.invoiceDate}`);
  doc.text(`Billing Period: ${invoiceData.billingPeriodStart} - ${invoiceData.billingPeriodEnd}`);
  doc.text(`Charger Serial: ${invoiceData.chargerSerialNumber}`);
  doc.text(`Client: ${invoiceData.clientName}`);
  doc.text(`Client Email: ${invoiceData.clientEmail}`);
  doc.moveDown();

  doc.text("Line Items:", { underline: true });
  doc.moveDown();

  // Table header
  doc.text("Date", 50);
  doc.text("Start", 120);
  doc.text("End", 220);
  doc.text("Energy (kWh)", 320);
  doc.text("Unit Price ($)", 420);
  doc.text("Amount ($)", 520);
  doc.moveDown();

  // Line items
  invoiceData.lineItems.forEach(item => {
    doc.text(item.date, 50);
    doc.text(new Date(item.startTime).toLocaleTimeString(), 120);
    doc.text(new Date(item.endTime).toLocaleTimeString(), 220);
    doc.text(item.energyConsumed, 320);
    doc.text(item.unitPrice, 420);
    doc.text(item.amount, 520);
    doc.moveDown();
  });

  // Totals
  const totalAmount = invoiceData.lineItems.reduce(
    (sum, item) => sum + parseFloat(item.amount), 0
  ).toFixed(2);

  doc.moveDown();
  doc.text(`Total Amount: $${totalAmount}`, { align: "right" });

  doc.end();
  console.log(`[INFO] PDF generated at ${outputPath}`);
}

// --- Main runner ---
(async () => {
  const service = new CloudOceanService();

  try {
    const startDate = "2024-10-16";
    const endDate = "2024-11-25";

    console.log("[INFO] Fetching consumption data from RVE API...");
    const consumptionData = await service.getConsumptionData(startDate, endDate);

    const invoiceData = {
      invoiceNumber: "FAC-2024-001",
      invoiceDate: new Date().toISOString().split("T")[0],
      chargerSerialNumber: "CHG-001",
      billingPeriodStart: startDate,
      billingPeriodEnd: endDate,
      environmentalImpactText: "CO2 emissions reduced thanks to EV usage.",
      paymentDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      lineItems: []
    };

    // --- Generate line items for each day in billing period ---
    const dayMilliseconds = 24 * 60 * 60 * 1000;
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (const station of consumptionData) {
      for (let d = new Date(start); d <= end; d = new Date(d.getTime() + dayMilliseconds)) {
        const lineItem = {
          date: d.toISOString().split("T")[0],
          startTime: new Date(d.setHours(3,0,0,0)).toISOString(), // 3:00 AM
          endTime: new Date(d.setHours(1,59,59,0) + dayMilliseconds).toISOString(), // 1:59:59 AM next day
          energyConsumed: station.consumption.toFixed(2),
          unitPrice: (process.env.RATE_PER_KWH || 0.15).toFixed(2),
          amount: (station.consumption * (process.env.RATE_PER_KWH || 0.15)).toFixed(2)
        };
        invoiceData.lineItems.push(lineItem);
      }
    }

    console.log("[INFO] Writing invoice to Contentful...");
    await createOrUpdateInvoice("fac-2024-001", invoiceData);

    // --- Generate PDF ---
    generateInvoicePDF(invoiceData, `./${invoiceData.invoiceNumber}.pdf`);

    console.log("[INFO] Done ✅");

  } catch (err) {
    console.error("❌ Error:", err.message);
  }
})();
