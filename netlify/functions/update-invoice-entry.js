const fetch = require('node-fetch');
const { Client } = require('pg');

// Use the same DB env variable as get-consumption.js
const DB_URL = process.env.NETLIFY_DATABASE_URL;

// The invoice slug to update
const SLUG = '/invoice/fac-2024-001';

exports.handler = async function(event) {
  // 1. Query get-consumption
  const consRes = await fetch(`${process.env.SITE_URL}/.netlify/functions/get-consumption?slug=${encodeURIComponent(SLUG)}`);
  const consJson = await consRes.json();
  const consumptionRecords = consJson.data || [];

  // 2. Query get-invoice
  const invRes = await fetch(`${process.env.URL}/.netlify/functions/get-invoice?slug=${encodeURIComponent(SLUG)}`);
  const invoiceJson = await invRes.json();

  // 3. Query push-invoice (for any additional status/PDF info)
  const pushRes = await fetch(`${process.env.URL}/.netlify/functions/push-invoice?slug=${encodeURIComponent(SLUG)}`);
  const pushJson = await pushRes.json();

  // 4. Map consumption records to line_items
  // Adjust field mapping if your data shape is different!
  const lineItems = Array.isArray(consumptionRecords) ? consumptionRecords.map(rec => ({
    date: rec.timestamp ? new Date(rec.timestamp).toISOString() : null,
    start_time: rec.start_time ? new Date(rec.start_time).toISOString() : null,
    end_time: rec.end_time ? new Date(rec.end_time).toISOString() : null,
    energy_consumed_kwh: rec.energy_kwh ? String(rec.energy_kwh) : "",
    unit_price_dollars: rec.unit_price ? String(rec.unit_price) : "",
    amount_due_dollars: rec.amount_due ? String(rec.amount_due) : ""
  })) : [];

  // 5. Build the updated invoice object
  // Adjust field mappings as needed based on your actual function output
  const updatedInvoice = {
    syndicate_name: invoiceJson.syndicate_name || "",
    slug: SLUG,
    address: invoiceJson.address || "",
    contact: invoiceJson.contact || "",
    invoice_number: invoiceJson.invoice_number || "",
    invoice_date: invoiceJson.invoice_date || "",
    client_name: invoiceJson.client_name || "",
    client_email: invoiceJson.client_email || "",
    charger_serial: invoiceJson.charger_serial || "",
    billing_period_start: invoiceJson.billing_period_start || "",
    billing_period_end: invoiceJson.billing_period_end || "",
    environmental_impact_text: invoiceJson.environmental_impact_text || "",
    payment_due_date: invoiceJson.payment_due_date || "",
    late_fee_rate: invoiceJson.late_fee_rate || 0,
    line_items: lineItems
  };

  // 6. Update the invoice in PostgreSQL
  const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    await client.query(
      `UPDATE invoice SET
        syndicate_name = $1,
        address = $2,
        contact = $3,
        invoice_number = $4,
        invoice_date = $5,
        client_name = $6,
        client_email = $7,
        charger_serial = $8,
        billing_period_start = $9,
        billing_period_end = $10,
        environmental_impact_text = $11,
        payment_due_date = $12,
        late_fee_rate = $13,
        line_items = $14
      WHERE slug = $15`,
      [
        updatedInvoice.syndicate_name,
        updatedInvoice.address,
        updatedInvoice.contact,
        updatedInvoice.invoice_number,
        updatedInvoice.invoice_date,
        updatedInvoice.client_name,
        updatedInvoice.client_email,
        updatedInvoice.charger_serial,
        updatedInvoice.billing_period_start,
        updatedInvoice.billing_period_end,
        updatedInvoice.environmental_impact_text,
        updatedInvoice.payment_due_date,
        updatedInvoice.late_fee_rate,
        JSON.stringify(updatedInvoice.line_items),
        SLUG
      ]
    );
    await client.end();

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Invoice entry updated', updatedInvoice, pushStatus: pushJson })
    };
  } catch (err) {
    if (client) await client.end();
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
