// stackbit.config.ts
import { defineStackbitConfig } from "@stackbit/types";
// Remove any Contentful client imports/creation if they exist here

export default defineStackbitConfig({
  stackbitVersion: "~0.6.0", // Keep this or update if needed
  nodeVersion: "20.18.1", // Keep this or your desired version

  // Remove the top-level 'models:' key if it exists

  // Define which Contentful models represent site pages and their URL structure
  modelExtensions: [
    {
      name: "page",        // Contentful ID of your Page model
      type: "page",        // Tell Stackbit this is a page
      urlPath: "/{slug}",  // URLs are formed using the 'slug' field.
                           // Handles '/' and '/about', '/contact' etc.
    },
    {
      name: "invoice",     // Contentful ID of your Invoice model
      type: "page",        // Tell Stackbit this is also a page
      urlPath: "/invoices/{slug}", // URLs start with /invoices/ followed by slug
    },
    // Define other models as 'object' or 'data' if they don't represent standalone pages
    // This helps the editor understand their structure for component editing.
    { name: "hero", type: "object" },
    { name: "stats", type: "object" },
    { name: "button", type: "object" },
    { name: "statItem", type: "object" },
  ],

  // --- Remove or Comment Out the custom siteMap function ---
  // Often, modelExtensions with urlPath is sufficient for Stackbit to build the sitemap.
  // A complex siteMap function can sometimes interfere if not perfectly correct.
  // Let's try removing it first to rely on urlPath inference.
  /*
  siteMap: ({ documents }) => {
     // Your complex mapping logic here - comment out for now
     // ...
  },
  */

  // --- Assets Configuration (Optional but Recommended) ---
  // This tells Stackbit how to handle images from Contentful.
  assets: {
    referenceType: "fields", // Default for Contentful
    fields: {
      url: "fields.file.url", // Path to the asset URL
      altText: "fields.description", // Use description for alt text
      caption: "fields.title", // Use title for caption (optional)
      // Add dimensions if available and needed
      // width: 'fields.file.details.image.width',
      // height: 'fields.file.details.image.height',
    },
    // Prepend protocol if Contentful URLs start with //
     resolveUrl: (url) => {
       if (typeof url === 'string' && url.startsWith('//')) {
         return 'https:' + url;
       }
       return url;
     },
    // You might need to configure uploading if you want to replace images via Stackbit
    // uploadEnabled: true,
    // ... upload settings ...
  },

});
