require('dotenv').config();
const express = require('express');
const { Sequelize, DataTypes, Model } = require('sequelize');
const path = require('path');
const fs = require('fs');
const logger = require('pino')({ level: 'info' });

// Express app and DB setup
const app = express();
const DATABASE_URL = process.env.NETLIFY_DATABASE_URL || 'sqlite:./invoices.db';

// Set up Sequelize (Postgres or fallback to SQLite)
const sequelize = new Sequelize(DATABASE_URL, {
  dialect: DATABASE_URL.includes('postgres') ? 'postgres' : 'sqlite',
  logging: false,
  pool: { max: 5, min: 0, acquire: 30000, idle: 10000 }
});

// Ensure static directories exist
const staticDir = path.join(__dirname, 'static', 'invoices');
fs.mkdirSync(staticDir, { recursive: true });

// Models
class Invoice extends Model {}
Invoice.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  device_id: DataTypes.INTEGER,
  invoice_number: DataTypes.STRING(50),
  billing_period_start: DataTypes.DATE,
  billing_period_end: DataTypes.DATE,
  total_kwh: DataTypes.DOUBLE,
  total_amount: DataTypes.DOUBLE,
  status: DataTypes.STRING(20),
  pdf_path: DataTypes.STRING(200),
  created_at: { type: DataTypes.DATE, defaultValue: Sequelize.NOW }
}, { sequelize, modelName: 'Invoice', timestamps: false });

class Device extends Model {}
Device.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  model_number: DataTypes.STRING(20),
  serial_number: DataTypes.STRING(50),
  device_location: DataTypes.STRING(200),
  max_amperage: DataTypes.DOUBLE,
  evse_count: DataTypes.INTEGER,
  created_at: { type: DataTypes.DATE, defaultValue: Sequelize.NOW }
}, { sequelize, modelName: 'Device', timestamps: false });

class ConsumptionRecord extends Model {}
ConsumptionRecord.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  device_id: DataTypes.INTEGER,
  time_stamp: DataTypes.DATE,
  kwh_consumption: DataTypes.DOUBLE,
  rate: DataTypes.DOUBLE,
  created_at: { type: DataTypes.DATE, defaultValue: Sequelize.NOW }
}, { sequelize, modelName: 'ConsumptionRecord', timestamps: false });

// Set up associations if necessary (optional)
// Device.hasMany(Invoice, { foreignKey: 'device_id' });
// Device.hasMany(ConsumptionRecord, { foreignKey: 'device_id' });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Register routes
logger.info('Initializing Express application...');
require('./routes')(app); // Make sure you have a ./routes.js file

// --- Cloud Ocean API Integration ---

const CloudOceanAPI = require('./services/cloudoceanapi');
const cloudOcean = new CloudOceanAPI();

/**
 * Example function to fetch from Cloud Ocean and save to ConsumptionRecord.
 * Modify this as needed for your use case and models!
 */
async function syncFromCloudOcean() {
  // Example parameters - replace with real ones as appropriate
  const moduleUuid = 'your-module-uuid';
  const measuringPointUuid = 'your-measuring-point-uuid';
  const startDate = new Date(Date.now() - 86400 * 1000 * 30);
  const endDate = new Date();

  // Fetch reads (see cloudoceanapi.js for available methods)
  const reads = await cloudOcean.getMeasuringPointReads(moduleUuid, measuringPointUuid, startDate, endDate);

  // Store the reads as ConsumptionRecord entries
  for (const read of reads) {
    await ConsumptionRecord.create({
      device_id: read.device_id || 1,
      time_stamp: read.timestamp ? new Date(read.timestamp) : new Date(),
      kwh_consumption: parseFloat(read.consumption) || 0,
      rate: parseFloat(read.rate) || 0,
      created_at: new Date()
    });
  }
}

// Endpoint to trigger the sync
app.post('/sync-cloud-ocean', async (req, res) => {
  try {
    await syncFromCloudOcean();
    res.json({ success: true });
  } catch (e) {
    logger.error('Cloud Ocean sync failed:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// Sync DB and create tables
(async () => {
  try {
    logger.info('Creating database tables...');
    await sequelize.sync();
    logger.info('Database tables created successfully');
  } catch (error) {
    logger.error('Error creating database tables:', error);
  }
})();

// Error handlers
app.use((req, res, next) => {
  res.status(404).send('404 Not Found');
});
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).send('500 Internal Server Error');
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server is running on http://localhost:${PORT}`);
});
logger.info('Express application initialized successfully');
