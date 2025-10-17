import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import contentful from "contentful";

const client = contentful.createClient({
  space: process.env.VONTENTFUL_SPACE_ID,
  accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN,
});

export default function Dashboard() {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const response = await client.getEntries({
          content_type: "dashboard",
          "fields.slug": "main-dashboard",
          limit: 1,
        });

        if (response.items.length > 0) {
          const data = response.items[0].fields;
          setDashboardData(data);
        }
      } catch (err) {
        console.error("Failed to fetch dashboard:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, []);

  if (loading) {
    return <div className="text-center text-gray-500 mt-10">Loading dashboard...</div>;
  }

  if (!dashboardData) {
    return <div className="text-center text-red-500 mt-10">No dashboard data found.</div>;
  }

  const summary = dashboardData.widgets?.["en-US"]?.summary ?? dashboardData.widgets?.summary ?? {};
  const deviceTrends = dashboardData.widgets?.["en-US"]?.deviceTrends ?? dashboardData.widgets?.deviceTrends ?? [];

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-3xl font-bold">Energy Dashboard</h1>

      {/* Summary Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-lg rounded-2xl">
          <CardHeader>
            <CardTitle>Total Devices</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-blue-600">{summary.totalDevices ?? 0}</p>
          </CardContent>
        </Card>

        <Card className="shadow-lg rounded-2xl">
          <CardHeader>
            <CardTitle>Total Consumption</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-green-600">
              {(summary.totalConsumption ?? 0).toFixed(2)} kWh
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-lg rounded-2xl">
          <CardHeader>
            <CardTitle>Average per Device</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-orange-600">
              {(summary.averageConsumption ?? 0).toFixed(2)} kWh
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Device Trends Section */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Device Consumption Trends</h2>
        {deviceTrends.length === 0 ? (
          <p className="text-gray-500">No device trend data available.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {deviceTrends.map((device) => (
              <Card key={device.deviceId} className="p-4 rounded-2xl shadow-md">
                <CardHeader>
                  <CardTitle>Device {device.deviceId}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={device.readings}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="consumption" stroke="#8884d8" name="kWh" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
