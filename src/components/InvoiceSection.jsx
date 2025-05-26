// src/components/InvoiceSection.js
import React from 'react'
import PropTypes from 'prop-types'
export default function InvoiceSection({ heading, invoice, theme }) {
  return (
    <section className={`invoice-section ${theme}`}>      
      {/* Section Heading */}
      {heading && <h2 className="invoice-heading">{heading}</h2>}

      {/* Invoice Header Info */}
      <div className="invoice-metadata">
        <div className="invoice-meta-block">
          <p><strong>Invoice #:</strong> {invoice.invoiceNumber}</p>
          <p><strong>Date:</strong> {new Date(invoice.invoiceDate).toLocaleDateString()}</p>
        </div>
        <div className="invoice-meta-block">
          <p><strong>Client:</strong> {invoice.clientName}</p>
          <p><strong>Email:</strong> {invoice.clientEmail}</p>
        </div>
      </div>

      {/* Charger & Billing Period Info */}
      <div className="invoice-charger-info">
        <p><strong>Charger Serial #:</strong> {invoice.chargerSerial}</p>
        <p><strong>Charger Model:</strong> {invoice.chargerModel}</p>
        <p><strong>Billing Period:</strong> {new Date(invoice.billingStart).toLocaleDateString()} — {new Date(invoice.billingEnd).toLocaleDateString()}</p>
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
          {invoice.lineItems.map(item => (
            <tr key={item.sys.id}>
              <td>{new Date(item.date).toLocaleDateString()}</td>
              <td>{item.startTime}</td>
              <td>{item.endTime}</td>
              <td>{item.energyConsumed}</td>
              <td>{item.unitPrice}</td>
              <td>{item.amount}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals & Environmental Impact */}
      <div className="invoice-summary">
        <p><strong>Total Amount:</strong> {invoice.totalAmount}</p>
        {invoice.environmentalImpact && (
          <p className="invoice-environmental">{invoice.environmentalImpact}</p>
        )}
      </div>

      {/* Payment Terms */}
      {invoice.paymentDueDate && (
        <div className="invoice-footer">
          <p><strong>Payment Due By:</strong> {new Date(invoice.paymentDueDate).toLocaleDateString()}</p>
          {invoice.lateFeeRate && (
            <p><em>Late fee:</em> {invoice.lateFeeRate}% per month</p>
          )}
        </div>
      )}
    </section>
  )
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
        sys: PropTypes.shape({ id: PropTypes.string.isRequired }).isRequired,
        date: PropTypes.string,
        startTime: PropTypes.string,
        endTime: PropTypes.string,
        energyConsumed: PropTypes.string,
        unitPrice: PropTypes.string,
        amount: PropTypes.string,
      })
    ).isRequired,
    totalAmount: PropTypes.string,
    environmentalImpact: PropTypes.string,
    paymentDueDate: PropTypes.string,
    lateFeeRate: PropTypes.number,
  }).isRequired,
}
