const express = require('express');
const { Op } = require('sequelize');
const path = require('path');
const fs = require('fs');
const moment = require('moment');
const logger = require('pino')({ level: 'info' });
const { Device, Invoice, ConsumptionRecord } = require('./models');
const CloudOceanAPI = require('./services/cloudoceanapi');
const InvoiceGenerator = require('./services/invoicegenerator');
const { updateInvoiceEntry } = require('./services/contentful_writer'); // NEW

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const cloudOcean = new CloudOceanAPI();
const invoiceGenerator = new InvoiceGenerator(path.join(__dirname, 'static', 'invoices'));

app.post('/api/generate-invoices', async (req, res) => {
  try {
    const moduleUuid = "c667ff46-9730-425e-ad48-1e950691b3f9";
    const measuringPoints = [
      "71ef9476-3855-4a3f-8fc5-333cfbf9e898",
      "fd7e69ef-cd01-4b9a-8958-2aa5051428d4",
      "b7423cbc-d622-4247-bb9a-8d125e5e2351"
    ];

    const endDate = moment();
    const startDate = moment(endDate).subtract(1, 'month').startOf('month');
    const consumptionData = await cloudOcean.getModuleConsumption(moduleUuid, measuringPoints, startDate, endDate);

    const invoicesGenerated = [];
    for (const [mpUuid, consumption] of Object.entries(consumptionData)) {
      try {
        const invoiceNumber = `INV-${endDate.format('YYYYMM')}-${mpUuid.substring(0, 8)}`;
        const rate = 0.12;
        const totalAmount = parseFloat(consumption) * rate;

        const invoice = await Invoice.create({
          device_id: 1,
          invoice_number: invoiceNumber,
          billing_period_start: startDate.toDate(),
          billing_period_end: endDate.toDate(),
          total_kwh: parseFloat(consumption),
          total_amount: totalAmount,
          status: 'pending'
        });

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
          rate: rate,
          due_date: endDate.clone().add(30, 'days').format('YYYY-MM-DD'),
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

        // --- Contentful integration ---
        await updateInvoiceEntry({
          spaceId: process.env.CONTENTFUL_SPACE_ID,
          environmentId: process.env.CONTENTFUL_ENVIRONMENT || 'master',
          entryId: process.env.CONTENTFUL_INVOICE_ENTRY_ID, // Set this in your env vars
          invoiceData: {
            totalKwh: parseFloat(consumption),
            cost: totalAmount,
            lineItems: invoiceData.charging_sessions
          }
        });
        // -----------------------------

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

// ...rest of routes.js unchanged...
