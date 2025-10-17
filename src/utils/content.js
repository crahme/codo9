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
  if (!client) {
    console.error("❌ Contentful client not initialized - check environment variables");
    return null;
  }

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
  const looksDashboard = /^(main-)?dashboard/i.test(trimmed);

  const typesToTry = explicitType
    ? [explicitType]
    : looksInvoice
    ? ["invoice"]
    : looksInvoicesList
    ? ["invoicesList"]
    : looksDashboard
    ? ["dashboard"]
    : ["page", "invoice", "invoicesList", "dashboard"];

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

  console.log(`🔍 Searching for content with slug: "${slugPath}"`);
  console.log(`📋 Types to try: ${typesToTry.join(', ')}`);
  console.log(`🎯 Slug candidates: ${slugCandidates.join(', ')}`);

  for (const type of typesToTry) {
    for (const s of slugCandidates) {
      try {
        // Use deeper inclusion for dashboard to get all linked data
        const includeDepth = type === "dashboard" ? 10 : 3;
        
        console.log(`🔎 Trying ${type} with slug: "${s}" (include: ${includeDepth})`);
        
        const entries = await client.getEntries({
          content_type: type,
          "fields.slug": s,
          limit: 1,
          include: includeDepth,
        });
        
        let item = entries.items && entries.items[0];
        
        // Fallback: for invoices, also try invoiceNumber matching by last segment
        if (!item && type === "invoice" && last) {
          console.log(`🔄 Trying invoice fallback with invoiceNumber: "${last}"`);
          const byNumber = await client.getEntries({
            content_type: type,
            "fields.invoiceNumber": last,
            limit: 1,
            include: 3,
          });
          item = byNumber.items && byNumber.items[0];
        }
        
        if (item) {
          console.log(`✅ Found ${type} entry for slug: "${s}"`);
          console.log(`📊 ${type} entry ID: ${item.sys.id}`);
          console.log(`🏷️ ${type} fields available:`, Object.keys(item.fields || {}));
          
          if (type === "dashboard") {
            console.log(`🔗 Dashboard recentInvoices count:`, item.fields?.recentInvoices?.length || 0);
            console.log(`📦 Dashboard widgets:`, item.fields?.widgets ? "present" : "missing");
            if (item.fields?.widgets) {
              console.log(`📊 Widgets structure:`, Object.keys(item.fields.widgets));
            }
          }
          return item;
        }
      } catch (error) {
        console.error(`❌ Error fetching ${type} for slug "${s}":`, error.message);
        // Ignore and continue trying candidates
      }
    }
  }

  console.log(`❌ No content found for slug: "${slugPath}" after trying all candidates`);
  return null;
}

