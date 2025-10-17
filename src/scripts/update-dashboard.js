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

  // --- Extract device-level data ---
  const deviceMap = {}; // { deviceId: { total: X, readings: [{date, consumption}] } }

  invoices.forEach((inv) => {
    const slug = inv.fields?.slug?.["en-US"];
    if (!slug || !slug.startsWith("fac-")) return;

    const deviceId = slug.replace(/^fac-/, ""); // remove "fac-" prefix
    const date = inv.fields?.invoiceDate?.["en-US"];
    const consumption = Number(inv.fields?.consumptionKwh?.["en-US"] ?? 0);

    if (!deviceMap[deviceId]) {
      deviceMap[deviceId] = { total: 0, readings: [] };
    }

    deviceMap[deviceId].total += consumption;
    if (date) deviceMap[deviceId].readings.push({ date, consumption });
  });

  const totalDevices = Object.keys(deviceMap).length;
  const totalConsumption = Object.values(deviceMap).reduce(
    (sum, d) => sum + d.total,
    0
  );

  // --- Compute trends for each device ---
  const deviceTrends = Object.entries(deviceMap).map(([deviceId, data]) => ({
    deviceId,
    totalConsumption: data.total,
    readings: data.readings.sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    ),
  }));

  console.log("📈 Stats computed successfully.");
  console.log(`   Total Devices: ${totalDevices}`);
  console.log(`   Total Consumption: ${totalConsumption.toFixed(2)} kWh`);

  // --- Prepare dashboard widgets ---
  const widgets = {
    summary: {
      totalDevices,
      totalConsumption,
      averageConsumption:
        totalDevices > 0 ? totalConsumption / totalDevices : 0,
    },
    deviceTrends,
  };

  // --- Fetch or create dashboard entry ---
  let dashboardEntry;
  try {
    dashboardEntry = await environment.getEntry("mainDashboard");
  } catch {
    console.log("⚠️ Dashboard entry not found, creating one...");
  }

  const fields = {
    title: { "en-US": "Main Dashboard" },
    slug: { "en-US": "main-dashboard" },
    widgets: { "en-US": widgets },
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
    return;
  }

  await dashboardEntry.publish();
  console.log("✅ Dashboard created and published successfully!");
}

updateDashboard().catch(console.error);
