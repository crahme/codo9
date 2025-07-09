const fetch = require('node-fetch');
const ACCESS_TOKEN = process.env.API_Key;
const RVE_BASE = 'https://api.develop.rve.ca';
const MODULE_UUID = 'c667ff46-9730-425e-ad48-1e950691b3f9';

exports.handler = async function(event) {
  const invoiceNumber = event.queryStringParameters.number;
  if (!invoiceNumber) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing invoice number" }) };
  }

  // You may need to adjust the endpoint and query params for your API
  const url = `${RVE_BASE}/v1/modules/${MODULE_UUID}/invoices?invoiceNumber=${encodeURIComponent(invoiceNumber)}`;
  const response = await fetch(url, {
    headers: { 'Access-Token': `Bearer ${ACCESS_TOKEN}` },
  });
  if (!response.ok) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to fetch invoice' }) };
  }
  const data = await response.json();
  return {
    statusCode: 200,
    body: JSON.stringify(data)
  };
};
