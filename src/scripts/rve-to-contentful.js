// src/scripts/rve-to-contentful.js
import dotenv from "dotenv";
dotenv.config();

import { CloudOceanService } from "../services/CloudOceanService.js";
import contentful from "contentful-management";

// --- Contentful client setup ---
const client = contentful.createClient({
  accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN,
});

async function getEnvironment() {
  const space = await client.getSpace(process.env.CONTENTFUL_SPACE_ID);
  return space.getEnvironment(process.env.CONTENTFUL_ENVIRONMENT || "master");
}

// --- Convert plain text to Rich Text for Contentful ---
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

// --- Create line item entries ---
async function createLineItemEntries(env, lineItems) {
  const entryPromises = lineItems.map(async (item) => {
    const entry = await env.createEntry("lineItem", {
      fields: {
        date: { "en-US": item.date },
        startTime: { "en-US": item.startTime },
        endTime: { "en-US": item.endTime },
        energyConsumed: { "en-US": item.energyConsumed },
        unitPrice: { "en-US": item.unitPrice },
        amount: { "en-US": item.amount },
      },
    });
    await entry.publish();
    return entry.sys.id;
  });
  return Promise.all(entryPromises);
}

// --- Create or update the invoice ---
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
  entry.fields["syndicateName"] = { "en-US": "RVE Cloud Ocean" };
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
  entry.fields["environmentalImpactText"] = { "en-US": toRichText(invoiceData.environmentalImpactText || "") };
  entry.fields["paymentDueDate"] = { "en-US": invoiceData.paymentDueDate };
  entry.fields["lateFeeRate"] = { "en-US": 0 };

  // Create line item entries and link them
  const lineItemIds = await createLineItemEntries(env, invoiceData.lineItems);
  entry.fields["lineItems"] = { "en-US": lineItemIds.map(id => ({ sys: { type: "Link", linkType: "Entry", id } })) };

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

    // Prepare line items
    const lineItems = consumptionData.flatMap(station =>
      station.readings.map(read => {
        const readingDate = new Date(read.date); // actual reading date
        const startTime = new Date(Date.UTC(readingDate.getUTCFullYear(), readingDate.getUTCMonth(), readingDate.getUTCDate(), 0, 0, 0));
        const endTime = new Date(Date.UTC(readingDate.getUTCFullYear(), readingDate.getUTCMonth(), readingDate.getUTCDate(), 23, 59, 59));

        const energyConsumed = read.value;
        const unitPrice = parseFloat(process.env.RATE_PER_KWH || 0.15);
        const amount = parseFloat((energyConsumed * unitPrice).toFixed(2));

        return {
          date: readingDate.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          energyConsumed: energyConsumed.toFixed(2),
          unitPrice: unitPrice.toFixed(2),
          amount: amount.toFixed(2),
        };
      })
    );

    // Prepare invoice data
    const invoiceData = {
      invoiceNumber: "fac-2024-001",
      invoiceDate: new Date().toISOString().split("T")[0],
      chargerSerialNumber: "CHG-001",
      billingPeriodStart: startDate,
      billingPeriodEnd: endDate,
      environmentalImpactText: "CO2 emissions reduced thanks to EV usage.",
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
