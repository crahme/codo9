// src/app/api/invoices/[id]/download/route.js
import { NextResponse } from 'next/server';

// Mock data function - replace with your actual Contentful logic
async function getInvoiceById(id) {
  console.log('🔍 Fetching invoice data for ID:', id);
  
  // For now, use mock data - replace with your Contentful API call
  return {
    id: id,
    invoiceNumber: `fac-${id}`,
    clientName: 'John Doe',
    invoiceDate: '2025-10-15',
    totalAmount: '41.30',
    consumptionKwh: '275.37',
    chargerSerial: 'CHG-001',
    deviceId: id,
    billingPeriod: '2024-10-16 to 2024-11-25',
    dueDate: '2025-11-14',
    ratePerKwh: '0.15'
  };
}

// Generate charging sessions data
function generateChargingSessions() {
  const sessions = [];
  const startDate = new Date('2024-10-16');
  const endDate = new Date('2024-11-24');
  
  const highConsumptionDays = {
    '2024-10-16': 31.71,
    '2024-10-22': 24.32,
    '2024-10-23': 30.31,
    '2024-10-29': 30.56,
    '2024-11-01': 16.59,
    '2024-11-03': 9.26,
    '2024-11-04': 6.06,
    '2024-11-05': 23.79,
    '2024-11-10': 30.05,
    '2024-11-14': 20.50,
    '2024-11-15': 6.49,
    '2024-11-19': 23.60,
    '2024-11-23': 19.34
  };
  
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const consumption = highConsumptionDays[dateStr] || (Math.random() * 0.02 + 0.09);
    const amount = (consumption * 0.15).toFixed(2);
    
    sessions.push({
      date: dateStr,
      startTime: '00:00:00',
      endTime: '23:59:59',
      duration: '24:00:00',
      energy: consumption.toFixed(2),
      unitPrice: '0.15',
      amount: amount
    });
  }
  
  return sessions;
}

// Create a simple but valid PDF
function createSimplePDF(invoice) {
  // This creates a minimal but valid PDF that should open in any PDF reader
  const pdfContent = `
%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 500 >>
stream
BT
/F1 12 Tf
50 750 Td
(EV Station Invoice Statement) Tj
0 -20 Td
(Syndicate Name: RVE CLOUD OCEAN) Tj
0 -15 Td
(Address: 123 EV Way, Montreal, QC) Tj
0 -15 Td
(Phone: +1 (555) 123-4567) Tj
0 -15 Td
(Email: contact@rve.ca) Tj
0 -15 Td
(Website: https://rve.ca) Tj
0 -30 Td
(Invoice Details) Tj
0 -15 Td
(Invoice Number: ${invoice.invoiceNumber}) Tj
0 -15 Td
(Invoice Date: ${invoice.invoiceDate}) Tj
0 -15 Td
(Billing Period: ${invoice.billingPeriod}) Tj
0 -15 Td
(Due Date: ${invoice.dueDate}) Tj
0 -30 Td
(Summary) Tj
0 -15 Td
(Total Amount: $${invoice.totalAmount}) Tj
0 -15 Td
(Total kWh Consumed: ${invoice.consumptionKwh} kWh) Tj
0 -15 Td
(Rate per kWh: $${invoice.ratePerKwh}) Tj
0 -30 Td
(Payment Instructions) Tj
0 -15 Td
(Please make the payment before ${invoice.dueDate}.) Tj
0 -15 Td
(For questions, contact: smp@microbms.com) Tj
0 -15 Td
(Phone: +1 (555) 123-4567) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000220 00000 n 
0000000750 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
850
%%EOF
`;

  return Buffer.from(pdfContent);
}

export async function GET(request, { params }) {
  const { id } = params;

  console.log('🚀 API called with invoice ID:', id);
  
  try {
    // 1. Fetch invoice data
    const invoice = await getInvoiceById(id);
    
    if (!invoice) {
      console.log('❌ Invoice not found for ID:', id);
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    console.log('✅ Invoice data loaded:', invoice.invoiceNumber);
    
    // 2. Generate simple PDF
    const pdfBuffer = createSimplePDF(invoice);

    console.log('✅ PDF generated, size:', pdfBuffer.length, 'bytes');
    
    // 3. Create and return response
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${invoice.invoiceNumber}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });

  } catch (error) {
    console.error('💥 PDF generation failed:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate PDF',
        details: error.message
      },
      { status: 500 }
    );
  }
}

// Add other HTTP methods
export async function POST() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function PUT() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}