// src/app/[...slug]/page.jsx
import { notFound } from "next/navigation";
import { draftMode } from "next/headers";
import { getPageFromSlug } from "../../utils/content.js"; // <-- adjust to your helper
import { NextResponse } from "next/server";

export default async function Page({ params }) {
  const { slug } = params;
  const fullPath = Array.isArray(slug) ? slug.join("/") : slug;

  const { isEnabled } = draftMode();
  const page = await getPageFromSlug(fullPath, isEnabled);

  if (!page) {
    console.warn(`Page not found for slug '${fullPath}'`);
    return notFound();
  }

  const type = page.sys.contentType.sys.id;

  // ===========================
  // Render normal "page" type
  // ===========================
  if (type === "page") {
    const f = page.fields;
    return (
      <div data-sb-object-id={page.sys.id}>
        <h1>{f.title?.["en-US"] || "Untitled Page"}</h1>
        <p>{f.body?.["en-US"] || ""}</p>
      </div>
    );
  }

  // ===========================
  // Render single "invoice"
  // ===========================
  if (type === "invoice") {
    const f = page.fields;
    return (
      <div data-sb-object-id={page.sys.id}>
        <h1>Invoice #{f.invoiceNumber?.["en-US"]}</h1>
        <p>Date: {f.invoiceDate?.["en-US"]}</p>
        {f.invoiceFile?.["en-US"]?.fields?.file?.["en-US"]?.url && (
          <a
            href={`https:${f.invoiceFile["en-US"].fields.file["en-US"].url}`}
            download
            target="_blank"
            rel="noopener noreferrer"
          >
            <button>Download PDF</button>
          </a>
        )}
      </div>
    );
  }

  // ===========================
  // Render "invoicesList"
  // ===========================
  if (type === "invoicesList") {
    const f = page.fields;
    if (!f?.invoiceNumbers || !f?.invoiceDates || !f?.invoiceFiles) {
      console.warn(
        `InvoicesList entry found for slug '${fullPath}', but missing invoice data.`,
        page
      );
      return notFound();
    }

    const numbers = f.invoiceNumbers["en-US"] || [];
    const dates = f.invoiceDates["en-US"] || [];
    const files = f.invoiceFiles["en-US"] || [];
    const assets = page.includes?.Asset || [];

    return (
      <div data-sb-object-id={page.sys.id}>
        <h1>Invoices List</h1>
        {numbers.length > 0 ? (
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
              {numbers.map((num, i) => {
                const date = dates[i]
                  ? new Date(dates[i]).toLocaleDateString()
                  : "N/A";
                const fileLink = files[i];
                let fileUrl = null;

                if (fileLink?.sys?.id) {
                  const asset = assets.find((a) => a.sys.id === fileLink.sys.id);
                  fileUrl = asset?.fields?.file?.["en-US"]?.url
                    ? `https:${asset.fields.file["en-US"].url}`
                    : null;
                }

                return (
                  <tr key={i}>
                    <td>{num}</td>
                    <td>{date}</td>
                    <td>
                      {fileUrl && (
                        <a
                          href={fileUrl}
                          download
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <button>Download PDF</button>
                        </a>
                      )}
                      <a href={`/invoice/${fileLink?.sys?.id || num}`}>
                        <button>Open</button>
                      </a>
                      <button
                        onClick={() => {
                          if (
                            confirm(
                              `Are you sure you want to delete invoice #${num}?`
                            )
                          ) {
                            console.log(`Delete invoice ${num}`);
                            // TODO: call Contentful Management API
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

  // ===========================
  // Unknown content type
  // ===========================
  console.warn(
    `Content type '${type}' not supported for slug '${fullPath}'`,
    page
  );
  return notFound();
}
