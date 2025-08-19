import fetch from 'node-fetch';
const ACCESS_TOKEN = process.env.CLOUD_OCEAN_API_KEY || process.env.API_Key || process.env.API_KEY;
const RVE_BASE = 'https://api.develop.rve.ca';
const MODULE_UUID = 'c667ff46-9730-425e-ad48-1e950691b3f9';

async function fetchWithFallback(url, token) {
  const attempts = [
    { name: 'Access-Token (raw)', headers: { 'Access-Token': token } },
    { name: 'X-API-Key', headers: { 'X-API-Key': token } },
    { name: 'Access-Token (Bearer)', headers: { 'Access-Token': `Bearer ${token}` } },
    { name: 'Authorization (Bearer)', headers: { 'Authorization': `Bearer ${token}` } },
  ];
  let lastResp;
  for (const attempt of attempts) {
    try {
      console.log('Attempting request with header:', attempt.name);
      const resp = await fetch(url, { headers: attempt.headers });
      if (resp.status === 401) {
        lastResp = resp;
        continue;
      }
      return resp;
    } catch (e) {
      lastResp = undefined;
    }
  }
  if (lastResp) return lastResp;
  throw new Error('All authentication header attempts failed without a response');
}

exports.handler = async function(event) {
  const qs = event.queryStringParameters || {};
  const invoiceNumber = qs.invoiceNumber ?? qs.number;
  if (!invoiceNumber) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing invoiceNumber" }) };
  }

  const url = `${RVE_BASE}/v1/modules/${MODULE_UUID}/invoices?invoiceNumber=${encodeURIComponent(invoiceNumber)}`;
  console.log("Fetching invoice from URL:", url);
  try {
    const response = await fetchWithFallback(url, ACCESS_TOKEN);
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
