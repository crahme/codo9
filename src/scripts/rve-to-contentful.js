// src/scripts/rve-to-contentful.js
import dotenv from "dotenv";
dotenv.config();

import { CloudOceanService } from "../services/CloudOceanService.js";
import contentful from "contentful-management";
import path from "path";
import { fileURLToPath } from "url";

// --- Contentful setup ---
const client = contentful.createClient({
  accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN,
});

async function getEnvironment() {
  const space = await client.getSpace(process.env.CONTENTFUL_SPACE_ID);
  const env = await space.getEnvironment(process.env.CONTENTFUL_ENVIRONMENT || "master");
  return env;
}

// --- Function to create/update invoice entry ---
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

  // Set invoice fields
  entry.fields["syndicateName"] = { "en-US": "RVE CLOUD OCEAN" };
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
  entry.fields["environmentalImpactText"] = { "en-US": invoiceData.environmentalImpactText || "" };
  entry.fields["paymentDueDate"] = { "en-US": invoiceData.paymentDueDate };

  // Set line items (array of line item content type)
  entry.fields["lineItems"] = {
    "en-US": invoiceData.lineItems.map(item => ({
      fields: {
        date: { "en-US": item.date },
        startTime: { "en-US": item.startTime },
        endTime: { "en-US": item.endTime },
        energyConsumed: { "en-US": item.energyConsumed },
        unitPrice: { "en-US": item.unitPrice },
        amount: { "en-US": item.amount },
      }
    }))
  };

  const updatedEntry = await entry.update();
  await updatedEntry.publish();
  console.log(`[INFO] Invoice ${invoiceId} published successfully`);
}

// --- Main runner ---
(async () => {
  const service = new CloudOceanService();

  try {
    const startDate = "2024-10-16";
    const endDate = "2024-11-25";

    console.log("[INFO] Fetching consumption data from RVE API...");
    const consumptionData = await service.getConsumptionData(startDate, endDate);
    const totals = service.calculateTotals(consumptionData);

    // Prepare invoice data
    const invoiceData = {
      invoiceNumber: "fAC-2024-001", // fixed invoice number
      invoiceDate: new Date().toISOString().split("T")[0],
      chargerSerialNumber: "CHG-001", // can map dynamically if needed
      billingPeriodStart: startDate,
      billingPeriodEnd: endDate,
      environmentalImpactText: "CO2 emissions reduced thanks to EV usage.",
      paymentDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // +30 days
      lineItems: consumptionData.map(station => ({
        date: new Date().toISOString().split("T")[0],
        startTime: new Date(`${startDate}T00:00:00Z`).toISOString(),
        endTime: new Date(`${endDate}T23:59:59Z`).toISOString(),
        energyConsumed: station.consumption.toFixed(2),
        unitPrice: (process.env.RATE_PER_KWH || 0.15).toFixed(2),
        amount: (station.consumption * (process.env.RATE_PER_KWH || 0.15)).toFixed(2),
      }))
    };

    console.log("[INFO] Writing invoice to Contentful...");
    await createOrUpdateInvoice(invoiceData.invoiceNumber, invoiceData);

    console.log("[INFO] Done ✅");

  } catch (err) {
    console.error("❌ Error:", err.message);
  }
})();
