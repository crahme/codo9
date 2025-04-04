// Inside src/utils/content.js -> getPageFromSlug function

// ... (Keep the logic to determine typeToQuery and slugForQuery) ...

console.log(`[content.js] Querying Contentful: type='${typeToQuery}', slug='${slugForQuery}'`);

try {
    // Build the query object dynamically
    const queryOptions = {
        content_type: typeToQuery,
        limit: 1,
        include: 2, // Adjust include level if needed
    };

    // *** IMPORTANT: Add slug filter ONLY if it's NOT the homepage type ***
    // Because the homepage type doesn't have a 'slug' field.
    if (typeToQuery !== CONTENTFUL_HOMEPAGE_TYPE_ID) {
        // Only add the slug filter for invoices, default pages, etc.
        queryOptions['fields.slug'] = slugForQuery;
    }
    // For the homepage type, we simply fetch the first (presumably only) entry
    // of that content type without filtering by a non-existent slug.

    // Execute the query using the dynamically built options
    const entries = await client.getEntries(queryOptions);

    if (entries.items && entries.items.length > 0) {
        console.log(`[content.js] Found entry for type='${typeToQuery}', input slug='${slug}'`);
        return entries.items[0];
    } else {
        console.warn(`[content.js] No entry found for type='${typeToQuery}', input slug='${slug}' (query slug: '${slugForQuery}')`);
        return null;
    }
} catch (error) {
    // Improved error logging
    console.error(`[content.js] Error fetching entry from Contentful for input slug '${slug}':`, error.message);
    // Check for specific error details if available (ContentfulError has response)
    if (error.response?.data) {
        console.error('[content.js] Contentful Error Details:', JSON.stringify(error.response.data, null, 2));
        if (error.response.data.message?.includes('unknown field') || error.response.data.message?.includes('No field with id')) {
             console.error(`[content.js] Check if the field being queried (e.g., 'slug') exists on the Content Type '${typeToQuery}'.`);
        }
        if (error.response.data.message?.includes('unknownContentType')) {
            console.error(`[content.js] The resolved content type ID '${typeToQuery}' might be incorrect or does not exist in Contentful space '${space}'. Verify CONTENTFUL_*_TYPE_ID variables.`);
        }
    }
    return null; // Return null on error
}
