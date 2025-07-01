// src/components/InvoiceSection.jsx
import React from 'react';
import PropTypes from 'prop-types';

export function InvoiceSection({ heading, invoice = {}, theme = '' }) {
  if (!invoice || !invoice.invoiceNumber) {
    return (
      <section className={`invoice-section ${theme}`}>
        <h2>Invoice data is missing or incomplete.</h2>
      </section>
    );
  }

  const {
    invoiceNumber,
    invoiceDate,
    clientName,
    clientEmail,
    chargerSerial,
    chargerModel,
    billingStart,
    billingEnd,
    lineItems = [],
    totalAmount,
    environmentalImpact,
    paymentDueDate,
    lateFeeRate,
  } = invoice;

  return (
    <section className={`invoice-section ${theme}`}>
      {/* Section Heading */}
      {heading && <h2 className="invoice-heading">{heading}</h2>}

      {/* Invoice Header Info */}
      <div className="invoice-metadata">
        <div className="invoice-meta-block">
          <p>
            <strong>Invoice #:</strong> {invoiceNumber}
          </p>
          <p>
            <strong>Date:</strong> {invoiceDate ? new Date(invoiceDate).toLocaleDateString() : '—'}
          </p>
        </div>
        <div className="invoice-meta-block">
          <p>
            <strong>Client:</strong> {clientName || '—'}
          </p>
          <p>
            <strong>Email:</strong> {clientEmail || '—'}
          </p>
        </div>
      </div>

      {/* Charger & Billing Period Info */}
      <div className="invoice-charger-info">
        <p>
          <strong>Charger Serial #:</strong> {chargerSerial || '—'}
        </p>
        <p>
          <strong>Charger Model:</strong> {chargerModel || '—'}
        </p>
        <p>
          <strong>Billing Period:</strong>{' '}
          {billingStart && billingEnd
            ? `${new Date(billingStart).toLocaleDateString()} — ${new Date(billingEnd).toLocaleDateString()}`
            : '—'}
        </p>
      </div>

      {/* Line Items Table */}
      <table className="invoice-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Start Time</th>
            <th>End Time</th>
            <th>Energy (kWh)</th>
            <th>Unit Price</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {lineItems.length > 0 ? (
            lineItems.map((item) => (
              <tr key={item?.sys?.id || Math.random()}>
                <td>{item?.date ? new Date(item.date).toLocaleDateString() : '—'}</td>
                <td>{item?.startTime || '—'}</td>
                <td>{item?.endTime || '—'}</td>
                <td>{item?.energyConsumed || '—'}</td>
                <td>{item?.unitPrice || '—'}</td>
                <td>{item?.amount || '—'}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={6} style={{ textAlign: 'center' }}>
                No line items available.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Totals & Environmental Impact */}
      <div className="invoice-summary">
        <p>
          <strong>Total Amount:</strong> {totalAmount || '—'}
        </p>
        {environmentalImpact && (
          <p className="invoice-environmental">{environmentalImpact}</p>
        )}
      </div>

      {/* Payment Terms */}
      {paymentDueDate && (
        <div className="invoice-footer">
          <p>
            <strong>Payment Due By:</strong> {new Date(paymentDueDate).toLocaleDateString()}
          </p>
          {lateFeeRate !== undefined && lateFeeRate !== null && (
            <p>
              <em>Late fee:</em> {lateFeeRate}% per month
            </p>
          )}
        </div>
      )}
    </section>
  );
}

InvoiceSection.propTypes = {
  heading: PropTypes.string,
  theme: PropTypes.string,
  invoice: PropTypes.shape({
    invoiceNumber: PropTypes.string.isRequired,
    invoiceDate: PropTypes.string.isRequired,
    clientName: PropTypes.string,
    clientEmail: PropTypes.string,
    chargerSerial: PropTypes.string,
    chargerModel: PropTypes.string,
    billingStart: PropTypes.string,
    billingEnd: PropTypes.string,
    lineItems: PropTypes.arrayOf(
      PropTypes.shape({
        sys: PropTypes.shape({ id: PropTypes.string }),
        date: PropTypes.string,
        startTime: PropTypes.string,
        endTime: PropTypes.string,
        energyConsumed: PropTypes.string,
        unitPrice: PropTypes.string,
        amount: PropTypes.string,
      })
    ),
    totalAmount: PropTypes.string,
    environmentalImpact: PropTypes.string,
    paymentDueDate: PropTypes.string,
    lateFeeRate: PropTypes.number,
  }),
};
