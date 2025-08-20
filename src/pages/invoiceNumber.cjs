import { useEffect, useState } from "react";

export default function InvoicePage({ invoiceNumber }) {
  const [invoice, setInvoice] = useState(null);

  useEffect(() => {
    fetch(`/.netlify/functions/get-invoice?number=${invoiceNumber}`)
      .then(res => res.json())
      .then(setInvoice)
      .catch(err => {/* handle error */});
  }, [invoiceNumber]);

  if (!invoice) return <div>Loading...</div>;

  // Helper for rendering environmentalImpactText which may be a string, object, or RichText
  function renderEnvironmentalImpactText(text) {
    if (!text) return null;
    // If plain string
    if (typeof text === "string") return <div>{text}</div>;
    // If Contentful RichText, you might want to render it with @contentful/rich-text-react-renderer
    // else fallback to JSON
    return <pre>{JSON.stringify(text, null, 2)}</pre>;
  }

  // Helper for line items
  function renderLineItems(items) {
    if (!Array.isArray(items) || items.length === 0) return null;
    return (
      <ul>
        {items.map((item, i) => (
          <li key={item.id || i}>
            {typeof item === "object" ? JSON.stringify(item) : String(item)}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div>
      <h1>Invoice {invoice.invoiceNumber}</h1>
      <p><strong>Syndicate Name:</strong> {invoice.syndicateName}</p>
      <p><strong>Slug:</strong> {invoice.slug}</p>
      <p><strong>Address:</strong> {invoice.address}</p>
      <p><strong>Contact:</strong> {invoice.contact}</p>
      <p><strong>Invoice Number:</strong> {invoice.invoiceNumber}</p>
      <p><strong>Invoice Date:</strong> {invoice.invoiceDate}</p>
      <p><strong>Client Name:</strong> {invoice.clientName}</p>
      <p><strong>Client Email:</strong> {invoice.clientEmail}</p>
      <p><strong>Charger Serial Number:</strong> {invoice.chargerSerialNumber}</p>
      <p><strong>Billing Period Start:</strong> {invoice.billingPeriodStart}</p>
      <p><strong>Billing Period End:</strong> {invoice.billingPeriodEnd}</p>
      <div>
        <strong>Environmental Impact Text:</strong>
        {renderEnvironmentalImpactText(invoice.environmentalImpactText)}
      </div>
      <p><strong>Payment Due Date:</strong> {invoice.paymentDueDate}</p>
      <p><strong>Late Fee Rate:</strong> {invoice.lateFeeRate}</p>
      <div>
        <strong>Line Items:</strong>
        {renderLineItems(invoice.lineItems)}
      </div>
    </div>
  );
}
