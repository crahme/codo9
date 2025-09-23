// src/scripts/createOrUpdateInvoicesList.js
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import contentful from "contentful-management";

dotenv.config();

const SPACE_ID = process.env.CONTENTFUL_SPACE_ID;
const ENVIRONMENT = process.env.CONTENTFUL_ENVIRONMENT || "master";
const ACCESS_TOKEN = process.env.CONTENTFUL_MANAGEMENT_TOKEN;
const ENTRY_ID = process.env.INVOICE_ENTRY_ID; // optional

const INVOICE_FOLDER = path.join(process.cwd(), "invoices");

const client = contentful.createClient({
  accessToken: ACCESS_TOKEN,
});

// Upload a PDF asset to Contentful
async function uploadAsset(filePath, fileName) {
  const env = await client.getSpace(SPACE_ID).then((space) => space.getEnvironment(ENVIRONMENT));

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
          upload: `https://localhost/${fileName}`, // temporary URL
        },
      },
    },
  });

  // Upload local file properly
  await asset.processForLocale("en-US", { file: { upload: `file://${filePath}` } });
  await asset.publish();
  console.log(`✅ Uploaded and published: ${fileName}`);
  return asset;
}

async function main() {
  const env = await client.getSpace(SPACE_ID).then((space) => space.getEnvironment(ENVIRONMENT));
  const files = fs.readdirSync(INVOICE_FOLDER).filter((f) => f.endsWith(".pdf"));

  if (files.length === 0) return console.log("No PDF files found in invoices folder.");

  const assets = [];
  for (const file of files) {
    const filePath = path.join(INVOICE_FOLDER, file);
    const asset = await uploadAsset(filePath, file);
    assets.push(asset);
  }

  // Get existing entry or create a new one
  let entry;
  if (ENTRY_ID) {
    try {
      entry = await env.getEntry(ENTRY_ID);
      console.log("ℹ️ Updating existing entry:", ENTRY_ID);
    } catch {
      console.log("⚠️ ENTRY_ID not found, creating new entry...");
    }
  }

  if (!entry) {
    entry = await env.createEntry("invoicesList", {
      fields: {
        slug: { "en-US": "/invoiceslist" },
      },
    });
    console.log("ℹ️ Created new entry:", entry.sys.id);
  }

  // Set invoiceFile (first PDF) and invoiceNumbers
  entry.fields.invoiceFile = {
    "en-US": { sys: { type: "Link", linkType: "Asset", id: assets[0].sys.id } },
  };

  entry.fields.invoiceNumbers = {
    "en-US": files,
  };

  entry.fields.invoiceDate = {
    "en-US": new Date().toISOString(),
  };

  // Save and publish
  await entry.update();
  await entry.publish();

  console.log("✅ InvoicesList updated successfully:", entry.sys.id);
}

main().catch((err) => {
  console.error("❌ Error running script:", err);
});
