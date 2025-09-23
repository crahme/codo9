// src/scripts/createorupdateinvoiceslist.js
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import contentful from "contentful-management";

dotenv.config();

const SPACE_ID = process.env.CONTENTFUL_SPACE_ID;
const ENVIRONMENT = process.env.CONTENTFUL_ENVIRONMENT || "master";
const ACCESS_TOKEN = process.env.CONTENTFUL_MANAGEMENT_TOKEN;

const client = contentful.createClient({ accessToken: ACCESS_TOKEN });
const INVOICE_FOLDER = path.join(process.cwd(), "invoices");
const SLUG = "/invoicelist"; // slug for the entry

// Upload a PDF file to Contentful
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
          upload: `file://${filePath}`,
        },
      },
    },
  });

  await asset.processForAllLocales();
  await asset.publish();
  console.log(`✅ Uploaded and published: ${fileName}`);
  return asset;
}

// Fetch existing entry by slug, or create if missing
async function getOrCreateInvoicesEntry(env) {
  const res = await env.getEntries({
    content_type: "invoiceList",
    "fields.slug": SLUG,
    limit: 1,
  });

  if (res.items.length > 0) {
    console.log("📄 Found existing InvoicesList entry");
    return res.items[0];
  }

  console.log("📄 No entry found, creating a new InvoicesList entry");
  const entry = await env.createEntry("invoiceList", {
    fields: {
      slug: { "en-US": SLUG },
      invoiceNumbers: { "en-US": [] },
      invoiceDate: { "en-US": new Date().toISOString() },
      invoiceFile: { "en-US": null },
      invoiceFiles: { "en-US": [] },
    },
  });
  await entry.publish();
  return entry;
}

async function main() {
  const files = fs.readdirSync(INVOICE_FOLDER).filter(f => f.endsWith(".pdf"));
  if (files.length === 0) return console.log("❌ No PDF files found in invoices folder");

  const env = await client.getSpace(SPACE_ID).then(space => space.getEnvironment(ENVIRONMENT));

  // Upload all PDFs and collect assets
  const assets = [];
  for (const file of files) {
    const filePath = path.join(INVOICE_FOLDER, file);
    const asset = await uploadAsset(filePath, file);
    assets.push(asset);
  }

  // Get or create the InvoicesList entry
  const entry = await getOrCreateInvoicesEntry(env);

  // Update entry fields
  entry.fields.invoiceFile = {
    "en-US": {
      sys: { type: "Link", linkType: "Asset", id: assets[0].sys.id },
    },
  };

  entry.fields.invoiceFiles = {
    "en-US": assets.map(a => ({ sys: { type: "Link", linkType: "Asset", id: a.sys.id } })),
  };

  entry.fields.invoiceNumbers = { "en-US": files };
  entry.fields.invoiceDate = { "en-US": new Date().toISOString() };

  await entry.update();
  await entry.publish();
  console.log("✅ InvoicesList entry updated successfully!");
}

main().catch(err => {
  console.error("❌ Error running script:", err);
});
