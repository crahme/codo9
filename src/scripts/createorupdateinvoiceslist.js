import dotenv from "dotenv";
dotenv.config();
import fs from "fs";
import path from "path";
import pkg from "contentful-management";
const { createClient } = pkg;

const client = createClient({
  accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN,
});

const INVOICES_DIR = path.join(process.cwd(), "invoices");

async function uploadAsset(env, filename, filePath) {
  const existingAssets = await env.getAssets({ "fields.title": filename });
  if (existingAssets.items.length > 0) {
    const asset = existingAssets.items[0];
    if (!asset.isPublished()) await asset.publish();
    console.log(`✅ Asset already exists for ${filename}`);
    return asset.sys.id;
  }

  const asset = await env.createAsset({
    fields: {
      title: { "en-US": filename },
      file: {
        "en-US": {
          contentType: "application/pdf",
          fileName: filename,
          upload: `file://${filePath}`,
        },
      },
    },
  });

  await asset.processForAllLocales();
  await asset.publish();
  console.log(`⬆️ Uploaded and published new asset ${filename}`);
  return asset.sys.id;
}

async function updateInvoicesList() {
  try {
    const space = await client.getSpace(process.env.CONTENTFUL_SPACE_ID);
    const env = await space.getEnvironment(process.env.CONTENTFUL_ENVIRONMENT);

    // 1️⃣ Get all published invoices
    const invoices = await env.getPublishedEntries({ content_type: "invoice" });
    const invoiceNumbers = invoices.items.map(inv => inv.fields.invoiceNumber["en-US"]);
    console.log("📑 Found invoice numbers:", invoiceNumbers);

    // 2️⃣ Upload PDFs & collect asset IDs
    const assetIds = [];
    for (const invNum of invoiceNumbers) {
      const pdfPath = path.join(INVOICES_DIR, `${invNum}.pdf`);
      if (!fs.existsSync(pdfPath)) {
        console.warn(`⚠ PDF not found for ${invNum}, skipping.`);
        continue;
      }
      const assetId = await uploadAsset(env, `${invNum}.pdf`, pdfPath);
      assetIds.push({ sys: { type: "Link", linkType: "Asset", id: assetId } });
    }

    if (assetIds.length === 0) throw new Error("No invoice PDFs found in /invoices");

    // 3️⃣ Find or create invoicesList entry
    const entries = await env.getEntries({ content_type: "invoicesList", "fields.slug": "/invoicelist" });
    let entry;

    if (entries.items.length > 0) {
      entry = entries.items[0];
      console.log("🔄 Updating existing invoicesList entry");
    } else {
      entry = await env.createEntry("invoicesList", { fields: { slug: { "en-US": "/invoicelist" } } });
      console.log("🆕 Created new invoicesList entry");
    }

    // 4️⃣ Update fields
    entry.fields.invoiceNumbers = { "en-US": invoiceNumbers };
    entry.fields.invoiceFile = { "en-US": assetIds };
    entry.fields.invoiceDate = { "en-US": new Date().toISOString() };

    const updated = await entry.update();
    await updated.publish();
    console.log("✅ invoicesList entry updated & published!");
  } catch (err) {
    console.error("❌ Error syncing invoicesList:", err);
  }
}

updateInvoicesList();
