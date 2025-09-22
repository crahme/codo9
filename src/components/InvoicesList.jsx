// components/InvoicesList.jsx
"use client";

import { useEffect, useState } from "react";
import { createClient } from "contentful";
import { documentToReactComponents } from "@contentful/rich-text-react-renderer";

const client = createClient({
  space: process.env.CONTENTFUL_SPACE_ID,
  accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN,
  environment:process.env.CONTENTFUL_ENVIRONMENT
});

// Management client (for updating InvoiceNumbers + deleting invoices)
import { createClient as createManagementClient } from "contentful-management";

const mgmtClient = createManagementClient({
  accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN,
});

export default function InvoicesList() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        // 1. Fetch all invoices
        const res = await client.getEntries({
          content_type: "invoice", // content type ID for invoices
          order: "-fields.invoiceDate",
        });

        const fetchedInvoices = res.items.map((item) => ({
          id: item.sys.id,
          invoiceNumber: item.fields.invoiceNumber,
          invoiceDate: item.fields.invoiceDate,
          pdfUrl: item.fields.pdfFile?.fields?.file?.url || null,
        }));

        setInvoices(fetchedInvoices);

        // 2. Extract numbers
        const invoiceNumbers = fetchedInvoices.map((inv) => inv.invoiceNumber);

        // 3. Update the single InvoicesList entry dynamically
        const env = await mgmtClient
          .getSpace(process.env.CONTENTFUL_SPACE_ID)
          .then((space) => space.getEnvironment("master"));

        const entries = await env.getEntries({
          content_type: "invoicesList",
          "fields.slug": "/invoiceslist",
        });

        if (entries.items.length > 0) {
          const invoicesListEntry = entries.items[0];
          invoicesListEntry.fields.invoiceNumbers = {
            "en-US": invoiceNumbers,
          };
          await invoicesListEntry.update();
          await invoicesListEntry.publish();
        }
      } catch (err) {
        console.error("Error fetching invoices:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchInvoices();
  }, []);

  const handleDelete = async (invoiceId) => {
    try {
      const env = await mgmtClient
        .getSpace(process.env.CONTENTFUL_SPACE_ID)
        .then((space) => space.getEnvironment("master"));

      const entry = await env.getEntry(invoiceId);
      await entry.unpublish();
      await entry.delete();

      setInvoices((prev) => prev.filter((inv) => inv.id !== invoiceId));
    } catch (err) {
      console.error("Error deleting invoice:", err);
    }
  };

  if (loading) return <p>Loading invoices...</p>;

  if (invoices.length === 0) return <p>No invoices found.</p>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Invoices List</h1>
      <table className="min-w-full border border-gray-300">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-4 py-2">Invoice Number</th>
            <th className="border px-4 py-2">Invoice Date</th>
            <th className="border px-4 py-2">Invoice Operations</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => (
            <tr key={invoice.id}>
              <td className="border px-4 py-2">{invoice.invoiceNumber}</td>
              <td className="border px-4 py-2">
                {new Date(invoice.invoiceDate).toLocaleDateString()}
              </td>
              <td className="border px-4 py-2 flex gap-2">
                {invoice.pdfUrl && (
                  <a
                    href={invoice.pdfUrl}
                    download
                    className="px-2 py-1 bg-blue-500 text-white rounded"
                  >
                    Download PDF
                  </a>
                )}
                {invoice.pdfUrl && (
                  <a
                    href={invoice.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-1 bg-green-500 text-white rounded"
                  >
                    Open
                  </a>
                )}
                <button
                  onClick={() => handleDelete(invoice.id)}
                  className="px-2 py-1 bg-red-500 text-white rounded"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
