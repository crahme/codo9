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

// --- Convert plain text to RichText ---
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

  // Invoice fields
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
  entry.fields["environmentalImpactText"] = { "en-US": toRichText(invoiceData.environmentalImpactText || "") };
  entry.fields["paymentDueDate"] = { "en-US": invoiceData.paymentDueDate };

  // Line items (linking existing line item entries)
  entry.fields["lineItems"] = {
    "en-US": invoiceData.lineItems.map(item => ({
      sys: {
        type: "Link",
        linkType: "Entry",
        id: item.entryId, // Pre-created line item entry in Contentful
      }
    }))
  };

  const updatedEntry = await entry.update();
  await updatedEntry.publish();
  console.log(`[INFO] Invoice ${invoiceId} published successfully`);
}

// --- Generate daily line items for Contentful ---
function generateDailyLineItems(consumptionData, startDate, endDate) {
  const dailyItems = [];

  // Create date array for billing period
  let current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    const dateStr = current.toISOString().split("T")[0]; // YYYY-MM-DD

    for (const station of consumptionData) {
      const energy = station.consumption / ((new Date(endDate) - new Date(startDate)) / (1000*60*60*24) + 1);
      dailyItems.push({
        date: dateStr,
        startTime: `${dateStr}T00:00:00Z`,
        endTime: `${dateStr}T23:59:59Z`,
        energyConsumed: energy.toFixed(2),
        unitPrice: (process.env.RATE_PER_KWH || 0.15).toFixed(2),
        amount: (energy * (process.env.RATE_PER_KWH || 0.15)).toFixed(2),
        entryId: station.entryId // Must be set if linking existing line items
      });
    }

    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dailyItems;
}

// --- Generate PDF of invoice ---
function generateInvoicePDF(invoiceData, consumptionData) {
  const doc = new PDFDocument();
  const fileName = `invoice_${invoiceData.invoiceNumber}.pdf`;
  doc.pipe(fs.createWriteStream(fileName));

  doc.fontSize(16).text("Invoice", { align: "center" });
  doc.moveDown();
  doc.fontSize(12).text(`Invoice Number: ${invoiceData.invoiceNumber}`);
  doc.text(`Invoice Date: ${invoiceData.invoiceDate}`);
  doc.text(`Billing Period: ${invoiceData.billingPeriodStart} to ${invoiceData.billingPeriodEnd}`);
  doc.text(`Charger Serial: ${invoiceData.chargerSerialNumber}`);
  doc.text(`Client: ${invoiceData.clientName} <${invoiceData.clientEmail}>`);
  doc.moveDown();

  doc.text("Consumption Details:");
  const tableTop = doc.y + 20;
  doc.text("Date       Start UTC      End UTC      Energy(kWh)   Unit Price($)   Amount($)", { underline: true });

  for (const item of invoiceData.lineItems) {
    doc.text(`${item.date}   ${item.startTime.split("T")[1]}   ${item.endTime.split("T")[1]}   ${item.energyConsumed}        ${item.unitPrice}          ${item.amount}`);
  }

  doc.end();
  console.log(`[INFO] PDF generated: ${fileName}`);
}

// --- Main runner ---
(async () => {
  const service = new CloudOceanService();

  try {
    const startDate = "2024-10-16";
    const endDate = "2024-11-25";

    console.log("[INFO] Fetching consumption data from RVE API...");
    const consumptionData = await service.getConsumptionData(startDate, endDate);

    // You must pre-create Contentful line item entries and assign entryId for linking
    const lineItems = generateDailyLineItems(consumptionData, startDate, endDate);

    const invoiceData = {
      invoiceNumber: "fac-2024-001",
      invoiceDate: new Date().toISOString().split("T")[0],
      chargerSerialNumber: "CHG-001",
      billingPeriodStart: startDate,
      billingPeriodEnd: endDate,
      environmentalImpactText: "CO2 emissions reduced thanks to EV usage.",
      paymentDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      clientName: "John Doe",
      clientEmail: "john.doe@example.com",
      lineItems
    };

    console.log("[INFO] Writing invoice to Contentful...");
    await createOrUpdateInvoice(invoiceData.invoiceNumber, invoiceData);

    console.log("[INFO] Generating PDF...");
    generateInvoicePDF(invoiceData, consumptionData);

    console.log("[INFO] Done ✅");

  } catch (err) {
    console.error("❌ Error:", err);
  }
})();
