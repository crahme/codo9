export default async function handler(req, res) {
  const { id } = req.query;

  try {
    // 1. Fetch invoice data from your database
    const invoice = await getInvoiceById(id);
    
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // 2. Generate PDF (using a library like pdfkit, jspdf, or puppeteer)
    const pdfBuffer = await generatePDF(invoice);

    // 3. Set headers and send PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
}