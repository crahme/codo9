import { ContentfulContentSource } from "@stackbit/cms-contentful";

import { defineStackbitConfig, SiteMapEntry } from "@stackbit/types";


export default defineStackbitConfig({
  new ContentfulContentSource({
  spaceId: process.env.CONTENTFUL_SPACE_ID!,
  environment: process.env.CONTENTFUL_ENVIRONMENT!,
  previewToken: process.env.CONTENTFUL_PREVIEW_TOKEN!,
  accessToken: process.env.CONTENTFUL_ACCESS_TOKEN!,
  useWebhookForContentUpdates: true
});
  stackbitVersion: "~0.6.0",
  nodeVersion: "20.18.1", // Fixed typo "nodeVersiob" to "nodeVersion" and replaced "." with ","
  modelExtensions: [
    // Static URL paths derived from the model's "slug" field
    { name: "Untitled", type: "Invoice", urlPath: "/{slug}/"}
  ],
  siteMap: ({ documents, models }) => {
    // 1. Filter all page models which were defined in modelExtensions
    const pageModels = models.filter((m) => m.type === "Invoice");

    return documents
      // 2. Filter all documents which are of a page model
      .filter((d) => pageModels.some((m) => m.name === d.modelName))
      // 3. Map each document to a SiteMapEntry
      .map((document) => {
        // Map the model name to its corresponding URL
        const urlModel = (() => {
          switch (document.modelName) {
            case "Invoice":
              return "OtherInvoice";
            default:
              return null;
          }
        })();

        if (!urlModel) return null; // Ensure we filter out invalid mappings

        return {
          stableId: document.id,
          urlPath: `/${urlModel}/${document.id}`,
          document,
          isHomePage: false,
        };
      })
      .filter(Boolean) as SiteMapEntry[];
  },
});
