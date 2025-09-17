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
    .text(`Reads Consumption (kWh): ${point.readsConsumption.toFixed(1)}`)
    .text(`CDR Consumption (kWh): ${point.cdrConsumption.toFixed(1)}`)
    .moveDown(2);

  // --- CDR SESSIONS TABLE ---
  doc.fontSize(14).text("CDR Sessions (Grouped by Day)", { underline: true }).moveDown();

  const grouped = {};
  for (const session of point.cdrSessions || []) {
    if (!grouped[session.date]) grouped[session.date] = [];
    grouped[session.date].push(session);
  }

  for (const [date, sessions] of Object.entries(grouped)) {
    doc.fontSize(12).text(`Date: ${date}`).moveDown(0.5);

    // --- Table Header ---
    doc.fontSize(10).text("Start Time", 80, doc.y, { continued: true })
      .text("End Time", 220, doc.y, { continued: true })
      .text("Energy (kWh)", 360, doc.y);
    doc.moveDown(0.5);

    // Draw header line
    const headerY = doc.y;
    doc.moveTo(70, headerY).lineTo(500, headerY).stroke();
    doc.moveDown(0.5);

    let dayTotal = 0;

    // --- Session rows ---
    for (const session of sessions) {
      doc.fontSize(10)
        .text(session.startTime, 80, doc.y, { continued: true })
        .text(session.endTime, 220, doc.y, { continued: true })
        .text(session.energy.toFixed(1), 360, doc.y);
      doc.moveDown(0.5);

      dayTotal += session.energy;

      // Handle page break
      if (doc.y > doc.page.height - 100) {
        doc.addPage();
      }
    }

    // Subtotal row
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Subtotal: ${dayTotal.toFixed(1)} kWh`, 360);
    doc.moveDown(1);
  }

  // --- GRAND TOTAL ---
  const grandTotal = point.cdrSessions.reduce((sum, s) => sum + s.energy, 0);
  doc.moveDown(1);
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
    const { devices } = await service.getConsumptionData(startDate, endDate);

    if (!devices || devices.length === 0) {
      console.warn("⚠️ No measuring points returned by CloudOceanService.");
      return;
    }

    console.log(`[INFO] Generating invoices for ${devices.length} station(s)...`);

    for (const point of devices) {
      console.log(`[INFO] Generating invoice for station: ${point.name}`);
      generateInvoicePDF(point, "./invoices");
    }

    console.log("[INFO] All invoices generated ✅");
  } catch (err) {
    console.error("❌ Error in invoice generation:", err);
  }
})();
