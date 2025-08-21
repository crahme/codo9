import { notFound } from 'next/navigation';
import { getPageFromSlug } from '../../utils/content.js';
import { Hero } from '../../components/Hero.jsx';
import { Stats } from '../../components/Stats.jsx';
import { InvoiceSection } from '../../components/InvoiceSection.jsx'; // fix missing component

const componentMap = {
  hero: Hero,
  stats: Stats,
  invoiceSection: InvoiceSection,
};

export default async function ComposablePage({ params }) { 
  // ✅ params is passed in automatically
  const slugArray = params.slug;
  
  if (!Array.isArray(slugArray) || slugArray.length === 0) {
    console.warn("Invalid slug parameter received:", params);
    return notFound();
  }

  // Normalize slug
  let pageSlug = slugArray.join('/');
  pageSlug = pageSlug.replace(/\/index\.html?$/i, '');
  const fullPath = `/${pageSlug}`;

  try {
    const page = await getPageFromSlug(fullPath);

    if (!page || !page.sys?.contentType?.sys?.id) {
      console.log(`No content found for slug: ${fullPath}`);
      return notFound();
    }

    if (page.sys.contentType.sys.id === 'page') {
      if (!page.fields || !page.fields.sections) return notFound();

      return (
        <div data-sb-object-id={page.sys.id}>
          {page.fields.sections.map((section) => {
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

    if (page.sys.contentType.sys.id === 'invoice') {
      if (!page.fields) return notFound();

      return (
        <div data-sb-object-id={page.sys.id}>
          <h1>Invoice: {page.fields.invoiceNumber || page.fields.slug || 'Unknown'}</h1>
          <section>
            <p><strong>Client:</strong> {page.fields.clientName}</p>
            <p><strong>Email:</strong> {page.fields.clientEmail}</p>
          </section>
        </div>
      );
    }

    return notFound();
  } catch (error) {
    console.error(`Error fetching page for slug '${fullPath}':`, error);
    return notFound();
  }
}
