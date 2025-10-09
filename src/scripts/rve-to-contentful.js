// src/scripts/rve-to-contentful.js
import dotenv from "dotenv";
dotenv.config();

import { CloudOceanService } from "../services/CloudOceanService.js";
import contentful from "contentful-management";
import { InvoiceGenerator } from "../../services/invoicegenerator.mjs";

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
  const entry = await env.createEntry("lineItem", {
    fields: {
      date: { "en-US": itemData.date },
      energyConsumed: { "en-US": itemData.energyConsumed },
      unitPrice: { "en-US": itemData.unitPrice },
      amount: { "en-US": itemData.amount },
    },
  });
  await entry.publish();
  return entry.sys.id;
}


// --- Create or update invoice entry safely ---
async function createOrUpdateInvoice(invoiceId, invoiceData) {
  const env = await getEnvironment();

  // Get allowed fields from Contentful model
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

  // Build daily line items
  const lineItemIds = [];
  for (const d of invoiceData.daily) {
    const id = await createLineItem(env, {
      date: d.date,
      energyConsumed: d.kWh.toFixed(2),
      unitPrice: invoiceData.unitPrice,
      amount: (d.kWh * parseFloat(invoiceData.unitPrice)).toFixed(2),
    });
    lineItemIds.push({ sys: { type: "Link", linkType: "Entry", id } });
  }

  // Safe field assignment
  function setField(field, value) {
    if (allowedFields.includes(field)) {
      entry.fields[field] = { "en-US": value };
    } else {
      console.warn(`[WARN] Skipping unknown field "${field}"`);
    }
  }

  setField("syndicateName", "RVE CLOUD OCEAN");
  setField("slug", `/${invoiceData.invoiceNumber}`);
  setField("address", "123 EV Way, Montreal, QC");
  setField("contact", "contact@rve.ca");
  setField("invoiceNumber", invoiceData.invoiceNumber);
  setField("invoiceDate", invoiceData.invoiceDate);
  setField("clientName", invoiceData.clientName);
  setField("clientEmail", invoiceData.clientEmail);
  setField("chargerSerialNumber", invoiceData.chargerSerialNumber);
  setField("stationName", invoiceData.stationName);
  setField("stationLocation", invoiceData.stationLocation);
  setField("billingPeriodStart", invoiceData.billingPeriodStart);
  setField("billingPeriodEnd", invoiceData.billingPeriodEnd);
  setField("environmentalImpactText", toRichText(invoiceData.environmentalImpactText));
  setField("paymentDueDate", invoiceData.paymentDueDate);
  setField("lineItems", lineItemIds);

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

    console.log("[INFO] Fetching station consumption data...");
    const { devices } = await service.getConsumptionData(startDate, endDate);
    const generator = new InvoiceGenerator("./invoices");

    if (!devices || devices.length === 0) {
      throw new Error("No station data returned from CloudOceanService.");
    }

    for (const [index, station] of devices.entries()) {
      const now = new Date(endDate);
      const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
      const invNum = `INV-${yearMonth}-${String(index + 1).padStart(3, "0")}`;
      const rateNum = parseFloat(process.env.RATE_PER_KWH || 0.15);
      const daily = station.dailyData.map(d => ({
        date: d.date,
        kWh: d.reads_kwh,
      }));
      const totalKwh = daily.reduce((s, d) => s + d.kWh, 0);
      const totalAmount = totalKwh * rateNum;

      const invoiceData = {
        invoiceNumber: invNum,
        invoiceDate: new Date().toISOString().split("T")[0],
        chargerSerialNumber: "CHG-001",
        billingPeriodStart: startDate,
        billingPeriodEnd: endDate,
        environmentalImpactText: "CO2 emissions reduced thanks to EV usage.",
        paymentDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        clientName: "John Doe",
        clientEmail: "john.doe@example.com",
        stationName: station.name,
        stationLocation: station.location,
        unitPrice: rateNum.toFixed(2),
        daily,
      };

      console.log(`[INFO] Writing invoice for ${station.name} to Contentful...`);
      await createOrUpdateInvoice(invoiceData.invoiceNumber, invoiceData);

      console.log(`[INFO] Generating PDF for ${station.name}...`);
      const genData = {
        invoice_number: invNum,
        syndicate_name: "RVE Cloud Ocean",
        company_address: "123 EV Way, Montreal, QC",
        company_phone: "+1 (555) 123-4567",
        company_email: "contact@rve.ca",
        company_website: "https://rve.ca",
        billing_period_start: startDate,
        billing_period_end: endDate,
        total_kwh: totalKwh,
        total_amount: totalAmount,
        rate: rateNum,
        due_date: invoiceData.paymentDueDate,
        charging_sessions: daily.map(d => ({
          date: d.date,
          start_time: "00:00",
          end_time: "23:59",
          duration: "24:00",
          kwh: d.kWh,
          rate: rateNum,
          amount: d.kWh * rateNum
        }))
      };
      const pdfPath = await generator.generateInvoice(genData);
      console.log(`[INFO] PDF generated: ${pdfPath}`);
    }

    console.log("[INFO] Done ✅");
  } catch (err) {
    console.error("❌ Error:", err);
  }
})();
