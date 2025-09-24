// stackbit.config.ts
import dotenv from 'dotenv';
dotenv.config();
import types from '@stackbit/types';
const { defineStackbitConfig } = types;
// Note: SiteMapEntry is a TypeScript type from @stackbit/types (CJS). If you compile with TS, you can uncomment the next line:
// import type { SiteMapEntry } from '@stackbit/types';
// As a fallback for direct runtime execution without TS, declare a minimal structural type:
type SiteMapEntry = {
  stableId: string;
  label: string;
  urlPath: string;
  isHomePage?: boolean;
};
import { ContentfulContentSource } from '@stackbit/cms-contentful';

// --- Environment Variable Checks ---
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
    { name: 'invoice', type: 'page', urlPath: '/invoice/{slug}' },
    { name: 'hero', type: 'data' },
    { name: 'stats', type: 'data' },
    { name: 'button', type: 'data' },
    { name: 'statItem', type: 'data' },
    { name: 'invoiceSection', type: 'data' },
    {name:'invoicesList', type:'data'}
  ],

  siteMap: ({ documents }) => {
    if (!Array.isArray(documents)) {
      console.warn('[siteMap] Documents data is not an array. Returning empty map.');
      return [];
    }

    const entries: (SiteMapEntry | null)[] = documents
      .filter((doc) => {
        const isPageModel = doc && doc.modelName && (doc.modelName === 'page' || doc.modelName === 'invoice');
        const hasFields = doc && typeof doc.fields === 'object' && doc.fields !== null;
        return isPageModel && hasFields;
      })
      .map((doc) => {
        const entryId = doc.id as string | undefined;
             const slugField = doc.fields.slug;
const slug =
  typeof slugField === 'string'
    ? slugField
    : slugField && typeof slugField === 'object' && 'value' in slugField
    ? (slugField as any).value
    : undefined;

        const titleField = doc.fields.title;
        const title = typeof titleField === 'object' && titleField !== null && 'value' in titleField
          ? titleField.value
          : titleField;

        if (!entryId || typeof slug !== 'string') {
          console.warn(`[siteMap] Skipping document: Missing ID or valid slug string. Model: ${doc.modelName}, ID: ${entryId || 'UNKNOWN'}, Slug: ${slug}`);
          return null;
        }

        let urlPath: string;
        let isHomePage = false;

        if (doc.modelName === 'page') {
          const cleanSlug = slug.startsWith('/') ? slug.substring(1) : slug;
          urlPath = cleanSlug === '' ? '/' : `/${cleanSlug}`;
          isHomePage = cleanSlug === '';
        } else if (doc.modelName === 'invoice') {
          const cleanSlug = slug.startsWith('/') ? slug.substring(1) : slug;
          urlPath = `/invoice/${cleanSlug}`;
        }
        else if (doc.modelName === 'invoicesList') {
          const cleanSlug = slug.startsWith('/') ? slug.substring(1) : slug;
          urlPath = `/invoiceslist/${cleanSlug}`;
       } 
         else {
                return null;
              }
         

        return {
          stableId: entryId,
          label: title || slug,
          urlPath,
          isHomePage,
        } as SiteMapEntry;
      });

    const validEntries: SiteMapEntry[] = entries.filter((e): e is SiteMapEntry => e !== null);

    console.log(`[siteMap] Generated ${validEntries.length} site map entries.`);
    if (validEntries.length > 0) {
      console.log('[siteMap] First generated entry:', validEntries[0]);
    } else {
      console.warn("[siteMap] No entries generated. Check data structure. Sample input documents (first 3):", documents.slice(0, 3));
    }

    return validEntries;
  },
});
