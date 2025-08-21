// src/utils/content.cjs
const { createClient } = require("contentful");

const space = process.env.CONTENTFUL_SPACE_ID;
const accessToken =
  process.env.CONTENTFUL_PREVIEW_TOKEN || process.env.CONTENTFUL_DELIVERY_TOKEN;

const host = process.env.CONTENTFUL_PREVIEW_TOKEN
  ? "preview.contentful.com"
  : undefined;

if (!space || !accessToken) {
  console.error("[content.cjs] Missing Contentful credentials.");
}

const client =
  space && accessToken
    ? createClient({ space, accessToken, host })
    : null;

const CONTENTFUL_INVOICE_TYPE_ID =
  process.env.CONTENTFUL_INVOICE_TYPE_ID || "invoice";
const CONTENTFUL_PAGE_TYPE_ID =
  process.env.CONTENTFUL_PAGE_TYPE_ID || "page";

async function getPageFromSlug(slug, contentType) {
  if (!client) return null;
  if (!slug) return null;

  let typeToQuery = contentType || CONTENTFUL_PAGE_TYPE_ID;
  let slugForQuery = slug.startsWith("/") ? slug.substring(1) : slug;

  if (slug.startsWith("/invoice/")) {
    typeToQuery = CONTENTFUL_INVOICE_TYPE_ID;
    slugForQuery = slug.replace(/^\/invoice\//, "");
  } else if (slug === "/") {
    slugForQuery = "/";
  }

  const entries = await client.getEntries({
    content_type: typeToQuery,
    "fields.slug": slugForQuery,
    limit: 1,
    include: 2,
  });

  return entries.items?.[0] || null;
}

module.exports = { getPageFromSlug };
