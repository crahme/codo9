import { createClient } from "contentful-management";

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
      content_type: "invoice", // 👈 replace with your Invoice content type ID
    });

    // Extract invoiceNumbers
    const invoiceNumbers = invoices.items.map(
      (inv) => inv.fields.invoiceNumber["en-US"] // 👈 adjust locale if needed
    );

    console.log("📑 Found invoice numbers:", invoiceNumbers);

    // 2. Find invoicesList entry (slug = /invoicelist)
    const entries = await env.getEntries({
      content_type: "invoicesList", // 👈 your invoicesList content type ID
      "fields.slug": "/invoicelist",
    });

    let entry;

    if (entries.items.length > 0) {
      // Update existing
      entry = entries.items[0];
      entry.fields.invoicesNumbers = {
        "en-US": invoiceNumbers,
      };
      console.log("🔄 Updating existing invoicesList entry");
    } else {
      // Create new
      entry = await env.createEntry("invoicesList", {
        fields: {
          slug: { "en-US": "/invoicelist" },
          invoicesNumbers: { "en-US": invoiceNumbers },
        },
      });
      console.log("🆕 Created new invoicesList entry");
    }

    // 3. Save + publish
    const updated = await entry.update();
    await updated.publish();

    console.log("✅ invoicesList entry updated & published!");
  } catch (err) {
    console.error("❌ Error syncing invoicesList:", err);
  }
}

updateInvoicesList();
