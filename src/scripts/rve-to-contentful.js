// src/scripts/rve-to-contentful.js
import dotenv from "dotenv";
dotenv.config();

import { CloudOceanService } from "../services/CloudOceanService.js";
import contentful from "contentful-management";
import fs from "fs";
import path from "path";
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

// --- Generate PDF invoice ---
function generateInvoicePDF(invoiceData) {
  const outputDir = "./invoices";
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  const filePath = path.join(outputDir, `${invoiceData.invoiceNumber}.pdf`);
  const doc = new PDFDocument({ margin: 50 });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  // Header
  doc.fontSize(20).text("INVOICE", { align: "center" }).moveDown();
  doc.fontSize(12)
    .text(`Invoice Number: ${invoiceData.invoiceNumber}`)
    .text(`Invoice Date: ${invoiceData.invoiceDate}`)
    .text(`Billing Period: ${invoiceData.billingPeriodStart} → ${invoiceData.billingPeriodEnd}`)
    .text(`Payment Due: ${invoiceData.paymentDueDate}`)
    .moveDown();

  // Client Info
  doc.fontSize(14).text("Bill To:", { underline: true });
  doc.fontSize(12).text(invoiceData.clientName);
  doc.text(invoiceData.clientEmail).moveDown();

  // Table Header
  doc.fontSize(12).text("Date", 50, doc.y, { continued: true });
  doc.text("Start Time", 150, doc.y, { continued: true });
  doc.text("End Time", 250, doc.y, { continued: true });
  doc.text("Energy (kWh)", 350, doc.y, { continued: true });
  doc.text("Unit Price", 450, doc.y, { continued: true });
  doc.text("Amount", 520, doc.y).moveDown(0.5);

  let total = 0;

  invoiceData.lineItems.forEach(item => {
    total += parseFloat(item.amount);
    doc.fontSize(10)
      .text(item.date, 50, doc.y, { continued: true })
      .text(item.startTime, 150, doc.y, { continued: true })
      .text(item.endTime, 250, doc.y, { continued: true })
      .text(item.energyConsumed, 350, doc.y, { continued: true })
      .text(`$${item.unitPrice}`, 450, doc.y, { continued: true })
      .text(`$${item.amount}`, 520, doc.y);

    doc.moveDown(0.5);
    if (doc.y > doc.page.height - 100) doc.addPage();
  });

  // TOTAL
  doc.moveDown().fontSize(12).text("TOTAL", 450, doc.y, { continued: true });
  doc.text(`$${total.toFixed(2)}`, 520);

  // Environmental Impact
  doc.moveDown().fontSize(10).text(invoiceData.environmentalImpactText, { align: "left" });

  doc.end();
  return filePath;
}

// --- Create Line Item Entry ---
async function createLineItem(env, itemData) {
  const entry = await env.createEntry("lineItem", {
    fields: {
      date: { "en-US": itemData.date },
      startTime: { "en-US": itemData.startTime },
      endTime: { "en-US": itemData.endTime },
      energyConsumed: { "en-US": itemData.energyConsumed },
      unitPrice: { "en-US": itemData.unitPrice },
      amount: { "en-US": itemData.amount },
    },
  });
  await entry.publish();
  return entry.sys.id;
}

// --- Create or update Invoice ---
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

  // Deduplicate line items
  const uniqueLineItems = [];
  const seen = new Set();
  for (const item of invoiceData.lineItems) {
    const key = `${item.startTime}_${item.endTime}_${item.energyConsumed}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueLineItems.push(item);
    }
  }

  // Create & publish line items
  const lineItemIds = [];
  for (const item of uniqueLineItems) {
    const id = await createLineItem(env, item);
    lineItemIds.push({ sys: { type: "Link", linkType: "Entry", id } });
  }

  // Set invoice fields
  entry.fields = {
    syndicateName: { "en-US": "RVE CLOUD OCEAN" },
    slug: { "en-US": `/${invoiceData.invoiceNumber}` },
    address: { "en-US": "123 EV Way, Montreal, QC" },
    contact: { "en-US": "contact@rve.ca" },
    invoiceNumber: { "en-US": invoiceData.invoiceNumber },
    invoiceDate: { "en-US": invoiceData.invoiceDate },
    clientName: { "en-US": invoiceData.clientName },
    clientEmail: { "en-US": invoiceData.clientEmail },
    chargerSerialNumber: { "en-US": invoiceData.chargerSerialNumber },
    billingPeriodStart: { "en-US": invoiceData.billingPeriodStart },
    billingPeriodEnd: { "en-US": invoiceData.billingPeriodEnd },
    environmentalImpactText: { "en-US": toRichText(invoiceData.environmentalImpactText) },
    paymentDueDate: { "en-US": invoiceData.paymentDueDate },
    lineItems: { "en-US": lineItemIds },
  };

  const updatedEntry = await entry.update();
  await updatedEntry.publish();
  console.log(`[INFO] Invoice ${invoiceId} published in Contentful`);

  // Generate PDF immediately
  const pdfPath = generateInvoicePDF(invoiceData);
  console.log(`[INFO] PDF generated: ${pdfPath}`);
  return pdfPath;
}

// --- MAIN ---
(async () => {
  const service = new CloudOceanService();

  try {
    const startDate = "2024-10-16";
    const endDate = "2024-11-25";

    console.log("[INFO] Fetching consumption data from RVE API...");
    const consumptionData = await service.getConsumptionData(startDate, endDate);

    for (const station of consumptionData.devices || []) {
      // Build invoice data per station
      const invoiceData = {
        invoiceNumber: `fac-${station.name.replace(/\s+/g, "-")}`,
        invoiceDate: new Date().toISOString().split("T")[0],
        chargerSerialNumber: station.serialNumber || station.uuid,
        billingPeriodStart: startDate,
        billingPeriodEnd: endDate,
        environmentalImpactText: "CO2 emissions reduced thanks to EV usage.",
        paymentDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        clientName: station.clientName || "Default Client",
        clientEmail: station.clientEmail || "client@example.com",
        lineItems: (station.cdrSessions || []).map(s => ({
          date: s.date,
          startTime: s.startTime,
          endTime: s.endTime,
          energyConsumed: s.energy.toFixed(2),
          unitPrice: (process.env.RATE_PER_KWH || 0.15).toFixed(2),
          amount: (s.energy * (process.env.RATE_PER_KWH || 0.15)).toFixed(2),
        })),
      };

      await createOrUpdateInvoice(invoiceData.invoiceNumber, invoiceData);
    }

    console.log("[INFO] All invoices generated and PDFs created ✅");

  } catch (err) {
    console.error("❌ Error:", err);
  }
})();
