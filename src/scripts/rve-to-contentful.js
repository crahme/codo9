import dotenv from "dotenv";
import { CloudOceanService } from "../services/CloudOceanService.js";
import contentful from "contentful-management";
import fs from "fs";
import PDFDocument from "pdfkit";

dotenv.config();

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
  try {
    const dailyKwh = itemData.finalReading - itemData.initialReading;
    const entry = await env.createEntry("lineItem", {
      fields: {
        date: { "en-US": itemData.date },
        consumption: { "en-US": Number(dailyKwh.toFixed(2)) },
        readingStart: { "en-US": Number(itemData.initialReading) },
        readingEnd: { "en-US": Number(itemData.finalReading) },
        amount: { "en-US": Number((dailyKwh * parseFloat(itemData.unitPrice)).toFixed(2)) },
        rate: { "en-US": Number(itemData.unitPrice) }
      },
    });
    await entry.publish();
    return entry.sys.id;
  } catch (error) {
    console.error(`[ERROR] Failed to create line item for ${itemData.date}:`, error.message);
    throw error;
  }
}

function generateInvoicePDF(invoiceData) {
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
  doc.fontSize(14).text("Station Details:", { underline: true });
  doc.fontSize(12)
    .text(`Name: ${invoiceData.stationName}`)
    .text(`Location: ${invoiceData.stationLocation}`)
    .text(`Serial: ${invoiceData.chargerSerialNumber}`);
  doc.moveDown();

  // Table Header
  doc.fontSize(10)
    .text('Date', 50, doc.y, { continued: true })
    .text('Initial (kWh)', 150, doc.y, { continued: true })
    .text('Final (kWh)', 250, doc.y, { continued: true })
    .text('Daily kWh', 350, doc.y, { continued: true })
    .text('Amount', 450, doc.y);
  doc.moveDown();

  // Line Items
  let totalKwh = 0;
  let totalAmount = 0;
  
  invoiceData.daily.forEach(day => {
    const dailyKwh = day.finalReading - day.initialReading;
    const amount = dailyKwh * parseFloat(invoiceData.unitPrice);
    
    totalKwh += dailyKwh;
    totalAmount += amount;
    
    doc.fontSize(9)
      .text(day.date, 50, doc.y, { continued: true })
      .text(day.initialReading.toFixed(2), 150, doc.y, { continued: true })
      .text(day.finalReading.toFixed(2), 250, doc.y, { continued: true })
      .text(dailyKwh.toFixed(2), 350, doc.y, { continued: true })
      .text(`$${amount.toFixed(2)}`, 450, doc.y);
  });

  // Summary
  doc.moveDown()
    .fontSize(12)
    .text('Total:', 250, doc.y, { continued: true })
    .text(`${totalKwh.toFixed(2)} kWh`, 350, doc.y, { continued: true })
    .text(`$${totalAmount.toFixed(2)}`, 450, doc.y);

  // Environmental Impact
  doc.moveDown().moveDown()
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

  // Build line items with calculated daily consumption
  const lineItemIds = [];
  for (const day of invoiceData.daily) {
    try {
      const id = await createLineItem(env, {
        date: day.date,
        initialReading: day.initialReading,
        finalReading: day.finalReading,
        unitPrice: invoiceData.unitPrice
      });
      lineItemIds.push({ sys: { type: "Link", linkType: "Entry", id } });
    } catch (error) {
      console.error(`[ERROR] Skipping line item for ${day.date}:`, error.message);
    }
  }

  function setField(field, value) {
    if (allowedFields.includes(field)) {
      entry.fields[field] = { "en-US": value };
    } else {
      console.warn(`[WARN] Skipping unknown field "${field}"`);
    }
  }

  // Set all fields
  const invoiceFields = {
    invoiceNumber: invoiceData.invoiceNumber,
    invoiceDate: invoiceData.invoiceDate,
    billingPeriodStart: invoiceData.billingPeriodStart,
    billingPeriodEnd: invoiceData.billingPeriodEnd,
    paymentDueDate: invoiceData.paymentDueDate,
    stationId: invoiceData.chargerSerialNumber,
    stationName: invoiceData.stationName,
    stationLocation: invoiceData.stationLocation,
    customerName: invoiceData.clientName,
    customerEmail: invoiceData.clientEmail,
    ratePerKwh: Number(invoiceData.unitPrice),
    totalConsumption: Number(invoiceData.totalConsumption),
    totalAmount: Number(invoiceData.totalConsumption * parseFloat(invoiceData.unitPrice)),
    environmentalImpact: toRichText(invoiceData.environmentalImpactText),
    lineItems: lineItemIds
  };

  // Set all fields
  Object.entries(invoiceFields).forEach(([key, value]) => {
    setField(key, value);
  });

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
    const data = await service.getConsumptionData(startDate, endDate);

    for (const station of data) {
      console.log(`[INFO] Processing ${station.station}...`);
      
      const dailyConsumption = station.dailyData.map(day => ({
        date: day.start_time.split('T')[0],
        initialReading: day.initial_kwh,
        finalReading: day.final_kwh
      }));

      const invoiceData = {
        invoiceNumber: `fac-${station.station.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`,
        invoiceDate: new Date().toISOString().split("T")[0],
        chargerSerialNumber: station.station,
        billingPeriodStart: startDate,
        billingPeriodEnd: endDate,
        environmentalImpactText: `This station consumed ${station.consumption.toFixed(2)} kWh during the billing period.`,
        paymentDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        clientName: "John Doe",
        clientEmail: "john.doe@example.com",
        stationName: station.station,
        stationLocation: station.location,
        unitPrice: (process.env.RATE_PER_KWH || 0.15).toFixed(2),
        totalConsumption: station.consumption,
        daily: dailyConsumption
      };

      console.log(`[INFO] Writing invoice for ${station.station} to Contentful...`);
      await createOrUpdateInvoice(invoiceData.invoiceNumber, invoiceData);

      console.log(`[INFO] Generating PDF for ${station.station}...`);
      const pdfPath = generateInvoicePDF(invoiceData);
      console.log(`[INFO] PDF generated: ${pdfPath}`);
    }

    console.log("[INFO] Done ✅");
  } catch (err) {
    console.error("❌ Error:", err);
  }
})();