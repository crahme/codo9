import { notFound } from 'next/navigation';
import { getPageFromSlug } from '../../utils/content.js';
import { Hero } from '../../components/Hero.jsx';
import { Stats } from '../../components/Stats.jsx';

const componentMap = {
  hero: Hero,
  stats: Stats,
};

export default async function ComposablePage({ params }) { // <-- FIXED
  try {
    // Validate and construct the slug
    if (typeof params?.then === 'function') {
      params = await params;
    }
    const slugArray = params?.slug;
    if (!Array.isArray(slugArray) || slugArray.length === 0) {
      console.warn("Invalid slug parameter received:", params);
      return notFound();
    }
    // Normalize slug: remove trailing /index.html or /index.htm
    let pageSlug = slugArray.join('/');
    pageSlug = pageSlug.replace(/\/index\.html?$/i, ''); // <-- FIXED
    const fullPath = `/${pageSlug}`;

    const page = await getPageFromSlug(fullPath);

    if (!page || !page.sys?.contentType?.sys?.id) {
      console.log(`No content found for slug: ${fullPath}`);
      return notFound();
    }

    if (page.sys.contentType.sys.id === 'page') {
      if (!page.fields || !page.fields.sections) {
        console.warn(`Page entry found for slug '${fullPath}', but missing fields or sections.`, page);
        return notFound();
      }

      return (
        <div data-sb-object-id={page.sys.id}>
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
                return <div key={section.sys.id}>Component for {contentTypeId} not found</div>;
              }
              return (
                <Component key={section.sys.id} {...section.fields} id={section.sys.id} />
              );
            })}
        </div>
      );
    }

    if (page.sys.contentType.sys.id === 'invoice') {
      if (!page.fields) {
        console.warn(`Invoice entry found for slug '${fullPath}', but missing fields.`, page);
        return notFound();
      }
      return (
        <div data-sb-object-id={page.sys.id}>
          return (
  <div data-sb-object-id={page.sys.id}>
    <h1>Invoice: {page.fields.slug || 'Unknown'}</h1>
    <ul>
      {Array.isArray(page.fields.lineItems) && page.fields.lineItems.map(item => (
        <li key={item.sys.id}>
          {item.fields.description} - {item.fields.amount}
        </li>
      ))}
    </ul>
    <p>Total: {page.fields.total}</p>
  </div>
);
        </div>
      );
    }

    console.warn(`Unsupported content type for slug '${fullPath}':`, page.sys.contentType.sys.id);
    return notFound();

  } catch (error) {
    console.error(`Error fetching or rendering page for slug '${params?.slug?.join('/')}':`, error);
    return notFound();
  }
}
