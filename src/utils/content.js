// src/utils/content.js
import { createClient } from 'contentful';

// --- Contentful Client Setup ---
// Ensure this uses the correct credentials.
// For Visual Editor/Previews, PREVIEW_TOKEN is usually needed.
// For production builds, ACCESS_TOKEN (Delivery) is often used.
// Consider checking process.env.NODE_ENV or specific preview flags.
const space = process.env.CONTENTFUL_SPACE_ID;
const accessToken = process.env.CONTENTFUL_PREVIEW_TOKEN // Use Preview for Visual Editor
  || process.env.CONTENTFUL_ACCESS_TOKEN; // Fallback to Delivery
const host = process.env.CONTENTFUL_PREVIEW_TOKEN
  ? 'preview.contentful.com'
  : undefined; // Use default delivery host if not preview

if (!space || !accessToken) {
  throw new Error(
    'Contentful Space ID and Access Token must be provided via environment variables.'
  );
}

const client = createClient({
  space: space,
  accessToken: accessToken,
  host: host,
});

// --- Content Type IDs (Best Practice: Use Environment Variables) ---
const CONTENTFUL_HOMEPAGE_TYPE_ID = process.env.CONTENTFUL_HOMEPAGE_TYPE_ID || 'homePage';
const CONTENTFUL_INVOICE_TYPE_ID = process.env.CONTENTFUL_INVOICE_TYPE_ID || 'invoice';
// Add a default page type if you have one for generic slugs like /about, /contact etc.
const CONTENTFUL_DEFAULT_PAGE_TYPE_ID = process.env.CONTENTFUL_PAGE_TYPE_ID || 'page'; // *** ADJUST 'page' if your default page type has a different ID ***

/**
 * Fetches a single Contentful entry based on its slug.
 * Intelligently determines the content type based on the slug pattern
 * if no explicit contentType is provided.
 *
 * @param {string} slug - The URL slug (e.g., "/", "/about", "/invoices/inv-001").
 * @param {string} [contentType] - Optional: Explicitly specify the Contentful Content Type ID.
 * @returns {Promise<object|null>} - The Contentful entry object or null if not found or on error.
 */
export async function getPageFromSlug(slug, contentType) {
  if (!slug) {
    console.warn('getPageFromSlug called with empty or null slug.');
    return null;
  }

  let typeToQuery = contentType;
  let slugForQuery = slug;

  // 1. Determine Content Type if not explicitly provided
  if (!typeToQuery) {
    if (slug === '/') {
      typeToQuery = CONTENTFUL_HOMEPAGE_TYPE_ID;
      // Keep slugForQuery as '/' - assuming the homepage entry's slug field IS "/"
    } else if (slug.startsWith('/invoices/')) {
      typeToQuery = CONTENTFUL_INVOICE_TYPE_ID;
      // Extract the part AFTER /invoices/ for the query
      slugForQuery = slug.substring('/invoices/'.length);
      if (!slugForQuery) {
         console.warn(`Invalid invoice slug detected: ${slug}`);
         return null; // Avoid querying with an empty slug
      }
    } else {
      // Fallback for other slugs (e.g., /about, /contact)
      typeToQuery = CONTENTFUL_DEFAULT_PAGE_TYPE_ID;
      // Adjust slug format if Contentful stores them without leading slash
      // Example: If URL is /about, but Contentful slug field is just 'about'
      slugForQuery = slug.startsWith('/') ? slug.substring(1) : slug; // Adjust this line if needed!
    }
  } else {
     // Content Type *was* provided, ensure slug format matches Contentful storage
     if (slug === '/') {
       slugForQuery = '/'; // Assume homepage slug is stored as '/'
     } else if (typeToQuery === CONTENTFUL_INVOICE_TYPE_ID && slug.startsWith('/invoices/')) {
       // If type invoice was passed explicitly, still extract the core slug
       slugForQuery = slug.substring('/invoices/'.length);
     } else {
       // For other explicit types, adjust slug if needed (e.g., remove leading '/')
       slugForQuery = slug.startsWith('/') ? slug.substring(1) : slug; // Adjust if needed!
     }
  }

  // Defensive check if somehow typeToQuery is still missing
  if (!typeToQuery) {
      console.error(`Could not determine content type for slug: ${slug}`);
      return null;
  }

  console.log(`[content.js] Querying Contentful: type='${typeToQuery}', slug='${slugForQuery}'`); // For debugging

  try {
    const entries = await client.getEntries({
      content_type: typeToQuery,
      'fields.slug': slugForQuery, // Query the 'slug' field
      limit: 1, // We expect only one entry per unique slug/type combo
      include: 2, // Include linked entries (adjust level if needed)
    });

    if (entries.items && entries.items.length > 0) {
      // Return the first matching entry
      // The structure is likely { sys: { id: ... }, fields: { ... } }
      return entries.items[0];
    } else {
      console.warn(`[content.js] No entry found for type='${typeToQuery}', slug='${slugForQuery}'`);
      return null;
    }
  } catch (error) {
    console.error(`[content.js] Error fetching entry from Contentful for input slug '${slug}':`, error.message);
    // Provide more context if it's an unknown content type error
    if (error.response?.data?.message?.includes('unknownContentType') || error.message?.includes('unknown content type')) {
         console.error(`[content.js] The resolved content type ID '${typeToQuery}' might be incorrect or does not exist in Contentful space '${space}'.`);
    }
    return null; // Return null on error to allow pages to trigger notFound()
  }
}

// --- Optional: Add other utility functions if needed ---
// e.g., function getAllInvoices() { ... }
// e.g., function getGlobalSettings() { ... }
