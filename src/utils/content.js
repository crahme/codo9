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

export async function getPageFromSlug(slug, contentType) {
  if (!client) return null;

  const entries = await client.getEntries({
    content_type: contentType,
    "fields.slug": slug,
    limit: 1,
    include: 2,
  });

  return entries.items?.[0] || null;
}
