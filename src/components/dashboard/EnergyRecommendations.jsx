
import { Card, CardContent } from "@/components/ui/card"
export function EnergyRecommendations({ data }) {
  return (
    <Card className="bg-slate-800 text-white">
      <CardContent className="p-4">
        <h2 className="mb-2 text-lg font-semibold">Energy Recommendations</h2>
        <p>Your Usage: {data.usage}</p>
        <p>Potential Monthly Savings: ${data.savings}</p>
        <div className="mt-4">
          <p>Efficiency Score</p>
          <div className="w-full bg-slate-600 rounded-full h-2 mt-1">
            <div className="bg-green-400 h-2 rounded-full" style={{ width: `${data.score}%` }}></div>
          </div>
          <p className="text-right text-xs">{data.score}/100</p>
        </div>
      </CardContent>
    </Card>
  );
}
