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

// --- Create a line item entry safely ---
async function createLineItem(env, itemData) {
  if (!itemData.date || !itemData.energyConsumed) return null;
  try {
    const entry = await env.createEntry("lineItem", {
      fields: {
        date: { "en-US": itemData.date },
        startTime: { "en-US": itemData.startTime },
        endTime: { "en-US": itemData.endTime },
        energyConsumed: { "en-US": itemData.energyConsumed },
        unitPrice: { "en-US": itemData.unitPrice },
        amount: { "en-US": itemData.amount },
        stationName: { "en-US": itemData.stationName },
        stationLocation: { "en-US": itemData.stationLocation },
      },
    });
    await entry.publish();
    return entry.sys.id;
  } catch (err) {
    console.error(`[WARN] Failed to create line item for ${itemData.stationName}:`, err.message);
    return null;
  }
}

// --- Generate PDF invoice ---
function generateInvoicePDF(invoiceData) {
  const outputDir = "./invoices";
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  const filePath = `${outputDir}/${invoiceData.invoiceNumber}.pdf`;
  const doc = new PDFDocument({ margin: 50 });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  // --- Header ---
  doc.fontSize(20).text("INVOICE", { align: "center" });
  doc.moveDown();
  doc.fontSize(12).text(`Invoice Number: ${invoiceData.invoiceNumber}`);
  doc.text(`Invoice Date: ${invoiceData.invoiceDate}`);
  doc.text(`Billing Period: ${invoiceData.billingPeriodStart} → ${invoiceData.billingPeriodEnd}`);
  doc.text(`Payment Due: ${invoiceData.paymentDueDate}`);
  doc.moveDown();

  // --- Client Info ---
  doc.fontSize(14).text("Bill To:", { underline: true });
  doc.fontSize(12).text(invoiceData.clientName);
  doc.text(invoiceData.clientEmail);
  doc.moveDown();

  // --- Table of CDR Sessions grouped by station ---
  invoiceData.lineItems.forEach(item => {
    doc.fontSize(12).text(`${item.stationName} (${item.stationLocation})`, { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10);
    doc.text("Date", 50, doc.y, { continued: true });
    doc.text("Start", 120, doc.y, { continued: true });
    doc.text("End", 200, doc.y, { continued: true });
    doc.text("Energy (kWh)", 270, doc.y, { continued: true });
    doc.text("Unit Price", 360, doc.y, { continued: true });
    doc.text("Amount", 450, doc.y);
    doc.moveDown(0.5);

    doc.text(item.date, 50, doc.y, { continued: true });
    doc.text(item.startTime.split("T")[1]?.split("Z")[0] || "", 120, doc.y, { continued: true });
    doc.text(item.endTime.split("T")[1]?.split("Z")[0] || "", 200, doc.y, { continued: true });
    doc.text(item.energyConsumed, 270, doc.y, { continued: true });
    doc.text(`$${item.unitPrice}`, 360, doc.y, { continued: true });
    doc.text(`$${item.amount}`, 450, doc.y);
    doc.moveDown(0.5);
  });

  // --- Total ---
  const totalAmount = invoiceData.lineItems.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
  doc.moveDown();
  doc.fontSize(12).text("TOTAL", 360, doc.y, { continued: true });
  doc.text(`$${totalAmount.toFixed(2)}`, 450, doc.y);

  // --- Environmental Impact ---
  doc.moveDown().fontSize(10).text(invoiceData.environmentalImpactText, { align: "left" });

  doc.end();
  return filePath;
}

// --- Create or update invoice entry safely ---
async function createOrUpdateInvoice(invoiceId, invoiceData) {
  const env = await getEnvironment();

  // --- Ensure there are line items ---
  const validLineItems = invoiceData.lineItems.filter(item => item.date && item.energyConsumed);
  if (!validLineItems.length) {
    console.warn(`[WARN] No valid line items for invoice ${invoiceId}. Skipping Contentful upload.`);
    return;
  }

  // --- Create/publish line items ---
  const lineItemIds = [];
  for (const item of validLineItems) {
    const id = await createLineItem(env, item);
    if (id) lineItemIds.push({ sys: { type: "Link", linkType: "Entry", id } });
  }

  if (!lineItemIds.length) {
    console.warn(`[WARN] No line items were successfully created for invoice ${invoiceId}.`);
    return;
  }

  // --- Create or update invoice entry ---
  let entry;
  try {
    entry = await env.getEntry(invoiceId);
    console.log(`[INFO] Updating invoice ${invoiceId}`);
  } catch {
    entry = await env.createEntryWithId("invoice", invoiceId, { fields: {} });
    console.log(`[INFO] Creating invoice ${invoiceId}`);
  }

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
  console.log(`[INFO] Invoice ${invoiceId} published successfully to Contentful`);
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

    // --- Prepare invoice data ---
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
      lineItems: devices.flatMap(station =>
        station.cdrDaily.map(cdr => ({
          date: cdr.date,
          startTime: cdr.start_time,
          endTime: cdr.end_time,
          energyConsumed: cdr.daily_kwh.toFixed(2),
          unitPrice: (process.env.RATE_PER_KWH || 0.15).toFixed(2),
          amount: (cdr.daily_kwh * (process.env.RATE_PER_KWH || 0.15)).toFixed(2),
          stationName: station.name,
          stationLocation: station.location,
        }))
      )
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
