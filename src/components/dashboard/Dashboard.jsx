import React, { useEffect, useState } from "react";

/**
 * Dashboard Component
 * Displays aggregated and per-device stats from Contentful dashboard data
 */
export default function Dashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch("/api/dashboard"); // backend endpoint serving dashboard data
        if (!res.ok) throw new Error("Failed to fetch dashboard data");
        const data = await res.json();
        setDashboard(data);
      } catch (err) {
        console.error("❌ Error loading dashboard:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, []);

  if (loading)
    return <div className="p-8 text-gray-600 text-center">Loading dashboard...</div>;

  if (error)
    return (
      <div className="p-8 text-center text-red-600">
        ⚠️ Error loading dashboard: {error}
      </div>
    );

  if (!dashboard || !dashboard.fields?.widgets?.["en-US"])
    return (
      <div className="p-8 text-center text-gray-500">
        No dashboard data available
      </div>
    );

  const { summary, deviceTrends } = dashboard.fields.widgets["en-US"];

  return (
    <div className="p-8 bg-gray-50 min-h-screen space-y-8">
      {/* Dashboard Header */}
      <header>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Energy Dashboard</h1>
        <p className="text-gray-500 text-sm">
          Last updated:{" "}
          {new Date(
            dashboard.fields.lastUpdated?.["en-US"] || Date.now()
          ).toLocaleString()}
        </p>
      </header>

      {/* Summary Section */}
      <section className="bg-white shadow-sm rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Summary</h2>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="p-4 border rounded-xl">
            <p className="text-sm text-gray-500">Total Devices</p>
            <p className="text-2xl font-bold text-blue-600">
              {summary?.totalDevices ?? 0}
            </p>
          </div>
          <div className="p-4 border rounded-xl">
            <p className="text-sm text-gray-500">Total Consumption</p>
            <p className="text-2xl font-bold text-green-600">
              {summary?.totalConsumption?.toFixed(2) ?? 0} kWh
            </p>
          </div>
          <div className="p-4 border rounded-xl">
            <p className="text-sm text-gray-500">Average per Device</p>
            <p className="text-2xl font-bold text-purple-600">
              {summary?.averageConsumption?.toFixed(2) ?? 0} kWh
            </p>
          </div>
        </div>
      </section>

      {/* Device Trends Section */}
      <section className="bg-white shadow-sm rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-6">
          Device Consumption Trends
        </h2>

        {deviceTrends?.length ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {deviceTrends.map((device) => (
              <div
                key={device.deviceId}
                className="border rounded-xl p-4 bg-gray-50 hover:bg-gray-100 transition"
              >
                <h3 className="font-semibold text-gray-700 mb-2">
                  Device: <span className="text-blue-700">{device.deviceId}</span>
                </h3>
                <p className="text-sm text-gray-600 mb-1">
                  Total:{" "}
                  <span className="font-medium text-green-600">
                    {device.totalConsumption.toFixed(2)} kWh
                  </span>
                </p>
                <p className="text-sm text-gray-600 mb-3">
                  Data Points:{" "}
                  <span className="font-medium">{device.readings.length}</span>
                </p>

                <div className="bg-white rounded-md border p-3 text-xs text-gray-500">
                  {device.readings.length
                    ? device.readings
                        .slice(-3)
                        .map(
                          (r, i) =>
                            `📅 ${new Date(r.date).toLocaleDateString()}: ${r.consumption} kWh`
                        )
                        .join("\n")
                    : "No readings available"}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm text-center">
            No device trends data found
          </p>
        )}
      </section>
    </div>
  );
}
