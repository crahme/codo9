// src/scripts/createOrUpdateInvoicesList.js
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import contentful from "contentful-management";

dotenv.config();

const SPACE_ID = process.env.CONTENTFUL_SPACE_ID;
const ENVIRONMENT = process.env.CONTENTFUL_ENVIRONMENT || "master";
const ACCESS_TOKEN = process.env.CONTENTFUL_MANAGEMENT_TOKEN;

const client = contentful.createClient({
  accessToken: ACCESS_TOKEN,
});

const INVOICE_FOLDER = path.join(process.cwd(), "invoices"); // folder containing PDF files
const ENTRY_ID = process.env.INVOICE_ENTRY_ID; // existing entry to update

async function uploadAsset(filePath, fileName) {
  const fileData = fs.readFileSync(filePath);

  const asset = await client.getSpace(SPACE_ID)
    .then(space => space.getEnvironment(ENVIRONMENT))
    .then(env => env.createAsset({
      fields: {
        title: { "en-US": fileName },
        file: {
          "en-US": {
            contentType: "application/pdf",
            fileName,
            upload: `data:application/pdf;base64,${fileData.toString("base64")}`,
          },
        },
      },
    }));

  await asset.processForAllLocales();
  await asset.publish();
  console.log(`✅ Uploaded and published: ${fileName}`);
  return asset;
}

async function main() {
  const files = fs.readdirSync(INVOICE_FOLDER).filter(f => f.endsWith(".pdf"));
  if (files.length === 0) {
    console.log("No PDF files found in invoices folder.");
    return;
  }

  const assets = [];
  for (const file of files) {
    const filePath = path.join(INVOICE_FOLDER, file);

    // Check if asset already exists by title (optional, you could improve this)
    let asset;
    try {
      asset = await client.getSpace(SPACE_ID)
        .then(space => space.getEnvironment(ENVIRONMENT))
        .then(env => env.getAssets({ "fields.title": file }));
      if (asset.items.length > 0) {
        console.log(`✅ Asset already exists for ${file}`);
        asset = asset.items[0];
      } else {
        asset = await uploadAsset(filePath, file);
      }
    } catch (err) {
      asset = await uploadAsset(filePath, file);
    }
    assets.push(asset);
  }

  // Now update the invoices list entry
  const env = await client.getSpace(SPACE_ID).then(space => space.getEnvironment(ENVIRONMENT));
  const entry = await env.getEntry(ENTRY_ID);

  // Single invoiceFile: pick the first asset
  const mainInvoice = assets[0];
  entry.fields.invoiceFile = {
    "en-US": {
      sys: { type: "Link", linkType: "Asset", id: mainInvoice.sys.id }
    }
  };

  // Multiple invoiceFiles: array of all assets
  entry.fields.invoiceFiles = {
    "en-US": assets.map(a => ({
      sys: { type: "Link", linkType: "Asset", id: a.sys.id }
    }))
  };

  // Update invoiceNumbers and invoiceDate
  entry.fields.invoiceNumbers = {
    "en-US": files
  };
  entry.fields.invoiceDate = {
    "en-US": new Date().toISOString()
  };

  // Save and publish
  await entry.update();
  await entry.publish();
  console.log("✅ InvoicesList entry updated and published successfully.");
}

main().catch(console.error);
