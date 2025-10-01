import { NextResponse } from "next/server";

const SPACE_ID = process.env.CONTENTFUL_SPACE_ID;
const ENVIRONMENT = "master";
const CDA_TOKEN = process.env.CONTENTFUL_DELIVERY_TOKEN;

const CONTENT_TYPE = "invoicesList";
const ENTRY_SLUG = "invoiceslist";

export async function GET() {
  try {
    const res = await fetch(
      `https://cdn.contentful.com/spaces/${SPACE_ID}/environments/${ENVIRONMENT}/entries?content_type=${CONTENT_TYPE}&fields.slug=${ENTRY_SLUG}&include=2`,
      {
        headers: {
          Authorization: `Bearer ${CDA_TOKEN}`, // ✅ correct auth header
        },
        cache: "no-store", // optional: avoid caching in dev
      }
    );

    if (!res.ok) {
      console.error("Contentful fetch failed:", res.status, res.statusText);
      return NextResponse.json([], { status: res.status });
    }

    const data = await res.json();

    if (!data.items || data.items.length === 0) {
      return NextResponse.json([]); // ✅ always return an array
    }

    const entry = data.items[0];
    const assets = data.includes?.Asset || [];

    // Map invoices into UI-friendly shape
    const invoices = (entry.fields.invoiceNumbers?.["en-US"] || []).map(
      (num, idx) => {
        const date =
          entry.fields.invoiceDates?.["en-US"]?.[idx] ||
          new Date().toISOString();
        const assetLink = entry.fields.invoiceFiles?.["en-US"]?.[idx];
        let url = "#";

        if (assetLink) {
          const asset = assets.find((a) => a.sys.id === assetLink.sys.id);
          url = asset?.fields?.file?.["en-US"]?.url
            ? `https:${asset.fields.file["en-US"].url}`
            : "#";
        }

        return {
          id: `${num}-${idx}`,
          number: num,
          date,
          url,
        };
      }
    );

    return NextResponse.json(invoices);
  } catch (err) {
    console.error("Error fetching invoices:", err);
    return NextResponse.json([], { status: 500 }); // ✅ always return an array
  }
}

export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing invoice ID" }, { status: 400 });
    }

    // TODO: Call Contentful Management API to actually delete
    console.log("Pretend deleting invoice:", id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error deleting invoice:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
