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
  // Structure: { deviceId: { total: number, totalRevenue: number, dailyReadings: [{ date, consumption, amount }] } }
  const deviceMap = {};

  for (const inv of invoices) {
    const slug = inv.fields?.slug?.["en-US"];
    
    if (!slug || !slug.includes("fac-")) continue;

    // Extract device ID from slug (e.g., "/fac-b7423cbc..." → "b7423cbc...")
    const deviceId = slug.replace(/^\/fac-/, "");
    const lineItemRefs = inv.fields?.lineItems?.["en-US"] || [];

    // Initialize device entry if not exists
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

    // Process each line item for this invoice
    for (const lineItemRef of lineItemRefs) {
      const lineItem = lineItemsMap.get(lineItemRef.sys.id);
      if (!lineItem) continue;

      const energyConsumed = Number(lineItem.fields?.energyConsumed?.["en-US"] ?? 0);
      const amount = Number(lineItem.fields?.amount?.["en-US"] ?? 0);
      const date = lineItem.fields?.date?.["en-US"];

      // Add to device totals
      deviceMap[deviceId].total += energyConsumed;
      deviceMap[deviceId].totalRevenue += amount;

      // Store daily reading for trend analysis
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

  // --- Compute overall totals across all devices ---
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
    // Aggregate daily readings (in case there are multiple readings per day)
    const dailyMap = {};
    for (const reading of data.dailyReadings) {
      const dateKey = reading.date.split('T')[0]; // Get YYYY-MM-DD
      if (!dailyMap[dateKey]) {
        dailyMap[dateKey] = { consumption: 0, amount: 0 };
      }
      dailyMap[dateKey].consumption += reading.consumption;
      dailyMap[dateKey].amount += reading.amount;
    }

    // Convert to sorted array
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
      totalConsumption: data.total,
      totalRevenue: data.totalRevenue,
      invoiceCount: data.invoiceCount,
      averageConsumptionPerDay: trend.length > 0 ? data.total / trend.length : 0,
      trend, // Daily consumption trend for this device
    };
  });

  // Sort devices by total consumption (highest first)
  deviceTrends.sort((a, b) => b.totalConsumption - a.totalConsumption);

  // --- Build overall consumption timeline (aggregate all devices by date) ---
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
      consumption: data.consumption,
      revenue: data.revenue,
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  // --- Recent invoices (latest 10 by date) ---
  const recentInvoices = invoices
    .filter((inv) => inv.fields?.invoiceDate?.["en-US"])
    .sort(
      (a, b) =>
        new Date(b.fields.invoiceDate["en-US"]) -
        new Date(a.fields.invoiceDate["en-US"])
    )
    .slice(0, 10)
    .map((inv) => {
      const slug = inv.fields?.slug?.["en-US"];
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
        invoiceNumber: inv.fields.invoiceNumber?.["en-US"],
        invoiceDate: inv.fields.invoiceDate?.["en-US"],
        clientName: inv.fields.clientName?.["en-US"],
        chargerSerial: inv.fields.chargerSerialNumber?.["en-US"],
        consumptionKwh: totalKwh,
        totalAmount: totalAmount,
        billingPeriod: {
          start: inv.fields.billingPeriodStart?.["en-US"],
          end: inv.fields.billingPeriodEnd?.["en-US"],
        },
      };
    });

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
      totalConsumption: data.consumption,
      totalRevenue: data.revenue,
      invoiceCount: data.invoiceCount,
    }))
    .sort((a, b) => b.totalConsumption - a.totalConsumption)
    .slice(0, 10);

  console.log("📈 Stats computed successfully.");
  console.log(`   Total Devices: ${totalDevices}`);
  console.log(`   Total Energy Consumed: ${totalConsumption.toFixed(2)} kWh`);
  console.log(`   Total Revenue: $${totalRevenue.toFixed(2)}`);
  console.log(`   Total Invoices: ${invoices.length}`);

  // --- Dashboard widgets structure ---
  const widgets = {
    summary: {
      totalDevices,
      totalInvoices: invoices.length,
      totalEnergyConsumed: totalConsumption,
      totalRevenue: totalRevenue,
      averageConsumptionPerDevice: totalDevices > 0 ? totalConsumption / totalDevices : 0,
      averageRevenuePerInvoice: invoices.length > 0 ? totalRevenue / invoices.length : 0,
    },
    deviceTrends, // Per-device consumption with daily trends
    consumptionTimeline, // Overall daily consumption across all devices
    recentInvoices,
    topClients,
  };

  // --- Fetch or create dashboard entry ---
  let dashboardEntry;
  try {
    dashboardEntry = await environment.getEntry("mainDashboard");
  } catch {
    console.log("⚠️ Dashboard entry not found, creating one...");
  }

  const fields = {
    title: { "en-US": "EV Charging Dashboard" },
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

  // Display summary
  console.log("\n📊 Dashboard Summary:");
  console.log(`   🔌 Total Devices: ${totalDevices}`);
  console.log(`   ⚡ Total Energy: ${totalConsumption.toFixed(2)} kWh`);
  console.log(`   💰 Total Revenue: $${totalRevenue.toFixed(2)}`);
  console.log(`   📄 Total Invoices: ${invoices.length}`);
  console.log(`   📈 Avg per Device: ${(totalDevices > 0 ? totalConsumption / totalDevices : 0).toFixed(2)} kWh`);
  
  if (deviceTrends.length > 0) {
    console.log(`\n   🏆 Top Device: ${deviceTrends[0].deviceId}`);
    console.log(`      Charger: ${deviceTrends[0].chargerSerial}`);
    console.log(`      Client: ${deviceTrends[0].clientName}`);
    console.log(`      Consumption: ${deviceTrends[0].totalConsumption.toFixed(2)} kWh`);
    console.log(`      Revenue: $${deviceTrends[0].totalRevenue.toFixed(2)}`);
    console.log(`      Daily Avg: ${deviceTrends[0].averageConsumptionPerDay.toFixed(2)} kWh`);
    console.log(`      Trend Data Points: ${deviceTrends[0].trend.length} days`);
  }

  if (topClients.length > 0) {
    console.log(`\n   👤 Top Client: ${topClients[0].clientName}`);
    console.log(`      Consumption: ${topClients[0].totalConsumption.toFixed(2)} kWh`);
    console.log(`      Revenue: $${topClients[0].totalRevenue.toFixed(2)}`);
    console.log(`      Invoices: ${topClients[0].invoiceCount}`);
  }

  console.log(`\n   📅 Timeline Coverage: ${consumptionTimeline.length} days`);
  if (consumptionTimeline.length > 0) {
    console.log(`      From: ${consumptionTimeline[0].date}`);
    console.log(`      To: ${consumptionTimeline[consumptionTimeline.length - 1].date}`);
  }
}

updateDashboard().catch(console.error);