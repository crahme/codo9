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
          Authorization: `Bearer ${CDA_TOKEN}`,
        },
      }
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch from Contentful" },
        { status: res.status }
      );
    }

    const data = await res.json();

    if (data.items.length === 0) {
      return NextResponse.json([]);
    }

    const entry = data.items[0];
    const fileLinks = entry.fields.invoiceFiles?.["en-US"] || [];
    const assets = data.includes?.Asset || [];

    const invoices = fileLinks.map((link, idx) => {
      const asset = assets.find((a) => a.sys.id === link.sys.id);
      const url = asset?.fields?.file?.["en-US"]?.url
        ? `https:${asset.fields.file["en-US"].url}`
        : "#";

      const fileName = asset?.fields?.title?.["en-US"] || `Invoice ${idx + 1}`;
      const date =
        entry.fields.invoiceDates?.["en-US"]?.[idx] || new Date().toISOString();

      return {
        id: asset?.sys.id || idx,
        number: fileName, // derived from asset title
        date,
        url,
      };
    });

    return NextResponse.json(invoices);
  } catch (err) {
    console.error("Error fetching invoices:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
