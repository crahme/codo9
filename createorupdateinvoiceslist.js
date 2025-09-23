// createorupdateinvoiceslist.js
import dotenv from "dotenv";
dotenv.config();
import fs from "fs";
import path from "path";
import pkg from "contentful-management";
const { createClient } = pkg;

const client = createClient({
  accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN,
});

// 📂 Local invoices directory
const INVOICES_DIR = path.resolve("./invoices");

// 🔎 Helper: find asset by title
async function getAssetByTitle(env, title) {
  const assets = await env.getAssets({ "fields.title": title });
  return assets.items.length > 0 ? assets.items[0] : null;
}

// 📤 Upload or reuse asset safely
async function uploadAsset(env, filePath, fileName) {
  let asset = await getAssetByTitle(env, fileName);

  if (asset) {
    console.log(`✅ Asset already exists for ${fileName}`);

    // Refetch latest version
    asset = await env.getAsset(asset.sys.id);

    // Only publish if not already published
    if (!asset.sys.publishedVersion) {
      await asset.publish();
      console.log(`📄 Published existing asset ${fileName}`);
    } else {
      console.log(`📦 Asset ${fileName} already published, skipping`);
    }

    return asset;
  }

  console.log(`⬆️ Uploading PDF for ${fileName}...`);
  const fileContent = fs.readFileSync(filePath);

  asset = await env.createAssetFromFiles({
    fields: {
      title: { "en-US": fileName },
      file: {
        "en-US": {
          contentType: "application/pdf",
          fileName,
          file: fileContent,
        },
      },
    },
  });

  // Process & publish
  await asset.processForAllLocales();
  asset = await env.getAsset(asset.sys.id); // refetch latest version
  await asset.publish();

  console.log(`📄 Uploaded and published new asset ${fileName}`);
  return asset;
}

async function updateInvoicesList() {
  try {
    // 1️⃣ Connect to Contentful
    const space = await client.getSpace(process.env.CONTENTFUL_SPACE_ID);
    const env = await space.getEnvironment(process.env.CONTENTFUL_ENVIRONMENT);

    // 2️⃣ Get all published invoices
    const invoices = await env.getPublishedEntries({
      content_type: "invoice",
    });

    const invoiceNumbers = invoices.items.map(
      (inv) => inv.fields.invoiceNumber["en-US"]
    );
    console.log("📑 Found invoice numbers:", invoiceNumbers);

    // 3️⃣ Match local PDFs with invoiceNumbers
    const invoiceFiles = [];
    for (const number of invoiceNumbers) {
      const pdfName = `${number}.pdf`;
      const pdfPath = path.join(INVOICES_DIR, pdfName);

      if (fs.existsSync(pdfPath)) {
        const asset = await uploadAsset(env, pdfPath, pdfName);
        invoiceFiles.push({
          sys: { type: "Link", linkType: "Asset", id: asset.sys.id },
        });
      } else {
        console.warn(`⚠️ No PDF found for invoice ${number}`);
      }
    }

    // 4️⃣ Find existing /invoicelist entry
    const entries = await env.getEntries({
      content_type: "invoicesList",
      "fields.slug": "/invoicelist",
    });

    let entry;

    if (entries.items.length > 0) {
      entry = entries.items[0];
      entry.fields.invoiceNumbers = { "en-US": invoiceNumbers };
      entry.fields.invoiceFile = { "en-US": invoiceFile };
      entry.fields.invoiceDate = { "en-US": new Date().toISOString() };
      console.log("🔄 Updating existing invoicesList entry");
    } else {
      entry = await env.createEntry("invoicesList", {
        fields: {
          slug: { "en-US": "/invoicelist" },
          invoiceNumbers: { "en-US": invoiceNumbers },
          invoiceFiles: { "en-US": invoiceFile },
          invoiceDate: { "en-US": new Date().toISOString() },
        },
      });
      console.log("🆕 Created new invoicesList entry");
    }

    // 5️⃣ Save + publish
    const updated = await entry.update();
    await updated.publish();

    console.log("✅ invoicesList entry updated & published successfully!");
  } catch (err) {
    console.error("❌ Error syncing invoicesList:", err);
  }
}

updateInvoicesList();
