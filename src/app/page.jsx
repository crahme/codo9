// src/app/page.jsx
import { notFound } from 'next/navigation';
import { Hero } from '../components/Hero.jsx'; // Adjust path if needed
import { Stats } from '../components/Stats.jsx'; // Adjust path if needed
import { getPageFromSlug } from '../utils/content.js'; // Adjust path if needed

// Map Contentful Content Type IDs to React components
const componentMap = {
  hero: Hero,
  stats: Stats,
  // Add mappings for any other section types you might create
};

export default async function HomePage() {
  try {
    // Fetch the 'page' entry with slug '/' - explicitly providing type is fine too
    const page = await getPageFromSlug("/", 'page'); // Or just getPageFromSlug("/"); if content.js handles it

    // Check if the page, its fields, or the sections array are missing
    if (!page || !page.fields || !page.fields.sections) {
      console.error("Error: Homepage ('/' page entry) not found, missing fields, or missing sections.", page);
      return notFound();
    }

    // Use the actual page entry's ID for the top-level Stackbit object ID
    return (
      <div data-sb-object-id={page.sys.id}>
        {/* Safely map over the sections array */}
        {Array.isArray(page.fields.sections) && page.fields.sections.map((section) => {
          // Basic check for a valid section object structure
          if (!section || !section.sys || !section.sys.contentType || !section.sys.contentType.sys || !section.sys.id || !section.fields) {
            console.warn("Skipping rendering of invalid section object:", section);
            return null;
          }

          // Get the Content Type ID of the linked section entry
          const contentTypeId = section.sys.contentType.sys.id;
          const Component = componentMap[contentTypeId];

          // Handle cases where a component isn't mapped
          if (!Component) {
            console.warn(`No component mapped for section content type: ${contentTypeId}`);
            return <div key={section.sys.id}>Component for {contentTypeId} not found</div>; // Render placeholder or null
          }

          // Pass the linked section's FIELDS as props, and its ID separately
          // Use the section's unique sys.id as the key
          return <Component key={section.sys.id} {...section.fields} id={section.sys.id} />;
        })}
      </div>
    );
  } catch (error) {
    console.error("Error fetching or rendering homepage:", error.message, error.stack);
    // Consider throwing error during development for better debugging
    // throw error;
    return notFound(); // Return 404 page on error
  }
}
