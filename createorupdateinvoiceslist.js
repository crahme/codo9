import dotenv from "dotenv";
dotenv.config();
import fs from "fs";
import path from "path";
import pkg from "contentful-management";
const { createClient } = pkg;

const client = createClient({
  accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN,
});

const INVOICES_DIR = path.resolve("./invoices");

// Check if an asset with the same file name already exists
async function getAssetByTitle(env, title) {
  const assets = await env.getAssets({ "fields.title": title });
  return assets.items.length > 0 ? assets.items[0] : null;
}

// Upload a PDF only if it doesn’t exist yet
async function uploadAsset(env, filePath, fileName) {
  const existingAsset = await getAssetByTitle(env, fileName);
  if (existingAsset) {
    console.log(`✅ Asset already exists for ${fileName}, skipping upload`);
    return existingAsset;
  }

  const fileContent = fs.readFileSync(filePath);
  const asset = await env.createAssetFromFiles({
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

  await asset.processForAllLocales();
  await asset.publish();
  console.log(`📄 Uploaded and published asset ${fileName}`);
  return asset;
}

async function updateInvoicesList() {
  try {
    const space = await client.getSpace(process.env.CONTENTFUL_SPACE_ID);
    const env = await space.getEnvironment(process.env.CONTENTFUL_ENVIRONMENT);

    const invoices = await env.getPublishedEntries({ content_type: "invoice" });
    if (!invoices.items.length) {
      console.log("⚠️ No invoices found in Contentful.");
      return;
    }

    const localFiles = fs.existsSync(INVOICES_DIR) ? fs.readdirSync(INVOICES_DIR) : [];

    const invoiceNumbers = [];
    const invoiceAssets = [];

    for (const inv of invoices.items) {
      const number = inv.fields.invoiceNumber?.["en-US"];
      if (!number) continue;
      invoiceNumbers.push(number);

      const match = localFiles.find(
        (f) => f.toLowerCase().includes(number.toLowerCase()) && f.toLowerCase().endsWith(".pdf")
      );

      if (match) {
        const asset = await uploadAsset(env, path.join(INVOICES_DIR, match), match);
        invoiceAssets.push({ sys: { type: "Link", linkType: "Asset", id: asset.sys.id } });
      }
    }

    console.log("📑 Found invoice numbers:", invoiceNumbers);

    const entries = await env.getEntries({ content_type: "invoicesList", "fields.slug": "/invoicelist" });
    let entry;

    const fields = {
      slug: { "en-US": "/invoicelist" },
      invoiceNumbers: { "en-US": invoiceNumbers },
      invoiceDate: { "en-US": new Date().toISOString() },
    };

    if (invoiceAssets.length) fields.invoiceFile = { "en-US": invoiceAssets[0] }; // attach the first asset, adjust as needed

    if (entries.items.length > 0) {
      entry = entries.items[0];

      // Merge fields safely
      entry.fields = { ...entry.fields, ...fields };
      const updated = await entry.update();
      await updated.publish();
      console.log("🔄 Updated & published existing invoicesList entry");
    } else {
      entry = await env.createEntry("invoicesList", { fields });
      await entry.publish();
      console.log("🆕 Created & published new invoicesList entry");
    }

    console.log("✅ invoicesList syncing completed successfully!");
  } catch (err) {
    console.error("❌ Error syncing invoicesList:", err);
  }
}

updateInvoicesList();
