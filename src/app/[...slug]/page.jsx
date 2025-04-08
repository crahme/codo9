// src/app/[...slug]/page.jsx
import { notFound } from 'next/navigation';
import { Hero } from '../../components/Hero.jsx'; // Verify path (double ..)
import { Stats } from '../../components/Stats.jsx'; // Verify path (double ..)
import { getPageFromSlug } from '../../utils/content.js'; // Verify path (double ..)
// Import other section components if needed

// Map Contentful Content Type IDs to React components
const componentMap = {
  hero: Hero,
  stats: Stats,
  // Add mappings for any other section types
};

// Note: This component will primarily render 'page' type entries by default
// based on the logic in content.js. It currently doesn't render 'invoice' types.
export default async function ComposablePage({ params }) {
  try {
    const slugArray = params?.slug; // Access slug array safely
    if (!Array.isArray(slugArray) || slugArray.length === 0) {
      console.warn("Invalid slug parameter received:", params);
      return notFound();
    }

    const pageSlug = slugArray.join('/');
    const fullPath = `/${pageSlug}`; // Construct the full path (e.g., /about)

    // Fetch the page data using the full path slug
    // content.js determines the type ('page' or 'invoice' based on pattern)
    const page = await getPageFromSlug(fullPath);

    // --- Handle 'page' type entries ---
    // Check if it's a 'page' type and has sections
    if (page && page.sys?.contentType?.sys?.id === 'page') {
        if (!page.fields || !page.fields.sections) {
             console.warn(`Page entry found for slug '${fullPath}', but missing fields or sections.`, page);
             // Decide if this should be a 404 or render something else
             return notFound();
        }

        // Render the sections like the homepage does
        return (
          <div data-sb-object-id={page.sys.id}>
            {Array.isArray(page.fields.sections) && page.fields.sections.map((section) => {
               if (!section || !section.sys || !section.sys.contentType || !section.sys.contentType.sys || !section.sys.id || !section.fields) {
                 console.warn("Skipping rendering of invalid section object:", section);
                 return null;
               }
               const contentTypeId = section.sys.contentType.sys.id;
               const Component = componentMap[contentTypeId];
               if (!Component) {
                 console.warn(`No component mapped for section content type: ${contentTypeId}`);
                 return <div key={section.sys.id}>Component for {contentTypeId} not found</div>;
               }
               return <Component key={section.sys.id} {...section.fields} id={section.sys.id} />;
            })}
          </div>
        );
    }
    // --- Handle 'invoice' type entries ---
    else if (page && page.sys?.contentType?.sys?.id === 'invoice') {
        // ** You need to create a component to render invoice data **
        // Example: import InvoiceComponent from '../../components/InvoiceComponent.jsx';
        // return <InvoiceComponent {...page.fields} id={page.sys.id} />;
        console.warn(`Rendering for content type 'invoice' is not implemented yet for slug: ${fullPath}`);
        // For now, show a simple message or 404
         return (
             <div data-sb-object-id={page.sys.id}>
                 <h1>Invoice: {page.fields?.slug || 'Unknown'}</h1>
                 <p>Rendering for this content type needs to be implemented.</p>
                 {/* Add fields like StartDate, endDate, address */}
                 {/* Add data-sb-field-path attributes */}
             </div>
         );

    }
    // --- Handle not found ---
    else {
      // Page data was null or not a recognized type
      console.log(`No content found or no renderer for slug: ${fullPath}`);
      return notFound();
    }

  } catch (error) {
    console.error(`Error fetching or rendering page for slug '${params?.slug?.join('/')}':`, error.message, error.stack);
    return notFound();
  }
}
