import contentfulManagement from 'contentful-management';
import { fetchCloudOceanReads } from './cloudoceanapi.js';

const CONTENTFUL_SPACE_ID = process.env.CONTENTFUL_SPACE_ID;
const CONTENTFUL_ACCESS_TOKEN = process.env.CONTENFUL_MANAGEMENT_TOKEN;
const CONTENTFUL_ENVIRONMENT_ID = 'master'; // Or your environment
const INVOICE_ENTRY_ID = 'invoice'; // Existing invoice entry ID

async function updateInvoiceEntry(readsData) {
  const client = contentfulManagement.createClient({
    accessToken: CONTENTFUL_ACCESS_TOKEN,
  });
  const space = await client.getSpace(CONTENTFUL_SPACE_ID);
  const environment = await space.getEnvironment(CONTENTFUL_ENVIRONMENT_ID);

  // Fetch the existing entry
  const entry = await environment.getEntry(INVOICE_ENTRY_ID);

  // Map your Cloud Ocean data to Contentful fields as appropriate
  entry.fields.totalValue = {
    'en-US': readsData.reduce((sum, r) => sum + (r.value || 0), 0),
  };
  entry.fields.cloudOceanId = {
    'en-US': readsData[0]?.id || '',
  };
  entry.fields.rawData = {
    'en-US': JSON.stringify(readsData),
  };
  // Add or update more fields as needed

  // Update and publish the entry
  const updatedEntry = await entry.update();
  await updatedEntry.publish();

  console.log('Invoice entry updated and published:', updatedEntry.sys.id);
}

async function main() {
  const reads = await fetchCloudOceanReads('2024-10-16', '2024-11-25');
  await updateInvoiceEntry(reads);
}

main().catch(console.error);
