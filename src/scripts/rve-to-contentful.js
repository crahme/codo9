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

// --- Create line items in Contentful ---
async function createLineItemEntries(env, consumptionData) {
  const lineItemLinks = [];

  for (const station of consumptionData) {
    for (const read of station.readings) {
      // Use actual reading date
      const readingDate = new Date(read.date || read.time_stamp);
      if (isNaN(readingDate)) {
        console.warn(`[WARN] Invalid date for reading: ${read.date || read.time_stamp}`);
        continue;
      }

      const energy = parseFloat(read.value);
      const unitPrice = parseFloat(process.env.RATE_PER_KWH || 0.15);

      const entry = await env.createEntry("lineItem", {
        fields: {
          date: { "en-US": readingDate },
          startTime: { "en-US": new Date(Date.UTC(readingDate.getUTCFullYear(), readingDate.getUTCMonth(), readingDate.getUTCDate(), 0, 0, 0)) },
          endTime: { "en-US": new Date(Date.UTC(readingDate.getUTCFullYear(), readingDate.getUTCMonth(), readingDate.getUTCDate(), 23, 59, 59)) },
          energyConsumed: { "en-US": energy },
          unitPrice: { "en-US": unitPrice },
          amount: { "en-US": parseFloat((energy * unitPrice).toFixed(2)) }
        }
      });

      await entry.publish();
      lineItemLinks.push({ sys: { type: "Link", linkType: "Entry", id: entry.sys.id } });
    }
  }

  return lineItemLinks;
}

// --- Update or overwrite invoice ---
async function createOrUpdateInvoice(invoiceId, invoiceData, lineItemLinks) {
  const env = await getEnvironment();
  let entry;

  try {
    entry = await env.getEntry(invoiceId);
    console.log(`[INFO] Updating invoice ${invoiceId}`);
  } catch {
    entry = await env.createEntryWithId("invoice", invoiceId, { fields: {} });
    console.log(`[INFO] Creating invoice ${invoiceId}`);
  }

  entry.fields.syndicateName = { "en-US": "RVE Cloud Ocean" };
  entry.fields.slug = { "en-US": `/fac-2024-001` };
  entry.fields.address = { "en-US": "123 EV Way, Montreal, QC" };
  entry.fields.contact = { "en-US": "contact@rve.ca" };
  entry.fields.invoiceNumber = { "en-US": invoiceId };
  entry.fields.invoiceDate = { "en-US": new Date(invoiceData.invoiceDate) };
  entry.fields.clientName = { "en-US": "John Doe" };
  entry.fields.clientEmail = { "en-US": "john.doe@example.com" };
  entry.fields.chargerSerialNumber = { "en-US": invoiceData.chargerSerialNumber };
  entry.fields.billingPeriodStart = { "en-US": new Date(invoiceData.billingPeriodStart) };
  entry.fields.billingPeriodEnd = { "en-US": new Date(invoiceData.billingPeriodEnd) };
  entry.fields.paymentDueDate = { "en-US": new Date(invoiceData.paymentDueDate) };
  entry.fields.lineItems = { "en-US": lineItemLinks };
  entry.fields.lateFeeRate = { "en-US": 0 };

  await entry.update();
  await entry.publish();
  console.log(`[INFO] Invoice ${invoiceId} published successfully`);
}

// --- PDF generation ---
function generatePDF(invoiceData, lineItems) {
  const doc = new PDFDocument();
  const pdfPath = `./invoice_${invoiceData.invoiceNumber}.pdf`;
  doc.pipe(fs.createWriteStream(pdfPath));

  doc.fontSize(18).text(`Invoice: ${invoiceData.invoiceNumber}`, { underline: true });
  doc.moveDown();
  doc.fontSize(12)
     .text(`Syndicate Name: RVE Cloud Ocean`)
     .text(`Address: 123 EV Way, Montreal, QC`)
     .text(`Contact: contact@rve.ca`)
     .text(`Client Name: John Doe`)
     .text(`Email: john.doe@example.com`)
     .text(`Charger Serial Number: ${invoiceData.chargerSerialNumber}`)
     .text(`Billing Period: ${invoiceData.billingPeriodStart} to ${invoiceData.billingPeriodEnd}`)
     .text(`Invoice Date: ${invoiceData.invoiceDate}`)
     .text(`Payment Due Date: ${invoiceData.paymentDueDate}`)
     .text(`Late Fee Rate: 0`)
     .moveDown();

  doc.text(`Line Items:`, { underline: true });

  // Table header
  doc.text("Date | Start | End | Energy(kWh) | Unit Price | Amount");
  doc.moveDown(0.5);

  lineItems.forEach(item => {
    const dateStr = item.date.toISOString().split("T")[0];
    const startStr = item.startTime.toISOString();
    const endStr = item.endTime.toISOString();
    doc.text(`${dateStr} | ${startStr} | ${endStr} | ${item.energyConsumed} | ${item.unitPrice} | ${item.amount}`);
  });

  doc.end();
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

    // Prepare invoice info
    const invoiceData = {
      invoiceNumber: "fac-2024-001",
      invoiceDate: new Date().toISOString().split("T")[0],
      chargerSerialNumber: "CHG-001",
      billingPeriodStart: startDate,
      billingPeriodEnd: endDate,
      paymentDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
    };

    // 1. Create line items
    console.log("[INFO] Creating line items in Contentful...");
    const env = await getEnvironment();
    const lineItemLinks = await createLineItemEntries(env, consumptionData);

    // 2. Update invoice with line items
    console.log("[INFO] Updating invoice entry in Contentful...");
    await createOrUpdateInvoice(invoiceData.invoiceNumber, invoiceData, lineItemLinks);

    // 3. Generate PDF
    console.log("[INFO] Generating invoice PDF...");
    const pdfLineItems = lineItemLinks.map(link => {
      const item = link.sys; // placeholder; ideally fetch data from line items if needed
      return item;
    });
    generatePDF(invoiceData, pdfLineItems);

    console.log("[INFO] Done ✅");

  } catch (err) {
    console.error("❌ Error:", err);
  }
})();
