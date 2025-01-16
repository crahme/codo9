import { defineStackbitConfig, SiteMapEntry } from "@stackbit/types";

export default defineStackbitConfig({
  stackbitVersion: "~0.6.0", // Correct syntax
  nodeVersion: "20.18.1", // Corrected Node.js version
  modelExtensions: [
    {
      name: "Invoice", // Ensure this matches the model name in your content source
      type: "page",
      urlPath: "/invoices/{slug}",
    },
  ],
 siteMap: ({ documents }) => {
    return documents
      .filter((doc) => doc.modelName === "Invoice") // Filter for relevant content types
      .map((document) => {
        const slug = document.fields?.slug || "unknown-slug";
        return {
          stableId: document.id,
          urlPath: `/invoices/${slug}`, // Construct valid URLs
          document,
        };
      });
  },
   const contentType = "Invoice"; // Replace with a valid Contentful content type
  const entries = await client.getEntries({
    content_type: contentType,
    "fields.slug[exists]": true, // Ensure slug exists
export default async function ComposablePage({ params }) {
    const { slug } = await params; // Await params
    const pageSlug = Array.isArray(slug) ? slug.join('/') : slug;

    // Fetch data based on the pageSlug
    return <div>{`Page slug: ${pageSlug}`}</div>;
  }
  
console.log(
    siteMap({ documents })
      .map((entry) => entry.urlPath)
      .join('\n')
  );

const entries = await client.getEntries({
  content_type: "Invoice", // Use a valid content type
  "fields.slug": "example-slug", // Ensure the field exists
});


});
