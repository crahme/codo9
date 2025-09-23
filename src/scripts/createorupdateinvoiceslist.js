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

async function uploadAsset(env, filePath, fileName) {
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
          upload: await fs.promises.readFile(filePath).then(buf => {
            const base64 = buf.toString("base64");
            return `data:application/pdf;base64,${base64}`;
          }),
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
  const env = await client.getSpace(SPACE_ID).then(space => space.getEnvironment(ENVIRONMENT));

  // Fetch invoiceList entry by slug
  const entries = await env.getEntries({
    content_type: "invoiceList",
    "fields.slug": "/invoicelist",
    limit: 1,
  });

  if (!entries.items.length) {
    throw new Error("No invoiceList entry found with slug /invoicelist");
  }

  const entry = entries.items[0];

  // Read all PDFs
  const files = fs.readdirSync(INVOICE_FOLDER).filter(f => f.endsWith(".pdf"));
  if (files.length === 0) return console.log("No PDF files found");

  // Upload all assets
  const assets = [];
  for (const file of files) {
    const filePath = path.join(INVOICE_FOLDER, file);
    const asset = await uploadAsset(env, filePath, file);
    assets.push(asset);
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

  // Save and publish
  await entry.update();
  await entry.publish();
  console.log("✅ InvoicesList updated successfully");
}

main().catch(err => console.error("❌ Error running script:", err));
