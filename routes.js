const express = require('express');
const { Op } = require('sequelize');
const path = require('path');
const fs = require('fs');
const moment = require('moment');
const logger = require('pino')({ level: 'info' });
const { Device, Invoice, ConsumptionRecord } = require('./models'); // Sequelize models
const CloudOceanAPI = require('./services/cloud_ocean');
const InvoiceGenerator = require('./services/invoice_generator');

// Initialize Express app
const app = express();

// Middleware to parse JSON and URL-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Cloud Ocean API client and Invoice Generator
const cloudOcean = new CloudOceanAPI(process.env.CLOUD_OCEAN_API_KEY);
const invoiceGenerator = new InvoiceGenerator(path.join(__dirname, 'static', 'invoices'));

// Route to generate invoices
app.post('/api/generate-invoices', async (req, res) => {
  try {
    const moduleUuid = "c667ff46-9730-425e-ad48-1e950691b3f9";
    const measuringPoints = [
      "71ef9476-3855-4a3f-8fc5-333cfbf9e898",
      "fd7e69ef-cd01-4b9a-8958-2aa5051428d4",
      "b7423cbc-d622-4247-bb9a-8d125e5e2351"
    ];

    // Calculate the billing period
    const endDate = moment();
    const startDate = moment(endDate).subtract(1, 'month').startOf('month');
    const consumptionData = await cloudOcean.getModuleConsumption(moduleUuid, measuringPoints, startDate, endDate);

    const invoicesGenerated = [];
    for (const [mpUuid, consumption] of Object.entries(consumptionData)) {
      try {
        const invoiceNumber = `INV-${endDate.format('YYYYMM')}-${mpUuid.substring(0, 8)}`;
        const rate = 0.12; // Example rate
        const totalAmount = parseFloat(consumption) * rate;

        // Create a new invoice
        const invoice = await Invoice.create({
          device_id: 1, // Adjust device_id mapping as needed
          invoice_number: invoiceNumber,
          billing_period_start: startDate.toDate(),
          billing_period_end: endDate.toDate(),
          total_kwh: parseFloat(consumption),
          total_amount: totalAmount,
          status: 'pending'
        });

        // Generate the invoice PDF
        const invoiceData = {
          invoice_number: invoiceNumber,
          syndicate_name: 'RVE Cloud Ocean',
          company_address: '123 EV Street, Montreal, QC',
          company_phone: '+1 (555) 123-4567',
          company_email: 'contact@rve.ca',
          company_website: 'https://rve.ca',
          billing_period_start: startDate.format('YYYY-MM-DD'),
          billing_period_end: endDate.format('YYYY-MM-DD'),
          total_kwh: parseFloat(consumption),
          total_amount: totalAmount,
          due_date: endDate.add(30, 'days').format('YYYY-MM-DD'),
          charging_sessions: [{
            date: endDate.format('YYYY-MM-DD'),
            start_time: '00:00',
            end_time: '23:59',
            duration: '24:00',
            kwh: parseFloat(consumption),
            rate: rate,
            amount: totalAmount
          }]
        };

        const pdfPath = await invoiceGenerator.generateInvoice(invoiceData);
        invoice.pdf_path = pdfPath;
        await invoice.save();

        invoicesGenerated.push({
          invoice_number: invoiceNumber,
          total_amount: totalAmount,
          status: 'pending'
        });
      } catch (error) {
        logger.error(`Error generating invoice for measuring point ${mpUuid}: ${error.message}`);
        continue;
      }
    }

    res.json({
      success: true,
      message: `Generated ${invoicesGenerated.length} invoices`,
      invoices: invoicesGenerated
    });
  } catch (error) {
    logger.error(`Error in generate_invoices: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Error generating invoices: ${error.message}`
    });
  }
});

// Dashboard route
app.get('/dashboard', async (req, res) => {
  try {
    const recentInvoices = await Invoice.findAll({ order: [['created_at', 'DESC']], limit: 5 });

    const moduleUuid = "c667ff46-9730-425e-ad48-1e950691b3f9";
    const measuringPoints = [
      "71ef9476-3855-4a3f-8fc5-333cfbf9e898",
      "fd7e69ef-cd01-4b9a-8958-2aa5051428d4",
      "b7423cbc-d622-4247-bb9a-8d125e5e2351"
    ];

    const endDate = moment();
    const startDate = moment(endDate).subtract(30, 'days');
    const consumptionData = await cloudOcean.getModuleConsumption(moduleUuid, measuringPoints, startDate, endDate);

    const formattedConsumption = {
      labels: [],
      values: []
    };

    for (const [mpUuid, consumption] of Object.entries(consumptionData)) {
      app.get('/invoices', async (req, res) => {
      const allInvoices = await Invoice.findAll({ order: [['created_at', 'DESC']] });
      res.render('invoices.html', { invoices: allInvoices });
});
      formattedConsumption.labels.push(`Device ${mpUuid.substring(0, 8)}`);
      formattedConsumption.values.push(parseFloat(consumption));
    }

    res.render('dashboard.html', {
      recent_invoices: recentInvoices,
      consumption_data: formattedConsumption
    });
  } catch (error) {
    logger.error(`Error in dashboard route: ${error.message}`);
    res.render('dashboard.html', {
      recent_invoices: [],
      consumption_data: { labels: [], values: [] }
    });
  }
});

// Invoices route
app.get('/invoices', async (req, res) => {
  const allInvoices = await Invoice.findAll({ order: [['created_at', 'DESC']] });
  res.render('invoices.html', { invoices: allInvoices });
});

// Download invoice route
app.get('/download_invoice/:invoice_id', async (req, res) => {
  const invoiceId = req.params.invoice_id;
  const invoice = await Invoice.findByPk(invoiceId);

  if (!invoice) {
    return res.status(404).send('Invoice not found');
  }

  const invoiceData = {
    invoice_number: invoice.invoice_number,
    syndicate_name: 'RVE Cloud Ocean',
    company_address: '123 EV Street, Montreal, QC',
    company_phone: '+1 (555) 123-4567',
    company_email: 'contact@rve.ca',
    company_website: 'https://rve.ca',
    billing_period_start: moment(invoice.billing_period_start).format('YYYY-MM-DD'),
    billing_period_end: moment(invoice.billing_period_end).format('YYYY-MM-DD'),
    total_kwh: invoice.total_kwh,
    total_amount: invoice.total_amount,
    due_date: moment(invoice.created_at).add(30, 'days').format('YYYY-MM-DD'),
    charging_sessions: []
  };

  const pdfPath = await invoiceGenerator.generateInvoice(invoiceData);
  res.download(pdfPath, `invoice_${invoice.invoice_number}.pdf`);
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  logger.info(`Server is running on http://localhost:${PORT}`);
});
