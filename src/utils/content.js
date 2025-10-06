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

  const raw = typeof slugPath === "string" ? slugPath : "/";

  // 🚨 Guard: skip API routes so Visual Editor won't try to load them as pages
  if (raw.startsWith("api/")) {
    return null;
  }

  // Strip query/hash, remove trailing /index.html, keep leading slash for one candidate
  const cleaned = raw.split("?")[0].split("#")[0].replace(/\/index\.html?$/i, "");
  // Trim leading slashes for canonical slug value ('' for homepage)
  const trimmed = cleaned.replace(/^\/+/, "");
  const isHome = trimmed === "";
  const looksInvoice = /^invoice\//i.test(trimmed);
  const looksInvoicesList = /^invoiceslist\//i.test(trimmed);

  const typesToTry = explicitType
    ? [explicitType]
    : looksInvoice
    ? ["invoice"]
    : looksInvoicesList
    ? ["invoicesList"]
    : ["page", "invoice", "invoicesList"];

  // Try a few slug representations since Contentful entries may store with or without leading '/'
  const last = trimmed.split("/").pop();
  const slugCandidates = isHome
    ? ["/", ""]
    : Array.from(
        new Set(
          [
            trimmed,
            "/" + trimmed,
            cleaned,
            last || "",
            last ? "/" + last : "",
            last ? last + "/" : "",
            last ? "/" + last + "/" : "",
          ].filter(Boolean)
        )
      );

  for (const type of typesToTry) {
    for (const s of slugCandidates) {
      try {
        const entries = await client.getEntries({
          content_type: type,
          "fields.slug": s,
          limit: 1,
          include: 3,
        });
        let item = entries.items && entries.items[0];
        // Fallback: for invoices, also try invoiceNumber matching by last segment
        if (!item && type === "invoice" && last) {
          const byNumber = await client.getEntries({
            content_type: type,
            "fields.invoiceNumber": last,
            limit: 1,
            include: 3,
          });
          item = byNumber.items && byNumber.items[0];
        }
        if (item) return item;
      } catch (_) {
        // Ignore and continue trying candidates
      }
    }
  }

  return null;
}

export async function getDashboardData() {
  // Minimal mock data to allow build to succeed; replace with real Contentful queries as needed.
  return {
    totalDevices: 3,
    totalConsumption: 1250,
    recentInvoicesCount: 5,
    devices: [
      { name: "Charger A", consumption: 420 },
      { name: "Charger B", consumption: 330 },
      { name: "Charger C", consumption: 500 }
    ],
    recentInvoices: [
      { invoiceId: "INV-2024-001", device: "Charger A", amount: 120.5, status: "Paid" },
      { invoiceId: "INV-2024-002", device: "Charger B", amount: 98.75, status: "Unpaid" },
      { invoiceId: "INV-2024-003", device: "Charger C", amount: 150.0, status: "Overdue" }
    ],
    consumptionTrend: [
      { name: "Mon", consumption: 180 },
      { name: "Tue", consumption: 210 },
      { name: "Wed", consumption: 190 },
      { name: "Thu", consumption: 230 },
      { name: "Fri", consumption: 210 },
      { name: "Sat", consumption: 260 },
      { name: "Sun", consumption: 270 }
    ],
    energyRecommendations: {
      usage: "High",
      savings: 45.2,
      score: 78
    }
  };
}
