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

async function createLineItem(env, itemData) {
  const entry = await env.createEntry("lineItem", {
    fields: {
      date: { "en-US": itemData.date },
      initialReading: { "en-US": Number(itemData.initialReading) },
      finalReading: { "en-US": Number(itemData.finalReading) },
      energyConsumed: { "en-US": Number(itemData.consumption) },
      unitPrice: { "en-US": Number(itemData.unitPrice) },
      amount: { "en-US": Number((itemData.consumption * parseFloat(itemData.unitPrice)).toFixed(2)) },
    },
  });
  await entry.publish();
  return entry.sys.id;
}

function generateInvoicePDF(invoiceData) {
  // ...existing PDF generation code...
  const outputDir = "./invoices";
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  const filePath = `${outputDir}/${invoiceData.invoiceNumber}.pdf`;
  const doc = new PDFDocument({ margin: 50 });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  // Header
  doc.fontSize(20).text("INVOICE", { align: "center" });
  doc.moveDown();
  doc.fontSize(12)
    .text(`Invoice Number: ${invoiceData.invoiceNumber}`)
    .text(`Invoice Date: ${invoiceData.invoiceDate}`)
    .text(`Billing Period: ${invoiceData.billingPeriodStart} → ${invoiceData.billingPeriodEnd}`)
    .text(`Payment Due: ${invoiceData.paymentDueDate}`);
  doc.moveDown();

  // Station Info
  doc.fontSize(14).text("Station:", { underline: true });
  doc.fontSize(12)
    .text(invoiceData.stationName || "N/A")
    .text(invoiceData.stationLocation || "N/A");
  doc.moveDown();

  // Table Header
  doc.fontSize(12)
    .text("Date", 50, doc.y, { continued: true })
    .text("Initial (kWh)", 150, doc.y, { continued: true })
    .text("Final (kWh)", 250, doc.y, { continued: true })
    .text("Energy (kWh)", 350, doc.y, { continued: true })
    .text("Amount", 450, doc.y);
  doc.moveDown();

  // Line Items
  let total = 0;
  invoiceData.daily.forEach(item => {
    const amount = item.consumption * parseFloat(invoiceData.unitPrice);
    total += amount;
    doc.text(item.date, 50, doc.y, { continued: true })
      .text(item.initialReading.toFixed(2), 150, doc.y, { continued: true })
      .text(item.finalReading.toFixed(2), 250, doc.y, { continued: true })
      .text(item.consumption.toFixed(2), 350, doc.y, { continued: true })
      .text(`$${amount.toFixed(2)}`, 450, doc.y);
  });

  // Total
  doc.moveDown()
    .fontSize(12)
    .text("TOTAL", 350, doc.y, { continued: true })
    .text(`$${total.toFixed(2)}`, 450, doc.y);

  // Environmental Impact
  doc.moveDown()
    .fontSize(10)
    .text(invoiceData.environmentalImpactText, { align: "left" });

  doc.end();
  return filePath;
}

async function createOrUpdateInvoice(invoiceId, invoiceData) {
  const env = await getEnvironment();
  const contentType = await env.getContentType("invoice");
  const allowedFields = contentType.fields.map(f => f.id);

  let entry;
  try {
    entry = await env.getEntry(invoiceId);
    console.log(`[INFO] Updating invoice ${invoiceId}`);
  } catch {
    entry = await env.createEntryWithId("invoice", invoiceId, { fields: {} });
    console.log(`[INFO] Creating invoice ${invoiceId}`);
  }

  // Build line items from daily readings
  const lineItemIds = [];
  let totalConsumption = 0;

  for (const day of invoiceData.daily) {
    const id = await createLineItem(env, {
      date: day.date,
      initialReading: day.initialReading,
      finalReading: day.finalReading,
      consumption: finalReading-initialReading,
      unitPrice: invoiceData.unitPrice
    });
    lineItemIds.push({ sys: { type: "Link", linkType: "Entry", id } });
    totalConsumption += consumption;
  }

  function setField(field, value) {
    if (allowedFields.includes(field)) {
      entry.fields[field] = { "en-US": value };
    } else {
      console.warn(`[WARN] Skipping unknown field "${field}"`);
    }
  }

  // Set all fields
  setField("syndicateName", "RVE CLOUD OCEAN");
  setField("slug", `/${invoiceData.invoiceNumber}`);
  setField("address", "123 EV Way, Montreal, QC");
  setField("contact", "contact@rve.ca");
  setField("invoiceNumber", invoiceData.invoiceNumber);
  setField("invoiceDate", invoiceData.invoiceDate);
  setField("clientName", invoiceData.clientName);
  setField("clientEmail", invoiceData.clientEmail);
  setField("chargerSerialNumber", invoiceData.chargerSerialNumber);
  setField("stationName", invoiceData.stationName);
  setField("stationLocation", invoiceData.stationLocation);
  setField("billingPeriodStart", invoiceData.billingPeriodStart);
  setField("billingPeriodEnd", invoiceData.billingPeriodEnd);
  setField("environmentalImpactText", toRichText(invoiceData.environmentalImpactText));
  setField("paymentDueDate", invoiceData.paymentDueDate);
  setField("totalConsumption", totalConsumption.toFixed(2));
  setField("totalAmount", (totalConsumption * parseFloat(invoiceData.unitPrice)).toFixed(2));
  setField("lineItems", lineItemIds);

  const updatedEntry = await entry.update();
  await updatedEntry.publish();
  console.log(`[INFO] Invoice ${invoiceId} published successfully`);
}

// Main runner
(async () => {
  const service = new CloudOceanService();

  try {
    const startDate = "2024-10-16";
    const endDate = "2024-11-25";

    console.log("[INFO] Fetching station consumption data...");
    const { devices } = await service.getConsumptionData(startDate, endDate);

    if (!devices || devices.length === 0) {
      throw new Error("No station data returned from CloudOceanService.");
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
        unitPrice: (process.env.RATE_PER_KWH || 0.15).toFixed(2),
        // Use dailyData instead of cdrDaily
        daily: station.dailyData.map(d => ({
          date: d.date,
          initialReading: d.reads_initial || 0,
          finalReading: d.reads_final || 0,
          consumption: d.reads_kwh || 0
        }))
      };

      console.log(`[INFO] Writing invoice for ${station.name} to Contentful...`);
      await createOrUpdateInvoice(invoiceData.invoiceNumber, invoiceData);

      console.log(`[INFO] Generating PDF for ${station.name}...`);
      const pdfPath = generateInvoicePDF(invoiceData);
      console.log(`[INFO] PDF generated: ${pdfPath}`);
    }

    console.log("[INFO] Done ✅");
  } catch (err) {
    console.error("❌ Error:", err);
  }
})();