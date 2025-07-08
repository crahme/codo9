const contentful = require('contentful-management');
const fetch = require('node-fetch'); // Use if you're not in a modern Node.js environment

const CONTENTFUL_ACCESS_TOKEN = process.env.CONTENTFUL_MANAGEMENT_TOKEN;
const SPACE_ID = process.env.CONTENTFUL_SPACE_ID;
const ENVIRONMENT_ID = process.enev.CONTENTFUL_ENVIRONMENT;

async function fetchCloudOceanReads(start, end, limit = 50, offset = 0) {
  const BASE_URL = 'https://api.develop.rve.ca/v1/modules/c667ff46-9730-425e-ad48-1e950691b3f9/measuring-points/71ef9476-3855-4a3f-8fc5-333cfbf9e898/reads';
  const url = `${BASE_URL}?start=${start}&end=${end}&limit=${limit}&offset=${offset}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Cloud Ocean API error: ${response.statusText}`);
  return response.json();
}

async function upsertInvoiceEntry(invoiceData) {
  const client = contentful.createClient({ accessToken: CONTENTFUL_ACCESS_TOKEN });
  const space = await client.getSpace(SPACE_ID);
  const environment = await space.getEnvironment(ENVIRONMENT_ID);

  // Try to find existing entry by invoiceNumber
  const entries = await environment.getEntries({
    content_type: 'invoice',
    'fields.invoiceNumber': invoiceData.invoiceNumber,
    limit: 1,
  });

  let entry;
  if (entries.items.length > 0) {
    // Entry exists, update it
    entry = entries.items[0];
    entry.fields = {
      ...entry.fields,
      ...invoiceData // Overwrite with new data
    };
    entry = await entry.update();
    await entry.publish();
    console.log(`Updated invoice: ${invoiceData.invoiceNumber}`);
  } else {
    // Entry does not exist, create it
    entry = await environment.createEntry('invoice', { fields: invoiceData });
    await entry.publish();
    console.log(`Created invoice: ${invoiceData.invoiceNumber}`);
  }
}

function mapApiDataToContentfulFields(apiData) {
  // Map your API fields to Contentful fields here; adjust as needed!
  return {
    syndicateName: { 'en-US': apiData.syndicateName },
    address: { 'en-US': apiData.address },
    contact: { 'en-US': apiData.contact },
    invoiceNumber: { 'en-US': apiData.invoiceNumber },
    invoiceDate: { 'en-US': apiData.invoiceDate },
    clientName: { 'en-US': apiData.clientName },
    clientEmail: { 'en-US': apiData.clientEmail },
    chargerSerialNumber: { 'en-US': apiData.chargerSerialNumber },
    billingPeriodStart: { 'en-US': apiData.billingPeriodStart },
    billingPeriodEnd: { 'en-US': apiData.billingPeriodEnd },
    environmentalImpactText: { 'en-US': apiData.environmentalImpactText },
    paymentDueDate: { 'en-US': apiData.paymentDueDate },
    lateFeeRate: { 'en-US': apiData.lateFeeRate },
    // lineItems: ... // Add if you have line items!
    // slug intentionally omitted
  };
}

// Example usage
async function syncInvoice(start, end) {
  const apiData = await fetchCloudOceanReads(start, end);
  // You need to map your API data to Contentful fields here
  const invoiceData = mapApiDataToContentfulFields(apiData);
  await upsertInvoiceEntry(invoiceData);
}

// Example run
// syncInvoice('2024-10-16', '2024-11-25');

module.exports = { fetchCloudOceanReads, upsertInvoiceEntry, syncInvoice };
