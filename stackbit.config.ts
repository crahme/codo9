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
  if (!Array.isArray(documents)) return [];

  const entries = documents
    .filter((doc) => doc && doc.modelName && (doc.modelName === 'page' || doc.modelName === 'invoice'))
    .map((document) => {
      const entryId = document.id;
      const slugField = document.fields?.slug;

      let slug: string | undefined;
      if (typeof slugField === 'string') slug = slugField;
      else if (typeof slugField === 'object' && slugField !== null) {
        const firstLocale = Object.keys(slugField)[0];
        slug = slugField[firstLocale];
      }

      if (!entryId || !slug) return null; // may return null here

      let urlPath = '/';
      let isHomePage = false;

      if (document.modelName === 'page') {
        urlPath = slug.startsWith('/') ? slug : `/${slug}`;
        isHomePage = urlPath === '/';
      } else if (document.modelName === 'invoice') {
        const cleanSlug = slug.startsWith('/') ? slug.substring(1) : slug;
        urlPath = `/invoice/${cleanSlug}`;
      }

      return {
        stableId: entryId,
        label: document.fields?.title || slug,
        urlPath,
        isHomePage,
      };
    });

  // Filter out any null entries explicitly
  const validEntries = entries.filter((e): e is { stableId: string; label: string; urlPath: string; isHomePage: boolean } => e !== null);

  return validEntries;
},

});
