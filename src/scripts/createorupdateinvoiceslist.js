// src/scripts/createOrUpdateInvoicesList.js
import fs from "fs";
import path from "path";
import contentful from "contentful-management";
import dotenv from "dotenv";

dotenv.config();

const client = contentful.createClient({
  accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN,
});

const INVOICES_FOLDER = path.resolve("invoices");
const CONTENT_TYPE = "invoicesList";
const ENTRY_SLUG = "invoiceslist";

// --- Upload a single PDF as an Asset in Contentful ---
async function uploadAsset(env, filePath, fileName) {
  const buffer = fs.readFileSync(filePath);
  const upload = await env.createUpload({ file: buffer });

  let asset = await env.createAsset({
    fields: {
      title: { "en-US": fileName },
      file: {
        "en-US": {
          fileName,
          contentType: "application/pdf",
          uploadFrom: {
            sys: { type: "Link", linkType: "Upload", id: upload.sys.id },
          },
        },
      },
    },
  });

  asset = await asset.processForAllLocales();
  const published = await asset.publish();

  console.log(`✅ Uploaded asset: ${fileName}`);
  return published;
}

// --- Helper: Get field type by ID ---
function getFieldType(contentType, idVariants) {
  const field = contentType.fields.find(f =>
    idVariants.includes(f.id)
  );
  return field ? field.type : null;
}

// --- Create or update invoicesList entry safely ---
async function getOrCreateInvoicesList(env, assetList) {
  const contentType = await env.getContentType(CONTENT_TYPE);
  const validFields = contentType.fields.map(f => f.id);

  const invoiceNumbers = assetList.map(a => a.fields.title["en-US"]);
  const invoiceFiles = assetList.map(a => ({
    sys: { type: "Link", linkType: "Asset", id: a.sys.id },
  }));

  // Detect correct date handling
  const dateFieldType = getFieldType(contentType, ["invoiceDate", "invoice_date"]);
  let invoiceDateValue;

  if (dateFieldType === "Array") {
    // Array of dates
    invoiceDateValue = assetList.map(() => new Date().toISOString());
  } else if (dateFieldType === "Date") {
    // Single date
    invoiceDateValue = new Date().toISOString();
  } else {
    invoiceDateValue = null;
  }

  const fields = { slug: { "en-US": ENTRY_SLUG } };

  // invoiceNumbers
  if (validFields.includes("invoiceNumbers"))
    fields.invoiceNumbers = { "en-US": invoiceNumbers };
  else if (validFields.includes("invoice_numbers"))
    fields.invoice_numbers = { "en-US": invoiceNumbers };

  // invoiceDate / invoiceDates (dynamic type-aware)
  if (invoiceDateValue) {
    if (validFields.includes("invoiceDate"))
      fields.invoiceDate = { "en-US": invoiceDateValue };
    else if (validFields.includes("invoice_date"))
      fields.invoice_date = { "en-US": invoiceDateValue };
    else if (validFields.includes("invoiceDates"))
      fields.invoiceDates = { "en-US": invoiceDateValue };
    else if (validFields.includes("invoice_dates"))
      fields.invoice_dates = { "en-US": invoiceDateValue };
  }

  // invoiceFiles
  if (validFields.includes("invoiceFiles"))
    fields.invoiceFiles = { "en-US": invoiceFiles };
  else if (validFields.includes("invoice_files"))
    fields.invoice_files = { "en-US": invoiceFiles };

  // Check for existing entry
  const existing = await env.getEntries({
    content_type: CONTENT_TYPE,
    "fields.slug": ENTRY_SLUG,
  });

  if (existing.items.length > 0) {
    const entry = existing.items[0];
    console.log(`ℹ️ Updating existing entry: ${entry.sys.id}`);
    entry.fields = { ...entry.fields, ...fields };

    const updated = await entry.update();
    const published = await updated.publish();

    console.log(`✅ Updated entry: ${published.sys.id}`);
    return published;
  } else {
    console.log("ℹ️ Creating new invoicesList entry");
    const entry = await env.createEntry(CONTENT_TYPE, { fields });
    const published = await entry.publish();

    console.log(`✅ Created entry: ${published.sys.id}`);
    return published;
  }
}

// --- Main ---
async function main() {
  try {
    const space = await client.getSpace(process.env.CONTENTFUL_SPACE_ID);
    const env = await space.getEnvironment("master");

    const files = fs
      .readdirSync(INVOICES_FOLDER)
      .filter(f => f.toLowerCase().endsWith(".pdf"));

    if (files.length === 0) {
      console.warn("⚠️ No PDF files found in invoices/ folder.");
      return;
    }

    const assetList = [];

    for (const fileName of files) {
      const filePath = path.join(INVOICES_FOLDER, fileName);

      // Check if asset already exists by title
      const existing = await env.getAssets({ "fields.title": fileName });
      if (existing.items.length > 0) {
        console.log(`✅ Asset already exists for ${fileName}`);
        assetList.push(existing.items[0]);
        continue;
      }

      const asset = await uploadAsset(env, filePath, fileName);
      assetList.push(asset);
    }

    await getOrCreateInvoicesList(env, assetList);
  } catch (err) {
    console.error("❌ Error running script:", err);
  }
}

main();
