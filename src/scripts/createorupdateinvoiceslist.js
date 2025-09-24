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
const ENTRY_SLUG = "/invoiceslist";  // unique slug

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

  // Process & publish
  asset = await asset.processForAllLocales();
  const published = await asset.publish();

  console.log(`✅ Uploaded asset: ${fileName}`);
  return published;
}

async function getOrCreateInvoicesList(env, assetIds, fileNames) {
  // Check if an entry with this slug exists
  const existing = await env.getEntries({
    content_type: CONTENT_TYPE,
    "fields.slug": ENTRY_SLUG,
  });

  if (existing.items.length > 0) {
    const entry = existing.items[0];
    console.log(`ℹ️ Updating existing entry: ${entry.sys.id}`);

    entry.fields = {
      ...entry.fields,
      slug: { "en-US": ENTRY_SLUG },
      invoiceDate: { "en-US": new Date().toISOString() },
      invoiceNumbers: { "en-US": fileNames },
      invoiceFile: {
        "en-US": { sys: { type: "Link", linkType: "Asset", id: assetIds[0] } },
      },
      invoiceFiles: {
        "en-US": assetIds.map((id) => ({
          sys: { type: "Link", linkType: "Asset", id },
        })),
      },
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
        invoiceDate: { "en-US": new Date().toISOString() },
        invoiceNumbers: { "en-US": fileNames },
        invoiceFile: {
          "en-US": { sys: { type: "Link", linkType: "Asset", id: assetIds[0] } },
        },
        invoiceFiles: {
          "en-US": assetIds.map((id) => ({
            sys: { type: "Link", linkType: "Asset", id },
          })),
        },
      },
    });

    const published = await entry.publish();
    console.log(`✅ Created entry: ${published.sys.id}`);
    return published;
  }
}

async function main() {
  try {
    const space = await client.getSpace(process.env.CONTENTFUL_SPACE_ID);
    const env = await space.getEnvironment("master");

    // Collect all PDFs in invoices/ folder
    const files = fs
      .readdirSync(INVOICES_FOLDER)
      .filter((f) => f.toLowerCase().endsWith(".pdf"));

    if (files.length === 0) {
      console.warn("⚠️ No PDF files found in invoices/ folder.");
      return;
    }

    const assetIds = [];
    const fileNames = [];

    for (const fileName of files) {
      const filePath = path.join(INVOICES_FOLDER, fileName);

      // Check if asset already exists by title
      const existing = await env.getAssets({ "fields.title": fileName });
      if (existing.items.length > 0) {
        console.log(`✅ Asset already exists for ${fileName}`);
        assetIds.push(existing.items[0].sys.id);
        fileNames.push(fileName);
        continue;
      }

      const asset = await uploadAsset(env, filePath, fileName);
      assetIds.push(asset.sys.id);
      fileNames.push(fileName);
    }

    // Create or update invoicesList entry
    await getOrCreateInvoicesList(env, assetIds, fileNames);

  } catch (err) {
    console.error("❌ Error running script:", err);
  }
}

main();
