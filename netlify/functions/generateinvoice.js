const { PDFDocument } = require('pdf-lib');
const { upsertInvoiceByNumber } = require('../../services/contentful_writer');
const CloudOceanAPI = require('../../services/cloudoceanapi');
const { calculateBilling } = require('../../src/lib/billing');

exports.handler = async (event) => {
  try {
    const qs = event.queryStringParameters || {};

    const moduleUuid = qs.moduleUuid || process.env.RVE_MODULE_UUID || 'c667ff46-9730-425e-ad48-1e950691b3f9';
    const measuringPointUuid = qs.measuringPointUuid || process.env.RVE_MEASURING_POINT_UUID || '71ef9476-3855-4a3f-8fc5-333cfbf9e898';
    const start = (qs.start || '2024-10-16').slice(0, 10);
    const end = (qs.end || '2024-11-25').slice(0, 10);
    const rate = Number(qs.rate ?? process.env.DEFAULT_RATE ?? 0.12);
    const invoiceNumber = qs.invoiceNumber || `INV-${measuringPointUuid.slice(0,8).toUpperCase()}-${start.replace(/-/g,'')}`;

    const cloudOcean = new CloudOceanAPI();
    const reads = await cloudOcean.getMeasuringPointReads(moduleUuid, measuringPointUuid, start, end);

    const { lineItems, totalKwh, cost } = calculateBilling(reads, rate);

    // Upsert invoice to Contentful
    const entryId = await upsertInvoiceByNumber({
      spaceId: process.env.CONTENTFUL_SPACE_ID,
      environmentId: process.env.CONTENTFUL_ENVIRONMENT || 'master',
      invoiceNumber,
      invoiceData: {
        invoiceNumber,
        measuringPointUuid,
        moduleUuid,
        billingPeriodStart: start,
        billingPeriodEnd: end,
        totalKwh,
        totalAmount: cost,
        rate,
        lineItems,
      }
    });

    // Generate a simple PDF summary
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]); // Letter size
    const summary = [
      `Invoice Number: ${invoiceNumber}`,
      `Module UUID: ${moduleUuid}`,
      `Measuring Point UUID: ${measuringPointUuid}`,
      `Period: ${start} to ${end}`,
      `Reads: ${reads.length}`,
      `Total kWh: ${totalKwh}`,
      `Rate: $${rate.toFixed(2)} / kWh`,
      `Total Amount: $${cost}`,
      `Contentful Entry ID: ${entryId}`
    ];
    let y = 750;
    for (const line of summary) {
      page.drawText(line, { x: 50, y });
      y -= 18;
    }
    const pdfBytes = await pdfDoc.save();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/pdf' },
      body: Buffer.from(pdfBytes).toString('base64'),
      isBase64Encoded: true,
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
