import dotenv from "dotenv";
dotenv.config();
import contentful from "contentful-management";

const client = contentful.createClient({
  accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN,
});

async function debugData() {
  const space = await client.getSpace(process.env.CONTENTFUL_SPACE_ID);
  const environment = await space.getEnvironment("master");

  console.log("📊 Fetching invoices...");
  const invoicesResponse = await environment.getEntries({
    content_type: "invoice",
    limit: 10,
  });

  console.log(`Found ${invoicesResponse.items.length} invoices\n`);

  for (const [idx, inv] of invoicesResponse.items.entries()) {
    console.log(`\n━━━ INVOICE #${idx + 1} ━━━`);
    console.log(`ID: ${inv.sys.id}`);
    console.log(`Invoice Number: ${inv.fields.invoiceNumber?.["en-US"]}`);
    console.log(`Client: ${inv.fields.clientName?.["en-US"]}`);
    console.log(`Charger: ${inv.fields.chargerSerialNumber?.["en-US"]}`);
    console.log(`Date: ${inv.fields.invoiceDate?.["en-US"]}`);
    
    const lineItemRefs = inv.fields?.lineItems?.["en-US"];
    console.log(`\nLine Items: ${lineItemRefs ? lineItemRefs.length : 0}`);
    
    if (lineItemRefs && lineItemRefs.length > 0) {
      console.log("\nFetching line item details...");
      for (const [liIdx, ref] of lineItemRefs.entries()) {
        console.log(`  Line Item ${liIdx + 1}:`);
        console.log(`    Reference ID: ${ref.sys.id}`);
        
        try {
          const lineItem = await environment.getEntry(ref.sys.id);
          console.log(`    ✓ Found line item`);
          console.log(`    Available fields:`, Object.keys(lineItem.fields));
          
          // Show all field values
          for (const [key, value] of Object.entries(lineItem.fields)) {
            console.log(`      ${key}: ${JSON.stringify(value["en-US"])}`);
          }
        } catch (err) {
          console.log(`    ✗ Could not fetch line item: ${err.message}`);
        }
      }
    } else {
      console.log("  ⚠️ No line items linked to this invoice");
    }
  }

  // Also check line item content type structure
  console.log("\n\n━━━ LINE ITEM CONTENT TYPE ━━━");
  try {
    const lineItemCT = await environment.getContentType("lineItem");
    console.log("Line Item fields:");
    lineItemCT.fields.forEach(field => {
      console.log(`  - ${field.id} (${field.name}): ${field.type}`);
    });
  } catch (err) {
    console.log("Could not fetch lineItem content type:", err.message);
  }
}

debugData().catch(console.error);