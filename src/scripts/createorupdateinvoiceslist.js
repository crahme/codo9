// src/scripts/createOrUpdateInvoicesList.js
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import contentful from "contentful-management";

dotenv.config();

const SPACE_ID = process.env.CONTENTFUL_SPACE_ID;
const ENVIRONMENT = process.env.CONTENTFUL_ENVIRONMENT || "master";
const ACCESS_TOKEN = process.env.CONTENTFUL_MANAGEMENT_TOKEN;
const ENTRY_SLUG = "/invoicelist"; // change if needed
const INVOICE_FOLDER = path.join(process.cwd(), "invoices");

const client = contentful.createClient({ accessToken: ACCESS_TOKEN });

async function getEnvironment() {
  const space = await client.getSpace(SPACE_ID);
  return space.getEnvironment(ENVIRONMENT);
}

async function uploadAsset(env, filePath, fileName) {
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
          upload: `https://example.com/dummy.pdf`, // placeholder
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
  if (files.length === 0) {
    console.log("No PDF files found in invoices folder");
    return;
  }

  const env = await getEnvironment();

  // Upload all PDFs
  const assets = [];
  for (const file of files) {
    const filePath = path.join(INVOICE_FOLDER, file);
    const asset = await uploadAsset(env, filePath, file);
    assets.push(asset);
  }

  // Check if an entry already exists by slug
  const entries = await env.getEntries({
    content_type: "invoicesList",
    "fields.slug": ENTRY_SLUG,
  });

  let entry;
  if (entries.items.length > 0) {
    entry = entries.items[0];
    console.log(`ℹ️ Updating existing entry: ${entry.sys.id}`);
  } else {
    entry = await env.createEntry("invoicesList", {
      fields: {
        slug: { "en-US": ENTRY_SLUG },
      },
    });
    console.log(`ℹ️ Created new entry: ${entry.sys.id}`);
  }

  // Update fields
  if ("invoiceFile" in entry.fields) {
    entry.fields.invoiceFile = {
      "en-US": { sys: { type: "Link", linkType: "Asset", id: assets[0].sys.id } },
    };
  }

  if ("invoiceFiles" in entry.fields) {
    entry.fields.invoiceFiles = {
      "en-US": assets.map(a => ({ sys: { type: "Link", linkType: "Asset", id: a.sys.id } })),
    };
  } else {
    console.log("⚠️ Field 'invoiceFiles' does not exist. Skipping multi-asset update.");
  }

  if ("invoiceNumbers" in entry.fields) {
    entry.fields.invoiceNumbers = { "en-US": files };
  }

  if ("invoiceDate" in entry.fields) {
    entry.fields.invoiceDate = { "en-US": new Date().toISOString() };
  }

  // Update and publish
  await entry.update();
  await entry.publish();
  console.log("✅ InvoicesList entry updated successfully");
}

main().catch(err => {
  console.error("❌ Error running script:", err);
});
