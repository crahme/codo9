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
  siteMap: ({ documents, modelExtensions }) => {
    if (!documents || !Array.isArray(documents)) {
      console.warn("Documents are undefined or not an array.");
      return [];
    }

    if (!modelExtensions || !Array.isArray(modelExtensions)) {
      console.warn("Model extensions are undefined or not an array.");
      return [];
    }

    // 1. Filter all page models defined in modelExtensions
    const pageModels = modelExtensions.filter((m) => m.type === "page");

    if (pageModels.length === 0) {
      console.warn("No page models found in modelExtensions.");
      return [];
    }

    // 2. Filter and map documents to SiteMapEntry
    return documents
      .filter((d) => pageModels.some((m) => m.name === d.modelName))
      .map((document) => {
        const modelName = document.modelName || "Invoice";
        const slug = document.fields?.slug || "default-slug";
        const urlPath = modelName === "Invoice" ? `/invoices/${slug}` : null;

        if (!urlPath) {
          console.warn(`Skipping document with ID ${document.id} due to missing URL path.`);
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
