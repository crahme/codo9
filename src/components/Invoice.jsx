import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { VisualEditorComponent } from './VisualEditorComponent';
import { CloudOceanService } from '../services/CloudOceanService';

export function Invoice({ invoice }) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [consumptionData, setConsumptionData] = useState([]);
  const [totals, setTotals] = useState({ totalConsumption: 0, totalAmount: 0 });

  const cloudOceanService = new CloudOceanService(
    process.env.CLOUD_OCEAN_BASE_URL,
    process.env.API_Key
  );

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const data = await cloudOceanService.getConsumptionData(
          invoice.startDate,
          invoice.endDate
        );
        setConsumptionData(data);
        setTotals(cloudOceanService.calculateTotals(data, invoice.rate));
        setError(null);
      } catch (err) {
        setError('Failed to fetch consumption data');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [invoice.startDate, invoice.endDate, invoice.rate]);

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  return (
    <div className="invoice-container">
      {isLoading ? (
        <div className="loading">Loading consumption data...</div>
      ) : (
        <>
          <header className="invoice-header">
            <div className="invoice-title">
              <h2>INVOICE</h2>
              <div className="invoice-meta">
                <p>
                  <strong>Invoice Number:</strong>{' '}
                  <VisualEditorComponent 
                    contentId={invoice.sys?.id} 
                    fieldName="invoiceNumber"
                  />
                </p>
                <p>
                  <strong>Date:</strong>{' '}
                  {new Date(invoice.invoiceDate).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="invoice-from">
              <h3>RVE Cloud Ocean</h3>
              <p className="address">123 EV Street, Montreal, QC</p>
            </div>
          </header>

          <section className="invoice-period">
            <p>
              <strong>Billing Period:</strong>{' '}
              {new Date(invoice.startDate).toLocaleDateString()} -{' '}
              {new Date(invoice.endDate).toLocaleDateString()}
            </p>
          </section>

          <table className="invoice-consumption">
            <thead>
              <tr>
                <th>Station</th>
                <th>Total Consumption (kWh)</th>
                <th>Rate ($/kWh)</th>
                <th>Amount ($)</th>
              </tr>
            </thead>
            <tbody>
              {consumptionData.map((station) => (
                <tr key={station.uuid}>
                  <td>{station.name}</td>
                  <td>{station.consumption.toFixed(2)}</td>
                  <td>{invoice.rate.toFixed(2)}</td>
                  <td>{(station.consumption * invoice.rate).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan="1"><strong>Total</strong></td>
                <td>{totals.totalConsumption.toFixed(2)} kWh</td>
                <td></td>
                <td><strong>${totals.totalAmount.toFixed(2)}</strong></td>
              </tr>
            </tfoot>
          </table>

          {invoice.pdfUrl && (
            <div className="invoice-pdf">
              <a href={invoice.pdfUrl} target="_blank" rel="noopener noreferrer">
                Download PDF Invoice
              </a>
            </div>
          )}
        </>
      )}
    </div>
  );
}

Invoice.propTypes = {
  invoice: PropTypes.shape({
    sys: PropTypes.shape({
      id: PropTypes.string.isRequired,
    }).isRequired,
    invoiceNumber: PropTypes.string.isRequired,
    invoiceDate: PropTypes.string.isRequired,
    startDate: PropTypes.string.isRequired,
    endDate: PropTypes.string.isRequired,
    rate: PropTypes.number.isRequired,
    pdfUrl: PropTypes.string,
  }).isRequired,
};