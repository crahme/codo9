// src/scripts/createOrUpdateInvoicesList.js
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import contentful from "contentful-management";

dotenv.config();

const SPACE_ID = process.env.CONTENTFUL_SPACE_ID;
const ENVIRONMENT = process.env.CONTENTFUL_ENVIRONMENT || "master";
const ACCESS_TOKEN = process.env.CONTENTFUL_MANAGEMENT_TOKEN;
const ENTRY_ID = process.env.INVOICE_ENTRY_ID; // optional, can be undefined
const CONTENT_TYPE = "invoicesList"; // your content type

const client = contentful.createClient({ accessToken: ACCESS_TOKEN });
const INVOICE_FOLDER = path.join(process.cwd(), "invoices");

async function uploadAsset(filePath, fileName) {
  const env = await client.getSpace(SPACE_ID).then(space => space.getEnvironment(ENVIRONMENT));

  // Check if asset already exists
  const existing = await env.getAssets({ "fields.title": fileName });
  if (existing.items.length > 0) {
    console.log(`✅ Asset already exists for ${fileName}`);
    return existing.items[0];
  }

  const asset = await env.createAsset({
    fields: {
      title: { "en-US": fileName },
      file: {
        "en-US": {
          contentType: "application/pdf",
          fileName,
          upload: `https://${filePath.replace(/\\/g, "/")}` // Contentful now requires HTTPS upload or a URL
        },
      },
    },
  });

  await asset.processForAllLocales();
  await asset.publish();
  console.log(`✅ Uploaded and published: ${fileName}`);
  return asset;
}

async function main() {
  const files = fs.readdirSync(INVOICE_FOLDER).filter(f => f.endsWith(".pdf"));
  if (files.length === 0) return console.log("No PDF files found in invoices folder.");

  const env = await client.getSpace(SPACE_ID).then(space => space.getEnvironment(ENVIRONMENT));
  const assets = [];

  for (const file of files) {
    const filePath = path.join(INVOICE_FOLDER, file);
    const asset = await uploadAsset(filePath, file);
    assets.push(asset);
  }

  let entry;
  if (ENTRY_ID) {
    try {
      entry = await env.getEntry(ENTRY_ID);
      console.log(`ℹ️ Updating existing entry: ${ENTRY_ID}`);
    } catch {
      console.log("⚠️ Entry ID not found, creating a new entry.");
    }
  }

  // If entry not found, create a new one
  if (!entry) {
    // Avoid slug conflict: use a unique slug if /invoicelist exists
    const slugBase = "/invoicelist";
    const existingEntries = await env.getEntries({ content_type: CONTENT_TYPE, "fields.slug": slugBase });
    const slug = existingEntries.items.length === 0 ? slugBase : `${slugBase}-${Date.now()}`;

    entry = await env.createEntry(CONTENT_TYPE, { fields: { slug: { "en-US": slug } } });
    console.log(`ℹ️ Created new entry: ${entry.sys.id}`);
  }

  // Update fields safely
  entry.fields.invoiceFile = {
    "en-US": { sys: { type: "Link", linkType: "Asset", id: assets[0].sys.id } },
  };

  if (entry.fields.hasOwnProperty("invoiceFiles")) {
    entry.fields.invoiceFiles = {
      "en-US": assets.map(a => ({ sys: { type: "Link", linkType: "Asset", id: a.sys.id } })),
    };
  } else {
    console.warn("⚠️ Field 'invoiceFiles' does not exist in this entry. Skipping multi-asset update.");
  }

  entry.fields.invoiceNumbers = { "en-US": files };
  entry.fields.invoiceDate = { "en-US": new Date().toISOString() };

  // Update and publish
  await entry.update();
  await entry.publish();
  console.log("✅ InvoicesList entry updated successfully.");
}

main().catch(err => console.error("❌ Error running script:", err));
