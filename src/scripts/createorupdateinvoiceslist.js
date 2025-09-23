// src/scripts/createorupdateinvoiceslist.js
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import contentful from "contentful-management";

dotenv.config();

const SPACE_ID = process.env.CONTENTFUL_SPACE_ID;
const ENVIRONMENT = process.env.CONTENTFUL_ENVIRONMENT || "master";
const ACCESS_TOKEN = process.env.CONTENTFUL_MANAGEMENT_TOKEN;
const INVOICE_FOLDER = path.join(process.cwd(), "invoices");

// Replace with your real content type ID from Contentful
const CONTENT_TYPE_ID = "invoicesList"; // <--- check your Contentful content model API ID
const ENTRY_SLUG = "/invoicelist"; // the slug field value you use

const client = contentful.createClient({ accessToken: ACCESS_TOKEN });

async function uploadAsset(filePath, fileName) {
  const env = await client.getSpace(SPACE_ID).then(space => space.getEnvironment(ENVIRONMENT));

  // Check if asset already exists
  const existing = await env.getAssets({ "fields.title": fileName });
  if (existing.items.length > 0) {
    console.log(`✅ Asset already exists for ${fileName}`);
    return existing.items[0];
  }

  // Create new asset
  const asset = await env.createAsset({
    fields: {
      title: { "en-US": fileName },
      file: {
        "en-US": {
          contentType: "application/pdf",
          fileName,
          upload: `https://example.com/${fileName}`, // Temporary placeholder for processing
        },
      },
    },
  });

  // Actually upload the local PDF
  await asset.processForLocale("en-US", { file: { upload: `file://${filePath}` } });
  await asset.publish();
  console.log(`✅ Uploaded and published: ${fileName}`);
  return asset;
}

async function main() {
  const files = fs.readdirSync(INVOICE_FOLDER).filter(f => f.endsWith(".pdf"));
  if (files.length === 0) return console.log("No PDF files found in invoices folder.");

  const env = await client.getSpace(SPACE_ID).then(space => space.getEnvironment(ENVIRONMENT));

  // Fetch or create entry
  let entry;
  const existingEntries = await env.getEntries({
    content_type: entry.sys.id,
    "fields.slug": ENTRY_SLUG,
    limit: 1,
  });

  if (existingEntries.items.length > 0) {
    entry = existingEntries.items[0];
    console.log("ℹ️  Updating existing entry");
  } else {
    entry = await env.createEntry(CONTENT_TYPE_ID, {
      fields: { slug: { "en-US": ENTRY_SLUG } },
    });
    console.log("ℹ️  Created new entry");
  }

  // Upload assets
  const assets = [];
  for (const file of files) {
    const filePath = path.join(INVOICE_FOLDER, file);
    const asset = await uploadAsset(filePath, file);
    assets.push(asset);
  }

  // Update fields
  entry.fields.invoiceFile = {
    "en-US": { sys: { type: "Link", linkType: "Asset", id: assets[0].sys.id } },
  };
  entry.fields.invoiceFile = {
    "en-US": assets.map(a => ({ sys: { type: "Link", linkType: "Asset", id: a.sys.id } })),
  };
  entry.fields.invoiceNumbers = { "en-US": files };
  entry.fields.invoiceDate = { "en-US": new Date().toISOString() };

  // Save and publish
  await entry.update();
  await entry.publish();
  console.log("✅ InvoicesList entry updated successfully", entry.sys.id);
}

main().catch(err => {
  console.error("❌ Error running script:", err);
});
