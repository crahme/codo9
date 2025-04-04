// src/utils/content.js
import { createClient } from 'contentful';

// --- Contentful Client Setup ---
const space = process.env.CONTENTFUL_SPACE_ID;
// Prioritize Preview token for Visual Editor/Dev, fallback to Delivery token for production builds
const accessToken = process.env.CONTENTFUL_PREVIEW_TOKEN || process.env.CONTENTFUL_ACCESS_TOKEN;
const host = process.env.CONTENTFUL_PREVIEW_TOKEN
  ? 'preview.contentful.com'
  : undefined; // undefined uses default delivery host

if (!space || !accessToken) {
  console.error(
    'Contentful Space ID and Access Token must be provided via environment variables.'
  );
  // Optionally throw an error to prevent builds without credentials
  // throw new Error('Missing Contentful credentials');
}

// Initialize client only if credentials exist
const client = (space && accessToken) ? createClient({
  space: space,
  accessToken: accessToken,
  host: host,
}) : null;

// --- Content Type IDs ---
// Best Practice: Use Environment Variables (adjust defaults if needed)
const CONTENTFUL_HOMEPAGE_TYPE_ID = process.env.CONTENTFUL_HOMEPAGE_TYPE_ID || 'homePage';
const CONTENTFUL_INVOICE_TYPE_ID = process.env.CONTENTFUL_INVOICE_TYPE_ID || 'invoice';
// *** IMPORTANT: Verify 'page' is the correct ID for your default/generic pages ***
const CONTENTFUL_DEFAULT_PAGE_TYPE_ID = process.env.CONTENTFUL_PAGE_TYPE_ID || 'page';

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
    // Ensure client was initialized
    if (!client) {
        console.error("[content.js] Contentful client not initialized. Missing credentials?");
        return null;
    }

    if (slug === undefined || slug === null) {
        console.warn('[content.js] getPageFromSlug called with invalid slug.');
        return null;
    }

    let typeToQuery = contentType;
    let slugForQuery = slug; // Use this for the actual query filter value

    // 1. Determine Content Type if not explicitly provided
    if (!typeToQuery) {
        if (slug === '/') {
            typeToQuery = CONTENTFUL_HOMEPAGE_TYPE_ID;
            // Keep slugForQuery as '/', we won't filter by it for homepage
        } else if (slug.startsWith('/invoices/')) {
            typeToQuery = CONTENTFUL_INVOICE_TYPE_ID;
            // *** ASSUMPTION: Invoice slugs in Contentful DO NOT start with /invoices/ ***
            slugForQuery = slug.substring('/invoices/'.length);
            if (!slugForQuery) {
                console.warn(`[content.js] Invalid invoice slug detected: ${slug}`);
                return null; // Avoid querying with an empty slug
            }
        } else {
            // Fallback for other slugs (e.g., /about, /contact)
            typeToQuery = CONTENTFUL_DEFAULT_PAGE_TYPE_ID;
            // *** ASSUMPTION: Default page slugs in Contentful DO NOT start with / ***
            // If URL is /about, query for 'about'. Adjust if your slugs include '/'.
            slugForQuery = slug.startsWith('/') ? slug.substring(1) : slug;
        }
    } else {
        // Content Type *was* provided, adjust slug format based on type if needed
        if (typeToQuery === CONTENTFUL_HOMEPAGE_TYPE_ID) {
            slugForQuery = '/'; // Set expected query value, though we might not filter by it
        } else if (typeToQuery === CONTENTFUL_INVOICE_TYPE_ID && slug.startsWith('/invoices/')) {
            // *** ASSUMPTION: Invoice slugs in Contentful DO NOT start with /invoices/ ***
            slugForQuery = slug.substring('/invoices/'.length);
        } else {
            // *** ASSUMPTION: Default page slugs in Contentful DO NOT start with / ***
             slugForQuery = slug.startsWith('/') ? slug.substring(1) : slug;
        }
    }

    // Defensive check if somehow typeToQuery is still missing
    if (!typeToQuery) {
        console.error(`[content.js] Could not determine content type for input slug: ${slug}`);
        return null;
    }

    console.log(`[content.js] Attempting to query Contentful: type='${typeToQuery}', inputSlug='${slug}', querySlug='${slugForQuery}'`);

    // *** The ENTIRE try...catch block MUST be INSIDE the function ***
    try {
        // Build the query object dynamically
        const queryOptions = {
            content_type: typeToQuery,
            limit: 1,
            include: 2, // Adjust include level if needed (e.g., for linked sections)
        };

        // *** IMPORTANT: Add slug filter ONLY if it's NOT the homepage type ***
        // Because the homepage type doesn't have a 'slug' field.
        if (typeToQuery !== CONTENTFUL_HOMEPAGE_TYPE_ID) {
            // Only add the slug filter for invoices, default pages, etc.
            queryOptions['fields.slug'] = slugForQuery; // Query the 'slug' field
            console.log(`[content.js] Applying filter: fields.slug = ${slugForQuery}`);
        } else {
            console.log(`[content.js] Querying homepage type '${typeToQuery}', skipping slug filter.`);
            // For the homepage type, we simply fetch the first (presumably only) entry
            // of that content type without filtering by a non-existent slug.
        }

        // Execute the query using the dynamically built options
        const entries = await client.getEntries(queryOptions);

        if (entries.items && entries.items.length > 0) {
            console.log(`[content.js] Found entry for type='${typeToQuery}', input slug='${slug}'`);
            return entries.items[0]; // Return the first matching entry
        } else {
            console.warn(`[content.js] No entry found for type='${typeToQuery}', input slug='${slug}' (query options: ${JSON.stringify(queryOptions)})`);
            return null;
        }
    } catch (error) {
        // Improved error logging
        console.error(`[content.js] Error fetching entry from Contentful for input slug '${slug}':`, error.message);
        // Check for specific error details if available (ContentfulError has response)
        if (error.response?.data) {
            console.error('[content.js] Contentful Error Details:', JSON.stringify(error.response.data, null, 2));
            // Add specific hints based on common errors
            if (error.response.data.message?.includes('unknown field') || error.response.data.message?.includes('No field with id')) {
                 console.error(`[content.js] HINT: Check if the field being queried (e.g., 'slug') exists on the Content Type '${typeToQuery}' in Contentful.`);
            }
            if (error.response.data.message?.includes('unknownContentType')) {
                console.error(`[content.js] HINT: The resolved content type ID '${typeToQuery}' might be incorrect or does not exist in Contentful space '${space}'. Verify CONTENTFUL_*_TYPE_ID variables/defaults.`);
            }
        } else {
            // Log the generic error object if no response data is available
            console.error('[content.js] Full Error Object:', error);
        }
        return null; // Return null on error to allow pages to use notFound()
    }
    // End of try...catch block

} // <--- END of getPageFromSlug function body brace }

// --- Optional: Add other utility functions if needed ---
// e.g., export async function getAllInvoices() { ... }
// e.g., export async function getGlobalSettings() { ... }
