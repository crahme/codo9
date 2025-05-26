// src/components/InvoiceSection.jsx
import React from 'react'
import PropTypes from 'prop-types'
import VisualEditorComponent from '../../VisualEditorComponent' // Adjust the path if needed

export default function InvoiceSection({ heading, invoice, theme }) {
  const entryId = invoice.sys?.id

  return (
    <section className={`invoice-section ${theme}`}>      
      {/* Section Heading */}
      {heading && <h2 className="invoice-heading">{heading}</h2>}

      {/* Invoice Header Info */}
      <div className="invoice-metadata">
        <div className="invoice-meta-block">
          <p>
            <strong>Invoice #:</strong>{' '}
            <VisualEditorComponent contentId={entryId} fieldName="invoiceNumber" />
          </p>
          <p>
            <strong>Date:</strong>{' '}
            <VisualEditorComponent contentId={entryId} fieldName="invoiceDate" />
          </p>
        </div>
        <div className="invoice-meta-block">
          <p>
            <strong>Client:</strong>{' '}
            <VisualEditorComponent contentId={entryId} fieldName="clientName" />
          </p>
          <p>
            <strong>Email:</strong>{' '}
            <VisualEditorComponent contentId={entryId} fieldName="clientEmail" />
          </p>
        </div>
      </div>

      {/* Charger & Billing Period Info */}
      <div className="invoice-charger-info">
        <p>
          <strong>Charger Serial #:</strong>{' '}
          <VisualEditorComponent contentId={entryId} fieldName="chargerSerial" />
        </p>
        <p>
          <strong>Charger Model:</strong>{' '}
          <VisualEditorComponent contentId={entryId} fieldName="chargerModel" />
        </p>
        <p>
          <strong>Billing Period:</strong>{' '}
          <VisualEditorComponent contentId={entryId} fieldName="billingStart" /> —{' '}
          <VisualEditorComponent contentId={entryId} fieldName="billingEnd" />
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
          {invoice.lineItems.map(item => (
            <tr key={item.sys.id}>
              <td>
                <VisualEditorComponent contentId={item.sys.id} fieldName="date" />
              </td>
              <td>
                <VisualEditorComponent contentId={item.sys.id} fieldName="startTime" />
              </td>
              <td>
                <VisualEditorComponent contentId={item.sys.id} fieldName="endTime" />
              </td>
              <td>
                <VisualEditorComponent contentId={item.sys.id} fieldName="energyConsumed" />
              </td>
              <td>
                <VisualEditorComponent contentId={item.sys.id} fieldName="unitPrice" />
              </td>
              <td>
                <VisualEditorComponent contentId={item.sys.id} fieldName="amount" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals & Environmental Impact */}
      <div className="invoice-summary">
        <p>
          <strong>Total Amount:</strong>{' '}
          <VisualEditorComponent contentId={entryId} fieldName="totalAmount" />
        </p>
        {invoice.environmentalImpact && (
          <p className="invoice-environmental">
            <VisualEditorComponent contentId={entryId} fieldName="environmentalImpact" />
          </p>
        )}
      </div>

      {/* Payment Terms */}
      {invoice.paymentDueDate && (
        <div className="invoice-footer">
          <p>
            <strong>Payment Due By:</strong>{' '}
            <VisualEditorComponent contentId={entryId} fieldName="paymentDueDate" />
          </p>
          {invoice.lateFeeRate && (
            <p>
              <em>Late fee:</em>{' '}
              <VisualEditorComponent contentId={entryId} fieldName="lateFeeRate" />% per month
            </p>
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
    sys: PropTypes.shape({ id: PropTypes.string.isRequired }).isRequired,
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
