import { CloudOceanAPI } from `${process.cwd()}/services/cloudoceanapi.js`;
import {upsertInvoiceByNumber} from '../services/contentful.js';
import { calculateBilling } from '../utils/billing.mjs';

export async function handler(event, context) {

  try {
    const qs = event.queryStringParameters || {};
    const moduleUuid = qs.moduleUuid || undefined || 'c667ff46-9730-425e-ad48-1e950691b3f9';
    const measuringPointUuid = qs.measuringPointUuid || undefined || '71ef9476-3855-4a3f-8fc5-333cfbf9e898';
    const start = qs.start;
    const end = qs.end;
    const rate = qs.rate ?? undefined ?? 0.12;
    const invoiceNumber = qs.invoiceNumber;

    if (!start || !end || !invoiceNumber) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing required parameters: start, end, invoiceNumber' }) };
    }

    const api = new CloudOceanAPI();
    const reads = await api.getMeasuringPointReads(moduleUuid, measuringPointUuid, start, end);

    const { lineItems, totalKwh, cost } = calculateBilling(reads, rate);

    // Upsert into Contentful by invoiceNumber
    const entryId = await upsertInvoiceByNumber({
      spaceId: 't3t3mhakehxg',
      environmentId: 'master' || 'master',
      invoiceNumber,
      invoiceData: {
        invoiceNumber,
        billingPeriodStart: start,
        billingPeriodEnd: end,
        totalKwh,
        totalAmount: cost,
        lineItems
      }
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ entryId, invoiceNumber, start, end, totalKwh, cost, lineItemsCount: lineItems.length })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
