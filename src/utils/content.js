// src/utils/content.js
import { createClient } from "contentful";

const space = process.env.CONTENTFUL_SPACE_ID;
const accessToken =
  process.env.CONTENTFUL_PREVIEW_TOKEN || process.env.CONTENTFUL_DELIVERY_TOKEN;

const host = process.env.CONTENTFUL_PREVIEW_TOKEN
  ? "preview.contentful.com"
  : undefined;

export const client =
  space && accessToken
    ? createClient({ space, accessToken, host })
    : null;

export async function getPageFromSlug(slugPath, explicitType) {
  if (!client) return null;

  const raw = typeof slugPath === 'string' ? slugPath : '/';
  // Strip query/hash, remove trailing /index.html, keep leading slash for one candidate
  const cleaned = raw.split('?')[0].split('#')[0].replace(/\/index\.html?$/i, '');
  // Trim leading slashes for canonical slug value ('' for homepage)
  const trimmed = cleaned.replace(/^\/+/, '');
  const isHome = trimmed === '';
  const looksInvoice = /^invoice\//i.test(trimmed);

  const typesToTry = explicitType
    ? [explicitType]
    : looksInvoice
    ? ['invoice']
    : ['page', 'invoice'];

  // Try a few slug representations since Contentful entries may store with or without leading '/'
  const slugCandidates = isHome
    ? ['/', '']
    : [trimmed, '/' + trimmed, cleaned];

  for (const type of typesToTry) {
    for (const s of slugCandidates) {
      try {
        const entries = await client.getEntries({
          content_type: type,
          'fields.slug': s,
          limit: 1,
          include: 3,
        });
        const item = entries.items && entries.items[0];
        if (item) return item;
      } catch (_) {
        // Ignore and continue trying candidates
      }
    }
  }

  return null;
}