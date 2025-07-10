const fetch = require('node-fetch');
const contentful = require('contentful-management');

const RVE_BASE = 'https://api.develop.rve.ca';
const MODULE_UUID = 'c667ff46-9730-425e-ad48-1e950691b3f9';
// Update this endpoint to match your actual invoice endpoint if it differs
const INVOICE_ENDPOINT = `/v1/modules/${MODULE_UUID}/invoices`;

const CONTENTFUL_SPACE_ID = process.env.CONTENTFUL_SPACE_ID;
const CONTENTFUL_ENVIRONMENT_ID = process.env.CONTENTFUL_ENVIRONMENT || 'master';
const CONTENTFUL_MANAGEMENT_TOKEN = process.env.CONTENTFUL_MANAGEMENT_TOKEN;
const CONTENTFUL_INVOICE_TYPE = 'invoice';

const ACCESS_TOKEN = process.env.API_Key;

exports.handler = async function(event) {
  // Accept start/end date from query params, or use defaults
  const startDate = event.queryStringParameters?.start || '2025-01-01';
  const endDate = event.queryStringParameters?.end || '2025-12-31';

  // 1. Fetch invoice data from Cloud Ocean API
  let invoiceData;
  try {
    const url = `${RVE_BASE}${INVOICE_ENDPOINT}?start_date=${startDate}&end_date=${endDate}`;
    const response = await fetch(url, {
      headers: { 'Access-Token': `Bearer ${ACCESS_TOKEN}` },
    });
    if (!response.ok) {
      throw new Error('Cloud Ocean API request failed');
    }
    invoiceData = await response.json();
    // If API returns an array, get first invoice. Adjust as needed.
    if (Array.isArray(invoiceData)) invoiceData = invoiceData[0];
    if (!invoiceData) throw new Error('No invoice data received');
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch invoice from Cloud Ocean', details: err.message })
    };
  }

  // 2. Write invoice to Contentful
  let contentfulResponse;
  try {
    const client = contentful.createClient({
      accessToken: CONTENTFUL_MANAGEMENT_TOKEN,
    });
    const space = await client.getSpace(CONTENTFUL_SPACE_ID);
    const env = await space.getEnvironment(CONTENTFUL_ENVIRONMENT_ID);

    // Prepare fields, mapping your API data to Contentful model.
    // Adjust as needed based on your API's response structure!
    const fields = {
      syndicateName:         { 'en-US': invoiceData.syndicateName || 'Default Syndicate' },
      slug:                  { 'en-US': invoiceData.slug || '/' },
      address:               { 'en-US': invoiceData.address || '' },
      contact:               { 'en-US': invoiceData.contact || '' },
      invoiceNumber:         { 'en-US': invoiceData.invoiceNumber || '' },
      invoiceDate:           { 'en-US': invoiceData.invoiceDate || new Date().toISOString() },
      clientName:            { 'en-US': invoiceData.clientName || '' },
      clientEmail:           { 'en-US': invoiceData.clientEmail || '' },
      chargerSerialNumber:   { 'en-US': invoiceData.chargerSerialNumber || '' },
      billingPeriodStart:    { 'en-US': invoiceData.billingPeriodStart || startDate },
      billingPeriodEnd:      { 'en-US': invoiceData.billingPeriodEnd || endDate },
      paymentDueDate:        { 'en-US': invoiceData.paymentDueDate || '' },
      lateFeeRate:           { 'en-US': invoiceData.lateFeeRate ?? 0 },
      environmentalImpactText: invoiceData.environmentalImpactText
        ? { 'en-US': invoiceData.environmentalImpactText }
        : undefined,
      // For lineItems, you need to create or link entries of type "lineItem" and collect their IDs
      // Example (requires lineItem entry creation or fetching first):
      // lineItems: { 'en-US': [{ sys: { type: 'Link', linkType: 'Entry', id: 'lineItemEntryId' } }] }
    };

    // Remove undefined fields (Contentful requires this)
    Object.keys(fields).forEach(key => fields[key] === undefined && delete fields[key]);

    contentfulResponse = await env.createEntry(CONTENTFUL_INVOICE_TYPE, { fields });
    await contentfulResponse.publish();

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to write to Contentful', details: err.message })
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Invoice pushed to Contentful', entryId: contentfulResponse.sys.id })
  };
};
