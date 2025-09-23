// src/scripts/createOrUpdateInvoicesList.js
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import contentful from "contentful-management";

dotenv.config();

const SPACE_ID = process.env.CONTENTFUL_SPACE_ID;
const ENVIRONMENT = process.env.CONTENTFUL_ENVIRONMENT || "master";
const ACCESS_TOKEN = process.env.CONTENTFUL_MANAGEMENT_TOKEN;
const INVOICE_FOLDER = path.join(process.cwd(), "invoices");
const SLUG = "/invoicelist";

const client = contentful.createClient({ accessToken: ACCESS_TOKEN });

async function uploadAsset(filePath, fileName) {
  const env = await client.getSpace(SPACE_ID).then(space => space.getEnvironment(ENVIRONMENT));

  // Check if asset exists
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

async function main() {
  try {
    const env = await client.getSpace(SPACE_ID).then(space => space.getEnvironment(ENVIRONMENT));
    const files = fs.readdirSync(INVOICE_FOLDER).filter(f => f.endsWith(".pdf"));
    if (!files.length) return console.log("No PDF files found");

    const assets = [];
    for (const file of files) {
      const filePath = path.join(INVOICE_FOLDER, file);
      const asset = await uploadAsset(filePath, file);
      assets.push(asset);
    }

    // Check if entry exists
    const existingEntries = await env.getEntries({
      content_type: "invoiceList",
      "fields.slug": SLUG,
    });

    let entry;
    if (existingEntries.items.length > 0) {
      entry = existingEntries.items[0];
      console.log(`ℹ️ Updating existing entry: ${entry.sys.id}`);
    } else {
      // Create new entry first
      entry = await env.createEntry("invoiceList", {
        fields: { slug: { "en-US": SLUG } },
      });
      console.log(`ℹ️ Created new entry: ${entry.sys.id}`);
    }

    // Update all fields BEFORE publishing
    entry.fields.invoiceFile = {
      "en-US": { sys: { type: "Link", linkType: "Asset", id: assets[0].sys.id } },
    };
    entry.fields.invoiceFiles = {
      "en-US": assets.map(a => ({ sys: { type: "Link", linkType: "Asset", id: a.sys.id } })),
    };
    entry.fields.invoiceNumbers = { "en-US": files };
    entry.fields.invoiceDate = { "en-US": new Date().toISOString() };

    const updatedEntry = await entry.update(); // increment version properly
    await updatedEntry.publish(); // safe publish

    console.log("✅ InvoicesList entry updated and published successfully");
  } catch (err) {
    console.error("❌ Error running script:", err);
  }
}

main();
