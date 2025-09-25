// src/app/api/invoices/route.js
import { NextResponse } from "next/server";

// Contentful Delivery API credentials
const SPACE_ID = process.env.CONTENTFUL_SPACE_ID;
const ENVIRONMENT = "master";
const CDA_TOKEN = process.env.CONTENTFUL_DELIVERY_TOKEN; // Delivery, not Management API

const CONTENT_TYPE = "invoicesList";

export async function GET() {
  try {
    const res = await fetch(
      `https://cdn.contentful.com/spaces/${SPACE_ID}/environments/${ENVIRONMENT}/entries?content_type=${CONTENT_TYPE}&include=2`,
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

    // always take the first invoicesList entry
    const entry = data.items[0];
    const assets = data.includes?.Asset || [];

    // Build invoice list in UI-friendly shape
    const invoices = (entry.fields.invoiceNumbers?.["en-US"] || []).map(
      (num, idx) => {
        const date =
          entry.fields.invoiceDates?.["en-US"]?.[idx] || new Date().toISOString();
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
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Missing invoice ID" },
        { status: 400 }
      );
    }

    // In production you'd call the Contentful Management API here
    // to unpublish/delete the asset or remove it from the entry.
    // For now, we’ll just simulate success:
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error deleting invoice:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
