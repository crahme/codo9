import { notFound } from 'next/navigation';
import { getPageFromSlug } from '../../utils/content.js';
import { Hero } from '../../components/Hero.jsx';
import { Stats } from '../../components/Stats.jsx';
import { InvoiceSection } from '../../components/InvoiceSection.jsx';
import { Invoice } from '../../components/Invoice.jsx';
import { VisualEditorComponent } from '../../components/VisualEditorComponent.jsx';
import InvoicesList from '../../components/InvoicesList.jsx';

const componentMap = {
  hero: Hero,
  stats: Stats,
  invoiceSection: InvoiceSection,
  invoice: Invoice,
  VisualEditorComponent: VisualEditorComponent,
  invoicesList: InvoicesList,
};

export default async function ComposablePage({ params }) {
  let resolvedParams;
  let slugArray;
  let pageSlug;
  let fullPath;

  try {
    resolvedParams = await params;
    slugArray = resolvedParams.slug;

    if (!Array.isArray(slugArray) || slugArray.length === 0) {
      console.warn("Invalid slug parameter received:", resolvedParams);
      return notFound();
    }

    pageSlug = slugArray.join('/');
    pageSlug = pageSlug.replace(/\/index\.html?$/i, '');
    fullPath = `/${pageSlug}`;

    if (
      fullPath.includes('.well-known') ||
      fullPath.includes('favicon.ico') ||
      fullPath.includes('robots.txt') ||
      fullPath.includes('sitemap.xml') ||
      fullPath.includes('manifest.json')
    ) {
      console.log(`Ignoring system request: ${fullPath}`);
      return notFound();
    }

    const page = await getPageFromSlug(fullPath);

    if (!page || !page.sys?.contentType?.sys?.id) {
      console.log(`No content found for slug: ${fullPath}`);
      return notFound();
    }

    // ✅ Handle "page"
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
              return <Component key={section.sys.id} {...section.fields} id={section.sys.id} />;
            })}
        </div>
      );
    }

    // ✅ Handle "invoice"
    if (page.sys.contentType.sys.id === 'invoice') {
      if (!page.fields) {
        console.warn(`Invoice entry found for slug '${fullPath}', but missing fields.`, page);
        return notFound();
      }
      return (
        <div data-sb-object-id={page.sys.id}>
          <h1>Invoice: {page.fields.invoiceNumber || page.fields.slug || 'Unknown'}</h1>
          {/* same invoice details as before */}
        </div>
      );
    }

    // ✅ Handle "invoicesList"
    if (page.sys.contentType.sys.id === 'invoicesList') {
      if (!page.fields || !page.fields.invoiceNumbers || !page.fields.invoiceDates || !page.fields.invoiceFiles) {
        console.warn(`InvoicesList entry found for slug '${fullPath}', but missing invoice data.`, page);
        return notFound();
      }

      const numbers = page.fields.invoiceNumbers || [];
      const dates = page.fields.invoiceDates || [];
      const files = page.fields.invoiceFiles || [];

      return (
        <div data-sb-object-id={page.sys.id}>
          <h1>Invoices List</h1>
          {numbers.length > 0 ? (
            <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th align="left">Number</th>
                  <th align="left">Date</th>
                  <th align="left">Operations</th>
                </tr>
              </thead>
              <tbody>
                {numbers.map((num, i) => {
                  const date = dates[i] ? new Date(dates[i]).toLocaleDateString() : 'N/A';
                  const file = files[i]?.fields?.file?.url || null;
                  const invoiceId = files[i]?.sys?.id || num;

                  return (
                    <tr key={i}>
                      <td>{num}</td>
                      <td>{date}</td>
                      <td>
                        {file && (
                          <a href={`https:${file}`} download target="_blank" rel="noopener noreferrer">
                            <button>Download PDF</button>
                          </a>
                        )}
                        <a href={`/invoice/${invoiceId}`}>
                          <button>Open</button>
                        </a>
                        <button
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete invoice #${num}?`)) {
                              // TODO: implement delete handler (API call to Contentful or your backend)
                              console.log(`Delete invoice ${num}`);
                            }
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p>No invoices found.</p>
          )}
        </div>
      );
    }

    // ❌ fallback
    console.warn(`Unsupported content type for slug '${fullPath}':`, page.sys.contentType.sys.id);
    return notFound();

  } catch (error) {
    const digest = error && error.digest;
    if (digest === 'NEXT_NOT_FOUND' || (typeof digest === 'string' && digest.includes('NEXT_HTTP_ERROR_FALLBACK;404'))) {
      throw error;
    }
    const errorSlug = slugArray ? slugArray.join('/') : 'unknown';
    console.error(`Error fetching or rendering page for slug '${errorSlug}':`, error);
    return notFound();
  }
}
