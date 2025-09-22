import React from "react";
import { createClient } from "contentful";

const client = createClient({
  space: process.env.CONTENTFUL_SPACE_ID,
  accessToken: process.env.CONTENTFUL_ACCESS_TOKEN,
});

const InvoicesList = () => {
  const [invoices, setInvoices] = React.useState([]);

  React.useEffect(() => {
    const fetchInvoices = async () => {
      const res = await client.getEntries({ content_type: "invoice" });
      const items = res.items.map((item) => ({
        id: item.sys.id,
        number: item.fields.invoiceNumber,
        date: item.fields.invoiceDate,
        fileUrl: item.fields.invoiceFile?.fields?.file?.url,
        invoiceUrl: item.fields.invoiceUrl,
      }));
      setInvoices(items);
    };
    fetchInvoices();
  }, []);

  return (
    <table>
      <thead>
        <tr>
          <th>Invoice Number</th>
          <th>Invoice Date</th>
          <th>Invoice Operations</th>
        </tr>
      </thead>
      <tbody>
        {invoices.map((inv) => (
          <tr key={inv.id}>
            <td>{inv.number}</td>
            <td>{new Date(inv.date).toLocaleDateString()}</td>
            <td>
              <button onClick={() => window.open(inv.fileUrl, "_blank")}>
                Download PDF
              </button>
              <button onClick={() => window.open(inv.invoiceUrl || inv.fileUrl, "_blank")}>
                Open Invoice
              </button>
              <button onClick={() => console.log("Delete logic for", inv.id)}>
                Delete
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default InvoicesList;
