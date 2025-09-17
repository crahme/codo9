// src/scripts/rve-to-contentful.js
import dotenv from "dotenv";
dotenv.config();

import { CloudOceanService } from "../services/CloudOceanService.js";
import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";

const service = new CloudOceanService();

/**
 * Generate an invoice PDF for one station
 */
function generateInvoicePDF(point, outputDir = "./invoices") {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const filename = path.join(outputDir, `${point.name.replace(/\s+/g, "_")}.pdf`);
  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(fs.createWriteStream(filename));

  // --- HEADER ---
  doc.fontSize(20).text("Invoice", { align: "center" }).moveDown();

  doc.fontSize(12)
    .text(`Station: ${point.name}`)
    .text(`Location: ${point.location || "N/A"}`)
    .text(`UUID: ${point.uuid || "N/A"}`)
    .moveDown();

  // --- TOTALS ---
  doc.fontSize(14).text("Summary", { underline: true }).moveDown(0.5);
  doc.fontSize(12)
    .text(`Reads Consumption (kWh): ${point.consumption.toFixed(1)}`)
    .text(`CDR Consumption (kWh): ${point.cdrConsumption.toFixed(1)}`)
    .moveDown();

  // --- GROUP CDRs BY DATE ---
  const grouped = {};
  for (const session of point.cdrSessions || []) {
    if (!grouped[session.date]) grouped[session.date] = [];
    grouped[session.date].push(session);
  }

  // --- TABLE HEADER ---
  doc.fontSize(14).text("CDR Sessions", { underline: true }).moveDown(0.5);

  const rowHeight = 20;
  let y = doc.y;
  let grandTotal = 0;

  for (const [date, sessions] of Object.entries(grouped)) {
    const dayTotal = sessions.reduce((sum, s) => sum + s.energy, 0);
    grandTotal += dayTotal;

    // Date label
    doc.fontSize(12).text(`Date: ${date}`, 50, y);
    y += rowHeight;

    // Column headers
    doc.fontSize(10)
      .text("Start Time", 100, y)
      .text("End Time", 250, y)
      .text("Energy (kWh)", 400, y);
    y += rowHeight;

    doc.moveTo(50, y - 5).lineTo(550, y - 5).stroke();

    // Session rows
    for (const session of sessions) {
      doc.fontSize(10)
        .text(session.startTime, 100, y)
        .text(session.endTime, 250, y)
        .text(session.energy.toFixed(1), 400, y);
      y += rowHeight;

      if (y > doc.page.height - 50) {
        doc.addPage();
        y = 50;
      }
    }

    // Subtotal
    doc.fontSize(10).text(`Subtotal: ${dayTotal.toFixed(1)} kWh`, 400, y);
    y += rowHeight * 2;

    if (y > doc.page.height - 50) {
      doc.addPage();
      y = 50;
    }
  }

  // --- GRAND TOTAL ---
  doc.moveDown();
  doc.fontSize(12).text(`GRAND TOTAL: ${grandTotal.toFixed(1)} kWh`, { align: "right" });

  doc.end();
  console.log(`✅ Invoice saved: ${filename}`);
}

// --- MAIN ---
(async () => {
  try {
    const startDate = "2024-10-16";
    const endDate = "2024-11-25";

    console.log(`[INFO] Fetching consumption data from ${startDate} → ${endDate}...`);
    const stations = await service.getConsumptionData(startDate, endDate);

    if (!stations || stations.length === 0) {
      console.warn("⚠️ No stations returned by CloudOceanService.");
      return;
    }

    console.log(`[INFO] Generating invoices for ${stations.length} station(s)...`);

    for (const point of stations) {
      console.log(`[INFO] Generating invoice for station: ${point.name}`);
      generateInvoicePDF(point, "./invoices");
    }

    console.log("[INFO] All invoices generated ✅");
  } catch (err) {
    console.error("❌ Error in invoice generation:", err);
  }
})();
