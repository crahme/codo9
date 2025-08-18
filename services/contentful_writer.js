const contentful = require('contentful-management');

const accessToken = process.env.CONTENTFUL_MANAGEMENT_TOKEN;
if (!accessToken) {
  throw new Error('CONTENTFUL_MANAGEMENT_TOKEN is not set in environment variables.');
}

const client = contentful.createClient({
  accessToken
});

async function updateInvoiceEntry({ spaceId, environmentId, entryId, invoiceData }) {
  try {
    const space = await client.getSpace(spaceId);
    const env = await space.getEnvironment(environmentId);
    const entry = await env.getEntry(entryId);

    // Update fields as needed; adjust field names to match Contentful model
    const localized = {};
    for (const [k, v] of Object.entries(invoiceData || {})) {
      localized[k] = { 'en-US': v };
    }
    Object.assign(entry.fields, localized);

    const updatedEntry = await entry.update();
    await updatedEntry.publish();
    return updatedEntry;
  } catch (error) {
    console.error('Error updating invoice entry:', error.message);
    throw error;
  }
}

async function upsertInvoiceByNumber({ spaceId, environmentId = 'master', invoiceNumber, invoiceData }) {
  try {
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
  } catch (error) {
    console.error('Error upserting invoice by number:', error.message);
    throw error;
  }
}

module.exports = { updateInvoiceEntry, upsertInvoiceByNumber };