export async function getDashboardBySlug(slug = "main-dashboard") {
  if (!client) {
    console.error("❌ Contentful client not initialized");
    return null;
  }

  try {
    console.log(`🔍 Fetching dashboard with slug: "${slug}"`);
    
    const entries = await client.getEntries({
      content_type: "dashboard",
      "fields.slug": slug,
      limit: 1,
      include: 10, // Deep inclusion for all linked data
    });

    if (!entries.items.length) {
      console.log(`❌ No dashboard found with slug: "${slug}"`);
      
      // Try alternative slugs
      const alternativeSlugs = [
        slug,
        slug.replace(/^\//, ''), // Remove leading slash
        `/${slug}`, // Add leading slash
        slug === "main-dashboard" ? "dashboard" : "main-dashboard", // Try alternative names
      ];
      
      for (const altSlug of alternativeSlugs) {
        if (altSlug !== slug) {
          console.log(`🔄 Trying alternative slug: "${altSlug}"`);
          const altEntries = await client.getEntries({
            content_type: "dashboard",
            "fields.slug": altSlug,
            limit: 1,
            include: 10,
          });
          
          if (altEntries.items.length) {
            console.log(`✅ Found dashboard with alternative slug: "${altSlug}"`);
            return altEntries.items[0];
          }
        }
      }
      
      return null;
    }

    const dashboard = entries.items[0];
    
    console.log("✅ Dashboard found successfully!");
    console.log("📊 Dashboard details:", {
      id: dashboard.sys.id,
      title: dashboard.fields.title,
      totalInvoices: dashboard.fields.totalInvoices,
      totalRevenue: dashboard.fields.totalRevenue,
      recentInvoicesCount: dashboard.fields.recentInvoices?.length || 0,
      hasWidgets: !!dashboard.fields.widgets,
      lastUpdated: dashboard.fields.lastUpdated
    });

    // Log detailed recent invoices info
    if (dashboard.fields.recentInvoices) {
      console.log("📋 Recent invoices details:");
      dashboard.fields.recentInvoices.forEach((invoice, index) => {
        console.log(`  ${index + 1}. ${invoice.fields?.invoiceNumber || 'No number'} - ${invoice.fields?.clientName || 'No client'}`);
      });
    }

    // Log widgets structure
    if (dashboard.fields.widgets) {
      console.log("📦 Widgets structure:", {
        summary: dashboard.fields.widgets.summary ? Object.keys(dashboard.fields.widgets.summary) : 'missing',
        deviceTrends: dashboard.fields.widgets.deviceTrends?.length || 0,
        consumptionTimeline: dashboard.fields.widgets.consumptionTimeline?.length || 0,
        topClients: dashboard.fields.widgets.topClients?.length || 0,
        recentInvoices: dashboard.fields.widgets.recentInvoices?.length || 0
      });
    }

    return dashboard;
  } catch (error) {
    console.error("❌ Error fetching dashboard:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack
    });
    return null;
  }
}

export async function getAllDashboards() {
  if (!client) {
    console.error("❌ Contentful client not initialized");
    return [];
  }

  try {
    console.log("🔍 Fetching all dashboards");
    
    const entries = await client.getEntries({
      content_type: "dashboard",
      limit: 100,
      include: 3,
    });

    console.log(`✅ Found ${entries.items.length} dashboards`);
    
    return entries.items;
  } catch (error) {
    console.error("❌ Error fetching all dashboards:", error);
    return [];
  }
}

export async function getDashboardData() {
  // First try to get the actual dashboard from Contentful
  const dashboard = await getDashboardBySlug("main-dashboard");
  
  if (dashboard) {
    console.log("✅ Using real dashboard data from Contentful");
    return dashboard;
  }

  // Fallback to mock data if no real dashboard found
  console.log("⚠️ Using mock dashboard data - no Contentful dashboard found");
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

// Helper function to check if Contentful is properly configured
export function checkContentfulConfig() {
  const config = {
    space: !!process.env.CONTENTFUL_SPACE_ID,
    deliveryToken: !!process.env.CONTENTFUL_DELIVERY_TOKEN,
    previewToken: !!process.env.CONTENTFUL_PREVIEW_TOKEN,
    client: !!client
  };

  console.log("🔧 Contentful Configuration Check:", config);
  
  if (!config.space || (!config.deliveryToken && !config.previewToken)) {
    console.error("❌ Contentful configuration incomplete. Check environment variables:");
    console.error("   - CONTENTFUL_SPACE_ID:", process.env.CONTENTFUL_SPACE_ID ? "✅ Set" : "❌ Missing");
    console.error("   - CONTENTFUL_DELIVERY_TOKEN:", process.env.CONTENTFUL_DELIVERY_TOKEN ? "✅ Set" : "❌ Missing");
    console.error("   - CONTENTFUL_PREVIEW_TOKEN:", process.env.CONTENTFUL_PREVIEW_TOKEN ? "✅ Set" : "❌ Missing");
  }

  return config;
}

// Initialize and check configuration on import
if (typeof window === 'undefined') {
  // Only run on server side
  checkContentfulConfig();
}