// src/utils/content.js
import { createClient } from 'contentful';

// --- Contentful Client Setup ---
const space = process.env.CONTENTFUL_SPACE_ID;
const accessToken = process.env.CONTENTFUL_PREVIEW_TOKEN || process.env.CONTENTFUL_ACCESS_TOKEN;
const host = process.env.CONTENTFUL_PREVIEW_TOKEN
  ? 'preview.contentful.com'
  : undefined;

if (!space || !accessToken) {
  console.error(
    'Contentful Space ID and Access Token must be provided via environment variables.'
  );
}

const client = (space && accessToken) ? createClient({
  space: space,
  accessToken: accessToken,
  host: host,
}) : null;

// --- Content Type IDs ---
// Define only the types you actually have
const CONTENTFUL_HOMEPAGE_TYPE_ID = process.env.CONTENTFUL_HOMEPAGE_TYPE_ID || 'homePage';
const CONTENTFUL_INVOICE_TYPE_ID = process.env.CONTENTFUL_INVOICE_TYPE_ID || 'invoice';
// NO DEFAULT PAGE TYPE ID NEEDED

/**
 * Fetches a single Contentful entry based on its slug.
 * Determines the content type based ONLY on known patterns (homepage, invoice).
 * Returns null for any other path.
 *
 * @param {string} slug - The URL slug (e.g., "/", "/invoices/inv-001").
 * @param {string} [contentType] - Optional: Explicitly specify the Contentful Content Type ID (less common with this logic).
 * @returns {Promise<object|null>} - The Contentful entry object or null if not found or path doesn't match known types.
 */
export async function getPageFromSlug(slug, contentType) {
    if (!client) {
        console.error("[content.js] Contentful client not initialized. Missing credentials?");
        return null;
    }

    if (slug === undefined || slug === null) {
        console.warn('[content.js] getPageFromSlug called with invalid slug.');
        return null;
    }

    let typeToQuery = contentType; // Primarily used if explicitly passed
    let slugForQuery = slug;

    // --- Determine Content Type based ONLY on known patterns ---
    if (!typeToQuery) { // Only determine type if not explicitly passed
        if (slug === '/') {
            typeToQuery = CONTENTFUL_HOMEPAGE_TYPE_ID;
            // keep slugForQuery as '/', will skip filter later
        } else if (slug.startsWith('/invoices/')) {
            typeToQuery = CONTENTFUL_INVOICE_TYPE_ID;
            slugForQuery = slug.substring('/invoices/'.length);
            if (!slugForQuery) {
                 console.warn(`[content.js] Invalid invoice slug detected: ${slug}`);
                 return null;
            }
        } else {
            // *** IMPORTANT CHANGE ***
            // If the slug isn't "/" and doesn't start with "/invoices/",
            // it doesn't match any known Contentful model in this project.
            console.log(`[content.js] Slug '${slug}' does not match known patterns (/, /invoices/). No Contentful query needed.`);
            return null; // <<< Immediately return null, page doesn't exist in CMS
        }
    } else {
        // Logic if contentType *was* explicitly passed (less likely needed now but kept for flexibility)
        if (typeToQuery === CONTENTFUL_HOMEPAGE_TYPE_ID) {
            slugForQuery = '/';
        } else if (typeToQuery === CONTENTFUL_INVOICE_TYPE_ID && slug.startsWith('/invoices/')) {
            slugForQuery = slug.substring('/invoices/'.length);
        }
         // Note: No specific slug adjustment needed here if type was passed explicitly
         // unless the passed slug also contained the prefix like '/invoices/'
    }

    // This check is mostly redundant now given the 'else' block above returns null, but safe to keep.
    if (!typeToQuery) {
        console.error(`[content.js] Could not determine content type for input slug: ${slug}`);
        return null;
    }

    console.log(`[content.js] Attempting to query Contentful: type='${typeToQuery}', inputSlug='${slug}', querySlug='${slugForQuery}'`);

    try {
        const queryOptions = {
            content_type: typeToQuery,
            limit: 1,
            include: 2,
        };

        // Add slug filter ONLY if it's NOT the homepage type
        if (typeToQuery !== CONTENTFUL_HOMEPAGE_TYPE_ID) {
            queryOptions['fields.slug'] = slugForQuery;
            console.log(`[content.js] Applying filter: fields.slug = ${slugForQuery}`);
        } else {
            console.log(`[content.js] Querying homepage type '${typeToQuery}', skipping slug filter.`);
        }

        const entries = await client.getEntries(queryOptions);

        if (entries.items && entries.items.length > 0) {
            console.log(`[content.js] Found entry for type='${typeToQuery}', input slug='${slug}'`);
            return entries.items[0];
        } else {
            console.warn(`[content.js] No entry found for type='${typeToQuery}', input slug='${slug}' (query options: ${JSON.stringify(queryOptions)})`);
            return null;
        }
    } catch (error) {
        console.error(`[content.js] Error fetching entry from Contentful for input slug '${slug}':`, error.message);
        if (error.response?.data) {
            console.error('[content.js] Contentful Error Details:', JSON.stringify(error.response.data, null, 2));
             if (error.response.data.message?.includes('unknown field') || error.response.data.message?.includes('No field with id')) {
                 console.error(`[content.js] HINT: Check if the field being queried (e.g., 'slug') exists on the Content Type '${typeToQuery}' in Contentful.`);
            }
            if (error.response.data.message?.includes('unknownContentType')) {
                console.error(`[content.js] HINT: The resolved content type ID '${typeToQuery}' might be incorrect or does not exist in Contentful space '${space}'. Check CONTENTFUL_*_TYPE_ID variables.`);
            }
        } else {
            console.error('[content.js] Full Error Object:', error);
        }
        return null;
    }
} // End of getPageFromSlug function

// --- Optional: Add other utility functions if needed ---
// e.g., export async function getAllInvoices() { ... }
