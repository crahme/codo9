// src/scripts/rve-to-contentful.js
import dotenv from "dotenv";
dotenv.config();

import { CloudOceanService } from "../services/CloudOceanService.js";
import contentful from "contentful-management";
import fs from "fs";
import PDFDocument from "pdfkit";

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

// --- Generate PDF invoice ---
function generateInvoicePDF(invoiceData) {
  const outputDir = "./invoices";
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  const filePath = `${outputDir}/${invoiceData.invoiceNumber}.pdf`;
  const doc = new PDFDocument({ margin: 50 });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  // --- Header
  doc.fontSize(20).text("EV Station Invoice Statement", { align: "Left" });
  doc.moveDown();
  doc.fontSize(12).text(`Address: ${invoiceData.address}`);
  doc.text(`Phone: +1 (555) 123-4567`);
  doc.text(`Email: ${invoiceData.contact}}`);
  doc.text(`Website: https://rve.ca`);
  doc.moveDown();

  // --- Station Info
  doc.fontSize(20).text("Invoice Details", { align: "left" });
  doc.fontSize(12).text("Invoice: " + invoiceData.invoiceNumber);
  doc.text("Date: " + invoiceData.invoiceDate);
  doc.text("Billing Period: " + invoiceData.billingPeriodStart + " to " + invoiceData.billingPeriodEnd);
  doc.text("Due Date: " + invoiceData.paymentDueDate);
  doc.moveDown();

  // --- Bordered and aligned table
  doc.fontSize(20).text("Electric Vehicle Charging details", {align:"left"}); 
  doc.moveDown();
  const left = doc.page.margins.left;
  let y = doc.y;
  const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colWidths = [contentWidth * 0.25, contentWidth * 0.25, contentWidth * 0.25, contentWidth * 0.25];
  const rowHeight = 24;

  function drawRow(cells, isHeader = false) {
    let x = left;
    doc.font(isHeader ? "Helvetica-Bold" : "Helvetica").fontSize(12);
    for (let i = 0; i < cells.length; i++) {
      // Cell border
      doc.rect(x, y, colWidths[i], rowHeight).stroke();
      // Cell text
      const align = i === 0 ? "left" : "right";
      doc.text(String(cells[i]), x + 6, y + 6, {
        width: colWidths[i] - 12,
        align,
      });
      x += colWidths[i];
    }
    y += rowHeight;
  }

  // Header row
  drawRow(["Date", "Start Time","End time","Duratiom","Energy (kWh)", "Unit Price", "Amount"], true);

  // Data rows
  let totalCost = 0;
  let totalConsumption = 0;
  const StartTime = setHours(0,0,0,0);
  const EndTime = setHours(23,59,59,999);
  const Duration = EndTime - StartTime;
  const unitPriceNum = parseFloat(invoiceData.unitPrice);
  invoiceData.daily.forEach(item => {
    const amount = item.kWh * unitPriceNum;
    totalCost += amount;
    totalConsumption += item.kWh;

    // Page break with header re-draw
    if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      y = doc.page.margins.top;
      drawRow(["Date","Start Time","End Time","Duration","Energy (kWh)", "Unit Price", "Amount"], true);
    }

    drawRow([
      item.date,
      item.StartTime,
      item.EndTime,
      item.Duration,
      item.kWh.toFixed(2),
      `${unitPriceNum.toFixed(2)}`,
      `${amount.toFixed(2)}`,
    ]);
  });
  doc.moveDown();

  // --- Totals summary lines
  doc.fontSize(20).text("Summary", {align:'left'});
  doc.moveDown();

  doc.fontSize(12);
  doc.text(`Total amount:     $${totalCost.toFixed(2)}`, left, y, { width: contentWidth, align: "left" });
  y += 18;
  doc.text(`Total kwh consumed: ${totalConsumption.toFixed(2)} kWh`, left, y, { width: contentWidth, align: "left" });
  doc.text(`Rate per kwh:   $${invoiceData.untiPrice}`);
  doc.moveDown();
  // --- Environmental Impact
  y += 24;
  doc.fontSize(20).text("Payment Instructions",{align:"left"});
  doc.fontSize(12);
  doc.text(`Please make the payment before ${invoiceData.paymentDueDate}.  For questions regarding this invoice, please contact us at
smp@microbms.com or call our customer service at +1 (555) 123-4567.`)
  return filePath;
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

    if (!devices || devices.length === 0) {
      throw new Error("No station data returned from CloudOceanService.");
    }

    for (const station of devices) {
      const invoiceData = {
        invoiceNumber: `fac-${station.uuid}-${Date.now()}`,
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
        unitPrice: (process.env.RATE_PER_KWH || 0.15).toFixed(2),
        daily: station.dailyData.map(d => ({
          date: d.date,
          kWh: d.reads_kwh,
        })),
      };

      console.log(`[INFO] Writing invoice for ${station.name} to Contentful...`);
      await createOrUpdateInvoice(invoiceData.invoiceNumber, invoiceData);

      console.log(`[INFO] Generating PDF for ${station.name}...`);
      const pdfPath = generateInvoicePDF(invoiceData);
      console.log(`[INFO] PDF generated: ${pdfPath}`);
    }

    console.log("[INFO] Done ✅");
  } catch (err) {
    console.error("❌ Error:", err);
  }
})();
