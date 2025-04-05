import { createClient } from 'contentful';

const client = createClient({
  space: process.env.CONTENTFUL_SPACE_ID,
  accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN,
});

export async function fetchEntries() {
  try {
    const entries = await client.getEntries();
    return entries.items;
  } catch (error) {
    console.error('Error fetching entries:', error);
    throw error;
  }
}
