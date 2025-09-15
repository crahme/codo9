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

// --- Helper to convert string to Contentful RichText ---
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
            data: {},
          },
        ],
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
        energyConsumed: { "en-US": String(item.energyConsumed) },
        unitPrice: { "en-US": String(item.unitPrice) },
        amount: { "en-US": String(item.amount) },
      },
    });

    await entry.publish();
    entries.push({ sys: { type: "Link", linkType: "Entry", id: entry.sys.id } });
  }

  return entries;
}

// --- Create or update invoice ---
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

  // Create line item entries
  const lineItemLinks = await createLineItemEntries(env, invoiceData.lineItems);

  // Set invoice fields
  entry.fields["syndicateName"] = { "en-US": "RVE Cloud Ocean" };
  entry.fields["slug"] = { "en-US": `/fac-2024-001` };
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

    // Flatten readings into line items
    const lineItems = consumptionData.flatMap(station =>
      station.readings
        .map(read => {
          if (!read.time_stamp) return null;

          const readDate = new Date(read.time_stamp);
          if (isNaN(readDate)) return null;

          const startTime = new Date(Date.UTC(readDate.getUTCFullYear(), readDate.getUTCMonth(), readDate.getUTCDate(), 0, 0, 0));
          const endTime = new Date(Date.UTC(readDate.getUTCFullYear(), readDate.getUTCMonth(), readDate.getUTCDate(), 23, 59, 59));

          return {
            date: readDate,
            startTime,
            endTime,
            energyConsumed: read.value.toFixed(2),
            unitPrice: (process.env.RATE_PER_KWH || 0.15).toFixed(2),
            amount: (read.value * (process.env.RATE_PER_KWH || 0.15)).toFixed(2),
          };
        })
        .filter(Boolean)
    );

    const invoiceData = {
      invoiceNumber: "fac-2024-001",
      invoiceDate: new Date().toISOString(),
      chargerSerialNumber: "CHG-001",
      billingPeriodStart: startDate,
      billingPeriodEnd: endDate,
      environmentalImpactText: "CO2 emissions reduced thanks to EV usage.",
      paymentDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // +30 days
      lineItems,
    };

    console.log("[INFO] Writing invoice to Contentful...");
    await createOrUpdateInvoice("fac-2024-001", invoiceData);

    console.log("[INFO] Done ✅");
  } catch (err) {
    console.error("❌ Error:", err);
  }
})();
