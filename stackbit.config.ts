// stackbit.config.ts
import { defineStackbitConfig } from "@stackbit/types";

export default defineStackbitConfig({
  stackbitVersion: "~0.6.0", // Keep this or update if needed
  nodeVersion: "20.18.1",   // Keep this or your desired version

  // --- REMOVED assets block ---
  // --- REMOVED siteMap block (rely on urlPath first) ---
  // --- Ensure NO top-level 'models' key ---
  // --- Ensure NO 'contentSources' key (let Netlify handle it) ---

  // Essential: Define which Contentful models represent pages and their URL structure
  modelExtensions: [
    {
      name: "page",        // EXACT Contentful ID of your Page model
      type: "page",        // Tell Stackbit this is a page
      urlPath: "/{slug}",  // URLs are formed using the 'slug' field.
                           // Handles '/' and '/about', '/contact' etc.
    },
    {
      name: "invoice",     // EXACT Contentful ID of your Invoice model
      type: "page",        // Tell Stackbit this is also a page
      urlPath: "/invoices/{slug}", // URLs start with /invoices/ followed by slug
    },
    // Define component/data models (optional but helpful for field annotations)
    { name: "hero", type: "object" },
    { name: "stats", type: "object" },
    { name: "button", type: "object" },
    { name: "statItem", type: "object" },
  ],

});
