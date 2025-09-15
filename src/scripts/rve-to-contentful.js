// src/scripts/rve-to-contentful.js
import dotenv from "dotenv";
dotenv.config();

import { CloudOceanService } from "../services/CloudOceanService.js";
import contentful from "contentful-management";

// --- Contentful setup ---
const client = contentful.createClient({
  accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN,
});

async function getEnvironment() {
  const space = await client.getSpace(process.env.CONTENTFUL_SPACE_ID);
  const env = await space.getEnvironment(process.env.CONTENTFUL_ENVIRONMENT || "master");
  return env;
}

// --- Convert plain text to Contentful Rich Text ---
function toRichText(text) {
  return {
    nodeType: "document",
    data: {},
    content: [
      {
        nodeType: "paragraph",
        content: [{ nodeType: "text", value: text, marks: [], data: {} }],
        data: {},
      },
    ],
  };
}

// --- Create line item entries in Contentful ---
async function createLineItemEntries(env, lineItems) {
  const entries = [];
  for (const item of lineItems) {
    const entry = await env.createEntry("lineItem", {
      fields: {
        date: { "en-US": new Date(item.date).toISOString() },
        startTime: { "en-US": new Date(item.startTime).toISOString() },
        endTime: { "en-US": new Date(item.endTime).toISOString() },
        energyConsumed: { "en-US": item.energyConsumed },
        unitPrice: { "en-US": item.unitPrice },
        amount: { "en-US": item.amount },
      },
    });
    await entry.publish();
    entries.push(entry.sys.id);
  }
  return entries;
}

// --- Create or update invoice entry ---
async function createOrUpdateInvoice(invoiceData) {
  const env = await getEnvironment();

  let entry;
  try {
    entry = await env.getEntry(invoiceData.invoiceNumber);
    console.log(`[INFO] Updating invoice ${invoiceData.invoiceNumber}`);
  } catch {
    entry = await env.createEntryWithId("invoice", invoiceData.invoiceNumber, { fields: {} });
    console.log(`[INFO] Creating invoice ${invoiceData.invoiceNumber}`);
  }

  // Create line items in Contentful and get their IDs
  const lineItemIds = await createLineItemEntries(env, invoiceData.lineItems);

  // Map line items as links
  const lineItemLinks = lineItemIds.map(id => ({
    sys: { type: "Link", linkType: "Entry", id },
  }));

  // Set invoice fields
  entry.fields["syndicateName"] = { "en-US": "RVE Cloud Ocean" };
  entry.fields["slug"] = { "en-US": "/fac-2024-001" };
  entry.fields["address"] = { "en-US": "123 EV Way, Montreal, QC" };
  entry.fields["contact"] = { "en-US": "contact@rve.ca" };
  entry.fields["invoiceNumber"] = { "en-US": invoiceData.invoiceNumber };
  entry.fields["invoiceDate"] = { "en-US": new Date(invoiceData.invoiceDate).toISOString() };
  entry.fields["clientName"] = { "en-US": "John Doe" };
  entry.fields["clientEmail"] = { "en-US": "john.doe@example.com" };
  entry.fields["chargerSerialNumber"] = { "en-US": invoiceData.chargerSerialNumber };
  entry.fields["billingPeriodStart"] = { "en-US": new Date(invoiceData.billingPeriodStart).toISOString() };
  entry.fields["billingPeriodEnd"] = { "en-US": new Date(invoiceData.billingPeriodEnd).toISOString() };
  entry.fields["environmentalImpactText"] = { "en-US": toRichText(invoiceData.environmentalImpactText || "") };
  entry.fields["paymentDueDate"] = { "en-US": new Date(invoiceData.paymentDueDate).toISOString() };
  entry.fields["lineItems"] = { "en-US": lineItemLinks };

  const updatedEntry = await entry.update();
  await updatedEntry.publish();
  console.log(`[INFO] Invoice ${invoiceData.invoiceNumber} published successfully`);
}

// --- Main runner ---
(async () => {
  const service = new CloudOceanService();

  try {
    const startDate = "2024-10-16";
    const endDate = "2024-11-25";

    console.log("[INFO] Fetching consumption data from RVE API...");
    const consumptionData = await service.getConsumptionData(startDate, endDate);

    // Prepare line items safely
    const lineItems = consumptionData.flatMap(station =>
      station.readings
        .map(read => {
          if (!read.time_stamp) return null;
          const readDate = new Date(read.time_stamp);
          if (isNaN(readDate)) return null;

          const startTime = new Date(Date.UTC(readDate.getUTCFullYear(), readDate.getUTCMonth(), readDate.getUTCDate(), 0, 0, 0)).toISOString();
          const endTime = new Date(Date.UTC(readDate.getUTCFullYear(), readDate.getUTCMonth(), readDate.getUTCDate(), 23, 59, 59)).toISOString();

          return {
            date: readDate.toISOString().split("T")[0],
            startTime,
            endTime,
            energyConsumed: read.value.toFixed(2),
            unitPrice: (process.env.RATE_PER_KWH || 0.15).toFixed(2),
            amount: (read.value * (process.env.RATE_PER_KWH || 0.15)).toFixed(2),
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
      lineItems,
    };

    console.log("[INFO] Writing invoice to Contentful...");
    await createOrUpdateInvoice(invoiceData);

    console.log("[INFO] Done ✅");
  } catch (err) {
    console.error("❌ Error:", err);
  }
})();
