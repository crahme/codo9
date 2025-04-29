const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const moment = require('moment');
const logger = require('pino')({ level: 'info' });

class InvoiceGenerator {
  constructor(outputDir) {
    this.outputDir = outputDir;

    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  }

  generateInvoice(invoiceData) {
    return new Promise((resolve, reject) => {
      try {
        logger.info(`Generating invoice ${invoiceData.invoice_number}`);

        const filename = `invoice_${invoiceData.invoice_number}.pdf`;
        const filepath = path.join(this.outputDir, filename);

        // Create a new PDF document
        const doc = new PDFDocument({ margin: 50 });

        // Pipe the PDF to a file
        const stream = fs.createWriteStream(filepath);
        doc.pipe(stream);

        // Header
        doc.fontSize(20).text('EV Station Invoice Statement', { align: 'center' });
        doc.moveDown();

        // Company Information
        doc.fontSize(10).text(`Syndicate Name: ${invoiceData.syndicate_name || ''}`);
        doc.text(`Address: ${invoiceData.company_address || ''}`);
        doc.text(`Phone: ${invoiceData.company_phone || ''}`);
        doc.text(`Email: ${invoiceData.company_email || ''}`);
        doc.text(`Website: ${invoiceData.company_website || ''}`);
        doc.moveDown();

        // Invoice Details
        doc.fontSize(14).text('Invoice Details', { underline: true });
        doc.fontSize(10).text(`Invoice Number: ${invoiceData.invoice_number}`);
        doc.text(`Date: ${moment().format('YYYY-MM-DD')}`);
        doc.text(`Billing Period: ${invoiceData.billing_period_start} to ${invoiceData.billing_period_end}`);
        doc.text(`Due Date: ${invoiceData.due_date || ''}`);
        doc.moveDown();

        // Charging Sessions Table
        doc.fontSize(14).text('Electric Vehicle Charging Details', { underline: true });
        doc.moveDown();
        const headers = ['Date', 'Start Time', 'End Time', 'Duration', 'kWh', 'Rate', 'Amount'];
        this._drawTable(doc, headers, invoiceData.charging_sessions || []);

        doc.moveDown();

        // Summary
        doc.fontSize(14).text('Summary', { underline: true });
        const summary = [
          [`Total kWh Consumed:`, `${invoiceData.total_kwh.toFixed(2)} kWh`],
          [`Rate per kWh:`, `$${invoiceData.rate.toFixed(2)}`],
          [`Total Amount:`, `$${invoiceData.total_amount.toFixed(2)}`]
        ];
        this._drawSummary(doc, summary);

        doc.moveDown();

        // Payment Instructions
        doc.fontSize(14).text('Payment Instructions', { underline: true });
        const paymentText = `
          Please make payment by ${invoiceData.due_date || ''}. For questions regarding this invoice,
          please contact us at smp@microbms.com or call our customer service at ${invoiceData.company_phone || ''}.
        `;
        doc.fontSize(10).text(paymentText, { align: 'left' });

        // Finalize and close the PDF
        doc.end();

        // Resolve the promise once the PDF is written
        stream.on('finish', () => {
          logger.info(`Successfully generated invoice PDF at ${filepath}`);
          resolve(filepath);
        });
        stream.on('error', (err) => {
          logger.error(`Failed to write PDF file: ${err.message}`);
          reject(err);
        });
      } catch (err) {
        logger.error(`Failed to generate invoice PDF: ${err.message}`);
        reject(err);
      }
    });
  }

  _drawTable(doc, headers, rows) {
    const tableTop = doc.y;
    const columnWidth = 80;
    const rowHeight = 20;

    const drawRow = (row, y) => {
      row.forEach((cell, i) => {
        doc.text(cell, 50 + i * columnWidth, y, { width: columnWidth, align: 'center' });
      });
    };

    // Draw headers
    drawRow(headers, tableTop);
    doc.moveTo(50, tableTop + rowHeight - 5).lineTo(50 + headers.length * columnWidth, tableTop + rowHeight - 5).stroke();

    // Draw rows
    rows.forEach((session, rowIndex) => {
      const y = tableTop + rowHeight * (rowIndex + 1);
      drawRow([
        session.date || '',
        session.start_time || '',
        session.end_time || '',
        session.duration || '',
        session.kwh ? session.kwh.toFixed(2) : '0.00',
        session.rate ? `$${session.rate.toFixed(2)}` : '$0.00',
        session.amount ? `$${session.amount.toFixed(2)}` : '$0.00'
      ], y);
    });
  }

  _drawSummary(doc, summary) {
    summary.forEach(([label, value]) => {
      doc.text(label, { continued: true }).text(value, { align: 'right' });
    });
  }
}

module.exports = InvoiceGenerator;
