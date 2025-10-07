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

// ... rest of existing functions unchanged ...

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

  // Set all required fields
  entry.fields = {
    // Required fields
    syndicateName: { "en-US": invoiceData.syndicateName },
    address: { "en-US": invoiceData.address },
    contact: { "en-US": invoiceData.contact },
    clientName: { "en-US": invoiceData.clientName },
    clientEmail: { "en-US": invoiceData.clientEmail },
    chargerSerialNumber: { "en-US": invoiceData.chargerSerialNumber },
    
    // Invoice details
    invoiceNumber: { "en-US": invoiceData.invoiceNumber },
    invoiceDate: { "en-US": invoiceData.invoiceDate },
    billingPeriodStart: { "en-US": invoiceData.billingPeriodStart },
    billingPeriodEnd: { "en-US": invoiceData.billingPeriodEnd },
    paymentDueDate: { "en-US": invoiceData.paymentDueDate },
    
    // Station details
    stationId: { "en-US": invoiceData.chargerSerialNumber },
    stationName: { "en-US": invoiceData.stationName },
    stationLocation: { "en-US": invoiceData.stationLocation },
    
    // Financial details
    ratePerKwh: { "en-US": Number(invoiceData.unitPrice) },
    totalConsumption: { "en-US": Number(invoiceData.totalConsumption) },
    totalAmount: { "en-US": Number(invoiceData.totalConsumption * parseFloat(invoiceData.unitPrice)) },
    
    // Additional info
    environmentalImpact: { "en-US": toRichText(invoiceData.environmentalImpactText) },
    lineItems: { "en-US": lineItemIds }
  };

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
        // Company details
        syndicateName: "EV Charging Solutions",
        address: "123 Main Street, City, Country",
        contact: "+1 234 567 8900",
        
        // Client details
        clientName: "John Doe",
        clientEmail: "john.doe@example.com",
        
        // Invoice details
        invoiceNumber: `fac-${station.station.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`,
        invoiceDate: new Date().toISOString().split("T")[0],
        billingPeriodStart: startDate,
        billingPeriodEnd: endDate,
        paymentDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        
        // Station details
        chargerSerialNumber: station.station,
        stationName: station.station,
        stationLocation: station.location,
        
        // Financial details
        unitPrice: (process.env.RATE_PER_KWH || 0.15).toFixed(2),
        totalConsumption: station.consumption,
        
        // Consumption data
        daily: dailyConsumption,
        
        // Additional info
        environmentalImpactText: `This station consumed ${station.consumption.toFixed(2)} kWh during the billing period.`
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