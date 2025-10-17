// src/app/api/invoices/[id]/download/route.js
import { NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';

// Mock data function - replace with your actual data source
async function getInvoiceById(id) {
  // Replace this with your actual data fetching logic
  // from Contentful, database, etc.
  return {
    id: id,
    invoiceNumber: `INV-${id.slice(-8).toUpperCase()}`,
    clientName: 'John Doe',
    invoiceDate: new Date().toISOString().split('T')[0],
    consumptionKwh: '45.25',
    totalAmount: '28.50',
    chargerSerial: 'CHG-001',
    deviceId: id,
    address: '123 Main St, City, State 12345',
    email: 'john.doe@example.com',
    rate: '0.15', // per kWh
    duration: '4.5' // hours
  };
}

// Real PDF generation with pdfkit
async function generatePDF(invoice) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // Add logo/header
      doc.fontSize(20).font('Helvetica-Bold')
         .text('EV CHARGING INVOICE', 50, 50);
      
      doc.moveDown();
      
      // Invoice details
      doc.fontSize(12).font('Helvetica')
         .text(`Invoice Number: ${invoice.invoiceNumber}`, { continued: true })
         .text(`Date: ${invoice.invoiceDate}`, { align: 'right' });
      
      doc.moveDown();
      
      // Client information
      doc.font('Helvetica-Bold').text('Bill To:');
      doc.font('Helvetica')
         .text(invoice.clientName)
         .text(invoice.address)
         .text(invoice.email);
      
      doc.moveDown();
      
      // Charging details table
      const tableTop = doc.y;
      doc.font('Helvetica-Bold')
         .text('Description', 50, tableTop)
         .text('Amount', 300, tableTop, { align: 'right' });
      
      doc.moveTo(50, doc.y + 5).lineTo(550, doc.y + 5).stroke();
      doc.moveDown();
      
      // Charging line item
      doc.font('Helvetica')
         .text('EV Charging Session', 50)
         .text(`$${invoice.totalAmount}`, 300, doc.y - 15, { align: 'right' });
      
      doc.font('Helvetica', 10)
         .text(`Consumption: ${invoice.consumptionKwh} kWh`, 70)
         .text(`Rate: $${invoice.rate}/kWh`, 70)
         .text(`Duration: ${invoice.duration} hours`, 70)
         .text(`Charger: ${invoice.chargerSerial}`, 70)
         .text(`Device: ${invoice.deviceId}`, 70);
      
      doc.moveDown();
      doc.moveTo(50, doc.y + 5).lineTo(550, doc.y + 5).stroke();
      doc.moveDown();
      
      // Total
      doc.font('Helvetica-Bold')
         .text('Total', 300, doc.y, { continued: true })
         .text(`$${invoice.totalAmount}`, { align: 'right' });
      
      doc.moveDown(2);
      
      // Footer
      doc.font('Helvetica', 10)
         .text('Thank you for choosing our EV charging services!', 50, doc.y, { align: 'center' });
      
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

// Named export for GET method
export async function GET(request, { params }) {
  const { id } = params;

  try {
    console.log('📥 Fetching invoice data for:', id);
    
    // 1. Fetch invoice data
    const invoice = await getInvoiceById(id);
    
    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    console.log('📄 Generating PDF for invoice:', invoice.invoiceNumber);
    
    // 2. Generate PDF
    const pdfBuffer = await generatePDF(invoice);

    console.log('✅ PDF generated successfully, size:', pdfBuffer.length, 'bytes');
    
    // 3. Create and return response
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: new Headers({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      }),
    });

  } catch (error) {
    console.error('❌ PDF generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF', details: error.message },
      { status: 500 }
    );
  }
}

// Optional: Add other HTTP methods if needed
export async function POST(request) {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function PUT(request) {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function DELETE(request) {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function PATCH(request) {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}