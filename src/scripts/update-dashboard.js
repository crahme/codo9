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

  // Fetch all line items once
  console.log("📋 Fetching line items...");
  const lineItemsResponse = await environment.getEntries({
    content_type: "lineItem",
    limit: 1000,
  });
  const lineItemsMap = new Map();
  lineItemsResponse.items.forEach(item => {
    lineItemsMap.set(item.sys.id, item);
  });

  console.log(`✅ Found ${lineItemsMap.size} line items.`);

  // --- Build device consumption data ---
  const deviceMap = {};

  for (const inv of invoices) {
    const slug = inv.fields?.slug?.["en-US"];
    
    if (!slug || !slug.includes("fac-")) continue;

    const deviceId = slug.replace(/^\/fac-/, "");
    const lineItemRefs = inv.fields?.lineItems?.["en-US"] || [];

    if (!deviceMap[deviceId]) {
      deviceMap[deviceId] = {
        total: 0,
        totalRevenue: 0,
        invoiceCount: 0,
        dailyReadings: [],
        invoiceDetails: {
          chargerSerial: inv.fields?.chargerSerialNumber?.["en-US"],
          clientName: inv.fields?.clientName?.["en-US"],
        }
      };
    }

    deviceMap[deviceId].invoiceCount += 1;

    for (const lineItemRef of lineItemRefs) {
      const lineItem = lineItemsMap.get(lineItemRef.sys.id);
      if (!lineItem) continue;

      const energyConsumed = Number(lineItem.fields?.energyConsumed?.["en-US"] ?? 0);
      const amount = Number(lineItem.fields?.amount?.["en-US"] ?? 0);
      const date = lineItem.fields?.date?.["en-US"];

      deviceMap[deviceId].total += energyConsumed;
      deviceMap[deviceId].totalRevenue += amount;

      if (date) {
        deviceMap[deviceId].dailyReadings.push({
          date,
          consumption: energyConsumed,
          amount: amount,
        });
      }
    }
  }

  // --- Sort daily readings by date for each device ---
  for (const deviceId in deviceMap) {
    deviceMap[deviceId].dailyReadings.sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );
  }

  // --- Compute overall totals ---
  const totalDevices = Object.keys(deviceMap).length;
  const totalConsumption = Object.values(deviceMap).reduce(
    (sum, device) => sum + device.total,
    0
  );
  const totalRevenue = Object.values(deviceMap).reduce(
    (sum, device) => sum + device.totalRevenue,
    0
  );

  // --- Build per-device consumption trends ---
  const deviceTrends = Object.entries(deviceMap).map(([deviceId, data]) => {
    const dailyMap = {};
    for (const reading of data.dailyReadings) {
      const dateKey = reading.date.split('T')[0];
      if (!dailyMap[dateKey]) {
        dailyMap[dateKey] = { consumption: 0, amount: 0 };
      }
      dailyMap[dateKey].consumption += reading.consumption;
      dailyMap[dateKey].amount += reading.amount;
    }

    const trend = Object.entries(dailyMap)
      .map(([date, values]) => ({
        date,
        consumption: values.consumption,
        amount: values.amount,
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    return {
      deviceId,
      chargerSerial: data.invoiceDetails.chargerSerial,
      clientName: data.invoiceDetails.clientName,
      totalConsumption: Math.round(data.total * 100) / 100,
      totalRevenue: Math.round(data.totalRevenue * 100) / 100,
      invoiceCount: data.invoiceCount,
    };
  });

  deviceTrends.sort((a, b) => b.totalConsumption - a.totalConsumption);

  // --- Build overall consumption timeline ---
  const dateMap = {};
  for (const deviceData of Object.values(deviceMap)) {
    for (const reading of deviceData.dailyReadings) {
      const dateKey = reading.date.split('T')[0];
      if (!dateMap[dateKey]) {
        dateMap[dateKey] = { consumption: 0, revenue: 0 };
      }
      dateMap[dateKey].consumption += reading.consumption;
      dateMap[dateKey].revenue += reading.amount;
    }
  }

  const consumptionTimeline = Object.entries(dateMap)
    .map(([date, data]) => ({
      date,
      consumption: Math.round(data.consumption * 100) / 100,
      revenue: Math.round(data.revenue * 100) / 100,
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  // --- Recent invoices as separate field ---
  console.log("🔄 Processing recent invoices...");
  
  const recentInvoices = invoices
    .filter((inv) => inv.fields?.invoiceDate?.["en-US"])
    .sort(
      (a, b) =>
        new Date(b.fields.invoiceDate["en-US"]) -
        new Date(a.fields.invoiceDate["en-US"])
    )
    .map((inv) => {
      const slug = inv.fields?.slug?.["en-US"] || '';
      const deviceId = slug?.startsWith("fac-") ? slug.replace(/^fac-/, "") : slug;
      const lineItemRefs = inv.fields?.lineItems?.["en-US"] || [];
      
      let totalAmount = 0;
      let totalKwh = 0;

      for (const lineItemRef of lineItemRefs) {
        const lineItem = lineItemsMap.get(lineItemRef.sys.id);
        if (lineItem) {
          totalKwh += Number(lineItem.fields?.energyConsumed?.["en-US"] ?? 0);
          totalAmount += Number(lineItem.fields?.amount?.["en-US"] ?? 0);
        }
      }

      return {
        id: inv.sys.id,
        deviceId: deviceId,
        invoiceNumber: inv.fields.invoiceNumber?.["en-US"] || 'N/A',
        invoiceDate: inv.fields.invoiceDate?.["en-US"] || 'N/A',
        clientName: inv.fields.clientName?.["en-US"] || 'N/A',
        chargerSerial: inv.fields.chargerSerialNumber?.["en-US"] || 'N/A',
        consumptionKwh: Math.round(totalKwh * 100) / 100,
        totalAmount: Math.round(totalAmount * 100) / 100,
        billingPeriod: {
          start: inv.fields.billingPeriodStart?.["en-US"] || 'N/A',
          end: inv.fields.billingPeriodEnd?.["en-US"] || 'N/A',
        },
      };
    });

  console.log(`   ✅ Processed ${recentInvoices.length} invoices`);

  // --- Top clients by consumption ---
  const clientMap = {};
  for (const inv of invoices) {
    const clientName = inv.fields?.clientName?.["en-US"];
    if (!clientName) continue;

    const lineItemRefs = inv.fields?.lineItems?.["en-US"] || [];
    let consumption = 0;
    let revenue = 0;

    for (const lineItemRef of lineItemRefs) {
      const lineItem = lineItemsMap.get(lineItemRef.sys.id);
      if (lineItem) {
        consumption += Number(lineItem.fields?.energyConsumed?.["en-US"] ?? 0);
        revenue += Number(lineItem.fields?.amount?.["en-US"] ?? 0);
      }
    }

    if (!clientMap[clientName]) {
      clientMap[clientName] = { consumption: 0, revenue: 0, invoiceCount: 0 };
    }
    clientMap[clientName].consumption += consumption;
    clientMap[clientName].revenue += revenue;
    clientMap[clientName].invoiceCount += 1;
  }

  const topClients = Object.entries(clientMap)
    .map(([name, data]) => ({
      clientName: name,
      totalConsumption: Math.round(data.consumption * 100) / 100,
      totalRevenue: Math.round(data.revenue * 100) / 100,
      invoiceCount: data.invoiceCount,
    }))
    .sort((a, b) => b.totalConsumption - a.totalConsumption)
    .slice(0, 10);

  console.log("📈 Stats computed successfully.");

  // --- Dashboard widgets structure (without recentInvoices) ---
  const widgets = {
    summary: {
      totalDevices,
      totalInvoices: invoices.length,
      totalEnergyConsumed: Math.round(totalConsumption * 100) / 100,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      averageConsumptionPerDevice: totalDevices > 0 ? Math.round((totalConsumption / totalDevices) * 100) / 100 : 0,
      averageRevenuePerInvoice: invoices.length > 0 ? Math.round((totalRevenue / invoices.length) * 100) / 100 : 0,
    },
    deviceTrends: deviceTrends.slice(0, 10),
    consumptionTimeline: consumptionTimeline.slice(-30),
    topClients,
  };

  console.log("🔍 Final data structure:");
  console.log(`   - widgets summary: ${Object.keys(widgets.summary).length} properties`);
  console.log(`   - widgets deviceTrends: ${widgets.deviceTrends.length} devices`);
  console.log(`   - widgets consumptionTimeline: ${widgets.consumptionTimeline.length} days`);
  console.log(`   - widgets topClients: ${widgets.topClients.length} clients`);
  console.log(`   - recentInvoices (separate): ${recentInvoices.length} invoices`);

  // --- Fetch or create dashboard entry ---
  let dashboardEntry;
  try {
    dashboardEntry = await environment.getEntry("mainDashboard");
    console.log("📝 Found existing dashboard entry");
  } catch {
    console.log("⚠️ Dashboard entry not found, creating one...");
  }

  // Create fields with recentInvoices as a separate top-level field
  const fields = {
    title: { "en-US": "EV Charging Dashboard" },
    slug: { "en-US": "main-dashboard" },
    widgets: { "en-US": widgets },
    recentInvoices: { "en-US": recentInvoices }, // ← This is now a separate field
    lastUpdated: { "en-US": new Date().toISOString() },
  };

  try {
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

    // Verify the update worked
    const verifiedEntry = await environment.getEntry("mainDashboard");
    const savedRecentInvoices = verifiedEntry.fields.recentInvoices?.["en-US"];
    console.log("🔍 Verification - Saved recentInvoices count:", savedRecentInvoices?.length || 0);
    
    if (savedRecentInvoices && savedRecentInvoices.length > 0) {
      console.log("✅ Recent invoices saved successfully as separate field!");
      console.log("   Sample:", {
        id: savedRecentInvoices[0].id,
        invoiceNumber: savedRecentInvoices[0].invoiceNumber,
        date: savedRecentInvoices[0].invoiceDate
      });
    }
    
  } catch (error) {
    console.error("❌ Error updating dashboard:", error);
    throw error;
  }

  console.log("\n📊 Update completed!");
  console.log(`   📋 Recent Invoices: ${recentInvoices.length} invoices (separate field)`);
  console.log(`   📊 Widgets: ${Object.keys(widgets).length} sections`);
}

updateDashboard().catch(console.error);