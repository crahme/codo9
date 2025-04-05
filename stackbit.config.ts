import { defineStackbitConfig } from "@stackbit/types";
import { createClient } from "contentful";

// Create Contentful client outside of the configuration
const client = createClient({
  space: process.env.CONTENTFUL_SPACE_ID,
  accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN,
});

export default defineStackbitConfig({
  stackbitVersion: "~0.6.0",
  nodeVersion: "20.18.1",
 
  modelExtensions: [
    {
      name: "invoice",
      type: "page",
      urlPath: "/invoices/{slug}",
    },
  ],
  siteMap: ({ documents }) => {
    if (!documents || !Array.isArray(documents)) {
      console.warn("Documents are undefined or not an array.");
      return [];
    }

    return documents
      .filter((doc) => doc.modelName === "invoice")
      .map((document) => {
        const slug = document.fields?.slug || "unknown-slug";
        return {
          stableId: document.id,
          urlPath: `/invoices/${slug}`,
          document,
        };
      });
  },


});

// Separate the fetchEntries function
export async function fetchEntries(contentType: string) {
  try {
    const entries = await client.getEntries({
      content_type: contentType,
      "fields.slug[exists]": true,
    });
    return entries.items;
  } catch (error) {
    console.error("Error fetching entries:", error);
    throw error;
  }
}
