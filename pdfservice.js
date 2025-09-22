import PDFDocument from 'pdfkit';
import fs from 'fs';

export class PDFGenerator {
    async generateInvoice(consumptionData, invoiceDetails) {
        const doc = new PDFDocument();
        const filePath = `./invoices/invoice-${invoiceDetails.invoiceNumber}.pdf`;
        
        doc.pipe(fs.createWriteStream(filePath));

        // Add header
        doc.fontSize(20).text('EV Charging Invoice', { align: 'center' });
        doc.moveDown();

        // Add invoice details
        doc.fontSize(12)
           .text(`Invoice Number: ${invoiceDetails.invoiceNumber}`)
           .text(`Date: ${invoiceDetails.date}`)
           .moveDown();

        // Add consumption table
        doc.fontSize(10);
        Object.entries(consumptionData).forEach(([station, consumption]) => {
            doc.text(`${station}: ${consumption.toFixed(2)} kWh`);
        });

        // Add total
        const total = Object.values(consumptionData)
            .reduce((sum, val) => sum + val, 0);
        doc.moveDown()
           .text(`Total Consumption: ${total.toFixed(2)} kWh`);

        doc.end();
        return filePath;
    }
}