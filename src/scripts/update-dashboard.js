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

  // Fetch all line items to calculate consumption and amounts
  console.log("📋 Fetching line items...");
  const lineItemsResponse = await environment.getEntries({
    content_type: "lineItem",
    limit: 1000,
  });
  const lineItemsMap = new Map();
  lineItemsResponse.items.forEach(item => {
    lineItemsMap.set(item.sys.id, item);
  });

  // --- Build charger consumption data ---
  const chargerMap = {}; // { chargerSerialNumber: { total: number, invoiceCount: number, readings: [{ date, consumption, amount }] } }
  let totalRevenue = 0;
  let totalEnergyConsumed = 0;

  for (const inv of invoices) {
    const chargerSerial = inv.fields?.chargerSerialNumber?.["en-US"];
    const invoiceDate = inv.fields?.invoiceDate?.["en-US"];
    const lineItemRefs = inv.fields?.lineItems?.["en-US"] || [];

    if (!chargerSerial) continue;

    // Calculate totals from line items
    let invoiceConsumption = 0;
    let invoiceAmount = 0;

    for (const lineItemRef of lineItemRefs) {
      const lineItem = lineItemsMap.get(lineItemRef.sys.id);
      if (!lineItem) continue;

      const quantity = Number(lineItem.fields?.quantity?.["en-US"] ?? 0);
      const unitPrice = Number(lineItem.fields?.unitPrice?.["en-US"] ?? 0);
      const lineTotal = quantity * unitPrice;

      // Assuming quantity represents kWh consumed
      invoiceConsumption += quantity;
      invoiceAmount += lineTotal;
    }

    totalRevenue += invoiceAmount;
    totalEnergyConsumed += invoiceConsumption;

    if (!chargerMap[chargerSerial]) {
      chargerMap[chargerSerial] = { 
        total: 0, 
        invoiceCount: 0,
        totalRevenue: 0,
        readings: [] 
      };
    }

    // Add to this charger's totals
    chargerMap[chargerSerial].total += invoiceConsumption;
    chargerMap[chargerSerial].totalRevenue += invoiceAmount;
    chargerMap[chargerSerial].invoiceCount += 1;

    // Store this invoice's reading for trend charting
    if (invoiceDate) {
      chargerMap[chargerSerial].readings.push({
        date: invoiceDate,
        consumption: invoiceConsumption,
        amount: invoiceAmount,
        invoiceNumber: inv.fields?.invoiceNumber?.["en-US"],
        clientName: inv.fields?.clientName?.["en-US"],
      });
    }
  }

  // --- Compute overall stats ---
  const totalChargers = Object.keys(chargerMap).length;
  const averageConsumptionPerCharger = totalChargers > 0 
    ? totalEnergyConsumed / totalChargers 
    : 0;

  // --- Build per-charger trend data ---
  const chargerTrends = Object.entries(chargerMap).map(([chargerSerial, data]) => ({
    chargerSerial,
    totalConsumption: data.total,
    totalRevenue: data.totalRevenue,
    invoiceCount: data.invoiceCount,
    averageConsumption: data.invoiceCount > 0 ? data.total / data.invoiceCount : 0,
    readings: data.readings.sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    ),
  }));

  // Sort chargers by consumption (highest first)
  chargerTrends.sort((a, b) => b.totalConsumption - a.totalConsumption);

  // --- Build consumption timeline (aggregate all chargers by date) ---
  const dateMap = {};
  for (const chargerData of Object.values(chargerMap)) {
    for (const reading of chargerData.readings) {
      const dateKey = reading.date.split('T')[0]; // Get YYYY-MM-DD
      if (!dateMap[dateKey]) {
        dateMap[dateKey] = { consumption: 0, revenue: 0, count: 0 };
      }
      dateMap[dateKey].consumption += reading.consumption;
      dateMap[dateKey].revenue += reading.amount;
      dateMap[dateKey].count += 1;
    }
  }

  const consumptionTimeline = Object.entries(dateMap)
    .map(([date, data]) => ({
      date,
      consumption: data.consumption,
      revenue: data.revenue,
      invoiceCount: data.count,
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
      const lineItemRefs = inv.fields?.lineItems?.["en-US"] || [];
      let totalAmount = 0;
      let totalKwh = 0;

      for (const lineItemRef of lineItemRefs) {
        const lineItem = lineItemsMap.get(lineItemRef.sys.id);
        if (lineItem) {
          const qty = Number(lineItem.fields?.quantity?.["en-US"] ?? 0);
          const price = Number(lineItem.fields?.unitPrice?.["en-US"] ?? 0);
          totalAmount += qty * price;
          totalKwh += qty;
        }
      }

      return {
        id: inv.sys.id,
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
        const qty = Number(lineItem.fields?.quantity?.["en-US"] ?? 0);
        const price = Number(lineItem.fields?.unitPrice?.["en-US"] ?? 0);
        consumption += qty;
        revenue += qty * price;
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
  console.log(`   Total Chargers: ${totalChargers}`);
  console.log(`   Total Energy Consumed: ${totalEnergyConsumed.toFixed(2)} kWh`);
  console.log(`   Total Revenue: $${totalRevenue.toFixed(2)}`);
  console.log(`   Total Invoices: ${invoices.length}`);

  // --- Dashboard widgets structure ---
  const widgets = {
    summary: {
      totalChargers,
      totalInvoices: invoices.length,
      totalEnergyConsumed,
      totalRevenue,
      averageConsumptionPerCharger,
      averageRevenuePerInvoice: invoices.length > 0 ? totalRevenue / invoices.length : 0,
    },
    chargerTrends,
    consumptionTimeline,
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
  console.log(`   🔌 Active Chargers: ${totalChargers}`);
  console.log(`   ⚡ Total Energy: ${totalEnergyConsumed.toFixed(2)} kWh`);
  console.log(`   💰 Total Revenue: $${totalRevenue.toFixed(2)}`);
  console.log(`   📄 Total Invoices: ${invoices.length}`);
  console.log(`   📈 Avg per Charger: ${averageConsumptionPerCharger.toFixed(2)} kWh`);
  
  if (chargerTrends.length > 0) {
    console.log(`\n   🏆 Top Charger: ${chargerTrends[0].chargerSerial}`);
    console.log(`      Consumption: ${chargerTrends[0].totalConsumption.toFixed(2)} kWh`);
    console.log(`      Revenue: $${chargerTrends[0].totalRevenue.toFixed(2)}`);
  }

  if (topClients.length > 0) {
    console.log(`\n   👤 Top Client: ${topClients[0].clientName}`);
    console.log(`      Consumption: ${topClients[0].totalConsumption.toFixed(2)} kWh`);
    console.log(`      Revenue: $${topClients[0].totalRevenue.toFixed(2)}`);
  }
}

updateDashboard().catch(console.error);