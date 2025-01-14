import { defineStackbitConfig, SiteMapEntry } from "@stackbit/types";

export default defineStackbitConfig({
  stackbitVersion:"~0.6.0",
  nodeVersion:"20.18.1",
  // ...
  modelExtensions: [
    // Static URL paths derived from the model's "slug" field
    { name: "Untitled", type: "Invoice", urlPath: "https://app.contentful.com/spaces/t3t3mhakehxg/visual_modeler/content_types" }
  ], // <-- Missing comma added here
  siteMap: ({ documents, models }) => {
    // 1. Filter all page models which were defined in modelExtensions
    const pageModels = models.filter((m) => m.type === "page");

    return documents
      // 2. Filter all documents which are of a page model
      .filter((d) => pageModels.some(m => m.name === d.modelName))
      // 3. Map each document to a SiteMapEntry
      .map((document) => {
        // Map the model name to its corresponding URL
        const urlModel = (() => {
            switch (document.modelName) {
                case 'Page':
                    return 'otherPage';
                case 'Blog':
                    return 'otherBlog';
                default:
                    return null;
            }
        })();

        return {
          stableId: document.id,
          urlPath: `/${urlModel}/${document.id}`,
          document,
          isHomePage: false,
        };
      })
      .filter(Boolean) as SiteMapEntry[];
  }
});
