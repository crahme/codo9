const contentful = require('contentful-management');

const client = contentful.createClient({
  accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN
});

async function updateInvoiceEntry({ spaceId, environmentId, entryId, invoiceData }) {
  const space = await client.getSpace(spaceId);
  const env = await space.getEnvironment(environmentId);
  const entry = await env.getEntry(entryId);

  // Update fields as needed; adjust field names to match Contentful model
  entry.fields.totalKwh = { 'en-US': invoiceData.totalKwh };
  entry.fields.totalAmount = { 'en-US': invoiceData.cost };
  if (invoiceData.lineItems) {
    entry.fields.lineItems = { 'en-US': invoiceData.lineItems };
  }

  const updatedEntry = await entry.update();
  await updatedEntry.publish();
  return updatedEntry;
}

async function upsertInvoiceByNumber({ spaceId, environmentId = 'master', invoiceNumber, invoiceData }) {
  const space = await client.getSpace(spaceId);
  const env = await space.getEnvironment(environmentId);

  const existing = await env.getEntries({ content_type: 'invoice', 'fields.invoiceNumber': invoiceNumber, limit: 1 });

  const localized = {};
  for (const [k, v] of Object.entries(invoiceData || {})) {
    localized[k] = { 'en-US': v };
  }

  if (existing.items && existing.items.length > 0) {
    const entry = existing.items[0];
    Object.assign(entry.fields, localized);
    const updated = await entry.update();
    await updated.publish();
    return updated.sys.id;
  } else {
    const created = await env.createEntry('invoice', { fields: localized });
    const published = await created.publish();
    return published.sys.id;
  }
}

module.exports = { updateInvoiceEntry, upsertInvoiceByNumber };
