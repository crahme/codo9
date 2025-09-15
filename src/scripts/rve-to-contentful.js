// src/scripts/rve-to-contentful.js
import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import contentful from "contentful-management";
import { CloudOceanService } from "../services/CloudOceanService.js";

// --- Contentful client setup ---
const client = contentful.createClient({
  accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN,
});

async function getEnvironment() {
  const space = await client.getSpace(process.env.CONTENTFUL_SPACE_ID);
  const env = await space.getEnvironment(process.env.CONTENTFUL_ENVIRONMENT || "master");
  return env;
}

// --- Convert plain text to Contentful RichText ---
function toRichText(text) {
  return {
    nodeType: "document",
    data: {},
    content: [
      {
        nodeType: "paragraph",
        content: [
          {
            nodeType: "text",
            value: text,
            marks: [],
            data: {},
          },
        ],
        data: {},
      },
    ],
  };
}

// --- Create line item entries in Contentful ---
async function createLineItemEntries(env, lineItems) {
  const createdEntries = [];
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
    createdEntries.push({ sys: { type: "Link", linkType: "Entry", id: entry.sys.id } });
  }
  return createdEntries;
}

// --- Create or update the invoice entry ---
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

  // --- Create line item entries ---
  const lineItemLinks = await createLineItemEntries(env, invoiceData.lineItems);

  // --- Update invoice fields ---
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
  entry.fields["lineItems"] = { "en-US": lineItemLinks };

  const updatedEntry = await entry.update();
  await updatedEntry.publish();
  console.log(`[INFO] Invoice ${invoiceId} published successfully`);
}

// --- Generate PDF from invoice ---
function generatePDF(invoiceData, filePath) {
  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(fs.createWriteStream(filePath));

  doc.fontSize(18).text(`Invoice: ${invoiceData.invoiceNumber}`, { align: "center" });
  doc.moveDown();
  doc.fontSize(12).text(`Syndicate: RVE Cloud Ocean`);
  doc.text(`Address: 123 EV Way, Montreal, QC`);
  doc.text(`Contact: contact@rve.ca`);
  doc.text(`Client: John Doe`);
  doc.text(`Client Email: john.doe@example.com`);
  doc.text(`Invoice Date: ${invoiceData.invoiceDate}`);
  doc.text(`Billing Period: ${invoiceData.billingPeriodStart} - ${invoiceData.billingPeriodEnd}`);
  doc.text(`Payment Due: ${invoiceData.paymentDueDate}`);
  doc.moveDown();

  doc.fontSize(14).text("Consumption Details:");
  doc.moveDown();

  // Table header
  doc.fontSize(12).text(
    `Date       | Start Time        | End Time          | Energy (kWh) | Unit Price | Amount`,
    { continued: false }
  );
  doc.moveDown();

  invoiceData.lineItems.forEach(item => {
    doc.text(
      `${item.date} | ${item.startTime} | ${item.endTime} | ${item.energyConsumed} | ${item.unitPrice} | ${item.amount}`
    );
  });

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

    // Prepare invoice line items (one per reading)
    const lineItems = consumptionData.flatMap(station => {
      return station.readings.map(read => {
        const readDate = new Date(read.timestamp);
        const pad = n => n.toString().padStart(2, "0");
        const formattedDate = `${pad(readDate.getUTCMonth() + 1)}/${pad(readDate.getUTCDate())}/${readDate.getUTCFullYear()}`;
        return {
          date: formattedDate,
          startTime: `${formattedDate} 00:00:00`,
          endTime: `${formattedDate} 23:59:59`,
          energyConsumed: read.value.toFixed(2),
          unitPrice: (process.env.RATE_PER_KWH || 0.15).toFixed(2),
          amount: (read.value * (process.env.RATE_PER_KWH || 0.15)).toFixed(2),
          stationName: station.name,
          location: station.location,
        };
      });
    });

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
    const pdfPath = path.join(process.cwd(), `invoice_${invoiceData.invoiceNumber}.pdf`);
    generatePDF(invoiceData, pdfPath);

    console.log("[INFO] Done ✅");

  } catch (err) {
    console.error("❌ Error:", err.message);
  }
})();
