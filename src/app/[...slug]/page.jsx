// app/[...slug]/page.jsx
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

    // ignore system paths
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

    const type = page.sys.contentType.sys.id;

    // ✅ Handle "page"
    if (type === 'page') {
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
                !section.sys?.contentType?.sys?.id ||
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
    if (type === 'invoice') {
      const f = page.fields;
      if (!f) {
        console.warn(`Invoice entry found for slug '${fullPath}', but missing fields.`, page);
        return notFound();
      }

      return (
        <div data-sb-object-id={page.sys.id}>
          <h1>Invoice: {f.invoiceNumber || f.slug || 'Unknown'}</h1>

          <section>
            <p><strong>Syndicate:</strong> {f.syndicateName}</p>
            <p><strong>Address:</strong> {f.address}</p>
            <p><strong>Contact:</strong> {f.contact}</p>
          </section>

          <section>
            <p><strong>Client:</strong> {f.clientName}</p>
            <p><strong>Email:</strong> {f.clientEmail}</p>
          </section>

          <section>
            <p><strong>Invoice Date:</strong> {f.invoiceDate ? new Date(f.invoiceDate).toLocaleDateString() : ''}</p>
            <p><strong>Charger Serial:</strong> {f.chargerSerialNumber}</p>
            <p><strong>Billing Period:</strong>
              {f.billingPeriodStart ? new Date(f.billingPeriodStart).toLocaleDateString() : ''} – {f.billingPeriodEnd ? new Date(f.billingPeriodEnd).toLocaleDateString() : ''}
            </p>
            <p><strong>Payment Due:</strong> {f.paymentDueDate ? new Date(f.paymentDueDate).toLocaleDateString() : ''}</p>
            <p><strong>Late Fee Rate:</strong> {f.lateFeeRate}</p>
          </section>

          <section>
            {Array.isArray(f.lineItems) && f.lineItems.length > 0 ? (
              <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Start</th>
                    <th>End</th>
                    <th>Energy</th>
                    <th>Unit Price</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {f.lineItems.map((item) => (
                    <tr key={item.sys.id}>
                      <td>{item.fields.date ? new Date(item.fields.date).toLocaleDateString() : ''}</td>
                      <td>{item.fields.startTime ? new Date(item.fields.startTime).toLocaleTimeString() : ''}</td>
                      <td>{item.fields.endTime ? new Date(item.fields.endTime).toLocaleTimeString() : ''}</td>
                      <td>{item.fields.energyConsumed}</td>
                      <td>{item.fields.unitPrice}</td>
                      <td>{item.fields.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No line items.</p>
            )}
          </section>

          {f.total && <p><strong>Total:</strong> {f.total}</p>}
        </div>
      );
    }

    // ✅ Handle "invoicesList"
    if (type === 'invoicesList') {
      const f = page.fields;
      if (!f?.invoiceNumbers || !f?.invoiceDates || !f?.invoiceFiles) {
        console.warn(`InvoicesList entry found for slug '${fullPath}', but missing invoice data.`, page);
        return notFound();
      }

      const numbers = f.invoiceNumbers || [];
      const dates = f.invoiceDates || [];
      const files = f.invoiceFiles || [];

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
                              // TODO: hook into Contentful Management API
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
    console.warn(`Unsupported content type for slug '${fullPath}':`, type);
    return notFound();

  } catch (error) {
    const digest = error?.digest;
    if (digest === 'NEXT_NOT_FOUND' || (typeof digest === 'string' && digest.includes('NEXT_HTTP_ERROR_FALLBACK;404'))) {
      throw error;
    }
    const errorSlug = slugArray ? slugArray.join('/') : 'unknown';
    console.error(`Error fetching or rendering page for slug '${errorSlug}':`, error);
    return notFound();
  }
}
