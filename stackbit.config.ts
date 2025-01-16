import { defineStackbitConfig, SiteMapEntry } from "@stackbit/types";

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

