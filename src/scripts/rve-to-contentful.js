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

// --- Convert plain text to Contentful RichText ---
function toRichText(text) {
  return {
    nodeType: "document",
    data: {},
    content: [
      {
        nodeType: "paragraph",
        content: [{ nodeType: "text", value: text, marks: [], data: {} }],
        data: {},
      },
    ],
  };
}

// --- Create LineItem entries in Contentful ---
async function createLineItemEntries(env, lineItems) {
  const entryLinks = [];

  for (const item of lineItems) {
    const entry = await env.createEntry("lineItem", {
      fields: {
        date: { "en-US": item.date }, // ISO YYYY-MM-DD
        startTime: { "en-US": item.startTime }, // ISO datetime
        endTime: { "en-US": item.endTime }, // ISO datetime
        energyConsumed: { "en-US": item.energyConsumed },
        unitPrice: { "en-US": item.unitPrice },
        amount: { "en-US": item.amount },
      },
    });

    await entry.publish();
    entryLinks.push({ sys: { type: "Link", linkType: "Entry", id: entry.sys.id } });
  }

  return entryLinks;
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

  // Create line item entries first
  const lineItemLinks = await createLineItemEntries(env, invoiceData.lineItems);

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
  entry.fields["lineItems"] = { "en-US": lineItemLinks };
  entry.fields["lateFeeRate"] = { "en-US": 0 };

  const updatedEntry = await entry.update();
  await updatedEntry.publish();
  console.log(`[INFO] Invoice ${invoiceId} published successfully`);
}

// --- Generate PDF ---
function generateInvoicePDF(invoiceData, filePath) {
  const doc = new PDFDocument({ margin: 30 });
  doc.pipe(fs.createWriteStream(filePath));

  doc.fontSize(18).text("Invoice", { align: "center" });
  doc.moveDown();
  doc.fontSize(12).text(`Invoice Number: ${invoiceData.invoiceNumber}`);
  doc.text(`Invoice Date: ${invoiceData.invoiceDate}`);
  doc.text(`Billing Period: ${invoiceData.billingPeriodStart} to ${invoiceData.billingPeriodEnd}`);
  doc.text(`Charger Serial Number: ${invoiceData.chargerSerialNumber}`);
  doc.text(`Payment Due Date: ${invoiceData.paymentDueDate}`);
  doc.moveDown();

  // Table header
  doc.text("Date\tStart Time\tEnd Time\tEnergy(kWh)\tUnit Price\tAmount");
  doc.moveDown(0.5);

  for (const item of invoiceData.lineItems) {
    doc.text(
      `${item.date}\t${item.startTime}\t${item.endTime}\t${item.energyConsumed}\t${item.unitPrice}\t${item.amount}`
    );
  }

  doc.moveDown();
  doc.text(`Environmental Impact: ${invoiceData.environmentalImpactText}`);

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

    // Prepare line items with ISO datetime
    const lineItems = consumptionData.flatMap(station =>
      station.readings.map(read => {
        const readDate = new Date(read.time_stamp); // timestamp from API
        const year = readDate.getUTCFullYear();
        const month = String(readDate.getUTCMonth() + 1).padStart(2, "0");
        const day = String(readDate.getUTCDate()).padStart(2, "0");

        const startTime = new Date(`${year}-${month}-${day}T00:00:00Z`).toISOString();
        const endTime = new Date(`${year}-${month}-${day}T23:59:59Z`).toISOString();

        return {
          date: `${year}-${month}-${day}`,
          startTime,
          endTime,
          energyConsumed: read.value.toFixed(2),
          unitPrice: (process.env.RATE_PER_KWH || 0.15).toFixed(2),
          amount: (read.value * (process.env.RATE_PER_KWH || 0.15)).toFixed(2),
        };
      })
    );

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

    // Generate PDF
    generateInvoicePDF(invoiceData, "./invoice_fac-2024-001.pdf");

    console.log("[INFO] Done ✅");
  } catch (err) {
    console.error("❌ Error:", err);
  }
})();
