// src/utils/content.js
// VERSION: Assumes 'page' content type (ID 'page') is used for ALL pages, including homepage via slug '/'.

import { createClient } from 'contentful';

// --- Contentful Client Setup ---
const space = process.env.CONTENTFUL_SPACE_ID!;
const accessToken = process.env.CONTENTFUL_PREVIEW_TOKEN || process.env.CONTENTFUL_DELIVERY_TOKEN!;
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
const CONTENTFUL_INVOICE_TYPE_ID = process.env.CONTENTFUL_INVOICE_TYPE_ID || 'invoice';
const CONTENTFUL_PAGE_TYPE_ID = process.env.CONTENTFUL_PAGE_TYPE_ID || 'page'; // Used for default and homepage

/**
 * Fetches a single Contentful entry based on its slug.
 * Determines content type based on slug pattern (/invoices/ vs default 'page').
 *
 * @param {string} slug - The URL slug (e.g., "/", "/about", "/invoices/inv-001").
 * @param {string} [contentType] - Optional: Explicitly specify Contentful ID (overrides pattern matching).
 * @returns {Promise<object|null>} - The Contentful entry object or null.
 */
export async function getPageFromSlug(slug, contentType) {
    if (!client) {
        console.error("[content.js] Contentful client not initialized.");
        return null;
    }
    if (slug === undefined || slug === null) {
        console.warn('[content.js] getPageFromSlug called with invalid slug.');
        return null;
    }

    let typeToQuery = contentType;
    let slugForQuery = slug;

    // 1. Determine Content Type if not explicitly provided
    if (!typeToQuery) {
        if (slug.startsWith('/invoices/')) {
            typeToQuery = CONTENTFUL_INVOICE_TYPE_ID;
            slugForQuery = slug.substring('/invoices/'.length);
            if (!slugForQuery) {
                 console.warn(`[content.js] Invalid invoice slug detected: ${slug}`);
                 return null;
            }
        } else {
            // Default to 'page' type for everything else, including homepage slug '/'
            typeToQuery = CONTENTFUL_PAGE_TYPE_ID;
            // Adjust slug format for query - assumes 'page' slugs don't have leading '/' EXCEPT homepage itself
            if (slug === '/') {
                slugForQuery = '/';
            } else {
                slugForQuery = slug.startsWith('/') ? slug.substring(1) : slug;
            }
        }
    } else {
         // Content Type was provided explicitly, adjust slug if needed
         if (typeToQuery === CONTENTFUL_INVOICE_TYPE_ID && slug.startsWith('/invoices/')) {
            slugForQuery = slug.substring('/invoices/'.length);
         } else if (typeToQuery === CONTENTFUL_PAGE_TYPE_ID) {
             if (slug === '/') {
                 slugForQuery = '/';
             } else {
                 slugForQuery = slug.startsWith('/') ? slug.substring(1) : slug;
             }
         }
         // Add adjustments for other explicit types if needed
    }

    if (!typeToQuery) {
        console.error(`[content.js] Could not determine content type for input slug: ${slug}`);
        return null;
    }

    console.log(`[content.js] Attempting to query Contentful: type='${typeToQuery}', inputSlug='${slug}', querySlug='${slugForQuery}'`);

    try {
        // Build the query object - assumes BOTH 'page' and 'invoice' types have a 'slug' field
        const queryOptions = {
            content_type: typeToQuery,
            'fields.slug': slugForQuery, // Always filter by slug now
            limit: 1,
            include: 2, // Include linked sections/references
        };

        console.log(`[content.js] Applying filter: fields.slug = ${slugForQuery}`);
        const entries = await client.getEntries(queryOptions);

        if (entries.items && entries.items.length > 0) {
            console.log(`[content.js] Found entry for type='${typeToQuery}', input slug='${slug}'`);
            return entries.items[0];
        } else {
            console.warn(`[content.js] No entry found for type='${typeToQuery}', input slug='${slug}' (query options: ${JSON.stringify(queryOptions)})`);
            return null;
        }
    } catch (error) {
        // Error Logging (same as before)
        console.error(`[content.js] Error fetching entry from Contentful for input slug '${slug}':`, error.message);
        if (error.response?.data) {
            console.error('[content.js] Contentful Error Details:', JSON.stringify(error.response.data, null, 2));
             if (error.response.data.message?.includes('unknown field') || error.response.data.message?.includes('No field with id')) {
                 console.error(`[content.js] HINT: Check if the field 'slug' exists on the Content Type '${typeToQuery}' in Contentful.`);
            }
            if (error.response.data.message?.includes('unknownContentType')) {
                console.error(`[content.js] HINT: The resolved content type ID '${typeToQuery}' might be incorrect or does not exist in Contentful space '${space}'. Check CONTENTFUL_*_TYPE_ID variables/defaults.`);
            }
        } else {
            console.error('[content.js] Full Error Object:', error);
        }
        return null;
    }
} // End of getPageFromSlug function
