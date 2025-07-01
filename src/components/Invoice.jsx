// src/components/Invoice.jsx
import React from 'react';
import PropTypes from 'prop-types';
import { VisualEditorComponent } from '../components/VisualEditorComponent.jsx';
import { InvoiceLineItem } from '../components/InvoiceLineItem.jsx';

export function Invoice({ invoice }) {
  const entryId = invoice.sys?.id;

  // Format date for display (optional)
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="invoice-container">
      {/* Header Section */}
      <header className="invoice-header">
        <div className="invoice-title">
          <h2>INVOICE</h2>
          <div className="invoice-meta">
            <p>
              <strong>Date:</strong>{' '}
              <VisualEditorComponent 
                contentId={entryId} 
                fieldName="invoiceDate" 
                displayValue={formatDate(invoice.invoiceDate)}
              />
            </p>
            <p>
              <strong>Due Date:</strong>{' '}
              <VisualEditorComponent 
                contentId={entryId} 
                fieldName="paymentDueDate" 
                displayValue={formatDate(invoice.paymentDueDate)}
              />
            </p>
          </div>
        </div>

        {/* Syndicate Info */}
        <div className="invoice-from">
          <h3>
            <VisualEditorComponent contentId={entryId} fieldName="syndicateName" />
          </h3>
          <p className="address">
            <VisualEditorComponent contentId={entryId} fieldName="address" />
          </p>
          <p>
            Contact: <VisualEditorComponent contentId={entryId} fieldName="contact" />
          </p>
        </div>
      </header>

      {/* Client Info */}
      <section className="invoice-client">
        <h4>Bill To:</h4>
        <p>
          <VisualEditorComponent contentId={entryId} fieldName="clientName" />
        </p>
        <p>
          <VisualEditorComponent contentId={entryId} fieldName="clientEmail" />
        </p>
      </section>

      {/* Charger Info */}
      <section className="invoice-charger">
        <p>
          <strong>Charger Serial #:</strong>{' '}
          <VisualEditorComponent contentId={entryId} fieldName="chargerSerialNumber" />
        </p>
        <p>
          <strong>Billing Period:</strong>{' '}
          <VisualEditorComponent 
            contentId={entryId} 
            fieldName="billingPeriodStart" 
            displayValue={formatDate(invoice.billingPeriodStart)}
          /> -{' '}
          <VisualEditorComponent 
            contentId={entryId} 
            fieldName="billingPeriodEnd" 
            displayValue={formatDate(invoice.billingPeriodEnd)}
          />
        </p>
      </section>

      {/* Line Items Table */}
      <table className="invoice-line-items">
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
          {invoice.lineItems.map((item) => (
            <InvoiceLineItem key={item.sys.id} lineItem={item} />
          ))}
        </tbody>
      </table>

      {/* Totals Section */}
      <section className="invoice-totals">
        <div className="late-fee-notice">
          <p>
            <strong>Late Fee Rate:</strong>{' '}
            <VisualEditorComponent 
              contentId={entryId} 
              fieldName="lateFeeRate" 
              displayValue={`${invoice.lateFeeRate}%`}
            /> per month
          </p>
        </div>
      </section>

      {/* Environmental Impact (if exists) */}
      {invoice.environmentalImpact && (
        <section className="invoice-environmental">
          <h4>Environmental Impact</h4>
          <div className="rich-text-content">
            <VisualEditorComponent 
              contentId={entryId} 
              fieldName="environmentalImpact" 
              isRichText={true}
            />
          </div>
        </section>
      )}
    </div>
  );
}

Invoice.propTypes = {
  invoice: PropTypes.shape({
    sys: PropTypes.shape({
      id: PropTypes.string.isRequired,
    }).isRequired,
    syndicateName: PropTypes.string.isRequired,
    address: PropTypes.string.isRequired,
    contact: PropTypes.string.isRequired,
    invoiceDate: PropTypes.string.isRequired,
    clientName: PropTypes.string.isRequired,
    clientEmail: PropTypes.string.isRequired,
    chargerSerialNumber: PropTypes.string.isRequired,
    billingPeriodStart: PropTypes.string.isRequired,
    billingPeriodEnd: PropTypes.string.isRequired,
    paymentDueDate: PropTypes.string.isRequired,
    lateFeeRate: PropTypes.number.isRequired,
    environmentalImpact: PropTypes.string,
    lineItems: PropTypes.arrayOf(
      PropTypes.shape({
        sys: PropTypes.shape({
          id: PropTypes.string.isRequired,
        }).isRequired,
        date: PropTypes.string.isRequired,
        startTime: PropTypes.string.isRequired,
        endTime: PropTypes.string.isRequired,
        energyConsumed: PropTypes.string.isRequired,
        unitPrice: PropTypes.string.isRequired,
        amount: PropTypes.string.isRequired,
      })
    ).isRequired,
  }).isRequired,
};
