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

  // --- Font Fallback ---
  try {
    const fontPath = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
    if (fs.existsSync(fontPath)) {
      doc.registerFont("BodyFont", fontPath);
    } else {
      doc.font("Helvetica");
    }
  } catch {
    doc.font("Helvetica");
  }

  doc.pipe(fs.createWriteStream(pdfPath));

  // --- HEADER ---
  doc
    .font("Helvetica-Bold")
    .fontSize(22)
    .fillColor("#1a1a1a")
    .text("EV Station Invoice Statement", { align: "center" });

  doc.moveDown(1);
  doc
    .moveTo(50, doc.y)
    .lineTo(550, doc.y)
    .strokeColor("#999")
    .lineWidth(1)
    .stroke();

  doc.moveDown(1.5);

  // --- STATION INFO ---
  doc.font("Helvetica-Bold").fontSize(14).fillColor("#000").text("Station Information");
  doc.moveDown(0.5);
  doc.font("Helvetica").fontSize(12);
  doc.text(`Station Name: ${invoiceData.stationName}`);
  doc.text(`Location: ${invoiceData.stationLocation}`);
  doc.text(`Invoice Date: ${invoiceData.invoiceDate}`);
  doc.moveDown(1);

  // --- INVOICE DETAILS (Improved layout) ---
  doc
    .font("Helvetica-Bold")
    .fontSize(14)
    .fillColor("#000")
    .text("Invoice Details", { align: "left" });

  doc.moveDown(0.5);

  const startY = doc.y;
  const labelX = 60;
  const valueX = 300;
  const lineHeight = 18;

  const rows = [
    ["Invoice Number", invoiceData.invoiceNumber],
    ["Billing Period", `${invoiceData.billingPeriodStart} → ${invoiceData.billingPeriodEnd}`],
    ["Payment Due Date", invoiceData.paymentDueDate],
  ];

  doc.font("Helvetica").fontSize(12).fillColor("#000");
  rows.forEach(([label, value], i) => {
    const y = startY + i * lineHeight;
    doc.text(label + ":", labelX, y);
    doc.text(value, valueX, y);
  });

  doc.moveDown(2);

  // --- SUMMARY BOX ---
  const boxTop = doc.y;
  const boxHeight = 100;
  const boxLeft = 50;
  const boxWidth = 500;

  doc
    .roundedRect(boxLeft, boxTop, boxWidth, boxHeight, 8)
    .strokeColor("#444")
    .lineWidth(1)
    .stroke();

  doc
    .font("Helvetica-Bold")
    .fontSize(14)
    .fillColor("#000")
    .text("Summary", boxLeft + 10, boxTop + 10);

  const summaryData = [
    ["Total Amount", `$${invoiceData.totalCost.toFixed(2)}`],
    ["Total kWh Consumed", `${invoiceData.totalConsumption.toFixed(2)} kWh`],
    ["Rate per kWh", `$${invoiceData.unitPrice.toFixed(2)}`],
  ];

  doc.font("Helvetica").fontSize(12);
  const summaryStartY = boxTop + 35;
  summaryData.forEach(([label, value], i) => {
    const y = summaryStartY + i * 20;
    doc.text(label + ":", boxLeft + 20, y);
    doc.text(value, boxLeft + 320, y, { align: "right" });
  });

  doc.moveDown(6);

  // --- PAYMENT INSTRUCTIONS ---
  doc.font("Helvetica-Oblique").fontSize(13).fillColor("#000").text("Payment Instructions");
  doc.moveDown(0.5);
  doc
    .font("Helvetica")
    .fontSize(12)
    .fillColor("#333")
    .text(
      "Please remit payment to the account details provided in your service agreement. Late payments may incur additional fees.",
      { align: "justify" }
    );

  // --- FOOTER ---
  doc.moveDown(3);
  doc
    .fontSize(10)
    .fillColor("#666")
    .text("Thank you for using RVE Cloud EV Charging Services.", { align: "center" });

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

  const entries = await env.getEntries({
    content_type: "invoice",
    "fields.invoiceNumber": invoiceData.invoiceNumber,
  });

  let entry;
  if (entries.items.length > 0) {
    entry = entries.items[0];
    console.log(`[INFO] Updating invoice ${entry.sys.id}`);
    entry.fields.pdfFile = {
      "en-US": { sys: { type: "Link", linkType: "Asset", id: asset.sys.id } },
    };
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
