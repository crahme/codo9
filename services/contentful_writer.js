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

module.exports = { updateInvoiceEntry };
