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

// --- Create line item entry in Contentful ---
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

// --- Generate PDF invoice for ONE station ---
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

  // Station Info
  doc.fontSize(14).text(`Station: ${invoiceData.stationName}`, { underline: true });
  doc.fontSize(12).text(`Location: ${invoiceData.stationLocation}`).moveDown();

  // Table header
  doc.fontSize(12).text("Date", 50, doc.y, { continued: true });
  doc.text("Energy (kWh)", 200, doc.y, { continued: true });
  doc.text("Unit Price", 320, doc.y, { continued: true });
  doc.text("Amount", 420, doc.y);
  doc.moveDown();

  // Table rows
  let total = 0;
  invoiceData.daily.forEach(d => {
    const amount = d.kWh * (process.env.RATE_PER_KWH || 0.15);
    total += amount;

    doc.text(d.date, 50, doc.y, { continued: true });
    doc.text(d.kWh.toFixed(2), 200, doc.y, { continued: true });
    doc.text(`$${(process.env.RATE_PER_KWH || 0.15).toFixed(2)}`, 320, doc.y, { continued: true });
    doc.text(`$${amount.toFixed(2)}`, 420, doc.y);
  });

  // Total row
  doc.moveDown();
  doc.fontSize(12).text("TOTAL", 320, doc.y, { continued: true });
  doc.text(`$${total.toFixed(2)}`, 420, doc.y);

  // Environmental impact
  doc.moveDown().fontSize(10).text(invoiceData.environmentalImpactText, { align: "left" });

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

  // Build line items (daily aggregates)
  const lineItemIds = [];
  for (const d of invoiceData.daily) {
    const id = await createLineItem(env, {
      date: d.date,
      energyConsumed: d.kWh.toFixed(2),
      unitPrice: (process.env.RATE_PER_KWH || 0.15).toFixed(2),
      amount: (d.kWh * (process.env.RATE_PER_KWH || 0.15)).toFixed(2),
    });
    lineItemIds.push({ sys: { type: "Link", linkType: "Entry", id } });
  }

  // Assign fields
  entry.fields["syndicateName"] = { "en-US": "RVE CLOUD OCEAN" };
  entry.fields["slug"] = { "en-US": `/${invoiceData.invoiceNumber}` };
  entry.fields["address"] = { "en-US": "123 EV Way, Montreal, QC" };
  entry.fields["contact"] = { "en-US": "contact@rve.ca" };
  entry.fields["invoiceNumber"] = { "en-US": invoiceData.invoiceNumber };
  entry.fields["invoiceDate"] = { "en-US": invoiceData.invoiceDate };
  entry.fields["clientName"] = { "en-US": invoiceData.clientName };
  entry.fields["clientEmail"] = { "en-US": invoiceData.clientEmail };
  entry.fields["chargerSerialNumber"] = { "en-US": invoiceData.chargerSerialNumber };
  entry.fields["stationName"] = { "en-US": invoiceData.stationName };
  entry.fields["stationLocation"] = { "en-US": invoiceData.stationLocation };
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
    const { devices } = await service.getConsumptionData(startDate, endDate);

    if (!devices || devices.length === 0) {
      console.error("[ERROR] No station data returned from CloudOceanService.");
      return;
    }

    for (const station of devices) {
      const invoiceData = {
        invoiceNumber: `fac-${station.uuid}-${Date.now()}`,
        invoiceDate: new Date().toISOString().split("T")[0],
        chargerSerialNumber: "CHG-001",
        billingPeriodStart: startDate,
        billingPeriodEnd: endDate,
        environmentalImpactText: "CO2 emissions reduced thanks to EV usage.",
        paymentDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        clientName: "John Doe",
        clientEmail: "john.doe@example.com",
        stationName: station.name,
        stationLocation: station.location,
        daily: station.cdrDaily.map(c => ({
          date: c.date,
          kWh: c.daily_kwh,
        })),
      };

      console.log(`[INFO] Writing invoice for ${station.name} to Contentful...`);
      await createOrUpdateInvoice(invoiceData.invoiceNumber, invoiceData);

      console.log(`[INFO] Generating PDF invoice for ${station.name}...`);
      const pdfPath = generateInvoicePDF(invoiceData);
      console.log(`[INFO] PDF generated: ${pdfPath}`);
    }

    console.log("[INFO] All invoices done ✅");
  } catch (err) {
    console.error("❌ Error:", err);
  }
})();
