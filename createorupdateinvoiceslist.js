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

    // 1. Get all published invoices
    const invoices = await env.getPublishedEntries({
      content_type: "invoice",
    });

    // Extract invoiceNumbers
    const invoiceNumbers = invoices.items.map(
      (inv) => inv.fields.invoiceNumber["en-US"]
    );

    console.log("📑 Found invoice numbers:", invoiceNumbers);

    // 2. Find invoicesList entry
    const entries = await env.getEntries({
      content_type: "invoicesList",
      "fields.slug": "/invoicelist",
    });

    let entry;

    if (entries.items.length > 0) {
      // Update existing
      entry = entries.items[0];
      entry.fields.invoiceNumbers = { "en-US": invoiceNumbers };
      console.log("🔄 Updating existing invoicesList entry");
    } else {
      // Create new — must include required fields
      entry = await env.createEntry("invoicesList", {
        fields: {
          slug: { "en-US": "/invoicelist" },
          invoiceNumbers: { "en-US": invoiceNumbers },
          invoiceDate: { "en-US": new Date().toISOString() }, // required
          invoiceFile: {
            "en-US": {
              sys: {
                type: "Link",
                linkType: "Asset",
                id: process.env.CONTENTFUL_DEFAULT_INVOICE_FILE_ID, // 👈 set this in .env
              },
            },
          },
        },
      });
      console.log("🆕 Created new invoicesList entry");
    }

    // 3. Save + publish
    const updated = await entry.update();
    await updated.publish();

    console.log("✅ invoicesList entry updated & published!");
  } catch (err) {
    console.error("❌ Error syncing invoicesList:", err.message || err);
  }
}

updateInvoicesList();
