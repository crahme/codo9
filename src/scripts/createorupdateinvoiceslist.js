// src/scripts/createOrUpdateInvoicesList.js
import fs from "fs";
import path from "path";
import contentful from "contentful-management";
import dotenv from "dotenv";

dotenv.config();

const client = contentful.createClient({
  accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN,
});

const INVOICES_FOLDER = path.resolve("invoices"); // your local invoices folder
const CONTENT_TYPE = "invoicesList"; // must match your Contentful content type
const ENTRY_SLUG = "invoiceslist";  // unique slug

// Upload a PDF file to Contentful and return the published asset
async function uploadAsset(env, filePath, fileName) {
  const buffer = fs.readFileSync(filePath);

  // Upload raw file to Contentful
  const upload = await env.createUpload({ file: buffer });

  // Create the asset linking to the upload
  let asset = await env.createAsset({
    fields: {
      title: { "en-US": fileName },
      file: {
        "en-US": {
          fileName,
          contentType: "application/pdf",
          uploadFrom: {
            sys: { type: "Link", linkType: "Upload", id: upload.sys.id },
          },
        },
      },
    },
  });

  asset = await asset.processForAllLocales();
  const published = await asset.publish();

  console.log(`✅ Uploaded asset: ${fileName}`);
  return published;
}

// Create or update the invoicesList entry
async function getOrCreateInvoicesList(env, assetList) {
  const existing = await env.getEntries({
    content_type: CONTENT_TYPE,
    "fields.slug": ENTRY_SLUG,
  });

  const invoiceNumbers = assetList.map(a => a.fields.title["en-US"]);
  const invoiceDates = assetList.map(() => new Date().toISOString());
  const invoiceFiles = assetList.map(a => ({
    sys: { type: "Link", linkType: "Asset", id: a.sys.id },
  }));

  if (existing.items.length > 0) {
    const entry = existing.items[0];
    console.log(`ℹ️ Updating existing entry: ${entry.sys.id}`);

    entry.fields = {
      ...entry.fields,
      slug: { "en-US": ENTRY_SLUG },
      invoiceNumbers: { "en-US": invoiceNumbers },
      invoiceDates: { "en-US": invoiceDates },
      invoiceFiles: { "en-US": invoiceFiles },
    };

    const updated = await entry.update();
    const published = await updated.publish();
    console.log(`✅ Updated entry: ${published.sys.id}`);
    return published;
  } else {
    console.log("ℹ️ Creating new invoicesList entry");

    const entry = await env.createEntry(CONTENT_TYPE, {
      fields: {
        slug: { "en-US": ENTRY_SLUG },
        invoiceNumbers: { "en-US": invoiceNumbers },
        invoiceDates: { "en-US": invoiceDates },
        invoiceFiles: { "en-US": invoiceFiles },
      },
    });

    const published = await entry.publish();
    console.log(`✅ Created entry: ${published.sys.id}`);
    return published;
  }
}

// Main
async function main() {
  try {
    const space = await client.getSpace(process.env.CONTENTFUL_SPACE_ID);
    const env = await space.getEnvironment("master");

    const files = fs
      .readdirSync(INVOICES_FOLDER)
      .filter(f => f.toLowerCase().endsWith(".pdf"));

    if (files.length === 0) {
      console.warn("⚠️ No PDF files found in invoices/ folder.");
      return;
    }

    const assetList = [];

    for (const fileName of files) {
      const filePath = path.join(INVOICES_FOLDER, fileName);

      // Check if asset already exists by title
      const existing = await env.getAssets({ "fields.title": fileName });
      if (existing.items.length > 0) {
        console.log(`✅ Asset already exists for ${fileName}`);
        assetList.push(existing.items[0]);
        continue;
      }

      const asset = await uploadAsset(env, filePath, fileName);
      assetList.push(asset);
    }

    // Create or update the invoicesList entry
    await getOrCreateInvoicesList(env, assetList);

  } catch (err) {
    console.error("❌ Error running script:", err);
  }
}

main();
