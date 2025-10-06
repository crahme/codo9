import { Card, CardContent } from "@/components/ui/card"

export function RecentInvoicesTable({ invoices }) {
  return (
    <Card className="bg-slate-800 text-white">
      <CardContent className="p-4">
        <h2 className="mb-2 text-lg font-semibold">Recent Invoices</h2>
        <table className="w-full text-left">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Device</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.invoiceId}>
                <td>{inv.invoiceId}</td>
                <td>{inv.device}</td>
                <td>${inv.amount}</td>
                <td>{inv.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
