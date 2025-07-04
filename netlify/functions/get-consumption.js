const { Client } = require('pg');
const fetch = require('node-fetch');

// Environment variables from Netlify or your .env file
const DB_URL = process.env.DATABASE_URL;
const RVE_BASE = 'https://api.develop.rve.ca';
const MODULE_UUID = 'c667ff46-9730-425e-ad48-1e950691b3f9';
const MEASURING_POINTS = [
  'uuid-1', // replace with your actual UUIDs
  'uuid-2',
  'uuid-3'
];
const API_KEY = process.env.API_Key;
const ACCESS_TOKEN = process.env.API_Key;

exports.handler = async function(event, context) {
  // Example: fetch for a date range
  const startDate = event.queryStringParameters.start || '2024-01-01';
  const endDate = event.queryStringParameters.end || '2024-12-31';

  // Try database first
  let dbClient;
  try {
    dbClient = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
    await dbClient.connect();

    const result = await dbClient.query(
      'SELECT * FROM consumption_record WHERE timestamp BETWEEN $1 AND $2',
      [startDate, endDate]
    );
    if (result.rows.length > 0) {
      await dbClient.end();
      return {
        statusCode: 200,
        body: JSON.stringify({ source: 'database', data: result.rows })
      };
    }
    await dbClient.end();
  } catch (e) {
    if (dbClient) await dbClient.end();
    // Log db error and proceed to API fallback
  }

  // API fallback
  for (const auth of [
    { header: { 'Access-Token': `Bearer ${ACCESS_TOKEN}` } },
    { header: { 'X-API-Key': API_KEY } },
    { header: { 'Authorization': `Bearer ${ACCESS_TOKEN}` } }
  ]) {
    for (const point of MEASURING_POINTS) {
      try {
        const url = `${RVE_BASE}/v1/modules/${MODULE_UUID}/measuring-points/${point}/reads?start_date=${startDate}&end_date=${endDate}`;
        const response = await fetch(url, { headers: auth.header });
        if (response.ok) {
          const apiData = await response.json();
          return {
            statusCode: 200,
            body: JSON.stringify({ source: 'api', data: apiData })
          };
        }
      } catch (e) {
        // Log API error and try next method
      }
    }
  }

  // If all else fails
  return {
    statusCode: 500,
    body: JSON.stringify({ error: 'Failed to get data from database and API' })
  };
};
