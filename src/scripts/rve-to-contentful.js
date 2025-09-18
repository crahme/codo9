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
  return await space.getEnvironment(process.env.CONTENTFUL_ENVIRONMENT || "master");
}

// --- Convert string to Rich Text ---
function toRichText(text) {
  return {
    nodeType: "document",
    data: {},
    content: [
      {
        nodeType: "paragraph",
        data: {},
        content: [{ nodeType: "text", value: text, marks: [], data: {} }],
      },
    ],
  };
}

// --- Create line item entry ---
async function createLineItem(env, itemData) {
  const entry = await env.createEntry("lineItem", {
    fields: {
      date: { "en-US": itemData.date },
      energyConsumed: { "en-US": itemData.energyConsumed },
      unitPrice: { "en-US": itemData.unitPrice },
      amount: { "en-US": itemData.amount },
    },
  });
  await entry.publish();
  return entry.sys.id;
}

// --- Generate PDF invoice (daily aggregates per station) ---
function generateInvoicePDF(invoiceData) {
  const outputDir = "./invoices";
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  const filePath = `${outputDir}/${invoiceData.invoiceNumber}.pdf`;
  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(fs.createWriteStream(filePath));

  // Header
  doc.fontSize(20).text("INVOICE", { align: "center" });
  doc.moveDown();
  doc.fontSize(12)
    .text(`Invoice Number: ${invoiceData.invoiceNumber}`)
    .text(`Invoice Date: ${invoiceData.invoiceDate}`)
    .text(`Billing Period: ${invoiceData.billingPeriodStart} → ${invoiceData.billingPeriodEnd}`)
    .text(`Payment Due: ${invoiceData.paymentDueDate}`)
    .moveDown();

  // Client Info
  doc.fontSize(14).text("Bill To:", { underline: true });
  doc.fontSize(12).text(invoiceData.clientName).text(invoiceData.clientEmail).moveDown();

  // Tables per station
  invoiceData.lineItems.forEach(station => {
    doc.fontSize(14).text(`Station: ${station.name} (${station.location})`, { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12);
    doc.text("Date", 50, doc.y, { continued: true });
    doc.text("Energy (kWh)", 200, doc.y);
    doc.moveDown(0.2);

    if (station.daily.length === 0) {
      doc.text("No daily consumption data", 50, doc.y);
    } else {
      station.daily.forEach(d => {
        doc.text(d.date, 50, doc.y, { continued: true });
        doc.text(d.kWh.toFixed(2), 200, doc.y);
      });
    }

    doc.moveDown();
  });

  // Totals
  doc.fontSize(12).text(`Total Reads: ${invoiceData.totals.totalReads.toFixed(2)} kWh`);
  doc.text(`Total CDR: ${invoiceData.totals.totalCdr.toFixed(2)} kWh`);
  doc.text(`Grand Total: ${invoiceData.totals.grandTotal.toFixed(2)} kWh`);

  doc.end();
  return filePath;
}

// --- Create or update invoice entry in Contentful ---
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

  // Safely create daily aggregated line items
  const lineItemIds = [];
  for (const station of invoiceData.lineItems) {
    for (const d of station.daily) {
      const id = await createLineItem(env, {
        date: d.date,
        energyConsumed: d.kWh.toFixed(2),
        unitPrice: (process.env.RATE_PER_KWH || 0.15).toFixed(2),
        amount: (d.kWh * (process.env.RATE_PER_KWH || 0.15)).toFixed(2),
      });
      lineItemIds.push({ sys: { type: "Link", linkType: "Entry", id } });
    }
  }

  // Set invoice fields
  entry.fields["syndicateName"] = { "en-US": "RVE CLOUD OCEAN" };
  entry.fields["slug"] = { "en-US": `/${invoiceData.invoiceNumber}` };
  entry.fields["address"] = { "en-US": "123 EV Way, Montreal, QC" };
  entry.fields["contact"] = { "en-US": "contact@rve.ca" };
  entry.fields["invoiceNumber"] = { "en-US": invoiceData.invoiceNumber };
  entry.fields["invoiceDate"] = { "en-US": invoiceData.invoiceDate };
  entry.fields["clientName"] = { "en-US": invoiceData.clientName };
  entry.fields["clientEmail"] = { "en-US": invoiceData.clientEmail };
  entry.fields["chargerSerialNumber"] = { "en-US": invoiceData.chargerSerialNumber };
  entry.fields["billingPeriodStart"] = { "en-US": invoiceData.billingPeriodStart };
  entry.fields["billingPeriodEnd"] = { "en-US": invoiceData.billingPeriodEnd };
  entry.fields["environmentalImpactText"] = { "en-US": toRichText(invoiceData.environmentalImpactText) };
  entry.fields["paymentDueDate"] = { "en-US": invoiceData.paymentDueDate };
  entry.fields["lineItems"] = { "en-US": lineItemIds };

  const updatedEntry = await entry.update();
  await updatedEntry.publish();
  console.log(`[INFO] Invoice ${invoiceId} published successfully`);
}

// --- Main runner ---
(async () => {
  const service = new CloudOceanService();

  try {
    const startDate = "2024-10-16";
    const endDate = "2024-11-25";

    console.log("[INFO] Fetching station consumption data...");
    const { devices, totals } = await service.getConsumptionData(startDate, endDate);

    if (!devices || devices.length === 0) {
      console.error("[ERROR] No station data returned from CloudOceanService.");
      return;
    }

    // Build daily aggregated line items
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
      lineItems: devices.map(d => ({
        name: d.name,
        location: d.location,
        daily: d.cdrDaily.map(c => ({
          date: c.date,
          kWh: c.daily_kwh,
        })),
      })),
      totals,
    };

    console.log("[INFO] Writing invoice to Contentful...");
    await createOrUpdateInvoice(invoiceData.invoiceNumber, invoiceData);

    console.log("[INFO] Generating PDF invoice...");
    const pdfPath = generateInvoicePDF(invoiceData);
    console.log(`[INFO] PDF generated: ${pdfPath}`);

    console.log("[INFO] Done ✅");
  } catch (err) {
    console.error("❌ Error:", err);
  }
})();
