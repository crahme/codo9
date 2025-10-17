// src/components/dashboard/Dashboard.jsx
import React from 'react';
import StatsCard from './StatsCards';
import DeviceOverview from './DeviceOverview';
import RecentInvoicesTable from './RecentInvoicesTable';
import ConsumptionTrendChart from './ConsumptionTrendChart';
import EnergyRecommendations from './EnergyRecommendations';

const Dashboard = ({ entry }) => {
  if (!entry || !entry.fields) {
    return <div>Loading dashboard...</div>;
  }

  const { 
    title, 
    totalInvoices, 
    totalRevenue, 
    recentInvoices = [],
    widgets,
    lastUpdated 
  } = entry.fields;

  // Extract data from widgets if available, otherwise use fallbacks
  const summary = widgets?.summary || {};
  const deviceTrends = widgets?.deviceTrends || [];
  const consumptionTimeline = widgets?.consumptionTimeline || [];
  const topClients = widgets?.topClients || [];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{title || 'EV Charging Dashboard'}</h1>
        <p className="text-gray-600 mt-2">
          Last updated: {lastUpdated ? new Date(lastUpdated).toLocaleString() : 'Never'}
        </p>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatsCard
          title="Total Invoices"
          value={totalInvoices || summary.totalInvoices || 0}
          subtitle="All time"
        />
        <StatsCard
          title="Total Revenue"
          value={`$${(totalRevenue || summary.totalRevenue || 0).toFixed(2)}`}
          subtitle="Total earnings"
        />
        <StatsCard
          title="Energy Consumed"
          value={`${(summary.totalEnergyConsumed || 0).toFixed(2)} kWh`}
          subtitle="Total consumption"
        />
        <StatsCard
          title="Active Devices"
          value={summary.totalDevices || deviceTrends.length || 0}
          subtitle="Charging stations"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Left Column - Charts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Consumption Trend Chart */}
          <ConsumptionTrendChart 
            data={consumptionTimeline}
            title="Energy Consumption Trends"
          />
          
          {/* Device Overview */}
          <DeviceOverview 
            devices={deviceTrends}
            title="Device Performance"
          />
        </div>

        {/* Right Column - Tables & Recommendations */}
        <div className="space-y-6">
          {/* Recent Invoices */}
          <RecentInvoicesTable 
            invoices={recentInvoices}
            title="Recent Invoices"
          />
          
          {/* Energy Recommendations */}
          <EnergyRecommendations 
            data={summary}
            devices={deviceTrends}
          />
        </div>
      </div>

      {/* Top Clients Section (if available) */}
      {topClients.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Top Clients</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {topClients.map((client, index) => (
              <div key={index} className="border rounded-lg p-4">
                <h3 className="font-semibold text-lg">{client.clientName}</h3>
                <p className="text-gray-600">{client.totalConsumption.toFixed(2)} kWh</p>
                <p className="text-green-600 font-medium">${client.totalRevenue.toFixed(2)}</p>
                <p className="text-sm text-gray-500">{client.invoiceCount} invoices</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;