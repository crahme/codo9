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
  const entry = await env.createEntry("lineItem", {
    fields: {
      date: { "en-US": itemData.date },
      startTime: { "en-US": itemData.startTime },
      endTime: { "en-US": itemData.endTime },
      energyConsumed: { "en-US": itemData.energyConsumed },
      unitPrice: { "en-US": itemData.unitPrice },
      amount: { "en-US": itemData.amount },
    },
  });
  await entry.publish();
  return entry.sys.id;
}

// --- Create or update invoice entry ---
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

  // --- Deduplicate line items ---
  const uniqueStations = [];
  const seen = new Set();
  for (const station of invoiceData.lineItems) {
    const key = `${station.startTime}_${station.endTime}_${station.energyConsumed}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueStations.push(station);
    }
  }

  // --- Create/publish line items ---
  const lineItemIds = [];
  for (const item of uniqueStations) {
    const id = await createLineItem(env, item);
    lineItemIds.push({ sys: { type: "Link", linkType: "Entry", id } });
  }

  // --- Set invoice fields ---
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
  entry.fields["environmentalImpactText"] = { "en-US": toRichText(invoiceData.environmentalImpactText) };
  entry.fields["paymentDueDate"] = { "en-US": invoiceData.paymentDueDate };

  // --- Link unique line items ---
  entry.fields["lineItems"] = { "en-US": lineItemIds };

  // --- Total calculation ---
  const totalKwh = uniqueStations.reduce((sum, item) => sum + parseFloat(item.energyConsumed), 0).toFixed(2);
  const totalAmount = uniqueStations.reduce((sum, item) => sum + parseFloat(item.amount), 0).toFixed(2);

  entry.fields["totalKwh"] = { "en-US": totalKwh };
  entry.fields["total"] = { "en-US": totalAmount };

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

    // --- Prepare line items ---
    const lineItems = consumptionData.map(station => {
      const energy = station.consumption;
      const unitPrice = parseFloat(process.env.RATE_PER_KWH || 0.15);
      const amount = energy * unitPrice;
      return {
        date: new Date().toISOString().split("T")[0],
        startTime: new Date(`${startDate}T00:00:00Z`).toISOString(),
        endTime: new Date(`${endDate}T23:59:59Z`).toISOString(),
        energyConsumed: energy.toFixed(2),
        unitPrice: unitPrice.toFixed(2),
        amount: amount.toFixed(2),
      };
    });

    // --- Prepare invoice data ---
    const invoiceData = {
      invoiceNumber: "fac-2024-001",
      invoiceDate: new Date().toISOString().split("T")[0],
      chargerSerialNumber: "CHG-001",
      billingPeriodStart: startDate,
      billingPeriodEnd: endDate,
      //environmentalImpactText: "CO2 emissions reduced thanks to EV usage.",
      paymentDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      lineItems,
    };

    console.log("[INFO] Writing invoice to Contentful...");
    await createOrUpdateInvoice(invoiceData.invoiceNumber, invoiceData);

    console.log("[INFO] Done ✅");

  } catch (err) {
    console.error("❌ Error:", err);
  }
})();
