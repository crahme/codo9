// src/scripts/createOrUpdateInvoicesList.js
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import contentful from "contentful-management";

dotenv.config();

const SPACE_ID = process.env.CONTENTFUL_SPACE_ID;
const ENVIRONMENT = process.env.CONTENTFUL_ENVIRONMENT || "master";
const ACCESS_TOKEN = process.env.CONTENTFUL_MANAGEMENT_TOKEN;

const client = contentful.createClient({ accessToken: ACCESS_TOKEN });

// Folder containing local PDF invoices
const INVOICE_FOLDER = path.join(process.cwd(), "invoices");

// The entry ID for your invoice list in Contentful
const ENTRY_ID = process.env.INVOICE_ENTRY_ID; // You can also hardcode it if needed

async function uploadAsset(filePath, fileName) {
  const env = await client.getSpace(SPACE_ID).then(space => space.getEnvironment(ENVIRONMENT));

  // Check if asset already exists by title
  const existing = await env.getAssets({ "fields.title": fileName });
  if (existing.items.length > 0) {
    console.log(`✅ Asset already exists for ${fileName}`);
    return existing.items[0];
  }

  // Read local PDF file as base64
  const fileBuffer = fs.readFileSync(filePath);

  // Create asset with base64 content
  const asset = await env.createAsset({
    fields: {
      title: { "en-US": fileName },
      file: {
        "en-US": {
          contentType: "application/pdf",
          fileName,
          content: fileBuffer.toString("base64"), // base64-encoded content
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
    // Read all PDF files in the invoices folder
    const files = fs.readdirSync(INVOICE_FOLDER).filter(f => f.endsWith(".pdf"));
    if (files.length === 0) return console.log("No PDF files found in invoices folder.");

    // Upload all PDFs
    const assets = [];
    for (const file of files) {
      const filePath = path.join(INVOICE_FOLDER, file);
      const asset = await uploadAsset(filePath, file);
      assets.push(asset);
    }

    // Get the Contentful entry for invoices list
    const env = await client.getSpace(SPACE_ID).then(space => space.getEnvironment(ENVIRONMENT));
    const entry = await env.getEntry(ENTRY_ID);

    // First PDF as single invoiceFile
    entry.fields.invoiceFile = {
      "en-US": {
        sys: { type: "Link", linkType: "Asset", id: assets[0].sys.id },
      },
    };

    // All PDFs as invoiceFiles array
    entry.fields.invoiceFiles = {
      "en-US": assets.map(a => ({ sys: { type: "Link", linkType: "Asset", id: a.sys.id } })),
    };

    // Store invoice numbers and current date
    entry.fields.invoiceNumbers = { "en-US": files };
    entry.fields.invoiceDate = { "en-US": new Date().toISOString() };

    // Update and publish entry
    await entry.update();
    await entry.publish();
    console.log("✅ InvoicesList entry updated successfully!");
  } catch (err) {
    console.error("❌ Error running script:", err);
  }
}

main();
