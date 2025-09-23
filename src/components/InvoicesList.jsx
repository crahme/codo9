"use client";

import { useEffect, useState } from "react";

function InvoicesList() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchInvoices() {
      try {
        const res = await fetch("/api/invoices"); // Next.js API route
        const data = await res.json();
        setInvoices(data);
      } catch (err) {
        console.error("Error fetching invoices:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchInvoices();
  }, []);

  const handleDownload = (url) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = url.split("/").pop();
    link.click();
  };

  const handleOpen = (url) => {
    window.open(url, "_blank");
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this invoice?")) return;

    const res = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
    if (res.ok) setInvoices((prev) => prev.filter((inv) => inv.id !== id));
  };

  if (loading) return <p>Loading invoices...</p>;
  if (invoices.length === 0) return <p>No invoices found.</p>;

  return (
    <table className="min-w-full border border-gray-300">
      <thead>
        <tr className="bg-gray-100">
          <th className="px-4 py-2 border">Invoice Number</th>
          <th className="px-4 py-2 border">Invoice Date</th>
          <th className="px-4 py-2 border">Actions</th>
        </tr>
      </thead>
      <tbody>
        {invoices.map((inv) => (
          <tr key={inv.id} className="text-center">
            <td className="px-4 py-2 border">{inv.number}</td>
            <td className="px-4 py-2 border">
              {inv.date ? new Date(inv.date).toLocaleDateString() : "-"}
            </td>
            <td className="px-4 py-2 border space-x-2">
              <button
                className="px-2 py-1 bg-blue-500 text-white rounded"
                onClick={() => handleDownload(inv.url)}
              >
                Download PDF
              </button>
              <button
                className="px-2 py-1 bg-green-500 text-white rounded"
                onClick={() => handleOpen(inv.url)}
              >
                Open
              </button>
              <button
                className="px-2 py-1 bg-red-500 text-white rounded"
                onClick={() => handleDelete(inv.id)}
              >
                Delete
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default InvoicesList;
