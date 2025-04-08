// stackbit.config.ts
import { defineStackbitConfig } from "@stackbit/types";

export default defineStackbitConfig({
  stackbitVersion: "~0.6.0",
  nodeVersion: "20.18.1",

  // --- REMOVED assets block ---
  // --- REMOVED siteMap block ---
  // --- Ensure NO top-level 'models' key ---
  // --- Ensure NO 'contentSources' key ---

  // ONLY define models that represent actual site pages
  modelExtensions: [
    {
      name: "page",        // EXACT Contentful ID of your Page model
      type: "page",        // Tell Stackbit this is a page
      urlPath: "/{slug}",  // Define its URL structure
    },
    {
      name: "invoice",     // EXACT Contentful ID of your Invoice model
      type: "page",        // Tell Stackbit this is also a page
      urlPath: "/invoices/{slug}", // Define its URL structure
    },
    // --- REMOVED type: "object" definitions for hero, stats, button, statItem ---
  ],

});
