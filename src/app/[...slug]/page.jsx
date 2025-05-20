// src/app/[...slug]/page.jsx
import { notFound } from 'next/navigation';
// *** ENSURE THIS IMPORT IS PRESENT AND CORRECT ***
import { getPageFromSlug } from '../../utils/content.js';
// *** END ENSURE ***
import { Hero } from '../../components/Hero.jsx'; // Verify path
import { Stats } from '../../components/Stats.jsx'; // Verify path
// Import other section components if needed

// Map Contentful Content Type IDs to React components
const componentMap = {
  hero: Hero,
  stats: Stats,
  // Add mappings for any other section types
};

export default async function ComposablePage({ params }) {
  try {
    // Await the params object itself before destructuring/accessing
    const awaitedParams = await params;
    const slugArray = awaitedParams?.slug; // Access slug array safely

    if (!Array.isArray(slugArray) || slugArray.length === 0) {
      console.warn("Invalid slug parameter received:", awaitedParams);
      return notFound();
    }

    const pageSlug = slugArray.join('/');
    const fullPath = `/${pageSlug}`; // Construct the full path (e.g., /about)

    // Fetch the page data using the full path slug
    // getPageFromSlug determines the type ('page' or 'invoice' based on pattern)
    const page = await getPageFromSlug(fullPath); // <<< This line needs the import

    // --- Handle 'page' type entries ---
    if (page && page.sys?.contentType?.sys?.id === 'page') {
        if (!page.fields || !page.fields.sections) {
             console.warn(`Page entry found for slug '${fullPath}', but missing fields or sections.`, page);
             return notFound();
        }
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
         // ** Implement invoice rendering here **
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
      console.log(`No content found or no renderer for slug: ${fullPath}`);
      return notFound();
    }

  } catch (error) {
     const awaitedParams = await params; // Await here too for error logging
     console.error(`Error fetching or rendering page for slug '${awaitedParams?.slug?.join('/')}':`, error.message, error.stack);
     return notFound();
  }
}
