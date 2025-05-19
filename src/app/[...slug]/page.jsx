import { notFound } from 'next/navigation';
import { getPageFromSlug } from '../../utils/content.js'; // Ensure this import is correct
import { Hero } from '../../components/Hero.jsx'; // Verify the path
import { Stats } from '../../components/Stats.jsx'; // Verify the path
// Import other section components if needed

// Map Contentful Content Type IDs to React components
const componentMap = {
  hero: Hero,
  stats: Stats,
  // Add mappings for any other section types
};

export default async function ComposablePage({ params }) {
  try {
    // Validate and construct the slug
    const slugArray = params?.slug; // Access slug array safely
    if (!Array.isArray(slugArray) || slugArray.length === 0) {
      console.warn("Invalid slug parameter received:", params);
      return notFound();
    }

    const pageSlug = slugArray.join('/'); // Join the slug array into a string
    const fullPath = `/${pageSlug}`; // Construct the full path (e.g., /about)

    // Fetch the page data using the slug
    const page = await getPageFromSlug(fullPath);

    // Ensure the page is valid
    if (!page || !page.sys?.contentType?.sys?.id) {
      console.log(`No content found for slug: ${fullPath}`);
      return notFound();
    }

    // --- Handle 'page' type entries ---
    if (page.sys.contentType.sys.id === 'page') {
      if (!page.fields || !page.fields.sections) {
        console.warn(`Page entry found for slug '${fullPath}', but missing fields or sections.`, page);
        return notFound();
      }

      return (
        <div data-sb-object-id={page.sys.id}>
          {/* Render sections */}
          {Array.isArray(page.fields.sections) &&
            page.fields.sections.map((section) => {
              if (
                !section ||
                !section.sys ||
                !section.sys.contentType ||
                !section.sys.contentType.sys ||
                !section.sys.id ||
                !section.fields
              ) {
                console.warn("Skipping rendering of invalid section object:", section);
                return null;
              }

              const contentTypeId = section.sys.contentType.sys.id;
              const Component = componentMap[contentTypeId];
              if (!Component) {
                console.warn(`No component mapped for section content type: ${contentTypeId}`);
                // Optionally, render a placeholder
                return <div key={section.sys.id}>Component for {contentTypeId} not found</div>;
              }

              return (
                <Component key={section.sys.id} {...section.fields} id={section.sys.id} />
              );
            })}
        </div>
      );
    }

    // --- Handle 'invoice' type entries ---
    if (page.sys.contentType.sys.id === 'invoice') {
      if (!page.fields) {
        console.warn(`Invoice entry found for slug '${fullPath}', but missing fields.`, page);
        return notFound();
      }

      return (
        <div data-sb-object-id={page.sys.id}>
          <h1>Invoice: {page.fields.slug || 'Unknown'}</h1>
          <p>Invoice-specific rendering needs to be implemented here.</p>
          {/* Add invoice-specific fields and rendering */}
        </div>
      );
    }

    // --- Handle unsupported content types ---
    console.warn(`Unsupported content type for slug '${fullPath}':`, page.sys.contentType.sys.id);
    return notFound();

  } catch (error) {
    console.error(`Error fetching or rendering page for slug '${params?.slug?.join('/')}':`, error);
    return notFound();
  }
}
