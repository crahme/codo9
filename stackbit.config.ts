import { defineStackbitConfig, SiteMapEntry } from "@stackbit/types";

export default defineStackbitConfig({
  stackbitVersion: "~0.6.0", // Correct syntax
  nodeVersion: "20.18.1", // Fixed missing colon and trailing period
  modelExtensions: [
    // Static URL paths derived from the model's "slug" field
    { name: "Invoice", type: "page", urlPath: "/invoices/{slug}" },
  ],
  siteMap: ({ documents, models }) => {
    // 1. Filter all page models which were defined in modelExtensions
    const pageModels = models.filter((m) => m.type === "page");

    return documents
      // 2. Filter all documents which are of a page model
      .filter((d) => pageModels.some((m) => m.name === d.modelName))
      // 3. Map each document to a SiteMapEntry
      .map((document) => {
        const modelName = document.modelName || "Invoice";
        const slug = document.fields?.slug || "https://app.contentful.com/spaces/t3t3mhakehxg/ent…";
        const urlPath = modelName === "Invoice" ? `/invoices/${slug}` : null;

        // Map the model name to its corresponding URL
         if (!urlPath) {
          // Skip if URL path cannot be determined
          return null;
        }


        return {
          stableId: document.id,
          urlPath,
          document,
          isHomePage: false,
        };
      })
      .filter(Boolean) as SiteMapEntry[];
  },
});
