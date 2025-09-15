// src/scripts/rve-to-contentful.js
import dotenv from "dotenv";
dotenv.config();

import { CloudOceanService } from "../services/CloudOceanService.js";
import contentful from "contentful-management";
import fs from "fs";
import path from "path";
import PdfPrinter from "pdfmake";

// --- Contentful setup ---
const client = contentful.createClient({
  accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN,
});

async function getEnvironment() {
  const space = await client.getSpace(process.env.CONTENTFUL_SPACE_ID);
  const env = await space.getEnvironment(process.env.CONTENTFUL_ENVIRONMENT || "master");
  return env;
}

// --- Utility: format datetime as MM/DD/YYYY HH:MM:SS ---
function formatDateTime(date) {
  const pad = (n) => n.toString().padStart(2, "0");
  return `${pad(date.getUTCMonth() + 1)}/${pad(date.getUTCDate())}/${date.getUTCFullYear()} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

// --- Utility: convert string to Contentful RichText ---
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
            data: {}
          }
        ]
      }
    ]
  };
}

// --- Create Contentful LineItem entries ---
async function createLineItemEntries(env, lineItems) {
  const lineItemEntries = [];
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
    lineItemEntries.push({ sys: { type: "Link", linkType: "Entry", id: entry.sys.id } });
  }
  return lineItemEntries;
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

  // Generate line item entries in Contentful
  const lineItemEntries = await createLineItemEntries(env, invoiceData.lineItems);

  // Set invoice fields
  entry.fields = {
    syndicateName: { "en-US": "RVE Cloud Ocean" },
    slug: { "en-US": `/${invoiceData.invoiceNumber.toLowerCase()}` },
    address: { "en-US": "123 EV Way, Montreal, QC" },
    contact: { "en-US": "contact@rve.ca" },
    invoiceNumber: { "en-US": invoiceData.invoiceNumber.toLowerCase() },
    invoiceDate: { "en-US": invoiceData.invoiceDate },
    clientName: { "en-US": "John Doe" },
    clientEmail: { "en-US": "john.doe@example.com" },
    chargerSerialNumber: { "en-US": invoiceData.chargerSerialNumber },
    billingPeriodStart: { "en-US": invoiceData.billingPeriodStart },
    billingPeriodEnd: { "en-US": invoiceData.billingPeriodEnd },
    environmentalImpactText: { "en-US": toRichText(invoiceData.environmentalImpactText || "") },
    paymentDueDate: { "en-US": invoiceData.paymentDueDate },
    lateFeeRate: { "en-US": 0 },
    lineItems: { "en-US": lineItemEntries },
  };

  const updatedEntry = await entry.update();
  await updatedEntry.publish();
  console.log(`[INFO] Invoice ${invoiceId} published successfully`);
}

// --- Generate line items for each day of the billing period ---
function generateLineItems(consumptionData, startDate, endDate) {
  const lineItems = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const dateStr = d.toISOString().split("T")[0]; // YYYY-MM-DD
    consumptionData.forEach(station => {
      lineItems.push({
        date: dateStr,
        startTime: formatDateTime(new Date(`${dateStr}T00:00:00Z`)),
        endTime: formatDateTime(new Date(`${dateStr}T23:59:59Z`)),
        energyConsumed: station.consumption.toFixed(2),
        unitPrice: (process.env.RATE_PER_KWH || 0.15).toFixed(2),
        amount: (station.consumption * (process.env.RATE_PER_KWH || 0.15)).toFixed(2),
        stationName: station.name,
        location: station.location
      });
    });
  }

  return lineItems;
}

// --- Generate PDF invoice ---
function generatePDF(invoiceData) {
  const fonts = {
    Roboto: {
      normal: "node_modules/pdfmake/fonts/Roboto-Regular.ttf",
      bold: "node_modules/pdfmake/fonts/Roboto-Medium.ttf",
      italics: "node_modules/pdfmake/fonts/Roboto-Italic.ttf",
      bolditalics: "node_modules/pdfmake/fonts/Roboto-MediumItalic.ttf"
    }
  };
  const printer = new PdfPrinter(fonts);

  const tableBody = [
    ["Date", "Start Time", "End Time", "Station", "Location", "Energy (kWh)", "Unit Price ($)", "Amount ($)"]
  ];
  invoiceData.lineItems.forEach(item => {
    tableBody.push([
      item.date,
      item.startTime,
      item.endTime,
      item.stationName,
      item.location,
      item.energyConsumed,
      item.unitPrice,
      item.amount
    ]);
  });

  const docDefinition = {
    content: [
      { text: `Invoice: ${invoiceData.invoiceNumber}`, style: "header" },
      { text: `Billing Period: ${invoiceData.billingPeriodStart} to ${invoiceData.billingPeriodEnd}` },
      { text: "\n" },
      {
        table: {
          headerRows: 1,
          widths: ["auto", "auto", "auto", "*", "*", "auto", "auto", "auto"],
          body: tableBody
        }
      }
    ],
    styles: {
      header: { fontSize: 18, bold: true }
    }
  };

  const pdfDoc = printer.createPdfKitDocument(docDefinition);
  const pdfPath = path.join(process.cwd(), `${invoiceData.invoiceNumber}.pdf`);
  pdfDoc.pipe(fs.createWriteStream(pdfPath));
  pdfDoc.end();

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

    // Prepare invoice data
    const invoiceData = {
      invoiceNumber: "fac-2024-001",
      invoiceDate: new Date().toISOString().split("T")[0],
      chargerSerialNumber: "CHG-001",
      billingPeriodStart: startDate,
      billingPeriodEnd: endDate,
      environmentalImpactText: "CO2 emissions reduced thanks to EV usage.",
      paymentDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      lineItems: generateLineItems(consumptionData, startDate, endDate)
    };

    console.log("[INFO] Writing invoice to Contentful...");
    await createOrUpdateInvoice(invoiceData.invoiceNumber, invoiceData);

    console.log("[INFO] Generating PDF...");
    generatePDF(invoiceData);

    console.log("[INFO] Done ✅");

  } catch (err) {
    console.error("❌ Error:", err);
  }
})();
