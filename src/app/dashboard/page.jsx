import { getDashboardData } from "../../utils/content.js"; 
import { StatsCards } from "../../components/dashboard/StatsCards.jsx";
import { DeviceOverviewChart } from "../../components/dashboard/DeviceOverviewChart.jsx";
import { DeviceOverviewChart as ConsumptionTrendChart } from "../../components/dashboard/ConsumptionTrendChart.jsx";
import { RecentInvoicesTable } from "../../components/dashboard/RecentInvoicesTable.jsx";
import { EnergyRecommendations } from "../../components/dashboard/EnergyRecommendations.jsx";

export default async function DashboardPage() {
  const data = await getDashboardData(); // from Contentful

  return (
    <div className="p-8 bg-slate-900 min-h-screen text-white space-y-6">
      <StatsCards {...data} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DeviceOverviewChart data={data.devices} />
        <RecentInvoicesTable invoices={data.recentInvoices} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ConsumptionTrendChart data={data.consumptionTrend} />
        <EnergyRecommendations data={data.energyRecommendations} />
      </div>
    </div>
  );
}
