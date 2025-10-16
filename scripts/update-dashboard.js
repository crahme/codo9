import dotenv from "dotenv";
dotenv.config();
import contentful from "contentful-management";

const client = contentful.createClient({
  accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN,
});

async function updateDashboard() {
  const space = await client.getSpace(process.env.CONTENTFUL_SPACE_ID);
  const environment = await space.getEnvironment("master");

  console.log("📊 Fetching invoice entries...");
  const invoicesResponse = await environment.getEntries({
    content_type: "invoice",
    limit: 1000,
  });

  const invoices = invoicesResponse.items;
  if (!invoices.length) {
    console.log("⚠️ No invoices found — skipping update.");
    return;
  }

  console.log(`📄 Found ${invoices.length} invoices.`);

  // --- Compute stats ---
  const totalInvoices = invoices.length;
  const totalRevenue = invoices.reduce((sum, inv) => {
    const amount = inv.fields?.totalAmount?.["en-US"] ?? 0;
    return sum + Number(amount);
  }, 0);

  const paidInvoices = invoices.filter(
    inv => inv.fields?.status?.["en-US"]?.toLowerCase() === "paid"
  ).length;

  const pendingInvoices = invoices.filter(
    inv => inv.fields?.status?.["en-US"]?.toLowerCase() === "pending"
  ).length;

  // Sort by date descending and get 5 most recent
  const recentInvoices = invoices
    .filter(inv => inv.fields?.invoiceDate?.["en-US"])
    .sort(
      (a, b) =>
        new Date(b.fields.invoiceDate["en-US"]) -
        new Date(a.fields.invoiceDate["en-US"])
    )
    .slice(0, 5)
    .map(inv => ({
      sys: {
        type: "Link",
        linkType: "Entry",
        id: inv.sys.id,
      },
    }));

  console.log("📈 Stats computed successfully.");

  // --- Fetch or create dashboard entry ---
  let dashboardEntry;
  try {
    dashboardEntry = await environment.getEntry("mainDashboard");
  } catch {
    console.log("⚠️ Dashboard entry not found, creating one...");
  }

  const fields = {
    title: { "en-US": "Main Dashboard" },
    slug: { "en-US": "main-dashboard" },  // Added required slug field
    totalInvoices: { "en-US": totalInvoices },
    totalRevenue: { "en-US": totalRevenue },
    paidInvoices: { "en-US": paidInvoices },
    pendingInvoices: { "en-US": pendingInvoices },
    recentInvoices: { "en-US": recentInvoices },
    lastUpdated: { "en-US": new Date().toISOString() },
  };

  if (!dashboardEntry) {
    dashboardEntry = await environment.createEntryWithId(
      "dashboard",
      "mainDashboard",
      { fields }
    );
    console.log("✅ Created new dashboard entry");
  } else {
    dashboardEntry.fields = fields;
    const updated = await dashboardEntry.update();
    await updated.publish();
    console.log("✅ Dashboard updated successfully with live data!");
    console.log(`   Total Invoices: ${totalInvoices}`);
    console.log(`   Total Revenue: $${totalRevenue.toFixed(2)}`);
    console.log(`   Paid: ${paidInvoices}`);
    console.log(`   Pending: ${pendingInvoices}`);
    return;
  }

  await dashboardEntry.publish();
  console.log("✅ Dashboard created and published successfully!");
  console.log(`   Total Invoices: ${totalInvoices}`);
  console.log(`   Total Revenue: $${totalRevenue.toFixed(2)}`);
  console.log(`   Paid: ${paidInvoices}`);
  console.log(`   Pending: ${pendingInvoices}`);
}

updateDashboard().catch(console.error);