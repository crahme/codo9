import dotenv from "dotenv";
dotenv.config();
import pkg from "contentful-management";
const { createClient } = pkg;

const client = createClient({
  accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN,
});

async function updateInvoicesList() {
  try {
    // Connect to space & environment
    const space = await client.getSpace(process.env.CONTENTFUL_SPACE_ID);
    const env = await space.getEnvironment(process.env.CONTENTFUL_ENVIRONMENT);

    // 1️⃣ Get all published invoices
    const invoices = await env.getPublishedEntries({
      content_type: "invoice",
    });

    if (!invoices.items.length) {
      console.log("⚠️ No invoices found. Exiting.");
      return;
    }

    const invoiceNumbers = invoices.items.map(
      (inv) => inv.fields.invoiceNumber["en-US"]
    );

    console.log("📑 Found invoice numbers:", invoiceNumbers);

    // Pick invoiceFile from the latest invoice (most recently published)
    const latestInvoice = invoices.items[invoices.items.length - 1];
    const invoiceFileLink = latestInvoice.fields.invoiceFile
      ? latestInvoice.fields.invoiceFile["en-US"]
      : null;

    if (!invoiceFileLink) {
      throw new Error(
        "No invoiceFile found on the latest invoice. Cannot proceed without a file."
      );
    }

    // 2️⃣ Find invoicesList entry (slug = /invoicelist)
    const entries = await env.getEntries({
      content_type: "invoicesList",
      "fields.slug": "/invoicelist",
    });

    let entry;

    if (entries.items.length > 0) {
      // Update existing entry
      entry = entries.items[0];
      entry.fields.invoiceNumbers = { "en-US": invoiceNumbers };

      // Fill missing required fields
      if (!entry.fields.invoiceDate) {
        entry.fields.invoiceDate = { "en-US": new Date().toISOString() };
      }

      if (!entry.fields.invoiceFile) {
        entry.fields.invoiceFile = { "en-US": invoiceFileLink };
      }

      console.log("🔄 Updating existing invoicesList entry with latest invoice file");
    } else {
      // Create new entry
      entry = await env.createEntry("invoicesList", {
        fields: {
          slug: { "en-US": "/invoicelist" },
          invoiceNumbers: { "en-US": invoiceNumbers },
          invoiceDate: { "en-US": new Date().toISOString() },
          invoiceFile: { "en-US": invoiceFileLink },
        },
      });

      console.log("🆕 Created new invoicesList entry using latest invoice file");
    }

    // 3️⃣ Update + publish
    const updated = await entry.update();
    await updated.publish();

    console.log("✅ invoicesList entry updated & published successfully!");
  } catch (err) {
    console.error("❌ Error syncing invoicesList:", err);
  }
}

updateInvoicesList();
