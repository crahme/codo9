const { PDFDocument } = require('pdf-lib');
const { updateInvoiceEntry } = require('../../services/contentful_writer');
const CloudOceanAPI = require('../../services/cloudoceanapi');

exports.handler = async (event) => {
  const moduleUuid = "c667ff46-9730-425e-ad48-1e950691b3f9";
  const measuringPointUuid = "71ef9476-3855-4a3f-8fc5-333cfbf9e898";
  const start = "2024-10-16";
  const end = "2024-11-25";
  const rate = 0.12;

  const cloudOcean = new CloudOceanAPI(process.env.API_Key);
  const consumptionData = await cloudOcean.getMeasuringPointReads(moduleUuid, measuringPointUuid, start, end);
  const totalKwh = consumptionData.reduce((sum, read) => sum + parseFloat(read.consumption || 0), 0);
  const cost = totalKwh * rate;

  // Write to Contentful
  await updateInvoiceEntry({
    spaceId: process.env.CONTENTFUL_SPACE_ID,
    environmentId: process.env.CONTENTFUL_ENVIRONMENT || 'master',
    invoiceData: { totalKwh, cost }
  });

  // Optionally, generate PDF (your original logic)
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage();
  page.drawText(`Invoice: Total kWh: ${totalKwh}, Cost: ${cost}`);
  const pdfBytes = await pdfDoc.save();

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/pdf" },
    body: Buffer.from(pdfBytes).toString("base64"),
    isBase64Encoded: true,
  };
};
