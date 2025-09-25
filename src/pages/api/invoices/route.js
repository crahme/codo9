// src/pages/api/invoices/route.js
import { client } from "../../../utils/content";

export async function GET() {
  try {
    if (!client) {
      return new Response(
        JSON.stringify({ error: "Contentful client not initialized" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Fetch all entries of type 'invoicesList'
    const entries = await client.getEntries({
      content_type: "invoicesList",
      limit: 1, // adjust if you have multiple invoicesList entries
      include: 3,
    });

    const entry = entries.items?.[0];

    if (!entry) {
      return new Response(
        JSON.stringify({ error: "Invoices list not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const fields = entry.fields || {};

    // Map invoice files
    const invoiceFiles = (fields.invoiceFiles?.["en-US"] || []).map((asset) => {
      const file = asset.fields?.file?.["en-US"];
      return file
        ? {
            id: asset.sys.id,
            title: asset.fields.title?.["en-US"] || "",
            url: file.url.startsWith("//") ? "https:" + file.url : file.url,
          }
        : null;
    }).filter(Boolean);

    // Map invoice numbers and dates
    const invoiceNumbers = fields.invoiceNumbers?.["en-US"] || [];
    const invoiceDates = fields.invoiceDates?.["en-US"] || [];

    const invoices = invoiceFiles.map((file, index) => ({
      id: file.id,
      title: file.title,
      url: file.url,
      number: invoiceNumbers[index] || null,
      date: invoiceDates[index] || null,
    }));

    return new Response(JSON.stringify({ invoices }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("❌ /api/invoices error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
