// src/components/dashboard/Dashboard.jsx
import React from 'react';
import Link from 'next/link';

const Dashboard = ({ entry }) => {
  console.log('🎯 Dashboard component received:', {
    hasEntry: !!entry,
    hasFields: !!entry?.fields,
    fields: entry?.fields ? Object.keys(entry.fields) : []
  });

  if (!entry || !entry.fields) {
    return (
      <div style={{ padding: '20px', background: '#ffebee', border: '2px solid red' }}>
        <h2>❌ Dashboard Data Issue</h2>
        <p><strong>Problem:</strong> No entry data received by Dashboard component</p>
        <details>
          <summary>Debug Details</summary>
          <pre>{JSON.stringify({ entry }, null, 2)}</pre>
        </details>
      </div>
    );
  }

  const { 
    title, 
    totalInvoices, 
    totalRevenue, 
    recentInvoices = [],
    widgets,
    lastUpdated 
  } = entry.fields;

  // Extract device consumption trends from widgets
  const deviceTrends = widgets?.deviceTrends || [];
  const consumptionTimeline = widgets?.consumptionTimeline || [];
  const summary = widgets?.summary || {};

  // Process device trends to extract consumption data with safe defaults
  const deviceConsumptionData = deviceTrends.map(device => ({
    deviceId: device.deviceId || 'Unknown Device',
    chargerSerial: device.chargerSerial || 'N/A',
    clientName: device.clientName || 'N/A',
    totalConsumption: device.totalConsumption || 0,
    totalRevenue: device.totalRevenue || 0,
    invoiceCount: device.invoiceCount || 0,
    dailyAverage: device.averageConsumptionPerDay || 0
  }));

  // Safe number formatting function
  const formatNumber = (value, decimals = 2) => {
    if (value === undefined || value === null) return '0.00';
    return Number(value).toFixed(decimals);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ color: '#333', borderBottom: '2px solid #007acc', paddingBottom: '10px' }}>
          🏠 {title || 'EV Charging Dashboard'}
        </h1>
        <p style={{ color: '#666', margin: '5px 0' }}>
          Last updated: {lastUpdated ? new Date(lastUpdated).toLocaleString() : 'Unknown'}
        </p>
      </div>

      {/* Summary Stats */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '20px', 
        marginBottom: '30px' 
      }}>
        <div style={{ 
          background: 'white', 
          padding: '20px', 
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          borderLeft: '4px solid #007acc'
        }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#333', fontSize: '14px' }}>Total Invoices</h3>
          <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#007acc', margin: 0 }}>
            {totalInvoices || 0}
          </p>
        </div>
        
        <div style={{ 
          background: 'white', 
          padding: '20px', 
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          borderLeft: '4px solid #4caf50'
        }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#333', fontSize: '14px' }}>Total Revenue</h3>
          <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#4caf50', margin: 0 }}>
            ${formatNumber(totalRevenue)}
          </p>
        </div>
        
        <div style={{ 
          background: 'white', 
          padding: '20px', 
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          borderLeft: '4px solid #ff9800'
        }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#333', fontSize: '14px' }}>Energy Consumed</h3>
          <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#ff9800', margin: 0 }}>
            {formatNumber(summary.totalEnergyConsumed)} kWh
          </p>
        </div>
        
        <div style={{ 
          background: 'white', 
          padding: '20px', 
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          borderLeft: '4px solid #9c27b0'
        }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#333', fontSize: '14px' }}>Active Devices</h3>
          <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#9c27b0', margin: 0 }}>
            {summary.totalDevices || 0}
          </p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '30px',
        alignItems: 'start'
      }}>
        
        {/* Left Column - Device Consumption Trends */}
        <div>
          <h2 style={{ color: '#333', marginBottom: '20px' }}>Device Consumption Trends</h2>
          {deviceConsumptionData.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {deviceConsumptionData.map((device, index) => (
                <div 
                  key={device.deviceId + index} 
                  style={{ 
                    background: 'white',
                    padding: '20px',
                    borderRadius: '8px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    border: '1px solid #e0e0e0'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                    <div>
                      <h3 style={{ margin: '0 0 5px 0', color: '#333', fontSize: '16px' }}>
                        Device: {device.deviceId}
                      </h3>
                      <p style={{ margin: '2px 0', color: '#666', fontSize: '14px' }}>
                        Charger: {device.chargerSerial}
                      </p>
                      <p style={{ margin: '2px 0', color: '#666', fontSize: '14px' }}>
                        Client: {device.clientName}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: '2px 0', color: '#007acc', fontSize: '18px', fontWeight: 'bold' }}>
                        {formatNumber(device.totalConsumption)} kWh
                      </p>
                      <p style={{ margin: '2px 0', color: '#4caf50', fontSize: '14px' }}>
                        ${formatNumber(device.totalRevenue)}
                      </p>
                    </div>
                  </div>
                  
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr', 
                    gap: '10px',
                    background: '#f8f9fa',
                    padding: '15px',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}>
                    <div>
                      <strong>Invoices:</strong> {device.invoiceCount}
                    </div>
                    <div>
                      <strong>Daily Avg:</strong> {formatNumber(device.dailyAverage)} kWh
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ 
              background: '#fff3cd', 
              padding: '20px', 
              borderRadius: '8px',
              border: '1px solid #ffeaa7',
              textAlign: 'center'
            }}>
              <p style={{ margin: 0, color: '#856404' }}>📊 No device consumption data available</p>
            </div>
          )}
        </div>

        {/* Right Column - Recent Invoices */}
        <div>
          <h2 style={{ color: '#333', marginBottom: '20px' }}>Recent Invoices</h2>
          {recentInvoices.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {recentInvoices.map((invoice, index) => {
                const invoiceSlug = invoice.fields?.slug;
                const invoiceUrl = invoiceSlug ? `/invoice/${invoiceSlug.replace(/^\//, '')}` : '#';
                const deviceId = invoiceSlug?.startsWith('/fac-') 
                  ? invoiceSlug.replace(/^\/fac-/, '') 
                  : invoiceSlug?.replace(/^fac-/, '') || 'Unknown Device';
                
                return (
                  <Link 
                    key={invoice.sys?.id || index} 
                    href={invoiceUrl}
                    style={{ textDecoration: 'none' }}
                  >
                    <div 
                      style={{ 
                        background: 'white',
                        padding: '18px',
                        borderRadius: '8px',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        border: '1px solid #e0e0e0',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
                        e.currentTarget.style.borderColor = '#007acc';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                        e.currentTarget.style.borderColor = '#e0e0e0';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <h4 style={{ 
                            margin: '0 0 8px 0', 
                            color: '#1976d2',
                            fontSize: '16px',
                            fontWeight: '600'
                          }}>
                            {invoice.fields?.invoiceNumber || `Invoice ${index + 1}`}
                          </h4>
                          <p style={{ margin: '4px 0', color: '#333', fontSize: '14px' }}>
                            <strong>Client:</strong> {invoice.fields?.clientName || 'Unknown Client'}
                          </p>
                          <p style={{ margin: '4px 0', color: '#666', fontSize: '13px' }}>
                            <strong>Device ID:</strong> {deviceId}
                          </p>
                          <p style={{ margin: '4px 0', color: '#666', fontSize: '13px' }}>
                            <strong>Date:</strong> {invoice.fields?.invoiceDate || 'No date'}
                          </p>
                        </div>
                        <div style={{ textAlign: 'right', minWidth: '100px' }}>
                          <p style={{ 
                            margin: '0 0 5px 0', 
                            color: '#4caf50', 
                            fontSize: '18px', 
                            fontWeight: 'bold' 
                          }}>
                            ${formatNumber(invoice.fields?.totalAmount)}
                          </p>
                          <p style={{ 
                            margin: 0, 
                            color: '#666', 
                            fontSize: '13px',
                            background: '#e8f5e8',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            display: 'inline-block'
                          }}>
                            {formatNumber(invoice.fields?.consumptionKwh)} kWh
                          </p>
                        </div>
                      </div>
                      <div style={{ 
                        marginTop: '10px', 
                        paddingTop: '10px', 
                        borderTop: '1px solid #f0f0f0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span style={{ 
                          color: '#007acc', 
                          fontSize: '12px', 
                          fontWeight: '500' 
                        }}>
                          Click to view details →
                        </span>
                        <span style={{ 
                          color: '#666', 
                          fontSize: '11px',
                          background: '#f5f5f5',
                          padding: '2px 6px',
                          borderRadius: '8px'
                        }}>
                          {invoice.fields?.chargerSerial || 'No serial'}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div style={{ 
              background: '#fff3cd', 
              padding: '20px', 
              borderRadius: '8px',
              border: '1px solid #ffeaa7',
              textAlign: 'center'
            }}>
              <p style={{ margin: 0, color: '#856404' }}>📝 No recent invoices available</p>
            </div>
          )}
        </div>
      </div>

      {/* Overall Consumption Timeline */}
      {consumptionTimeline.length > 0 && (
        <div style={{ marginTop: '40px' }}>
          <h2 style={{ color: '#333', marginBottom: '20px' }}>Overall Consumption Timeline</h2>
          <div style={{ 
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: '10px'
            }}>
              {consumptionTimeline.slice(-14).map((day, index) => {
                const maxConsumption = Math.max(...consumptionTimeline.map(d => d.consumption || 0));
                const height = maxConsumption > 0 
                  ? Math.max(20, ((day.consumption || 0) / maxConsumption) * 100)
                  : 20;
                
                return (
                  <div key={index} style={{ textAlign: 'center' }}>
                    <div style={{ 
                      background: 'linear-gradient(to top, #4caf50, #8bc34a)',
                      height: `${height}px`,
                      borderRadius: '4px 4px 0 0',
                      marginBottom: '5px'
                    }}></div>
                    <div style={{ fontSize: '11px', color: '#666' }}>
                      {day.date ? new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'}
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#333' }}>
                      {formatNumber(day.consumption, 1)} kWh
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;