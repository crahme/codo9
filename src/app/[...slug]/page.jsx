import { notFound } from 'next/navigation';
import { getPageFromSlug } from '../../utils/content.js';
import { Hero } from '../../components/Hero.jsx';
import { Stats } from '../../components/Stats.jsx';
import { InvoiceSection } from '../../components/InvoiceSection.jsx'; // add this component

// Map your section content types to React components
const componentMap = {
  hero: Hero,
  stats: Stats,
  invoiceSection: InvoiceSection,
};

export default async function ComposablePage({ params }) {
  try {
    // Destructure slug from params (no await)
    const slugArray = params.slug; // ✅ do NOT await
    if (!Array.isArray(slug) || slugArray.length === 0) {
      console.warn("Invalid slug parameter received:", params);
      return notFound();
    }

    // Normalize slug
    let pageSlug = slug.join('/');
    pageSlug = pageSlug.replace(/\/index\.html?$/i, '');
    const fullPath = `/${pageSlug}`;

    // Fetch page from your CMS or content source
    const page = await getPageFromSlug(fullPath);

    if (!page || !page.sys?.contentType?.sys?.id) {
      console.log(`No content found for slug: ${fullPath}`);
      return notFound();
    }

    // Handle "page" type
    if (page.sys.contentType.sys.id === 'page') {
      if (!page.fields || !page.fields.sections) {
        console.warn(`Page entry found for slug '${fullPath}', but missing fields or sections.`, page);
        return notFound();
      }

      return (
        <div data-sb-object-id={page.sys.id}>
          {page.fields.sections.map((section) => {
            if (!section?.sys?.contentType?.sys?.id || !section.fields) {
              console.warn("Skipping invalid section object:", section);
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

    // Handle "invoice" type
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
                {/* TODO: Render rich text if needed */}
                <div>{page.fields.environmentalImpactText}</div>
              </div>
            )}
          </section>

          <section>
            {Array.isArray(page.fields.lineItems) && page.fields.lineItems.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Start Time</th>
                    <th>End Time</th>
                    <th>Energy Consumed</th>
                    <th>Unit Price</th>
                    <th>Amount</th>
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

    // Unsupported content type
    console.warn(`Unsupported content type for slug '${fullPath}':`, page.sys.contentType.sys.id);
    return notFound();

  } catch (error) {
    console.error(`Error fetching or rendering page for slug '${params?.slug?.join('/')}':`, error);
    return notFound();
  }
}
