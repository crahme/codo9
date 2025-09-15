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

// Convert string to Contentful RichText
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

// --- Create Line Item Entries ---
async function createLineItemEntries(env, lineItems) {
  const entries = [];
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
    entries.push({
      sys: {
        type: "Link",
        linkType: "Entry",
        id: entry.sys.id
      }
    });
  }
  return entries;
}

// --- Create or Update Invoice ---
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

  // Set invoice fields
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

  const updatedEntry = await entry.update();
  await updatedEntry.publish();
  console.log(`[INFO] Invoice ${invoiceId} published successfully`);

  return invoiceData;
}

// --- Generate PDF ---
function generateInvoicePDF(invoiceData) {
  const doc = new PDFDocument({ margin: 30 });
  const pdfPath = `./${invoiceData.invoiceNumber}.pdf`;
  doc.pipe(fs.createWriteStream(pdfPath));

  doc.fontSize(20).text("Invoice", { align: "center" });
  doc.moveDown();

  // Invoice info
  doc.fontSize(12).text(`Invoice Number: ${invoiceData.invoiceNumber}`);
  doc.text(`Invoice Date: ${invoiceData.invoiceDate}`);
  doc.text(`Billing Period: ${invoiceData.billingPeriodStart} - ${invoiceData.billingPeriodEnd}`);
  doc.text(`Charger Serial: ${invoiceData.chargerSerialNumber}`);
  doc.text(`Client: ${invoiceData.clientName} <${invoiceData.clientEmail}>`);
  doc.text(`Address: ${invoiceData.address}`);
  doc.text(`Contact: ${invoiceData.contact}`);
  doc.moveDown();

  // Table header
  doc.text("Line Items:", { underline: true });
  doc.moveDown(0.5);

  // Draw table
  invoiceData.lineItems.forEach((item, index) => {
    doc.text(
      `${index + 1}. Date: ${item.date} | Start: ${item.startTime} | End: ${item.endTime} | Energy: ${item.energyConsumed} kWh | Unit Price: $${item.unitPrice} | Amount: $${item.amount}`
    );
  });

  doc.moveDown();
  doc.text(`Environmental Impact: ${invoiceData.environmentalImpactText}`);
  doc.end();
  console.log(`[INFO] PDF generated at ${pdfPath}`);
}

// --- Main Runner ---
(async () => {
  const service = new CloudOceanService();

  try {
    const startDate = "2024-10-16";
    const endDate = "2024-11-25";

    console.log("[INFO] Fetching consumption data from RVE API...");
    const consumptionData = await service.getConsumptionData(startDate, endDate);

    // Prepare invoice line items from RVE readings
    const lineItems = consumptionData.flatMap(station =>
      station.readings
        .filter(r => r.time_stamp)
        .map(read => {
          const readingDate = new Date(read.time_stamp);
          if (isNaN(readingDate.getTime())) return null;

          const startTime = new Date(Date.UTC(readingDate.getUTCFullYear(), readingDate.getUTCMonth(), readingDate.getUTCDate(), 0, 0, 0));
          const endTime = new Date(Date.UTC(readingDate.getUTCFullYear(), readingDate.getUTCMonth(), readingDate.getUTCDate(), 23, 59, 59));

          const energyConsumed = parseFloat(read.value || 0);
          const unitPrice = parseFloat(process.env.RATE_PER_KWH || 0.15);
          const amount = parseFloat((energyConsumed * unitPrice).toFixed(2));

          return {
            date: readingDate.toISOString(),
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            energyConsumed: energyConsumed.toFixed(2),
            unitPrice: unitPrice.toFixed(2),
            amount: amount.toFixed(2),
          };
        })
        .filter(Boolean)
    );

    // Prepare invoice data
    const invoiceData = {
      invoiceNumber: "fac-2024-001",
      invoiceDate: new Date().toISOString(),
      chargerSerialNumber: "CHG-001",
      billingPeriodStart: startDate,
      billingPeriodEnd: endDate,
      environmentalImpactText: "CO2 emissions reduced thanks to EV usage.",
      paymentDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      lineItems
    };

    console.log(`[INFO] Writing invoice ${invoiceData.invoiceNumber} to Contentful...`);
    await createOrUpdateInvoice(invoiceData.invoiceNumber, invoiceData);

    // Generate PDF
    generateInvoicePDF(invoiceData);

    console.log("[INFO] Done ✅");

  } catch (err) {
    console.error("❌ Error:", err);
  }
})();
