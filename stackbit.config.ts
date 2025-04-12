// stackbit.config.ts
// Corrected import path for ContentfulContentSource

import { defineStackbitConfig } from '@stackbit/types';
// Use the main package export, not the '/node' subpath
import { ContentfulContentSource } from '@stackbit/cms-contentful';

// Ensure required environment variables are available for Stackbit service
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

  // Keep siteMap commented out unless proven necessary
  /*
  siteMap: ({ documents }) => {
    // ...
  },
  */
});
