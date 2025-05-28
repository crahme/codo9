// components/InvoiceSection.jsx
import Invoice from './Invoice';
import InvoiceLineItem from './InvoiceLineItem';

export default function InvoiceSection({ invoice }) {
  return (
    <section>
      <Invoice invoice={invoice} />
      <table>
        {invoice.lineItems.map(item => (
          <InvoiceLineItem key={item.id} lineItem={item} />
        ))}
      </table>
    </section>
  );
}
