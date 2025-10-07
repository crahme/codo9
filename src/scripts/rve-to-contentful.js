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

// --- Convert string to Rich Text ---
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

// --- Create a line item entry and publish it ---
async function createLineItem(env, itemData) {
  try {
    const entry = await env.createEntry("lineItem", {
      fields: {
        date: { "en-US": itemData.date },
        initialReading: { "en-US": Number(itemData.initialReading.toFixed(2)) },
        finalReading: { "en-US": Number(itemData.finalReading.toFixed(2)) },
        energyConsumed: { "en-US": Number(itemData.consumption.toFixed(2)) },
        unitPrice: { "en-US": Number(itemData.unitPrice) },
        amount: { "en-US": Number((itemData.consumption * parseFloat(itemData.unitPrice)).toFixed(2)) }
      },
    });
    await entry.publish();
    return entry.sys.id;
  } catch (error) {
    console.error(`[ERROR] Failed to create line item for ${itemData.date}:`, error);
    throw error;
  }
}

// --- Generate PDF invoice ---
function generateInvoicePDF(invoiceData) {
  // ... existing PDF generation code ...
}

// --- Create or update invoice entry safely ---
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

  // Get daily readings with consumption
  const service = new CloudOceanService();
  const dailyReadings = await service.getDailyReadings(
    invoiceData.stationUuid,
    invoiceData.billingPeriodStart,
    invoiceData.billingPeriodEnd
  );

  // Calculate total consumption
  const totalConsumption = dailyReadings.reduce((sum, day) => sum + day.consumption, 0);

  // Create line items
  const lineItemIds = [];
  for (const reading of dailyReadings) {
    const id = await createLineItem(env, {
      ...reading,
      unitPrice: invoiceData.unitPrice
    });
    lineItemIds.push({ sys: { type: "Link", linkType: "Entry", id } });
  }

  // Set all fields
  entry.fields = {
    syndicateName: { "en-US": invoiceData.syndicateName },
    address: { "en-US": invoiceData.address },
    contact: { "en-US": invoiceData.contact },
    clientName: { "en-US": invoiceData.clientName },
    clientEmail: { "en-US": invoiceData.clientEmail },
    chargerSerialNumber: { "en-US": invoiceData.chargerSerialNumber },
    invoiceNumber: { "en-US": invoiceData.invoiceNumber },
    invoiceDate: { "en-US": invoiceData.invoiceDate },
    billingPeriodStart: { "en-US": invoiceData.billingPeriodStart },
    billingPeriodEnd: { "en-US": invoiceData.billingPeriodEnd },
    paymentDueDate: { "en-US": invoiceData.paymentDueDate },
    stationName: { "en-US": invoiceData.stationName },
    stationLocation: { "en-US": invoiceData.stationLocation },
    totalConsumption: { "en-US": Number(totalConsumption.toFixed(2)) },
    totalAmount: { "en-US": Number((totalConsumption * parseFloat(invoiceData.unitPrice)).toFixed(2)) },
    environmentalImpact: { "en-US": toRichText(invoiceData.environmentalImpactText) },
    lineItems: { "en-US": lineItemIds }
  };

  const updatedEntry = await entry.update();
  await updatedEntry.publish();
  console.log(`[INFO] Invoice ${invoiceId} published with total consumption: ${totalConsumption.toFixed(2)} kWh`);
}

// --- Main runner ---
(async () => {
  const service = new CloudOceanService();

  try {
    const startDate = "2024-10-16";
    const endDate = "2024-11-25";

    console.log("[INFO] Fetching station consumption data...");
    const { devices } = await service.getConsumptionData(startDate, endDate);

    for (const station of devices) {
      const invoiceData = {
        invoiceNumber: `fac-${station.uuid}-${Date.now()}`,
        invoiceDate: new Date().toISOString().split("T")[0],
        stationUuid: station.uuid,
        stationName: station.name,
        stationLocation: station.location,
        chargerSerialNumber: "CHG-001",
        billingPeriodStart: startDate,
        billingPeriodEnd: endDate,
        environmentalImpactText: "CO2 emissions reduced thanks to EV usage.",
        paymentDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        clientName: "John Doe",
        clientEmail: "john.doe@example.com",
        syndicateName: "RVE CLOUD OCEAN",
        address: "123 EV Way, Montreal, QC",
        contact: "contact@rve.ca",
        unitPrice: (process.env.RATE_PER_KWH || 0.15).toFixed(2)
      };

      await createOrUpdateInvoice(invoiceData.invoiceNumber, invoiceData);
    }

    console.log("[INFO] Done ✅");
  } catch (err) {
    console.error("❌ Error:", err);
  }
})();