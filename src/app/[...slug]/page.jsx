// app/[...slug]/page.jsx
import { notFound } from "next/navigation";
import { getPageFromSlug, getDashboardBySlug } from "../../utils/content.js";
import { Hero } from "../../components/Hero.jsx";
import { Stats } from "../../components/Stats.jsx";
import { InvoiceSection } from "../../components/InvoiceSection.jsx";
import { Invoice } from "../../components/Invoice.jsx";
import { VisualEditorComponent } from "../../components/VisualEditorComponent.jsx";
import InvoicesList from "../../components/InvoicesList.jsx";
import Dashboard from "../../components/dashboard/Dashboard.jsx";

const componentMap = {
  hero: Hero,
  stats: Stats,
  invoiceSection: InvoiceSection,
  invoice: Invoice,
  VisualEditorComponent: VisualEditorComponent,
  invoicesList: InvoicesList,
  dashboard: Dashboard,
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

    pageSlug = slugArray.join("/");
    pageSlug = pageSlug.replace(/\/index\.html?$/i, "");
    fullPath = `/${pageSlug}`;

    // ignore system paths
    if (
      fullPath.includes(".well-known") ||
      fullPath.includes("favicon.ico") ||
      fullPath.includes("robots.txt") ||
      fullPath.includes("sitemap.xml") ||
      fullPath.includes("manifest.json")
    ) {
      console.log(`Ignoring system request: ${fullPath}`);
      return notFound();
    }

    console.log(`🔍 Processing request for slug: ${fullPath}`);

    const page = await getPageFromSlug(fullPath);

    if (!page || !page.sys?.contentType?.sys?.id) {
      console.log(`❌ No content found for slug: ${fullPath}`);
      return notFound();
    }

    const type = page.sys.contentType.sys.id;
    console.log(`📄 Content type detected: ${type}`);

    // ✅ Handle "page"
    if (type === "page") {
      if (!page.fields || !page.fields.sections) {
        console.warn(
          `Page entry found for slug '${fullPath}', but missing fields or sections.`,
          page
        );
        return notFound();
      }

      console.log(`✅ Rendering page with ${page.fields.sections?.length || 0} sections`);

      return (
        <div data-sb-object-id={page.sys.id}>
          {Array.isArray(page.fields.sections) &&
            page.fields.sections.map((section) => {
              if (
                !section ||
                !section.sys?.contentType?.sys?.id ||
                !section.fields
              ) {
                console.warn(
                  "Skipping rendering of invalid section object:",
                  section
                );
                return null;
              }
              const contentTypeId = section.sys.contentType.sys.id;
              const Component = componentMap[contentTypeId];
              if (!Component) {
                console.warn(
                  `No component mapped for section content type: ${contentTypeId}`
                );
                return (
                  <div key={section.sys.id}>
                    Component for {contentTypeId} not found
                  </div>
                );
              }
              return (
                <Component
                  key={section.sys.id}
                  {...section.fields}
                  id={section.sys.id}
                />
              );
            })}
        </div>
      );
    }

    // ✅ Handle "dashboard"
    if (type === "dashboard") {
      console.log(`🎯 Handling dashboard content type for slug: ${fullPath}`);
      
      // Use the dedicated dashboard function for better data fetching
      const dashboardData = await getDashboardBySlug(fullPath.replace(/^\//, ''));

      if (!dashboardData?.fields) {
        console.error(`❌ Dashboard data missing for slug: ${fullPath}`);
        return (
          <div style={{ padding: '20px', background: '#ffebee', fontFamily: 'Arial, sans-serif' }}>
            <h2 style={{ color: '#d32f2f' }}>🚫 Dashboard Data Unavailable</h2>
            <p>Could not load dashboard data for: <strong>{fullPath}</strong></p>
            <div style={{ background: '#fce4ec', padding: '15px', borderRadius: '8px', margin: '15px 0' }}>
              <p><strong>Please check:</strong></p>
              <ul style={{ margin: '10px 0', paddingLeft: '20px' }}>
                <li>Dashboard entry exists in Contentful</li>
                <li>Dashboard is published</li>
                <li>Slug matches exactly: <code>{fullPath.replace(/^\//, '')}</code></li>
                <li>Contentful environment variables are configured</li>
              </ul>
            </div>
            <details style={{ marginTop: '20px' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>Debug Information</summary>
              <pre style={{ 
                background: '#f5f5f5', 
                padding: '15px', 
                borderRadius: '8px', 
                overflow: 'auto',
                fontSize: '12px',
                marginTop: '10px'
              }}>
                {JSON.stringify({
                  slug: fullPath,
                  pageData: page ? {
                    id: page.sys?.id,
                    contentType: page.sys?.contentType?.sys?.id,
                    fields: page.fields ? Object.keys(page.fields) : 'none'
                  } : 'no page data'
                }, null, 2)}
              </pre>
            </details>
          </div>
        );
      }

      console.log('✅ Dashboard data loaded successfully, passing to Dashboard component');

      return (
        <div data-sb-object-id={dashboardData.sys.id}>
          <Dashboard entry={dashboardData} />
        </div>
      );
    }

    // ✅ Handle "invoice"
    if (type === "invoice") {
      const f = page.fields;
      if (!f) {
        console.warn(
          `Invoice entry found for slug '${fullPath}', but missing fields.`,
          page
        );
        return notFound();
      }

      console.log(`✅ Rendering invoice: ${f.invoiceNumber || 'Unknown'}`);

      return (
        <div data-sb-object-id={page.sys.id}>
          <h1>Invoice: {f.invoiceNumber || f.slug || "Unknown"}</h1>

          <section>
            <p>
              <strong>Syndicate:</strong> {f.syndicateName}
            </p>
            <p>
              <strong>Address:</strong> {f.address}
            </p>
            <p>
              <strong>Contact:</strong> {f.contact}
            </p>
          </section>

          <section>
            <p>
              <strong>Client:</strong> {f.clientName}
            </p>
            <p>
              <strong>Email:</strong> {f.clientEmail}
            </p>
          </section>

          <section>
            <p>
              <strong>Invoice Date:</strong>{" "}
              {f.invoiceDate ? new Date(f.invoiceDate).toLocaleDateString() : ""}
            </p>
            <p>
              <strong>Charger Serial:</strong> {f.chargerSerialNumber}
            </p>
            <p>
              <strong>Billing Period:</strong>{" "}
              {f.billingPeriodStart
                ? new Date(f.billingPeriodStart).toLocaleDateString()
                : ""}{" "}
              –{" "}
              {f.billingPeriodEnd
                ? new Date(f.billingPeriodEnd).toLocaleDateString()
                : ""}
            </p>
            <p>
              <strong>Payment Due:</strong>{" "}
              {f.paymentDueDate
                ? new Date(f.paymentDueDate).toLocaleDateString()
                : ""}
            </p>
            <p>
              <strong>Late Fee Rate:</strong> {f.lateFeeRate}
            </p>
          </section>

          <section>
            {Array.isArray(f.lineItems) && f.lineItems.length > 0 ? (
              <table
                border="1"
                cellPadding="6"
                style={{ borderCollapse: "collapse", width: "100%" }}
              >
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
                      <td>
                        {item.fields.date
                          ? new Date(item.fields.date).toLocaleDateString()
                          : ""}
                      </td>
                      <td>
                        {item.fields.startTime
                          ? new Date(item.fields.startTime).toLocaleTimeString()
                          : ""}
                      </td>
                      <td>
                        {item.fields.endTime
                          ? new Date(item.fields.endTime).toLocaleTimeString()
                          : ""}
                      </td>
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

          {f.total && (
            <p>
              <strong>Total:</strong> {f.total}
            </p>
          )}
        </div>
      );
    }

    // ✅ Handle "invoicesList"
    if (type === "invoicesList") {
      const f = page.fields;

      // Debug logs
      console.log("Page fields:", page.fields);
      console.log("Raw invoiceFiles:", page.fields?.invoiceFiles);

      // normalize invoiceFiles into an array
      const files = Array.isArray(page.fields?.invoiceFiles)
        ? page.fields.invoiceFiles
        : page.fields?.invoiceFiles
        ? [page.fields.invoiceFiles] // handle singular
        : [];

      const numbers = f?.invoiceNumbers || [];
      const dates = f?.invoiceDates || [];

      console.log("InvoicesList normalized files:", files);

      if (files.length === 0) {
        console.warn(
          `InvoicesList entry '${fullPath}' has no invoiceFiles attached.`
        );
      }

      return (
        <div data-sb-object-id={page.sys.id}>
          <h1>Invoices List</h1>
          {files.length > 0 ? (
            <table
              border="1"
              cellPadding="8"
              style={{ borderCollapse: "collapse", width: "100%" }}
            >
              <thead>
                <tr>
                  <th align="left">Number</th>
                  <th align="left">Date</th>
                  <th align="left">Operations</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file, i) => {
                  if (!file) return null;

                  const num = numbers[i] || "Unknown";
                  const date = dates[i]
                    ? new Date(dates[i]).toLocaleDateString()
                    : "N/A";
                  const fileUrl =
                    file?.fields?.file?.url ||
                    file?.fields?.file?.["en-US"]?.url ||
                    null;

                  return (
                    <tr key={i}>
                      <td>{num}</td>
                      <td>{date}</td>
                      <td>
                        {fileUrl ? (
                          <a
                            href={`https:${fileUrl}`}
                            download
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <button>Download PDF</button>
                          </a>
                        ) : (
                          "No file"
                        )}
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

    // ❌ fallback - unsupported content type
    console.warn(`❌ Unsupported content type for slug '${fullPath}':`, type);
    return (
      <div style={{ padding: '20px', background: '#fff3cd', fontFamily: 'Arial, sans-serif' }}>
        <h2 style={{ color: '#856404' }}>Unsupported Content Type</h2>
        <p>No handler for content type: <strong>{type}</strong></p>
        <p>Supported types: page, dashboard, invoice, invoicesList</p>
        <div style={{ background: '#fff', padding: '15px', borderRadius: '8px', marginTop: '15px' }}>
          <details>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>Page Data</summary>
            <pre style={{ 
              background: '#f8f9fa', 
              padding: '15px', 
              borderRadius: '4px', 
              overflow: 'auto',
              fontSize: '12px',
              marginTop: '10px'
            }}>
              {JSON.stringify({
                slug: fullPath,
                contentType: type,
                pageId: page.sys?.id,
                availableFields: page.fields ? Object.keys(page.fields) : 'none'
              }, null, 2)}
            </pre>
          </details>
        </div>
      </div>
    );
  } catch (error) {
    const digest = error?.digest;
    if (
      digest === "NEXT_NOT_FOUND" ||
      (typeof digest === "string" &&
        digest.includes("NEXT_HTTP_ERROR_FALLBACK;404"))
    ) {
      throw error;
    }
    const errorSlug = slugArray ? slugArray.join("/") : "unknown";
    console.error(
      `❌ Error fetching or rendering page for slug '${errorSlug}':`,
      error
    );
    
    return (
      <div style={{ padding: '20px', background: '#f8d7da', fontFamily: 'Arial, sans-serif' }}>
        <h2 style={{ color: '#721c24' }}>Error Loading Page</h2>
        <p>There was an error loading the page for: <strong>{errorSlug}</strong></p>
        <div style={{ background: '#f5c6cb', padding: '15px', borderRadius: '8px', marginTop: '15px' }}>
          <p><strong>Error details:</strong></p>
          <pre style={{ 
            background: '#fff', 
            padding: '15px', 
            borderRadius: '4px', 
            overflow: 'auto',
            fontSize: '12px'
          }}>
            {error.message}
          </pre>
        </div>
      </div>
    );
  }
}

export async function generateStaticParams() {
  // Generate static params for known content types
  try {
    console.log("🔧 Generating static params...");
    
    // You can add more content types here as needed
    const contentTypes = ['page', 'dashboard', 'invoice', 'invoicesList'];
    const params = [];

    // Add main dashboard as a known route
    params.push({
      slug: ['main-dashboard'],
    });

    // Add other common routes if needed
    params.push({
      slug: ['dashboard'],
    });

    console.log(`✅ Generated ${params.length} static params`);
    return params;
  } catch (error) {
    console.error("❌ Error generating static params:", error);
    return [];
  }
}

export async function generateMetadata({ params }) {
  try {
    const resolvedParams = await params;
    const slugArray = resolvedParams.slug;
    const pageSlug = slugArray.join("/").replace(/\/index\.html?$/i, "");
    const fullPath = `/${pageSlug}`;

    console.log(`🔍 Generating metadata for: ${fullPath}`);

    const page = await getPageFromSlug(fullPath);

    if (!page || !page.fields) {
      return {
        title: "Page Not Found",
        description: "The requested page could not be found.",
      };
    }

    const title = page.fields.title || 
                 page.fields.invoiceNumber || 
                 page.fields.clientName || 
                 "EV Charging Dashboard";

    let description = "EV Charging Management System";

    if (page.sys.contentType.sys.id === "dashboard") {
      description = "Comprehensive EV charging analytics and management dashboard";
    } else if (page.sys.contentType.sys.id === "invoice") {
      description = `Invoice details for ${page.fields.clientName || 'client'}`;
    }

    return {
      title: `${title} | EV Charging`,
      description,
    };
  } catch (error) {
    console.error("❌ Error generating metadata:", error);
    return {
      title: "EV Charging Dashboard",
      description: "EV Charging Management System",
    };
  }
}