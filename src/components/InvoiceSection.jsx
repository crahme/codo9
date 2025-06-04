import Invoice from './Invoice';
import InvoiceLineItem from './InvoiceLineItem';

export default function InvoiceSection({ invoice }) {
  if (!invoice) return null; // Prevents errors if invoice is undefined

  return (
    <section>
      <Invoice invoice={invoice} />
      <table>
        <tbody>
          {invoice.lineItems?.map(item => (
            <InvoiceLineItem key={item.id} lineItem={item} />
          ))}
        </tbody>
      </table>
    </section>
  );
}
