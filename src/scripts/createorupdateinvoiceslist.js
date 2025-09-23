// src/scripts/createOrUpdateInvoicesList.js
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import contentful from "contentful-management";

dotenv.config();

const SPACE_ID = process.env.CONTENTFUL_SPACE_ID;
const ENVIRONMENT = process.env.CONTENTFUL_ENVIRONMENT || "master";
const ACCESS_TOKEN = process.env.CONTENTFUL_MANAGEMENT_TOKEN;
const SLUG = process.env.SLUG || "/invoicelist";
const INVOICE_FOLDER = process.env.INVOICE_FOLDER || path.join(process.cwd(), "invoices");
const CONTENT_TYPE_ID = process.env.CONTENT_TYPE_ID || "invoicesList";

const client = contentful.createClient({ accessToken: ACCESS_TOKEN });

async function getEnvironment() {
  const space = await client.getSpace(SPACE_ID);
  return await space.getEnvironment(ENVIRONMENT);
}

async function uploadAsset(filePath, fileName) {
  const env = await getEnvironment();

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
          upload: fs.existsSync(filePath) ? undefined : `https://example.com/${fileName}`,
          file: fs.existsSync(filePath) ? fs.readFileSync(filePath) : undefined,
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
  try {
    const env = await getEnvironment();

    // Check content type exists
    const contentTypes = await env.getContentTypes();
    if (!contentTypes.items.find(ct => ct.sys.id === CONTENT_TYPE_ID)) {
      throw new Error(`Content type "${CONTENT_TYPE_ID}" does not exist. Please create it first.`);
    }

    // Upload PDFs
    const files = fs.readdirSync(INVOICE_FOLDER).filter(f => f.endsWith(".pdf"));
    if (files.length === 0) return console.log("No PDF files found in invoices folder.");

    const assets = [];
    for (const file of files) {
      const filePath = path.join(INVOICE_FOLDER, file);
      const asset = await uploadAsset(filePath, file);
      assets.push(asset);
    }

    // Find existing entry by slug
    let entry;
    const existingEntries = await env.getEntries({
      content_type: CONTENT_TYPE_ID,
      "fields.slug": SLUG,
    });

    if (existingEntries.items.length > 0) {
      entry = existingEntries.items[0];
      console.log(`ℹ️ Updating existing entry: ${entry.sys.id}`);
    } else {
      entry = await env.createEntry(CONTENT_TYPE_ID, {
        fields: {
          slug: { "en-US": SLUG },
        },
      });
      console.log(`ℹ️ Created new entry: ${entry.sys.id}`);
    }

    // Update entry fields
    entry.fields.invoiceFile = {
      "en-US": { sys: { type: "Link", linkType: "Asset", id: assets[0].sys.id } },
    };

    entry.fields.invoiceFiles = {
      "en-US": assets.map(a => ({ sys: { type: "Link", linkType: "Asset", id: a.sys.id } })),
    };

    entry.fields.invoiceNumbers = { "en-US": files };
    entry.fields.invoiceDate = { "en-US": new Date().toISOString() };

    await entry.update();
    await entry.publish();

    console.log("✅ Invoices list updated successfully!");
  } catch (err) {
    console.error("❌ Error running script:", err);
  }
}

main();
