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
  const env = await space.getEnvironment(
    process.env.CONTENTFUL_ENVIRONMENT || "master"
  );
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

// --- Create a line item entry and publish it ---
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

// --- Generate PDF invoice per station ---
function generateInvoicePDF(invoiceData) {
  const outputDir = "./invoices";
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  const filePath = `${outputDir}/${invoiceData.invoiceNumber}.pdf`;
  const doc = new PDFDocument({ margin: 50 });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  // --- Header
  doc.fontSize(20).text("INVOICE", { align: "center" });
  doc.moveDown();
  doc.fontSize(12).text(`Invoice Number: ${invoiceData.invoiceNumber}`);
  doc.text(`Invoice Date: ${invoiceData.invoiceDate}`);
  doc.text(
    `Billing Period: ${invoiceData.billingPeriodStart} → ${invoiceData.billingPeriodEnd}`
  );
  doc.text(`Payment Due: ${invoiceData.paymentDueDate}`);
  doc.moveDown();

  // --- Client Info
  doc.fontSize(14).text("Bill To:", { underline: true });
  doc.fontSize(12).text(invoiceData.clientName);
  doc.text(invoiceData.clientEmail);
  doc.moveDown();

  // --- Charger Info
  doc.fontSize(12).text(`Charger: ${invoiceData.stationName}`);
  doc.text(`Serial: ${invoiceData.chargerSerialNumber}`);
  doc.moveDown();

  // --- Table Header
  doc.fontSize(12).text("Date", 50, doc.y, { continued: true });
  doc.text("Energy (kWh)", 150, doc.y, { continued: true });
  doc.text("Unit Price", 250, doc.y, { continued: true });
  doc.text("Amount", 350, doc.y);
  doc.moveDown();

  // --- Line Items
  let total = 0;
  invoiceData.lineItems.forEach((item) => {
    total += parseFloat(item.amount);
    doc.text(item.date, 50, doc.y, { continued: true });
    doc.text(item.energyConsumed, 150, doc.y, { continued: true });
    doc.text(`$${item.unitPrice}`, 250, doc.y, { continued: true });
    doc.text(`$${item.amount}`, 350, doc.y);
  });

  // --- TOTAL Row
  doc.moveDown();
  doc.fontSize(12).text("TOTAL", 250, doc.y, { continued: true });
  doc.text(`$${total.toFixed(2)}`, 350, doc.y);

  // --- Environmental Impact
  doc.moveDown()
    .fontSize(10)
    .text(invoiceData.environmentalImpactText, { align: "left" });

  doc.end();

  return filePath;
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

  // --- Deduplicate line items ---
  const uniqueStations = [];
  const seen = new Set();
  for (const station of invoiceData.lineItems) {
    const key = `${station.date}_${station.energyConsumed}_${station.amount}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueStations.push(station);
    }
  }

  // --- Create/publish line items ---
  const lineItemIds = [];
  for (const item of uniqueStations) {
    const id = await createLineItem(env, item);
    lineItemIds.push({ sys: { type: "Link", linkType: "Entry", id } });
  }

  // --- Set invoice fields ---
  entry.fields["syndicateName"] = { "en-US": "RVE CLOUD OCEAN" };
  entry.fields["slug"] = { "en-US": `/${invoiceData.invoiceNumber}` };
  entry.fields["address"] = { "en-US": "123 EV Way, Montreal, QC" };
  entry.fields["contact"] = { "en-US": "contact@rve.ca" };
  entry.fields["invoiceNumber"] = { "en-US": invoiceData.invoiceNumber };
  entry.fields["invoiceDate"] = { "en-US": invoiceData.invoiceDate };
  entry.fields["clientName"] = { "en-US": invoiceData.clientName };
  entry.fields["clientEmail"] = { "en-US": invoiceData.clientEmail };
  entry.fields["chargerSerialNumber"] = {
    "en-US": invoiceData.chargerSerialNumber,
  };
  entry.fields["billingPeriodStart"] = { "en-US": invoiceData.billingPeriodStart };
  entry.fields["billingPeriodEnd"] = { "en-US": invoiceData.billingPeriodEnd };
  entry.fields["stationName"] = { "en-US": invoiceData.stationName };
  entry.fields["environmentalImpactText"] = {
    "en-US": toRichText(invoiceData.environmentalImpactText),
  };
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

    console.log("[INFO] Fetching consumption data from RVE API...");
    const consumptionData = await service.getConsumptionData(startDate, endDate);

    // For each station, create a separate invoice
    for (const station of consumptionData) {
      const invoiceData = {
        invoiceNumber: `fac-${station.name.replace(/\s+/g, "_")}`,
        invoiceDate: new Date().toISOString().split("T")[0],
        stationName: station.name,
        chargerSerialNumber: station.serial || "UNKNOWN",
        billingPeriodStart: startDate,
        billingPeriodEnd: endDate,
        environmentalImpactText:
          "CO2 emissions reduced thanks to EV usage.",
        paymentDueDate: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        )
          .toISOString()
          .split("T")[0],
        clientName: "John Doe",
        clientEmail: "john.doe@example.com",
        lineItems: station.cdrSessions.map((cdr) => ({
          date: cdr.date,
          startTime: cdr.startTime,
          endTime: cdr.endTime,
          energyConsumed: cdr.energy.toFixed(2),
          unitPrice: (process.env.RATE_PER_KWH || 0.15).toFixed(2),
          amount: (cdr.energy * (process.env.RATE_PER_KWH || 0.15)).toFixed(2),
        })),
      };

      console.log(`[INFO] Writing invoice for ${station.name}...`);
      await createOrUpdateInvoice(invoiceData.invoiceNumber, invoiceData);

      console.log(`[INFO] Generating PDF invoice for ${station.name}...`);
      const pdfPath = generateInvoicePDF(invoiceData);
      console.log(`[INFO] PDF generated: ${pdfPath}`);
    }

    console.log("[INFO] Done ✅");
  } catch (err) {
    console.error("❌ Error:", err);
  }
})();

