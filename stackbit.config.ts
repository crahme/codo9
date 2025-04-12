// stackbit.config.ts
// Corrected version with explicit source and siteMap, ensuring single default export

import { defineStackbitConfig, SiteMapEntry } from "@stackbit/types";
// Ensure these packages are installed:
// npm install @stackbit/types --save-dev
// npm install @stackbit/cms-contentful --save-dev
import { ContentfulContentSource } from '@stackbit/cms-contentful'; // Correct import path

// --- Environment Variable Checks ---
if (!process.env.CONTENTFUL_SPACE_ID) {
  throw new Error('Stackbit requires CONTENTFUL_SPACE_ID environment variable');
}
if (!process.env.CONTENTFUL_PREVIEW_TOKEN) {
  throw new Error('Stackbit requires CONTENTFUL_PREVIEW_TOKEN environment variable');
}
// Management token is often needed for full schema access/metadata
if (!process.env.CONTENTFUL_MANAGEMENT_TOKEN) {
  console.warn('Stackbit: CONTENTFUL_MANAGEMENT_TOKEN environment variable is missing, editor functionality might be limited.');
  // If needed, throw error: throw new Error('Stackbit requires CONTENTFUL_MANAGEMENT_TOKEN');
}
// --- End Environment Variable Checks ---


// --- THE ONLY DEFAULT EXPORT SHOULD START HERE ---
export default defineStackbitConfig({
  stackbitVersion: '~0.6.0',
  nodeVersion: '20.18.1',

  // Explicitly define Contentful as the content source
  contentSources: [
    new ContentfulContentSource({
      spaceId: process.env.CONTENTFUL_SPACE_ID,
      environment: process.env.CONTENTFUL_ENVIRONMENT || 'master',
      previewToken: process.env.CONTENTFUL_PREVIEW_TOKEN,
      // Use the Management token (PAT) here
      accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN!,
    }),
  ],

  // Define page models and their URL structure
  modelExtensions: [
    {
      name: 'page',        // EXACT Contentful ID
      type: 'page',
      urlPath: '/{slug}',
    },
    {
      name: 'invoice',     // EXACT Contentful ID
      type: 'page',
      urlPath: '/invoices/{slug}',
    },
    // Define component/object models
    { name: 'hero', type: 'object' },
    { name: 'stats', type: 'object' },
    { name: 'button', type: 'object' },
    { name: 'statItem', type: 'object' },
  ],

  // Explicit siteMap function
  siteMap: ({ documents }) => {
    // Ensure documents is an array before proceeding
    if (!Array.isArray(documents)) {
        console.warn('[siteMap] Received non-array or undefined documents. Returning empty map.');
        return [];
    }

    const entries: SiteMapEntry[] = documents
      .filter((doc) => {
        // Filter for documents that match our page model names
        return doc.modelName === 'page' || doc.modelName === 'invoice';
      })
      .map((document) => {
        // Check required fields for mapping safely
        const slug = document.fields?.slug as string | undefined;
        const title = document.fields?.title as string | undefined;
        const entryId = document.sys?.id;

        if (!entryId || typeof slug === 'undefined') { // Check slug explicitly for undefined, allow empty string? Maybe not for page.
            console.warn(`[siteMap] Document ${entryId || 'UNKNOWN'} missing ID or slug, skipping:`, document?.modelName);
            return null;
        }

        let urlPath: string | null = null;
        let isHomePage = false;

        // Determine URL based on model type
        if (document.modelName === 'page') {
          // Assuming page slugs ('about') don't start with /, but homepage slug IS '/'
          urlPath = slug === '/' ? '/' : `/${slug}`;
          isHomePage = slug === '/';
        } else if (document.modelName === 'invoice') {
          // Assuming invoice slugs ('inv-001') don't start with /
          urlPath = `/invoices/${slug}`;
        }

        if (!urlPath) {
            console.warn(`[siteMap] Could not determine urlPath for document:`, entryId, document.modelName);
            return null;
        }

        return {
          stableId: entryId,
          label: title || slug, // Use title if available (for Page), otherwise slug
          urlPath: urlPath,
          isHomePage: isHomePage,
        };
      })
      // Filter out any null entries from skipped documents
      .filter((entry): entry is SiteMapEntry => entry !== null);

      console.log(`[siteMap] Generated ${entries.length} site map entries.`);
      return entries;
  },

});
// --- ENSURE NO OTHER 'export default' BELOW THIS LINE ---
