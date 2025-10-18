// src/app/api/invoices/[id]/download/route.js (Simplified version)
import { NextResponse } from 'next/server';

async function getInvoiceById(id) {
  return {
    id: id,
    invoiceNumber: `INV-${id.slice(-8).toUpperCase()}`,
    clientName: 'John Doe',
    invoiceDate: new Date().toISOString().split('T')[0],
    consumptionKwh: '45.25',
    totalAmount: '28.50',
    chargerSerial: 'CHG-001',
    deviceId: id,
  };
}

// Simple PDF generation using a PDF service or basic template
async function generatePDF(invoice) {
  // For now, let's create a very basic PDF using a service
  // You can replace this with a call to a PDF generation service
  // or use a different library like jspdf
  
  const PDFDocument = await import('pdfkit');
  const PDFKit = PDFDocument.default;
  
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFKit();
      const buffers = [];
      
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // Simple content
      doc.fontSize(20).text('EV Charging Invoice', 100, 100);
      doc.fontSize(12).text(`Invoice: ${invoice.invoiceNumber}`, 100, 150);
      doc.text(`Client: ${invoice.clientName}`, 100, 170);
      doc.text(`Date: ${invoice.invoiceDate}`, 100, 190);
      doc.text(`Consumption: ${invoice.consumptionKwh} kWh`, 100, 210);
      doc.text(`Amount: $${invoice.totalAmount}`, 100, 230);
      doc.text(`Charger: ${invoice.chargerSerial}`, 100, 250);
      
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

export async function GET(request, { params }) {
  const { id } = params;

  try {
    const invoice = await getInvoiceById(id);
    
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const pdfBuffer = await generatePDF(invoice);
    
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });

  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}