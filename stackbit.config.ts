// stackbit.config.ts
// Attempting explicit Contentful source definition for Netlify VE

import { defineStackbitConfig } from '@stackbit/types';
// Ensure this package is installed: npm install @stackbit/cms-contentful --save-dev
import { ContentfulContentSource } from '@stackbit/cms-contentful/node';
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
// Ensure required environment variables are available
if (!process.env.CONTENTFUL_SPACE_ID) {
  throw new Error('CONTENTFUL_SPACE_ID environment variable is required');
}
if (!process.env.CONTENTFUL_PREVIEW_TOKEN) {
  throw new Error('CONTENTFUL_PREVIEW_TOKEN environment variable is required');
}
// Management token is often needed for full schema access/metadata
if (!process.env.CONTENTFUL_MANAGEMENT_TOKEN) {
  // You might make this optional depending on exact needs, but VE likely needs it
  console.warn('CONTENTFUL_MANAGEMENT_TOKEN environment variable is missing, editor functionality might be limited.');
  // Consider throwing an error if it proves necessary:
  // throw new Error('CONTENTFUL_MANAGEMENT_TOKEN environment variable is required');
}


export default defineStackbitConfig({
  stackbitVersion: '~0.6.0', // Or the version specified in your package.json
  nodeVersion: '20.18.1', // Or your preferred version

  // Explicitly define Contentful as the content source
  contentSources: [
    new ContentfulContentSource({
      spaceId: process.env.CONTENTFUL_SPACE_ID,
      environment: process.env.CONTENTFUL_ENVIRONMENT || 'master',
      previewToken: process.env.CONTENTFUL_PREVIEW_TOKEN,
      // Use the Management token (PAT) here - often required by Stackbit for schema/metadata
      accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN!, // Add '!' if you know it's required and checked above
    }),
  ],

  // Define which Contentful models represent site pages and their URL structure
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
    // Component/object types
    { name: 'hero', type: 'object' },
    { name: 'stats', type: 'object' },
    { name: 'button', type: 'object' },
    { name: 'statItem', type: 'object' },
  ],

  // Keep siteMap commented out initially to rely on urlPath inference
  /*
  siteMap: ({ documents }) => {
    // ... (your siteMap logic if needed later) ...
  },
  */

  // Do NOT include the 'assets' block for now, as it caused errors before in the VE context
  // assets: { ... }

});
