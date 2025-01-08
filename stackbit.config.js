import { ContentfulContentSource } from '@stackbit/cms-contentful';

const config = {
  stackbitVersion: '~0.6.0',
  ssgName: 'nextjs',
  nodeVersion: '20.18.1',
  contentSources: [
    new ContentfulContentSource({
      spaceId: process.env.CONTENTFUL_SPACE_ID,
      environment: process.env.CONTENTFUL_ENVIRONMENT || 'master',
      previewToken: process.env.CONTENTFUL_PREVIEW_TOKEN,
      accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN,
    }),
  ],
  modelExtensions: [{ name: 'page', type: 'page', urlPath: '/{slug}' }],
  // Needed only for importing this repository via https://app.stackbit.com/import?mode=duplicate
  import: {
    type: 'contentful',
    contentFile: 'contentful/export.json',
    uploadAssets: true,
    assetsDirectory: 'contentful',
    spaceIdEnvVar: 'CONTENTFUL_SPACE_ID',
    deliveryTokenEnvVar: 'CONTENTFUL_DELIVERY_TOKEN',
    previewTokenEnvVar: 'CONTENTFUL_PREVIEW_TOKEN',
    accessTokenEnvVar: 'CONTENTFUL_MANAGEMENT_TOKEN',
  },
   modelExtensions: [
    // Extend the "Page" and "Post" models by defining them as page models
    { name: "Untitled", type: "Invoice" }
  ]
};

export default config;

// stackbit.config.ts new from content modeling for VE
import { defineStackbitConfig } from "@stackbit/types";

export default defineStackbitConfig({
  // ...
  modelExtensions: [
    // Extend the "Page" and "Post" models by defining them as page models
    { name: "Page", type: "page" },
    { name: "Post", type: "page" }
  ]
});

// stackbit.config.ts connect page models to page URL 
import { defineStackbitConfig, SiteMapEntry } from "@stackbit/types";

export default defineStackbitConfig({
  // ...
  modelExtensions: [
    // Static URL paths derived from the model's "slug" field
    { name: "Page", type: "page", urlPath: "/{slug}" },
    { name: "Post", type: "page", urlPath: "/blog/{slug}" }
  ]
  siteMap: ({ documents, models }) => {
    // 1. Filter all page models which were defined in modelExtensions
    const pageModels = models.filter((m) => m.type === "page")

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
