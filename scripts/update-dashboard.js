import dotenv from "dotenv";
dotenv.config();
import contentful from "contentful-management";

const client = contentful.createClient({
  accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN,
});

async function updateDashboard() {
  const space = await client.getSpace(process.env.CONTENTFUL_SPACE_ID);
  const environment = await space.getEnvironment("master");

  // Try to fetch the main dashboard entry
  let dashboardEntry;
  try {
    dashboardEntry = await environment.getEntry("mainDashboard");
  } catch (err) {
    console.warn("⚠️ Dashboard entry not found. Creating a new one...");
  }

  if (!dashboardEntry) {
    // Create it if it doesn’t exist
    dashboardEntry = await environment.createEntryWithId("dashboard", "mainDashboard", {
      fields: {
        title: { "en-US": "Main Dashboard" },
        totalInvoices: { "en-US": 0 },
        totalRevenue: { "en-US": 0 },
        paidInvoices: { "en-US": 0 },
        pendingInvoices: { "en-US": 0 },
        recentInvoices: { "en-US": [] },
        lastUpdated: { "en-US": new Date().toISOString() },
      },
    });
    console.log("✅ Created new dashboard entry");
  } else {
    // Update if it already exists
    dashboardEntry.fields.lastUpdated = { "en-US": new Date().toISOString() };
    console.log("🔄 Updating existing dashboard entry");
  }

  const updated = await dashboardEntry.update();
  await updated.publish();
  console.log("✅ Dashboard updated successfully!");
}

updateDashboard().catch(console.error);
