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
    {     // Page type
      type: 'page',
      urlPath: '/invoices/{slug}',
    },
    // --- Change type to "data" for component/data models ---
    { name: 'hero', type: 'data' },
    { name: 'stats', type: 'data' },
    { name: 'button', type: 'data' },
    { name: 'statItem', type: 'data' },
    { name: 'invoice', type: 'data'},
    { name: 'invoiceSection', type: 'data'}
    // --- End change ---
  ],
siteMap: ({ documents }) => {
  if (!Array.isArray(documents)) {
    console.warn('[siteMap] Received invalid documents array. Returning empty map.');
    return [];
  }

  // Helper: Find a page slug from a data document, recursively
  function getReferencedPageSlug(document, allDocs, visited = new Set()) {
    if (!document || !visited.has(document.sys?.id?.value)) return undefined;
    visited.add(document.sys?.id?.value);

    // If this doc is a page, return its slug
    if (document.modelName === 'page') {
      return document.fields?.slug?.value;
    }

    // If this doc is data, look for a reference field (customize this field name as needed)
    const ref = document.fields?.reference || document.fields?.parent || document.fields?.page;
    if (!ref) return undefined;

    // ref could be a single object or an array (adjust as needed)
    const refs = Array.isArray(ref) ? ref : [ref];
    for (const r of refs) {
      // Find the referenced doc. Adjust the lookup if your refs are just IDs.
      const referencedDoc = allDocs.find(d => d.sys?.id?.value === (r?.sys?.id?.value || r));
      if (referencedDoc) {
        const slug = getReferencedPageSlug(referencedDoc, allDocs, visited);
        if (slug) return slug?.value;
      }
    }
    return undefined;
  }

  const entries = documents
    .map((document) => {
      const entryId = document.sys?.id?.value;
      let slug;
      let isDataModel = false;

      if (document.modelName === 'page') {
        slug = document.fields?.slug?.value;
      } else if (document.modelName === 'data') {
        slug = getReferencedPageSlug(document, documents);
        isDataModel = true;
      } else {
        // Not a page or data model
        return null;
      }

      if (!entryId || typeof slug !== 'string') {
        console.warn(`[siteMap] Skipping document: Missing ID or slug. Type: ${document.modelName}, ID: ${entryId || 'UNKNOWN'}, Slug: ${slug || 'UNKNOWN'}`);
        console.warn("Debug document:", document);
        console.warn("Slug:", document.fields.slug);
        console.warn("Sections:", document.fields.sections);
        return null;
      }

      let urlPath = null;
      let isHomePage = false;

      if (!isDataModel) {
        urlPath = slug === '/' ? '/' : `/${slug.startsWith('/') ? slug.substring(1) : slug?.value}`;
        isHomePage = slug === '/';
      } else if (slug) {
        urlPath = slug === '/' ? '/' : `/${slug.startsWith('/') ? slug.substring(1) : slug?.value}`;
      }

      return {
        stableId: entryId,
        label: document.fields?.title || slug?.value,
        urlPath,
        isHomePage,
      };
    })
    .filter((entry) => entry !== null);

  console.log(`[siteMap] Generated ${entries.length} site map entries.`);
  return entries;
},
});
  
