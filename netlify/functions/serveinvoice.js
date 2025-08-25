import  fetch from 'node-fetch';
import {updateInvoiceEntry} from './update-invoice-entry.mjs';
export async function handler(event, context) {
  const moduleUuid = "c667ff46-9730-425e-ad48-1e950691b3f9";
  const measuringPointUuid = "71ef9476-3855-4a3f-8fc5-333cfbf9e898";
  const start = "2024-10-16";
  const end = "2024-11-25";
  const url = `https://api.develop.rve.ca/v1/modules/${moduleUuid}/measuring-points/${measuringPointUuid}/reads?start=${start}&end=${end}`;

  try {
    const response = await fetch(url, {
      headers: { "Access-Token": process.env.API_Key }
    });
    const data = await response.json();
    const totalKwh = data.data ? data.data.reduce((sum, read) => sum + parseFloat(read.consumption || 0), 0) : 0;
    const cost = totalKwh * 0.12;

    // Write to Contentful
    await updateInvoiceEntry({
      spaceId: process.env.CONTENTFUL_SPACE_ID,
      environmentId: process.env.CONTENTFUL_ENVIRONMENT || 'master',
      entryId: process.env.CONTENTFUL_INVOICE_ENTRY_ID,
      invoiceData: { totalKwh, cost }
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ totalKwh, cost, raw: data }),
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
