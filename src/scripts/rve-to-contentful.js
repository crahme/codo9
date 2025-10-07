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
  const entry = await env.createEntry("lineItem", {
    fields: {
      date: { "en-US": itemData.date },
      energyConsumed: { "en-US": itemData.energyConsumed },
      unitPrice: { "en-US": itemData.unitPrice },
      amount: { "en-US": itemData.amount },
      initialReading: { "en-US": itemData.initialReading },
      finalReading: { "en-US": itemData.finalReading },
      maxAmp: { "en-US": itemData.maxAmp || 0 },
      avgAmp: { "en-US": itemData.avgAmp || 0 }
    },
  });
  await entry.publish();
  return entry.sys.id;
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
    .text('Usage (kWh)', 350, doc.y, { continued: true })
    .text('Amount', 450, doc.y);
  doc.moveDown();

  // Line Items
  let total = 0;
  invoiceData.daily.forEach(item => {
    const amount = item.kWh * parseFloat(invoiceData.unitPrice);
    total += amount;
    
    doc.fontSize(9)
      .text(item.date, 50, doc.y, { continued: true })
      .text(item.initialReading.toFixed(2), 150, doc.y, { continued: true })
      .text(item.finalReading.toFixed(2), 250, doc.y, { continued: true })
      .text(item.kWh.toFixed(2), 350, doc.y, { continued: true })
      .text(`$${amount.toFixed(2)}`, 450, doc.y);
  });

  // Summary
  doc.moveDown()
    .fontSize(12)
    .text('Total Consumption:', 250, doc.y, { continued: true })
    .text(`${invoiceData.totalConsumption.toFixed(2)} kWh`, 350, doc.y);
  
  doc.text('Total Amount:', 250, doc.y, { continued: true })
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

  // Build line items with detailed readings
  const lineItemIds = [];
  for (const day of invoiceData.daily) {
    const id = await createLineItem(env, {
      date: day.date,
      energyConsumed: day.kWh.toFixed(2),
      unitPrice: invoiceData.unitPrice,
      amount: (day.kWh * parseFloat(invoiceData.unitPrice)).toFixed(2),
      initialReading: day.initialReading,
      finalReading: day.finalReading,
      maxAmp: day.maxAmp,
      avgAmp: day.avgAmp
    });
    lineItemIds.push({ sys: { type: "Link", linkType: "Entry", id } });
  }

  function setField(field, value) {
    if (allowedFields.includes(field)) {
      entry.fields[field] = { "en-US": value };
    } else {
      console.warn(`[WARN] Skipping unknown field "${field}"`);
    }
  }

  // Set all fields
  Object.entries(invoiceData).forEach(([key, value]) => {
    if (key === 'daily') return; // Skip daily array as it's handled separately
    if (key === 'environmentalImpactText') {
      setField(key, toRichText(value));
    } else {
      setField(key, value);
    }
  });
  
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
    const data = await service.getConsumptionData(startDate, endDate);

    for (const station of data) {
      console.log(`[INFO] Processing ${station.station}...`);
      
      const dailyConsumption = station.dailyData.map(day => ({
        date: day.start_time.split('T')[0],
        kWh: day.total_kwh,
        initialReading: day.initial_kwh,
        finalReading: day.final_kwh,
        maxAmp: day.max_amp || 0,
        avgAmp: day.avg_amp || 0
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