siteMap: ({ documents }) => {
    if (!Array.isArray(documents)) {
        console.warn('[siteMap] Received non-array or undefined documents. Returning empty map.');
        return [];
    }
    const entries: SiteMapEntry[] = documents

      .filter((doc) => {
        const isSupportedModel = ['page', 'invoice', 'hero', 'stats', 'statItem', 'button'].includes(doc.modelName);
        if (!isSupportedModel) {
          console.warn(`[siteMap] Unsupported model type: ${doc.modelName}, skipping.`);
        }
        return isSupportedModel;
      })
      .map((document) => {
        const slug = document.fields?.slug as string | undefined;
        const title = document.fields?.title as string | undefined;
        const entryId = document.sys?.id;
        if (!entryId || typeof slug === 'undefined') {
            console.warn(`[siteMap] Document ${entryId || 'UNKNOWN'} missing ID or slug, skipping:`, document?.modelName);
            return null;
        }
        let urlPath: string | null = null;
        let isHomePage = false;

        // Add logic for new model types
        if (document.modelName === 'page') {
          urlPath = slug === '/' ? '/' : `/${slug.startsWith('/') ? slug.substring(1) : slug}`;
          isHomePage = slug === '/';
        } else if (document.modelName === 'invoice') {
          urlPath = `/invoices/${slug.startsWith('/') ? slug.substring(1) : slug}`;
        } else if (['hero', 'stats', 'statItem', 'button'].includes(document.modelName)) {
          urlPath = `/components/${slug.startsWith('/') ? slug.substring(1) : slug}`; // Example path for components
        }

        if (!urlPath) {
            console.warn(`[siteMap] Could not determine urlPath for document:`, entryId, document.modelName);
            return null;
        }
        return {
          stableId: entryId,
          label: title || slug,
          urlPath: urlPath,
          isHomePage: isHomePage,
        };
      })
      .filter((entry): entry is SiteMapEntry => entry !== null);
      console.log(`[siteMap] Generated ${entries.length} site map entries.`);
      return entries;
  },
