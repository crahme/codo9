import { Card, CardContent } from "@/components/ui/card"

export function StatsCards({ totalDevices, totalConsumption, recentInvoicesCount }) {
  const stats = [
    { label: "Total Devices", value: totalDevices },
    { label: "Total Consumption", value: `${totalConsumption} kWh` },
    { label: "Recent Invoices", value: recentInvoicesCount },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {stats.map((s) => (
        <Card key={s.label} className="bg-slate-800 text-white">
          <CardContent className="p-6">
            <h2 className="text-sm">{s.label}</h2>
            <p className="text-2xl font-bold">{s.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
