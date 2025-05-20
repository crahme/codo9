// stackbit.config.ts
// ... (imports and env checks remain the same) ...

export default defineStackbitConfig({
  // ... (stackbitVersion, nodeVersion, contentSources, modelExtensions remain the same) ...

  siteMap: ({ documents }) => {
    if (!Array.isArray(documents)) {
      console.warn('[siteMap] Received invalid documents array. Returning empty map.');
      return [];
    }

    const entries: SiteMapEntry[] = documents
      .filter((doc) => {
        return doc && doc.modelName && (doc.modelName === 'page' || doc.modelName === 'invoice');
      })
      .map((document) => {
        // Corrected access based on your debug document logs
        const entryId = document.id as string | undefined;
        const slugValue = document.fields?.slug?.value as string | undefined; // Access the 'value'
        const titleValue = document.fields?.title?.value as string | undefined; // Access the 'value'

        // Use slugValue for all checks and assignments
        if (!entryId || typeof slugValue === 'undefined') {
          console.warn(`[siteMap] Document missing ID or slug, skipping: Model ${document.modelName}, ID ${entryId}, Slug ${slugValue}`);
          return null;
        }

        let urlPath: string | null = null;
        let isHomePage = false;

        if (document.modelName === 'page') {
          const cleanSlug = slugValue.startsWith('/') && slugValue.length > 1 ? slugValue.substring(1) : slugValue;
          urlPath = cleanSlug === '/' ? '/' : `/${cleanSlug}`;
          isHomePage = cleanSlug === '/';
        } else if (document.modelName === 'invoice') {
          const cleanSlug = slugValue.startsWith('/') ? slugValue.substring(1) : slugValue;
          urlPath = `/invoices/${cleanSlug}`;
        }

        if (!urlPath) {
          console.warn(`[siteMap] Could not determine urlPath for document: ID ${entryId}, Model ${document.modelName}`);
          return null;
        }

        return {
          stableId: entryId,
          label: titleValue || slugValue, // Use titleValue if available
          urlPath: urlPath,
          isHomePage: isHomePage,
        };
      })
      .filter((entry): entry is SiteMapEntry => entry !== null);

    console.log(`[siteMap] Generated ${entries.length} site map entries.`);
    if (entries.length === 0) {
      console.warn("[siteMap] No entries generated. Check document structure and filtering. Sample docs:", documents.slice(0,3).map(d => ({id: d.id, model: d.modelName, slug: d.fields?.slug, title: d.fields?.title})) );
    }
    return entries;
  },
});
