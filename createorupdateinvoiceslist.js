import dotenv from "dotenv";
dotenv.config();
import fs from "fs";
import path from "path";
import pkg from "contentful-management";
const { createClient } = pkg;

// Configure Contentful client
const client = createClient({
  accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN,
});

// Path to local invoices folder
const INVOICES_DIR = path.resolve("./invoices");

async function updateInvoicesList() {
  try {
    // Connect to Contentful space & environment
    const space = await client.getSpace(process.env.CONTENTFUL_SPACE_ID);
    const env = await space.getEnvironment(process.env.CONTENTFUL_ENVIRONMENT);

    // 1️⃣ Get all published invoices from Contentful
    const invoices = await env.getPublishedEntries({
      content_type: "invoice",
    });

    if (!invoices.items.length) {
      console.log("⚠️ No invoices found in Contentful. Exiting.");
      return;
    }

    // 2️⃣ Read local invoices directory
    const localFiles = fs.existsSync(INVOICES_DIR)
      ? fs.readdirSync(INVOICES_DIR)
      : [];
    const localInvoiceFiles = new Set(localFiles.map((f) => f.toLowerCase()));

    // 3️⃣ Map invoice numbers to existing PDF files
    const invoiceNumbers = [];
    let invoiceFileLink = null;

    for (const inv of invoices.items) {
      const number = inv.fields.invoiceNumber?.["en-US"];
      if (!number) continue;

      invoiceNumbers.push(number);

      // Check if a corresponding local PDF exists
      const match = localFiles.find(
        (f) =>
          f.toLowerCase().includes(number.toLowerCase()) &&
          f.toLowerCase().endsWith(".pdf")
      );

      if (match) {
        // Prepare a Contentful Asset link
        invoiceFileLink = {
          sys: {
            type: "Link",
            linkType: "Asset",
            // Note: We assume the PDF is already uploaded to Contentful and you know its asset ID
            // If not, you must upload it first and use the returned asset ID here
            id: process.env.CONTENTFUL_DEFAULT_INVOICE_FILE_ID || "UPLOAD_ASSET_ID_HERE",
          },
        };
      }
    }

    console.log("📑 Found invoice numbers:", invoiceNumbers);
    if (invoiceFileLink) console.log("📄 Found matching local invoice PDF.");

    // 4️⃣ Find existing invoicesList entry
    const entries = await env.getEntries({
      content_type: "invoicesList",
      "fields.slug": "/invoicelist",
    });

    let entry;

    if (entries.items.length > 0) {
      // Update existing entry
      entry = entries.items[0];
      entry.fields.invoiceNumbers = { "en-US": invoiceNumbers };
      if (!entry.fields.invoiceDate) {
        entry.fields.invoiceDate = { "en-US": new Date().toISOString() };
      }
      if (invoiceFileLink) {
        entry.fields.invoiceFile = { "en-US": invoiceFileLink };
      }
      console.log("🔄 Updating existing invoicesList entry");
    } else {
      // Create new entry
      const fields = {
        slug: { "en-US": "/invoicelist" },
        invoiceNumbers: { "en-US": invoiceNumbers },
        invoiceDate: { "en-US": new Date().toISOString() },
      };
      if (invoiceFileLink) fields.invoiceFile = { "en-US": invoiceFileLink };

      entry = await env.createEntry("invoicesList", { fields });
      console.log("🆕 Created new invoicesList entry");
    }

    // 5️⃣ Update + publish
    const updated = await entry.update();
    await updated.publish();

    console.log("✅ invoicesList entry updated & published successfully!");
  } catch (err) {
    console.error("❌ Error syncing invoicesList:", err);
  }
}

updateInvoicesList();
