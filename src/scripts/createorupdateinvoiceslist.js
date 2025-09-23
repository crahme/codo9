// createorupdateinvoiceslist.js
import dotenv from "dotenv";
dotenv.config();
import fs from "fs";
import path from "path";
import pkg from " contentful-management";
const { createClient } = pkg;

const client = createClient({
  accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN,
});

const INVOICES_DIR = path.resolve("./invoices");

async function getAssetByTitle(env, title) {
  const assets = await env.getAssets({ "fields.title": title });
  return assets.items.length > 0 ? assets.items[0] : null;
}

async function uploadAsset(env, filePath, fileName) {
  let asset = await getAssetByTitle(env, fileName);

  if (asset) {
    console.log(`✅ Asset already exists for ${fileName}`);
    asset = await env.getAsset(asset.sys.id);

    if (!asset.sys.publishedVersion) {
      await asset.publish();
      console.log(`📄 Published existing asset ${fileName}`);
    } else {
      console.log(`📄 Asset ${fileName} already published, skipping`);
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

  await asset.processForAllLocales();
  asset = await env.getAsset(asset.sys.id);
  await asset.publish();

  console.log(`📄 Uploaded and published new asset ${fileName}`);
  return asset;
}

async function updateInvoicesList() {
  try {
    const space = await client.getSpace(process.env.CONTENTFUL_SPACE_ID);
    const env = await space.getEnvironment(process.env.CONTENTFUL_ENVIRONMENT);

    // Get all published invoices
    const invoices = await env.getPublishedEntries({ content_type: "invoice" });
    const invoiceNumbers = invoices.items.map(
      (inv) => inv.fields.invoiceNumber["en-US"]
    );
    console.log("📑 Found invoice numbers:", invoiceNumbers);

    // Use only the latest invoice number for invoiceFile
    const latestNumber = invoiceNumbers[invoiceNumbers.length - 1];
    const pdfName = `${latestNumber}.pdf`;
    const pdfPath = path.join(INVOICES_DIR, pdfName);

    let latestInvoiceAsset = null;
    if (fs.existsSync(pdfPath)) {
      latestInvoiceAsset = await uploadAsset(env, pdfPath, pdfName);
    } else {
      console.warn(`⚠️ No PDF found for latest invoice ${latestNumber}`);
    }

    // Find existing invoicesList entry
    const entries = await env.getEntries({
      content_type: "invoicesList",
      "fields.slug": "/invoicelist",
    });

    let entry;
    if (entries.items.length > 0) {
      entry = entries.items[0];
      entry.fields.invoiceNumbers = { "en-US": invoiceNumbers };
      entry.fields.invoiceDate = { "en-US": new Date().toISOString() };

      if (latestInvoiceAsset) {
        entry.fields.invoiceFile = {
          "en-US": {
            sys: { type: "Link", linkType: "Asset", id: latestInvoiceAsset.sys.id },
          },
        };
      }

      console.log("🔄 Updating existing invoicesList entry");
    } else {
      const fields = {
        slug: { "en-US": "/invoicelist" },
        invoiceNumbers: { "en-US": invoiceNumbers },
        invoiceDate: { "en-US": new Date().toISOString() },
      };

      if (latestInvoiceAsset) {
        fields.invoiceFile = {
          "en-US": {
            sys: { type: "Link", linkType: "Asset", id: latestInvoiceAsset.sys.id },
          },
        };
      }

      entry = await env.createEntry("invoicesList", { fields });
      console.log("🆕 Created new invoicesList entry");
    }

    const updated = await entry.update();
    await updated.publish();
    console.log("✅ invoicesList entry updated & published successfully!");
  } catch (err) {
    console.error("❌ Error syncing invoicesList:", err);
  }
}

updateInvoicesList();
