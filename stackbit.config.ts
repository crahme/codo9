import { defineStackbitConfig, SiteMapEntry } from "@stackbit/types";

export default defineStackbitConfig({
  stackbitVersion: "~0.6.0", // Correct syntax
  nodeVersion: "20.18.1", // Corrected Node.js version
  modelExtensions: [
    {
      name: "Invoice", // Ensure this matches the model name in your content source
      type: "page",
      urlPath: "/invoices/{slug}",
    },
  ],
  siteMap: ({ documents }) => {
    return documents
      .filter((doc) => doc.modelName === "Invoice") // Filter for relevant content types
      .map((document) => {
        const slug = document.fields?.slug || "unknown-slug";
        return {
          stableId: document.id,
          urlPath: `/invoices/${slug}`, // Construct valid URLs
          document,
        };
      });
  },

});
