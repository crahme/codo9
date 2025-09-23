import { notFound } from 'next/navigation';
import { getPageFromSlug } from '../../utils/content.js';
import { Hero } from '../../components/Hero.jsx';
import { Stats } from '../../components/Stats.jsx';
import { InvoiceSection } from '../../components/InvoiceSection.jsx';
import { Invoice } from '../../components/Invoice.jsx';
import { VisualEditorComponent } from '../../components/VisualEditorComponent.jsx';
import  InvoicesList from '../../components/InvoicesList.jsx';

const componentMap = {
  hero: Hero,
  stats: Stats,
  invoiceSection: InvoiceSection,
  invoice: Invoice,
  VisualEditorComponent: VisualEditorComponent,
  invoicesList: InvoicesList, // ✅ fixed typo
};

export default async function ComposablePage({ params }) {
  let resolvedParams;
  let slugArray;
  let pageSlug;
  let fullPath;

  try {
    // Validate and construct the slug
    resolvedParams = await params;
    slugArray = resolvedParams.slug;

    if (!Array.isArray(slugArray) || slugArray.length === 0) {
      console.warn("Invalid slug parameter received:", resolvedParams);
      return notFound();
    }

    // Normalize slug: remove trailing /index.html or /index.htm
    pageSlug = slugArray.join('/');
    pageSlug = pageSlug.replace(/\/index\.html?$/i, '');
    fullPath = `/${pageSlug}`;

    // Skip system requests
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

    // ✅ Handle "page" content type
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

    // ✅ Handle "invoice" content type
    if (page.sys.contentType.sys.id === 'invoice') {
      if (!page.fields) {
        console.warn(`Invoice entry found for slug '${fullPath}', but missing fields.`, page);
        return notFound();
      }
      return (
        <div data-sb-object-id={page.sys.id}>
          <h1>Invoice: {page.fields.invoiceNumber || page.fields.slug || 'Unknown'}</h1>

          <section>
            <p><strong>Syndicate Name:</strong> {page.fields.syndicateName}</p>
            <p><strong>Address:</strong> {page.fields.address}</p>
            <p><strong>Contact:</strong> {page.fields.contact}</p>
          </section>

          <section>
            <p><strong>Client Name:</strong> {page.fields.clientName}</p>
            <p><strong>Email:</strong> {page.fields.clientEmail}</p>
          </section>

          <section>
            <p><strong>Invoice Number:</strong> {page.fields.invoiceNumber}</p>
            <p><strong>Invoice Date:</strong> {page.fields.invoiceDate ? new Date(page.fields.invoiceDate).toLocaleDateString() : ''}</p>
            <p><strong>Charger Serial Number:</strong> {page.fields.chargerSerialNumber}</p>
            <p><strong>Billing Period:</strong> 
              {page.fields.billingPeriodStart ? new Date(page.fields.billingPeriodStart).toLocaleDateString() : ''} 
              {' '}to{' '}
              {page.fields.billingPeriodEnd ? new Date(page.fields.billingPeriodEnd).toLocaleDateString() : ''}
            </p>
            <p><strong>Payment Due Date:</strong> {page.fields.paymentDueDate ? new Date(page.fields.paymentDueDate).toLocaleDateString() : ''}</p>
            <p><strong>Late Fee Rate:</strong> {page.fields.lateFeeRate}</p>
            {page.fields.environmentalImpactText && (
              <div>
                <h3>Environmental Impact</h3>
                <div>{/* TODO: Add rich text renderer if needed */}</div>
              </div>
            )}
          </section>

          <section>
            {Array.isArray(page.fields.lineItems) && page.fields.lineItems.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th width="30%">Date</th>
                    <th width="20%">Start Time</th>
                    <th width="20%">End Time</th>
                    <th width="20%">Energy Consumed</th>
                    <th width="20%">Unit Price</th>
                    <th width="20%">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {page.fields.lineItems.map(item => (
                    <tr key={item.sys.id}>
                      <td align="center">{item.fields.date ? new Date(item.fields.date).toLocaleDateString() : ''}</td>
                      <td align="center">{item.fields.startTime ? new Date(item.fields.startTime).toLocaleTimeString() : ''}</td>
                      <td align="center">{item.fields.endTime ? new Date(item.fields.endTime).toLocaleTimeString() : ''}</td>
                      <td align="center">{item.fields.energyConsumed}</td>
                      <td align="center">{item.fields.unitPrice}</td>
                      <td align="center">{item.fields.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No line items.</p>
            )}
          </section>

          {page.fields.total && <p><strong>Total:</strong> {page.fields.total}</p>}
        </div>
      );
    }

    // ✅ Handle "invoicesList" content type
    if (page.sys.contentType.sys.id === 'invoicesList') {
      if (!page.fields || !page.fields.invoiceNumbers) {
        console.warn(`InvoicesList entry found for slug '${fullPath}', but missing invoiceNumbers.`, page);
        return notFound();
      }

      return (
        <div data-sb-object-id={page.sys.id}>
          <h1>Invoices List</h1>
          {Array.isArray(page.fields.invoiceNumbers) && page.fields.invoiceNumbers.length > 0 ? (
            <ul>
              {page.fields.invoiceNumbers.map((num, i) => (
                <li key={i}>Invoice #{num}</li>
              ))}
            </ul>
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
