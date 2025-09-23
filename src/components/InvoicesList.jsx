// src/components/InvoicesList.jsx
"use client";
import { useEffect, useState } from "react";
import { createClient } from "contentful";

const client = createClient({
  space: process.env.NEXT_PUBLIC_CONTENTFUL_SPACE_ID,
  accessToken: process.env.NEXT_PUBLIC_CONTENTFUL_DELIVERY_TOKEN,
});

function InvoicesList() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchInvoices() {
      try {
        const res = await client.getEntries({
          content_type: "invoiceList", // use your real content type ID
          "fields.slug": "/invoicelist",
        });

        if (res.items.length > 0) {
          const invoiceNumbers = res.items[0].fields.invoiceNumbers || [];
          setInvoices(invoiceNumbers);
        }
      } catch (err) {
        console.error("Error fetching invoices:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchInvoices();
  }, []);

  if (loading) return <p>Loading invoices...</p>;
  if (invoices.length === 0) return <p>No invoices found.</p>;

  return (
    <ul>
      {invoices.map((num) => (
        <li key={num}>{num}</li>
      ))}
    </ul>
  );
}

// 👇 THIS is what was missing
export default InvoicesList;
