// stackbit.config.ts
import { defineStackbitConfig, SiteMapEntry } from "@stackbit/types";
// Make sure you install @stackbit/types if not already: npm install @stackbit/types --save-dev

export default defineStackbitConfig({
  stackbitVersion: "~0.6.0",
  nodeVersion: "20.18.1",

  // Define which Contentful models represent site pages
  // We keep urlPath here as well, it sometimes helps internally
  modelExtensions: [
    {
      name: "page",        // EXACT Contentful ID
      type: "page",
      urlPath: "/{slug}",
    },
    {
      name: "invoice",     // EXACT Contentful ID
      type: "page",
      urlPath: "/invoices/{slug}",
    },
    // Component/object types (optional but can help editor UI)
    { name: "hero", type: "object" },
    { name: "stats", type: "object" },
    { name: "button", type: "object" },
    { name: "statItem", type: "object" },
  ],

  // --- ADDING siteMap function ---
  // Explicitly tell Stackbit how to build the list of navigable pages
  // NOTE: This function runs in the Stackbit service, using PREVIEW token data
  siteMap: ({ documents }) => {
    const entries: SiteMapEntry[] = documents
      .filter((doc) => {
        // Filter for documents that match our page model names
        return doc.modelName === 'page' || doc.modelName === 'invoice';
      })
      .map((document) => {
        const slug = document.fields?.slug as string | undefined;
        const title = document.fields?.title as string | undefined; // For Page type label
        let urlPath: string | null = null;
        let isHomePage = false;

        // Check required fields for mapping
        if (!document.sys?.id || !slug) {
            console.warn(`[siteMap] Document missing ID or slug, skipping:`, document);
            return null;
        }

        // Determine URL based on model type
        if (document.modelName === 'page') {
          // Handle homepage slug vs other page slugs
          urlPath = slug === '/' ? '/' : `/${slug.startsWith('/') ? slug.substring(1) : slug}`; // Assuming slugs don't start with / except homepage
          isHomePage = slug === '/';
        } else if (document.modelName === 'invoice') {
          urlPath = `/invoices/${slug.startsWith('/') ? slug.substring(1) : slug}`; // Assuming invoice slugs don't start with /
        }

        // Skip if we couldn't determine a URL
        if (!urlPath) {
            console.warn(`[siteMap] Could not determine urlPath for document:`, document);
            return null;
        }

        return {
          stableId: document.sys.id,
          label: title || slug, // Use title if available (for Page), otherwise slug
          urlPath: urlPath,
          isHomePage: isHomePage,
          // Pass the document object if needed by specific editor features
          // document: document
        };
      })
      // Filter out any null entries from skipped documents
      .filter((entry): entry is SiteMapEntry => entry !== null);

      console.log(`[siteMap] Generated ${entries.length} site map entries.`);
      return entries;
  },

});
