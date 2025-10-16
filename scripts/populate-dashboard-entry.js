import dotenv from "dotenv";
dotenv.config();
import contentful from "contentful-management";

const client = contentful.createClient({
  accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN,
});

async function populateDashboardFromInvoices() {
  try {
    const space = await client.getSpace(process.env.CONTENTFUL_SPACE_ID);
    const environment = await space.getEnvironment("master");

    console.log("📊 Fetching invoice entries...");
    const invoicesResponse = await environment.getEntries({
      content_type: "invoice",
      limit: 1000,
    });

    const invoices = invoicesResponse.items;
    if (!invoices.length) {
      console.log("⚠️ No invoices found.");
      return;
    }

    console.log(`✅ Found ${invoices.length} invoices.\n`);

    // ========== 1. CREATE STAT ITEMS ==========
    console.log("📈 Creating stat items...");
    
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

    // Calculate total consumption from invoices
    const totalConsumption = invoices.reduce((sum, inv) => {
      const consumption = inv.fields?.consumption?.["en-US"] ?? 0;
      return sum + Number(consumption);
    }, 0);

    const statItems = [
      { id: "stat-total-invoices", label: "Total Invoices", value: String(totalInvoices), icon: "FileText", color: "blue" },
      { id: "stat-total-revenue", label: "Total Revenue", value: totalRevenue.toFixed(2), unit: "USD", icon: "DollarSign", color: "green" },
      { id: "stat-paid", label: "Paid Invoices", value: String(paidInvoices), icon: "CheckCircle", color: "green" },
      { id: "stat-pending", label: "Pending Invoices", value: String(pendingInvoices), icon: "Clock", color: "orange" },
      { id: "stat-consumption", label: "Total Consumption", value: totalConsumption.toFixed(2), unit: "kWh", icon: "Zap", color: "purple" },
    ];

    const createdStatItems = [];
    for (const stat of statItems) {
      try {
        const entry = await environment.createEntryWithId("statItem", stat.id, {
          fields: {
            label: { "en-US": stat.label },
            value: { "en-US": stat.value },
            unit: { "en-US": stat.unit || "" },
            icon: { "en-US": stat.icon },
            color: { "en-US": stat.color },
          },
        });
        await entry.publish();
        createdStatItems.push({ sys: { type: "Link", linkType: "Entry", id: entry.sys.id } });
        console.log(`  ✓ Created stat: ${stat.label}`);
      } catch (err) {
        if (err.message.includes("already exists")) {
          console.log(`  ↻ Updating stat: ${stat.label}`);
          const existing = await environment.getEntry(stat.id);
          existing.fields.label = { "en-US": stat.label };
          existing.fields.value = { "en-US": stat.value };
          existing.fields.unit = { "en-US": stat.unit || "" };
          existing.fields.icon = { "en-US": stat.icon };
          existing.fields.color = { "en-US": stat.color };
          const updated = await existing.update();
          await updated.publish();
          createdStatItems.push({ sys: { type: "Link", linkType: "Entry", id: stat.id } });
        }
      }
    }

    // ========== 2. CREATE DEVICE OVERVIEW ==========
    console.log("\n🔌 Creating device overview...");
    
    // Group invoices by device to calculate consumption per device
    const deviceMap = new Map();
    invoices.forEach(inv => {
      const deviceId = inv.fields?.deviceId?.["en-US"] || inv.fields?.device?.["en-US"] || "Unknown Device";
      const consumption = Number(inv.fields?.consumption?.["en-US"] ?? 0);
      
      if (deviceMap.has(deviceId)) {
        deviceMap.set(deviceId, deviceMap.get(deviceId) + consumption);
      } else {
        deviceMap.set(deviceId, consumption);
      }
    });

    // Create deviceStat entries
    const deviceStatLinks = [];
    for (const [deviceId, consumption] of deviceMap.entries()) {
      const deviceStatId = `device-${deviceId.replace(/\s+/g, '-').toLowerCase()}`;
      try {
        const entry = await environment.createEntryWithId("deviceStat", deviceStatId, {
          fields: {
            deviceId: { "en-US": deviceId },
            consumption: { "en-US": consumption },
          },
        });
        await entry.publish();
        deviceStatLinks.push({ sys: { type: "Link", linkType: "Entry", id: entry.sys.id } });
        console.log(`  ✓ Created device stat: ${deviceId} (${consumption.toFixed(2)} kWh)`);
      } catch (err) {
        if (err.message.includes("already exists")) {
          const existing = await environment.getEntry(deviceStatId);
          existing.fields.deviceId = { "en-US": deviceId };
          existing.fields.consumption = { "en-US": consumption };
          const updated = await existing.update();
          await updated.publish();
          deviceStatLinks.push({ sys: { type: "Link", linkType: "Entry", id: deviceStatId } });
          console.log(`  ↻ Updated device stat: ${deviceId}`);
        }
      }
    }

    // Create deviceOverview entry
    const deviceOverviewId = "device-overview-main";
    let deviceOverview;
    try {
      deviceOverview = await environment.createEntryWithId("deviceOverview", deviceOverviewId, {
        fields: {
          title: { "en-US": "Device Consumption Overview" },
          devices: { "en-US": deviceStatLinks },
        },
      });
      await deviceOverview.publish();
      console.log("  ✓ Created device overview");
    } catch (err) {
      if (err.message.includes("already exists")) {
        deviceOverview = await environment.getEntry(deviceOverviewId);
        deviceOverview.fields.devices = { "en-US": deviceStatLinks };
        const updated = await deviceOverview.update();
        await updated.publish();
        console.log("  ↻ Updated device overview");
      }
    }

    // ========== 3. CREATE CONSUMPTION TREND ==========
    console.log("\n📊 Creating consumption trend...");
    
    // Group invoices by date to create trend data
    const trendMap = new Map();
    invoices.forEach(inv => {
      const dateStr = inv.fields?.invoiceDate?.["en-US"] || inv.fields?.date?.["en-US"];
      if (!dateStr) return;
      
      const date = new Date(dateStr).toISOString().split('T')[0]; // Get YYYY-MM-DD
      const consumption = Number(inv.fields?.consumption?.["en-US"] ?? 0);
      
      if (trendMap.has(date)) {
        trendMap.set(date, trendMap.get(date) + consumption);
      } else {
        trendMap.set(date, consumption);
      }
    });

    // Sort by date and create trendPoint entries
    const sortedDates = Array.from(trendMap.entries()).sort((a, b) => 
      new Date(a[0]) - new Date(b[0])
    );

    const trendPointLinks = [];
    for (const [date, value] of sortedDates) {
      const trendPointId = `trend-${date}`;
      try {
        const entry = await environment.createEntryWithId("trendPoint", trendPointId, {
          fields: {
            date: { "en-US": date },
            value: { "en-US": value },
          },
        });
        await entry.publish();
        trendPointLinks.push({ sys: { type: "Link", linkType: "Entry", id: entry.sys.id } });
        console.log(`  ✓ Created trend point: ${date} (${value.toFixed(2)} kWh)`);
      } catch (err) {
        if (err.message.includes("already exists")) {
          const existing = await environment.getEntry(trendPointId);
          existing.fields.date = { "en-US": date };
          existing.fields.value = { "en-US": value };
          const updated = await existing.update();
          await updated.publish();
          trendPointLinks.push({ sys: { type: "Link", linkType: "Entry", id: trendPointId } });
        }
      }
    }

    // Create consumptionTrend entry
    const consumptionTrendId = "consumption-trend-main";
    let consumptionTrend;
    try {
      consumptionTrend = await environment.createEntryWithId("consumptionTrend", consumptionTrendId, {
        fields: {
          title: { "en-US": "Energy Consumption Trend" },
          dataPoints: { "en-US": trendPointLinks },
        },
      });
      await consumptionTrend.publish();
      console.log("  ✓ Created consumption trend");
    } catch (err) {
      if (err.message.includes("already exists")) {
        consumptionTrend = await environment.getEntry(consumptionTrendId);
        consumptionTrend.fields.dataPoints = { "en-US": trendPointLinks };
        const updated = await consumptionTrend.update();
        await updated.publish();
        console.log("  ↻ Updated consumption trend");
      }
    }

    // ========== 4. CREATE RECENT INVOICES WIDGET ==========
    console.log("\n📄 Creating recent invoices widget...");
    
    // Get 5 most recent invoices
    const recentInvoicesList = invoices
      .filter(inv => inv.fields?.invoiceDate?.["en-US"] || inv.fields?.date?.["en-US"])
      .sort((a, b) => {
        const dateA = new Date(a.fields?.invoiceDate?.["en-US"] || a.fields?.date?.["en-US"]);
        const dateB = new Date(b.fields?.invoiceDate?.["en-US"] || b.fields?.date?.["en-US"]);
        return dateB - dateA;
      })
      .slice(0, 5);

    // Create invoiceSummary entries
    const invoiceSummaryLinks = [];
    for (const inv of recentInvoicesList) {
      const invoiceId = inv.fields?.invoiceId?.["en-US"] || inv.sys.id;
      const summaryId = `invoice-summary-${invoiceId}`;
      
      try {
        const entry = await environment.createEntryWithId("invoiceSummary", summaryId, {
          fields: {
            invoiceId: { "en-US": invoiceId },
            device: { "en-US": inv.fields?.deviceId?.["en-US"] || inv.fields?.device?.["en-US"] || "Unknown" },
            amount: { "en-US": Number(inv.fields?.totalAmount?.["en-US"] ?? 0) },
            status: { "en-US": inv.fields?.status?.["en-US"] || "pending" },
          },
        });
        await entry.publish();
        invoiceSummaryLinks.push({ sys: { type: "Link", linkType: "Entry", id: entry.sys.id } });
        console.log(`  ✓ Created invoice summary: ${invoiceId}`);
      } catch (err) {
        if (err.message.includes("already exists")) {
          const existing = await environment.getEntry(summaryId);
          existing.fields.invoiceId = { "en-US": invoiceId };
          existing.fields.device = { "en-US": inv.fields?.deviceId?.["en-US"] || "Unknown" };
          existing.fields.amount = { "en-US": Number(inv.fields?.totalAmount?.["en-US"] ?? 0) };
          existing.fields.status = { "en-US": inv.fields?.status?.["en-US"] || "pending" };
          const updated = await existing.update();
          await updated.publish();
          invoiceSummaryLinks.push({ sys: { type: "Link", linkType: "Entry", id: summaryId } });
        }
      }
    }

    // Create recentInvoices entry
    const recentInvoicesId = "recent-invoices-main";
    let recentInvoicesWidget;
    try {
      recentInvoicesWidget = await environment.createEntryWithId("recentInvoices", recentInvoicesId, {
        fields: {
          title: { "en-US": "Recent Invoices" },
          invoices: { "en-US": invoiceSummaryLinks },
        },
      });
      await recentInvoicesWidget.publish();
      console.log("  ✓ Created recent invoices widget");
    } catch (err) {
      if (err.message.includes("already exists")) {
        recentInvoicesWidget = await environment.getEntry(recentInvoicesId);
        recentInvoicesWidget.fields.invoices = { "en-US": invoiceSummaryLinks };
        const updated = await recentInvoicesWidget.update();
        await updated.publish();
        console.log("  ↻ Updated recent invoices widget");
      }
    }

    // ========== 5. CREATE ENERGY RECOMMENDATIONS ==========
    console.log("\n💡 Creating energy recommendations...");
    
    const avgConsumption = totalConsumption / totalInvoices;
    const efficiencyScore = Math.max(0, Math.min(100, 100 - (avgConsumption / 10)));
    const potentialSavings = avgConsumption * 0.15; // 15% potential savings

    const recommendations = [];
    if (avgConsumption > 50) {
      recommendations.push("Consider switching to LED lighting to reduce consumption");
      recommendations.push("Optimize air conditioning usage during peak hours");
    }
    if (pendingInvoices > totalInvoices * 0.3) {
      recommendations.push("Review pending invoices to avoid late fees");
    }
    recommendations.push("Monitor high-consumption devices more closely");
    recommendations.push("Consider renewable energy options for long-term savings");

    const energyRecoId = "energy-recommendations-main";
    let energyReco;
    try {
      energyReco = await environment.createEntryWithId("energyRecommendation", energyRecoId, {
        fields: {
          title: { "en-US": "Energy Efficiency Recommendations" },
          description: { "en-US": `Based on your average consumption of ${avgConsumption.toFixed(2)} kWh, here are personalized recommendations.` },
          usageInfo: { "en-US": `Total consumption: ${totalConsumption.toFixed(2)} kWh across ${totalInvoices} invoices` },
          savings: { "en-US": potentialSavings },
          efficiencyScore: { "en-US": efficiencyScore },
          recommendations: { "en-US": recommendations },
        },
      });
      await energyReco.publish();
      console.log("  ✓ Created energy recommendations");
    } catch (err) {
      if (err.message.includes("already exists")) {
        energyReco = await environment.getEntry(energyRecoId);
        energyReco.fields.title = { "en-US": "Energy Efficiency Recommendations" };
        energyReco.fields.description = { "en-US": `Based on your average consumption of ${avgConsumption.toFixed(2)} kWh, here are personalized recommendations.` };
        energyReco.fields.usageInfo = { "en-US": `Total consumption: ${totalConsumption.toFixed(2)} kWh across ${totalInvoices} invoices` };
        energyReco.fields.savings = { "en-US": potentialSavings };
        energyReco.fields.efficiencyScore = { "en-US": efficiencyScore };
        energyReco.fields.recommendations = { "en-US": recommendations };
        const updated = await energyReco.update();
        await updated.publish();
        console.log("  ↻ Updated energy recommendations");
      }
    }

    // ========== 6. CREATE DASHBOARD ENTRY ==========
    console.log("\n🎯 Creating main dashboard...");
    
    const dashboardId = "main-dashboard";
    let dashboard;
    try {
      dashboard = await environment.createEntryWithId("dashboard", dashboardId, {
        fields: {
          title: { "en-US": "Energy Management Dashboard" },
          description: { "en-US": "Comprehensive overview of your energy consumption and invoices" },
          stats: { "en-US": createdStatItems },
          deviceOverview: { "en-US": { sys: { type: "Link", linkType: "Entry", id: deviceOverviewId } } },
          consumptionTrend: { "en-US": { sys: { type: "Link", linkType: "Entry", id: consumptionTrendId } } },
          recentInvoices: { "en-US": { sys: { type: "Link", linkType: "Entry", id: recentInvoicesId } } },
          energyRecommendations: { "en-US": { sys: { type: "Link", linkType: "Entry", id: energyRecoId } } },
        },
      });
      await dashboard.publish();
      console.log("  ✓ Created main dashboard");
    } catch (err) {
      if (err.message.includes("already exists")) {
        dashboard = await environment.getEntry(dashboardId);
        dashboard.fields.stats = { "en-US": createdStatItems };
        dashboard.fields.deviceOverview = { "en-US": { sys: { type: "Link", linkType: "Entry", id: deviceOverviewId } } };
        dashboard.fields.consumptionTrend = { "en-US": { sys: { type: "Link", linkType: "Entry", id: consumptionTrendId } } };
        dashboard.fields.recentInvoices = { "en-US": { sys: { type: "Link", linkType: "Entry", id: recentInvoicesId } } };
        dashboard.fields.energyRecommendations = { "en-US": { sys: { type: "Link", linkType: "Entry", id: energyRecoId } } };
        const updated = await dashboard.update();
        await updated.publish();
        console.log("  ↻ Updated main dashboard");
      }
    }

    console.log("\n✅ Dashboard population complete!");
    console.log(`\n📊 Summary:`);
    console.log(`   Total Invoices: ${totalInvoices}`);
    console.log(`   Total Revenue: $${totalRevenue.toFixed(2)}`);
    console.log(`   Total Consumption: ${totalConsumption.toFixed(2)} kWh`);
    console.log(`   Devices Tracked: ${deviceMap.size}`);
    console.log(`   Efficiency Score: ${efficiencyScore.toFixed(1)}/100`);

  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  }
}

populateDashboardFromInvoices().catch(console.error);