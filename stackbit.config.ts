import { defineStackbitConfig, SiteMapEntry } from "@stackbit/types";

export default defineStackbitConfig({
  stackbitVersion: "~0.6.0",
  nodeVersion: "20.18.1",
  modelExtensions: [
    {
      name: "Invoice",
      type: "page",
      urlPath: "/invoices/{slug}",
    },
  ],
  siteMap: ({ documents }) => {
    if (!documents || !Array.isArray(documents)) {
      console.warn("Documents are undefined or not an array.");
      return [];
    }

    return documents
      .filter((doc) => doc.modelName === "Invoice")
      .map((document) => {
        const slug = document.fields?.slug || "unknown-slug";
        return {
          stableId: document.id,
          urlPath: `/invoices/${slug}`,
          document,
        };
      });
  },
});

// Separate constant definition and API logic
const contentType = "Invoice"; // Use a valid Contentful content type

// Example async function for fetching entries
export async function fetchEntries(client) {
  try {
    const entries = await client.getEntries({
      content_type: contentType,
      "fields.slug[exists]": true, // Ensure slug exists
    });

    console.log(
      entries.items.map((entry) => `/invoices/${entry.fields.slug}`).join("\n")
    );

    return entries.items;
  } catch (error) {
    console.error("Error fetching entries:", error);
    throw error;
  }
}

// Example React component for a page
export default async function ComposablePage({ params }) {
  const { slug } = params;
  const pageSlug = Array.isArray(slug) ? slug.join("/") : slug;

  // Fetch data based on the pageSlug
  return <div>{`Page slug: ${pageSlug}`}</div>;
}
