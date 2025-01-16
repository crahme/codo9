import { defineStackbitConfig, SiteMapEntry } from "@stackbit/types";
import { createClient } from "contentful";

// Create Contentful client outside of the configuration
const client = createClient({
  space: process.env.CONTENTFUL_SPACE_ID,
  accessToken: process.env.CONTENTFUL_PREVIEW_TOKEN,
});
   const fetchEntries = async () => {
       try {
         const entries = await client.getEntries({
           content_type: "Invoice", // Replace with a valid content type
           "fields.slug[exists]": true, // Ensure the 'slug' field exists
         });

export default defineStackbitConfig({
  stackbitVersion: "~0.6.0",
  nodeVersion: "20.18.1",
  modelExtensions: [
    {
      name: "Invoice",
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
      .filter((doc) => doc.modelName === "Invoice")
      .map((document) => {
        const slug = document.fields?.slug || "unknown-slug";
        return {
          stableId: document.id,
          urlPath: `/invoices/${slug}`,import { defineStackbitConfig, SiteMapEntry } from "@stackbit/types";
import { createClient } from "contentful";

// Create Contentful client outside of the configuration
const client = createClient({
  space: process.env.CONTENTFUL_SPACE_ID,
  accessToken: process.env.CONTENTFUL_PREVIEW_TOKEN,
});
   const fetchEntries = async () => {
       try {
         const entries = await client.getEntries({
           content_type: "Invoice", // Replace with a valid content type
           "fields.slug[exists]": true, // Ensure the 'slug' field exists
         });

export default defineStackbitConfig({
  stackbitVersion: "~0.6.0",
  nodeVersion: "20.18.1",
  modelExtensions: [
    {
      name: "Invoice",
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
      .filter((doc) => doc.modelName === "Invoice")
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

// Example function for fetching entries from Contentful (optional, for usage)
export async function fetchEntries(contentType) {
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
          document,
        };
      });
  },
});

// Example function for fetching entries from Contentful (optional, for usage)
export async function fetchEntries(contentType) {
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
