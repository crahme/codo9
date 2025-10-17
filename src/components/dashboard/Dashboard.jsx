// src/components/dashboard/Dashboard.jsx - SIMPLE TEST VERSION
import React from 'react';

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

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ color: '#333', borderBottom: '2px solid #007acc', paddingBottom: '10px' }}>
        🏠 {title || 'EV Charging Dashboard'}
      </h1>
      
      {/* Data Status */}
      <div style={{ 
        background: '#e8f5e8', 
        padding: '15px', 
        margin: '20px 0', 
        borderRadius: '8px',
        border: '1px solid #4caf50'
      }}>
        <h3 style={{ color: '#2e7d32', margin: '0 0 10px 0' }}>✅ Dashboard Loaded Successfully!</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
          <div>
            <strong>Total Invoices:</strong><br/>
            <span style={{ fontSize: '24px', fontWeight: 'bold' }}>{totalInvoices || 0}</span>
          </div>
          <div>
            <strong>Total Revenue:</strong><br/>
            <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#4caf50' }}>
              ${(totalRevenue || 0).toFixed(2)}
            </span>
          </div>
          <div>
            <strong>Recent Invoices:</strong><br/>
            <span style={{ fontSize: '24px', fontWeight: 'bold' }}>{recentInvoices.length}</span>
          </div>
        </div>
      </div>

      {/* Recent Invoices */}
      <div style={{ margin: '30px 0' }}>
        <h2 style={{ color: '#333' }}>Recent Invoices</h2>
        {recentInvoices.length > 0 ? (
          <div style={{ display: 'grid', gap: '10px' }}>
            {recentInvoices.map((invoice, index) => (
              <div 
                key={invoice.sys?.id || index} 
                style={{ 
                  border: '1px solid #ddd', 
                  padding: '15px', 
                  borderRadius: '8px',
                  background: '#f9f9f9'
                }}
              >
                <h4 style={{ margin: '0 0 8px 0', color: '#1976d2' }}>
                  {invoice.fields?.invoiceNumber || `Invoice ${index + 1}`}
                </h4>
                <p style={{ margin: '4px 0' }}>
                  <strong>Client:</strong> {invoice.fields?.clientName || 'Unknown Client'}
                </p>
                <p style={{ margin: '4px 0' }}>
                  <strong>Amount:</strong> 
                  <span style={{ color: '#4caf50', fontWeight: 'bold', marginLeft: '8px' }}>
                    ${invoice.fields?.totalAmount?.toFixed(2) || '0.00'}
                  </span>
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ 
            background: '#fff3cd', 
            padding: '15px', 
            borderRadius: '8px',
            border: '1px solid #ffeaa7'
          }}>
            <p style={{ margin: 0, color: '#856404' }}>📝 No recent invoices available</p>
          </div>
        )}
      </div>

      <div style={{ 
        marginTop: '40px', 
        padding: '15px',
        background: '#e3f2fd',
        borderRadius: '8px',
        fontSize: '0.9em',
        color: '#1565c0'
      }}>
        <strong>Last updated:</strong> {lastUpdated ? new Date(lastUpdated).toLocaleString() : 'Unknown'}
      </div>
    </div>
  );
};

export default Dashboard;