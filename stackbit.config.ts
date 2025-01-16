import { defineStackbitConfig, SiteMapEntry } from "@stackbit/types";
import {createClient} from 'contentful';
export default defineStackbitConfig({
  stackbitVersion: "~0.6.0",
  nodeVersion: "20.18.1",
  const contentful = require("contentful");

     const client = contentful.createClient({
       space: process.env.CONTENTFUL_SPACE_ID,
       accessToken: process.env.CONTENTFUL_PREVIEW_TOKEN,
     });

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
