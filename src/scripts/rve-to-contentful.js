import "dotenv/config";
import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import contentful from "contentful-management";
import fetch from "node-fetch";

// --- CONFIG ---
const client = contentful.createClient({
  accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN,
});

const SPACE_ID = process.env.CONTENTFUL_SPACE_ID;
const ENV_ID = process.env.CONTENTFUL_ENVIRONMENT_ID || "master";

// --- FETCH STATION DATA MOCK (replace with your API logic) ---
async function fetchStationData() {
  console.log("[INFO] Fetching station consumption data...");
  // Example mock data
  return [
    {
      stationId: "EVS01",
      stationName: "EV Charger Station 01",
      stationLocation: "Building A - Level 1",
      totalConsumption: 341.2,
      unitPrice: 0.35,
      totalCost: 119.42,
      billingPeriodStart: "2025-09-01",
      billingPeriodEnd: "2025-09-30",
      paymentDueDate: "2025-10-15",
      invoiceNumber: "FAC-001",
      invoiceDate: "2025-10-01",
    },
    {
      stationId: "EVS02",
      stationName: "EV Charger Station 02",
      stationLocation: "Building A - Level 2",
      totalConsumption: 415.5,
      unitPrice: 0.35,
      totalCost: 145.43,
      billingPeriodStart: "2025-09-01",
      billingPeriodEnd: "2025-09-30",
      paymentDueDate: "2025-10-15",
      invoiceNumber: "FAC-002",
      invoiceDate: "2025-10-01",
    },
  ];
}

// --- PDF GENERATION ---
async function generateInvoicePDF(invoiceData) {
  const fileName = `invoice_${invoiceData.stationId}.pdf`;
  const pdfPath = path.join("invoices", fileName);
  fs.mkdirSync("invoices", { recursive: true });

  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(fs.createWriteStream(pdfPath));

  // HEADER
  doc.font("Helvetica-Bold").fontSize(20).text("EV Station Invoice Statement", {
    align: "center",
  });
  doc.moveDown(2);

  // EV Station Info Section
  doc.font("Helvetica-Bold").fontSize(14).text("Station Information", { align: "left" });
  doc.moveDown(0.5);
  doc.font("Helvetica").fontSize(12);
  doc.text(`Station Name: ${invoiceData.stationName}`);
  doc.text(`Location: ${invoiceData.stationLocation}`);
  doc.text(`Invoice Date: ${invoiceData.invoiceDate}`);
  doc.moveDown(1.5);

  // Invoice Details Section
  doc.font("Helvetica-Bold").fontSize(14).text("Invoice Details", { align: "left" });
  doc.moveDown(0.5);
  doc.font("Helvetica").fontSize(12);
  doc.text(`Invoice Number: ${invoiceData.invoiceNumber}`);
  doc.text(`Billing Period: ${invoiceData.billingPeriodStart} to ${invoiceData.billingPeriodEnd}`);
  doc.text(`Due Date: ${invoiceData.paymentDueDate}`);
  doc.moveDown(1.5);

  // Summary Section
  doc.font("Helvetica-Bold").fontSize(14).text("Summary", { align: "left" });
  doc.moveDown(0.5);
  doc.font("Helvetica").fontSize(12);

  const labelX = 60;
  const valueX = 400;
  const lineHeight = 20;
  let y = doc.y;

  doc.text("Total amount:", labelX, y);
  doc.text(`$${invoiceData.totalCost.toFixed(2)}`, valueX, y, { align: "right" });
  y += lineHeight;

  doc.text("Total kWh consumed:", labelX, y);
  doc.text(`${invoiceData.totalConsumption.toFixed(2)} kWh`, valueX, y, { align: "right" });
  y += lineHeight;

  doc.text("Rate per kWh:", labelX, y);
  doc.text(`$${invoiceData.unitPrice}`, valueX, y, { align: "right" });
  y += lineHeight * 2;

  // Payment Instructions
  doc.moveDown(2);
  doc.font("Helvetica-Oblique").fontSize(14).text("Payment Instructions", { align: "left" });
  doc.moveDown(0.5);
  doc.font("Helvetica").fontSize(12).text(
    "Please remit payment to the account details provided in your service agreement. Late payments may incur additional fees."
  );

  // FOOTER
  doc.moveDown(3);
  doc.fontSize(10).text("Thank you for using RVE Cloud EV Charging Services.", {
    align: "center",
  });

  doc.end();
  return pdfPath;
}

// --- UPLOAD TO CONTENTFUL ---
async function uploadInvoiceToContentful(invoiceData, pdfPath) {
  console.log(`[INFO] Writing invoice for ${invoiceData.stationName} to Contentful...`);
  const space = await client.getSpace(SPACE_ID);
  const env = await space.getEnvironment(ENV_ID);

  const pdfFile = await env.createUpload({
    file: fs.createReadStream(pdfPath),
  });

  const asset = await env.createAsset({
    fields: {
      title: { "en-US": `Invoice ${invoiceData.invoiceNumber}` },
      file: {
        "en-US": {
          fileName: path.basename(pdfPath),
          contentType: "application/pdf",
          uploadFrom: {
            sys: { type: "Link", linkType: "Upload", id: pdfFile.sys.id },
          },
        },
      },
    },
  });

  await asset.processForAllLocales();
  await asset.publish();

  console.log(`[INFO] Uploaded invoice PDF as asset: ${asset.sys.id}`);

  // Create or update the entry
  const entries = await env.getEntries({
    content_type: "invoice",
    "fields.invoiceNumber": invoiceData.invoiceNumber,
  });

  let entry;
  if (entries.items.length > 0) {
    entry = entries.items[0];
    console.log(`[INFO] Updating invoice ${entry.sys.id}`);
    entry.fields.pdfFile = { "en-US": { sys: { type: "Link", linkType: "Asset", id: asset.sys.id } } };
  } else {
    console.log(`[INFO] Creating new invoice entry for ${invoiceData.stationName}`);
    entry = await env.createEntry("invoice", {
      fields: {
        invoiceNumber: { "en-US": invoiceData.invoiceNumber },
        stationId: { "en-US": invoiceData.stationId },
        invoiceDate: { "en-US": invoiceData.invoiceDate },
        totalCost: { "en-US": invoiceData.totalCost },
        totalConsumption: { "en-US": invoiceData.totalConsumption },
        unitPrice: { "en-US": invoiceData.unitPrice },
        pdfFile: {
          "en-US": { sys: { type: "Link", linkType: "Asset", id: asset.sys.id } },
        },
      },
    });
  }

  await entry.update();
  await entry.publish();

  console.log(`[INFO] Invoice ${entry.sys.id} published successfully`);
}

// --- MAIN ---
(async () => {
  try {
    const stations = await fetchStationData();
    console.log(`[INFO] Processing ${stations.length} station(s)...`);

    for (const station of stations) {
      const pdfPath = await generateInvoicePDF(station);
      await uploadInvoiceToContentful(station, pdfPath);
    }

    console.log("[INFO] ✅ All invoices processed successfully.");
  } catch (err) {
    console.error("❌ Error:", err);
  }
})();
