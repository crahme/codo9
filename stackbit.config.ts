// stackbit.config.ts
// Changed component models from type: "object" to type: "data"

import { defineStackbitConfig, SiteMapEntry } from "@stackbit/types";
import { ContentfulContentSource } from '@stackbit/cms-contentful';

if (!process.env.CONTENTFUL_SPACE_ID) {
  throw new Error('Stackbit requires CONTENTFUL_SPACE_ID environment variable');
}
if (!process.env.CONTENTFUL_PREVIEW_TOKEN) {
  throw new Error('Stackbit requires CONTENTFUL_PREVIEW_TOKEN environment variable');
}
if (!process.env.CONTENTFUL_MANAGEMENT_TOKEN) {
  console.warn('Stackbit: CONTENTFUL_MANAGEMENT_TOKEN environment variable is missing, editor functionality might be limited.');
}

export default defineStackbitConfig({
  stackbitVersion: '~0.6.0',
  nodeVersion: '20.18.1',

  contentSources: [
    new ContentfulContentSource({
      spaceId: process.env.CONTENTFUL_SPACE_ID!,
      environment: process.env.CONTENTFUL_ENVIRONMENT || 'master',
      previewToken: process.env.CONTENTFUL_PREVIEW_TOKEN!,
      accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN!,
    }),
  ],

  modelExtensions: [
    {
      name: 'page',        // Page type
      type: 'page',
      urlPath: '/{slug}',
    },
    {
      name: 'invoice',     // Page type
      type: 'page',
      urlPath: '/invoices/{slug}',
    },
    // --- Change type to "data" for component/data models ---
    { name: 'hero', type: 'data' },
    { name: 'stats', type: 'data' },
    { name: 'button', type: 'data' },
    { name: 'statItem', type: 'data' },
    // --- End change ---
  ],

  // Keep siteMap function for now
  siteMap: ({ documents }) => {
    if (!Array.isArray(documents)) {
        console.warn('[siteMap] Received non-array or undefined documents. Returning empty map.');
        return [];
    }
    const entries: SiteMapEntry[] = documents
      .filter((doc) =>{
        const isSupportedModel = ['page', 'invoice'].includes(doc.modelName);
        if (!isSupportedModel) {
          console.warn(`[siteMap] Unsupported model type: ${doc.modelName}, skipping.`);
        }
        return isSupportedModel;
      })
      .map((document) => {
        const slug = document.fields?.slug as string | undefined;
        const title = document.fields?.title as string | undefined;
        const entryId = document.sys?.id;
        if (!entryId || typeof slug === 'undefined') {
            console.warn(`[siteMap] Document ${entryId || 'UNKNOWN'} missing ID or slug, skipping:`, document?.modelName);
            return null;
        }
        let urlPath: string | null = null;
        let isHomePage = false;
        if (document.modelName === 'page') {
          urlPath = slug === '/' ? '/' : `/${slug.startsWith('/') ? slug.substring(1) : slug}`;
          isHomePage = slug === '/';
        } else if (document.modelName === 'invoice') {
          urlPath = `/invoices/${slug.startsWith('/') ? slug.substring(1) : slug}`;
        }
        if (!urlPath) {
            console.warn(`[siteMap] Could not determine urlPath for document:`, entryId, document.modelName);
            return null;
        }
        return {
          stableId: entryId,
          label: title || slug,
          urlPath: urlPath,
          isHomePage: isHomePage,
        };
      })
      .filter((entry): entry is SiteMapEntry => entry !== null);
      console.log(`[siteMap] Generated ${entries.length} site map entries.`);
      return entries;
  },

});
