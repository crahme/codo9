import contentful from 'contentful-management';
import dotenv from 'dotenv';
dotenv.config();

const client = contentful.createClient({
  accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN
});

async function updateDashboard() {
  const space = await client.getSpace(process.env.CONTENTFUL_SPACE_ID);
  const env = await space.getEnvironment('master');

  // Fetch all invoices
  const invoices = await env.getEntries({ content_type: 'invoice' });

  let totalInvoices = invoices.items.length;
  let totalRevenue = 0;
  let paidInvoices = 0;
  let pendingInvoices = 0;

  invoices.items.forEach((invoice) => {
    const amount = invoice.fields.totalAmount?.['en-US'] || 0;
    const status = invoice.fields.status?.['en-US'] || 'Pending';
    totalRevenue += amount;
    if (status === 'Paid') paidInvoices++;
    else pendingInvoices++;
  });

  const recentInvoices = invoices.items.slice(0, 5).map((inv) => ({
    sys: { type: 'Link', linkType: 'Entry', id: inv.sys.id }
  }));

  // Fetch the dashboard entry
  const dashboards = await env.getEntries({ content_type: 'dashboard' });
  const dashboard = dashboards.items[0];

  // Update fields
  dashboard.fields.totalInvoices = { 'en-US': totalInvoices };
  dashboard.fields.totalRevenue = { 'en-US': totalRevenue };
  dashboard.fields.paidInvoices = { 'en-US': paidInvoices };
  dashboard.fields.pendingInvoices = { 'en-US': pendingInvoices };
  dashboard.fields.recentInvoices = { 'en-US': recentInvoices };
  dashboard.fields.lastUpdated = { 'en-US': new Date().toISOString() };

  await dashboard.update();
  await dashboard.publish();

  console.log('✅ Dashboard updated successfully');
}

updateDashboard().catch(console.error);
