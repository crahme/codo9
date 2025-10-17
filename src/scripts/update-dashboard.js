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

  // --- Build device consumption data ---
  const deviceMap = {}; // { deviceId: { total: number, readings: [{ date, consumption }] } }

  for (const inv of invoices) {
    const slug = inv.fields?.slug?.["en-US"];
    if (!slug || !slug.startsWith("fac-")) continue; // Skip non-device invoices

    const deviceId = slug.replace(/^fac-/, ""); // Extract device ID (e.g., "fac-generator1" → "generator1")
    const date = inv.fields?.invoiceDate?.["en-US"];
    const consumption = Number(inv.fields?.consumptionKwh?.["en-US"] ?? 0);

    if (!deviceMap[deviceId]) {
      deviceMap[deviceId] = { total: 0, readings: [] };
    }

    // ✅ Add consumption to this device’s total
    deviceMap[deviceId].total += consumption;

    // ✅ Store this invoice’s daily reading for trend charting
    if (date) {
      deviceMap[deviceId].readings.push({
        date,
        consumption,
      });
    }
  }

  // --- Compute overall totals ---
  const totalDevices = Object.keys(deviceMap).length;
  const totalConsumption = Object.values(deviceMap).reduce(
    (sum, d) => sum + d.total,
    0
  );

  // --- Build per-device trend data ---
  const deviceTrends = Object.entries(deviceMap).map(([deviceId, data]) => ({
    deviceId,
    totalConsumption: data.total,
    readings: data.readings.sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    ),
  }));

  // --- Recent invoices (latest 10 by date) ---
  const recentInvoices = invoices
    .filter((inv) => inv.fields?.invoiceDate?.["en-US"])
    .sort(
      (a, b) =>
        new Date(b.fields.invoiceDate["en-US"]) -
        new Date(a.fields.invoiceDate["en-US"])
    )
    .slice(0, 10)
    .map((inv) => ({
      id: inv.sys.id,
      slug: inv.fields.slug?.["en-US"] ?? "",
      invoiceDate: inv.fields.invoiceDate?.["en-US"],
      consumptionKwh: inv.fields.consumptionKwh?.["en-US"] ?? 0,
      customer: inv.fields.customerName?.["en-US"] ?? "Unknown",
    }));

  console.log("📈 Stats computed successfully.");
  console.log(`   Total Devices: ${totalDevices}`);
  console.log(`   Total Consumption: ${totalConsumption.toFixed(2)} kWh`);

  // --- Dashboard widgets structure ---
  const widgets = {
    summary: {
      totalDevices,
      totalConsumption,
      averageConsumption:
        totalDevices > 0 ? totalConsumption / totalDevices : 0,
    },
    deviceTrends,
    recentInvoices,
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
    await dashboardEntry.publish();
    console.log("✅ Dashboard created and published successfully!");
  } else {
    dashboardEntry.fields = fields;
    const updated = await dashboardEntry.update();
    await updated.publish();
    console.log("✅ Dashboard updated successfully with live data!");
  }
}

updateDashboard().catch(console.error);
