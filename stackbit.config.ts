// stackbit.config.ts
// Further refined siteMap for netlify dev log structure
import 'dotenv/config'; // Ensure dotenv is loaded to access environment variables
import {  defineStackbitConfig } from '@stackbit/types';
import { ContentfulContentSource } from '@stackbit/cms-contentful';
// --- Environment Variable Checks --- (Keep as before)
if (!process.env.CONTENTFUL_SPACE_ID) {
  console.warn('Warning: CONTENTFUL_SPACE_ID is not set in environment variables. Contentful integration may fail.');
}
if (!process.env.CONTENTFUL_PREVIEW_TOKEN) {
  console.warn('Warning: CONTENTFUL_PREVIEW_TOKEN is not set in environment variables. Contentful preview API access may fail.');
}
if (!process.env.CONTENTFUL_MANAGEMENT_TOKEN) {
  console.warn('Warning: CONTENTFUL_MANAGEMENT_TOKEN is not set in environment variables. Contentful management API access may fail.');
}
// --- End Environment Variable Checks ---

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

     { name: 'page', type: 'page', urlPath: '/{slug}' },
    { name:'invoice', type: 'page', urlPath: '/invoice/{slug}' },

    { name: 'hero', type: 'data' },
    { name: 'stats', type: 'data' },
    { name: 'button', type: 'data' },
    { name: 'statItem', type: 'data' },
    { name: 'invoiceSection', type: 'data' }, // Only if it exists
  ],

  siteMap: ({ documents }) => {
    if (!Array.isArray(documents)) {
      console.warn('[siteMap] Documents data is not an array. Returning empty map.');
      return [];
    }

    const entries = documents
      .filter((doc) => {
        // Filter for documents that are page models and have the necessary fields structure
        const isPageModel = doc && doc.modelName && (doc.modelName === 'page' || doc.modelName === 'invoice');
        const hasFields = doc && typeof doc.fields === 'object' && doc.fields !== null;
        return isPageModel && hasFields;
      })
      .map((document) => {
        const entryId = document.id as string | undefined; // Top-level ID from debug log
        const slugField = document.fields.slug;
        // Handle both direct string and localized object cases
        const slug =
          typeof slugField === 'string'
            ? slugField
            : typeof slugField === 'object' && slugField !== null && 'en' in slugField
              ? ((slugField as unknown) as { [locale: string]: string })['en']
              : undefined;

        const titleField = document.fields.title; // title might also be an object with 'value'
        const title = (typeof titleField === 'object' && titleField !== null && 'value' in titleField ? titleField.value : titleField) as string | undefined;

        if (!entryId || typeof slug !== 'string') { // Ensure slug is a string
          console.warn(`[siteMap] Skipping document: Missing ID or valid slug string. Model: ${document.modelName}, ID: ${entryId || 'UNKNOWN'}, Slug: ${slug}`);
          return null;
        }

        let urlPath: string | null = null;
        let isHomePage = false;

        if (document.modelName === 'page') {
          const cleanSlug = slug.startsWith('/') && slug.length > 1 ? slug.substring(1) : slug;
          urlPath = cleanSlug === '/' ? '/' : `/${cleanSlug}`;
          isHomePage = cleanSlug === '/';
        } else if (document.modelName === 'invoice') {
          const cleanSlug = slug.startsWith('/') ? slug.substring(1) : slug;
          urlPath = `/invoice/${cleanSlug}`;
        }

        if (!urlPath) {
          console.warn(`[siteMap] Could not determine urlPath for document: ID ${entryId}, Model ${document.modelName}`);
          return null;
        }

        return {
          stableId: entryId,
          label: title || slug,
          urlPath: urlPath,
          isHomePage: isHomePage,
        };
      })
      .filter((entry): entry is { stableId: string; label: string; urlPath: string; isHomePage: boolean } => entry !== null);

    console.log(`[siteMap] Generated ${entries.length} site map entries.`);
    if (entries.length > 0) {
        console.log('[siteMap] First generated entry:', entries[0]);
    } else {
        console.warn("[siteMap] No entries generated. Check filtering and data structure assumptions. Sample input documents (first 3):", documents.slice(0,3).map(d => ({ id: d.id, modelName: d.modelName, fields: d.fields })));
    }
    return entries;
  },
});
