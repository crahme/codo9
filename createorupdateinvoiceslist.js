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

async function uploadAsset(env, filePath, fileName) {
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
  return asset;
}

async function updateInvoicesList() {
  try {
    const space = await client.getSpace(process.env.CONTENTFUL_SPACE_ID);
    const env = await space.getEnvironment(process.env.CONTENTFUL_ENVIRONMENT);

    // 1️⃣ Get all published invoices
    const invoices = await env.getPublishedEntries({ content_type: "invoice" });
    if (!invoices.items.length) {
      console.log("⚠️ No invoices found in Contentful.");
      return;
    }

    const localFiles = fs.existsSync(INVOICES_DIR) ? fs.readdirSync(INVOICES_DIR) : [];

    const invoiceNumbers = [];
    let invoiceFileAssetId = null;

    for (const inv of invoices.items) {
      const number = inv.fields.invoiceNumber?.["en-US"];
      if (!number) continue;
      invoiceNumbers.push(number);

      // Match local PDF
      const match = localFiles.find(
        (f) => f.toLowerCase().includes(number.toLowerCase()) && f.toLowerCase().endsWith(".pdf")
      );

      if (match) {
        console.log(`📄 Uploading PDF for invoice ${number}...`);
        const asset = await uploadAsset(env, path.join(INVOICES_DIR, match), match);
        invoiceFileAssetId = asset.sys.id; // Use last matched invoice file
      }
    }

    console.log("📑 Found invoice numbers:", invoiceNumbers);

    // 2️⃣ Find existing invoicesList entry
    const entries = await env.getEntries({ content_type: "invoicesList", "fields.slug": "/invoicelist" });

    let entry;
    if (entries.items.length > 0) {
      entry = entries.items[0];
      entry.fields.invoiceNumbers = { "en-US": invoiceNumbers };
      entry.fields.invoiceDate = { "en-US": new Date().toISOString() };
      if (invoiceFileAssetId) {
        entry.fields.invoiceFile = { "en-US": { sys: { type: "Link", linkType: "Asset", id: invoiceFileAssetId } } };
      }
      console.log("🔄 Updating existing invoicesList entry");
    } else {
      const fields = {
        slug: { "en-US": "/invoicelist" },
        invoiceNumbers: { "en-US": invoiceNumbers },
        invoiceDate: { "en-US": new Date().toISOString() },
      };
      if (invoiceFileAssetId) {
        fields.invoiceFile = { "en-US": { sys: { type: "Link", linkType: "Asset", id: invoiceFileAssetId } } };
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
