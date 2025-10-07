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
    const entry = await env.createEntry("lineItem", {
      fields: {
        date: { "en-US": itemData.date },
        energyConsumed: { "en-US": String(itemData.energyConsumed) },
        unitPrice: { "en-US": String(itemData.unitPrice) },
        amount: { "en-US": String(itemData.amount) },
        consumption: { "en-US": Number(itemData.kWh) },
        readingStart: { "en-US": Number(itemData.initialReading) },
        readingEnd: { "en-US": Number(itemData.finalReading) },
        maxAmperage: { "en-US": Number(itemData.maxAmp || 0) },
        avgAmperage: { "en-US": Number(itemData.avgAmp || 0) }
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
  // ...existing PDF generation code...
}

async function createOrUpdateInvoice(invoiceId, invoiceData) {
  const env = await getEnvironment();
  
  try {
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
      try {
        const id = await createLineItem(env, {
          date: day.date,
          kWh: day.kWh,
          energyConsumed: day.kWh.toFixed(2),
          unitPrice: invoiceData.unitPrice,
          amount: (day.kWh * parseFloat(invoiceData.unitPrice)).toFixed(2),
          initialReading: day.initialReading,
          finalReading: day.finalReading,
          maxAmp: day.maxAmp,
          avgAmp: day.avgAmp
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

    // Set basic fields
    const basicFields = {
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
      totalAmount: Number(invoiceData.totalConsumption * parseFloat(invoiceData.unitPrice))
    };

    // Set all fields
    Object.entries(basicFields).forEach(([key, value]) => {
      setField(key, value);
    });

    // Set rich text fields
    setField("environmentalImpact", toRichText(invoiceData.environmentalImpactText));
    
    // Set line items
    setField("lineItems", lineItemIds);

    const updatedEntry = await entry.update();
    await updatedEntry.publish();
    console.log(`[INFO] Invoice ${invoiceId} published successfully`);
    
    return updatedEntry.sys.id;
  } catch (error) {
    console.error(`[ERROR] Failed to create/update invoice ${invoiceId}:`, error.message);
    throw error;
  }
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