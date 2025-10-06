"use client";

import { useEffect, useState } from "react";

export default function InvoicesList() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchInvoices() {
      try {
        const res = await fetch("/invoiceslist/invoiceslist-1758624798660"); // fetches from Contentful
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

  const handleDownload = async (url) => {
    try {
      if (!url) return;
      // Fetch the file as a Blob to support reliable cross-origin downloads
      const response = await fetch(url, { mode: "cors" });
      if (!response.ok) {
        window.open(url, "_blank");
        return;
      }
      const blob = await response.blob();
      const filename = (url.split("/").pop() || "invoice.pdf").split("?")[0];

      // Prefer a library for robust downloads (if available)
      try {
        const mod = await import("file-saver");
        if (mod && typeof mod.saveAs === "function") {
          mod.saveAs(blob, filename);
          return;
        }
      } catch (_) {
        // Library not available at runtime; fall back to manual link method
      }

      // Fallback: manual anchor approach
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
      console.error("Download failed, opening in new tab instead:", e);
      window.open(url, "_blank");
    }
  };

  const handleOpen = (url) => {
    window.open(url, "_blank");
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this invoice?")) return;

    const res = await fetch(`/invoiceslist/invoiceslist-1758624798660`, { method: "DELETE" });
    if (res.ok) {
      setInvoices((prev) => prev.filter((inv) => inv.id !== id));
    } else {
      alert("Failed to delete invoice");
    }
  };

  if (loading) return <p>Loading invoices...</p>;
  if (invoices.length === 0) return <p>No invoices found.</p>;

  return (
    <table className="min-w-full border border-gray-300">
      <thead>
        <tr className="bg-gray-100 text-center">
          <th className="px-4 py-2 border">Invoice Number</th>
          <th className="px-4 py-2 border">Invoice Date</th>
          <th className="px-4 py-2 border">Actions</th>
        </tr>
      </thead>
      <tbody>
        {invoices.map((inv) => (
          <tr key={inv.id} className="text-center">
            {/* 1st column */}
            <td className="px-4 py-2 border">{inv.number}</td>

            {/* 2nd column */}
            <td className="px-4 py-2 border">
              {inv.date ? new Date(inv.date).toLocaleDateString() : "-"}
            </td>

            {/* 3rd column */}
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
