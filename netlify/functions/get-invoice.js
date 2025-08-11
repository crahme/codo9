const fetch = require('node-fetch');
const ACCESS_TOKEN = process.env.API_Key;
const RVE_BASE = 'https://api.develop.rve.ca';
const MODULE_UUID = 'c667ff46-9730-425e-ad48-1e950691b3f9';

exports.handler = async function(event) {
  const qs = event.queryStringParameters || {};
  const invoiceNumber = qs.invoiceNumber ?? qs.number;
  if (!invoiceNumber) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing invoiceNumber" }) };
  }

  const url = `${RVE_BASE}/v1/modules/${MODULE_UUID}/invoices?invoiceNumber=${encodeURIComponent(invoiceNumber)}`;
  console.log("Fetching invoice from URL:", url);
  try {
    const response = await fetch(url, {
      headers: { 'Access-Token': ACCESS_TOKEN },
    });
    if (!response.ok) {
      return { statusCode: response.status, body: JSON.stringify({ error: 'Failed to fetch invoice' }) };
    }
    const data = await response.json();
    return {
      statusCode: 200,
      body: JSON.stringify(data)
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
