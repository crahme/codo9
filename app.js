const express = require('express');
const { Sequelize, DataTypes, Model } = require('sequelize');
const path = require('path');
const fs = require('fs');

// Configure logging
const logger = require('pino')({ level: 'info' });

// Initialize Express app
const app = express();
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });

client.connect()
  .then(() => console.log('Connected to Neon DB!'))
  .catch(err => console.error('Connection error', err.stack));
// Configuration
const SECRET_KEY = process.env.FLASK_SECRET_KEY || 'dev_secret_key';
const DATABASE_URL = process.env.NETLIFY_DATABASE_URL || 'sqlite:./invoices.db';

// Set up Sequelize
const sequelize = new Sequelize(DATABASE_URL, {
  dialect: 'postgresql',
  logging: false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

// Define Base model
class Base extends Model {}

// Ensure static directories exist
const staticDir = path.join(__dirname, 'static', 'invoices');
fs.mkdirSync(staticDir, { recursive: true });

// Initialize models
sequelize.define('Invoice', {
  // Define fields here
  id:serial,
  device_id: DataTypes.INTEGER,
  invoice_number: Sequelize.STRING(50),
  billing_period_start: DataTypes.DATE,
  billing_period_end:DataTypes.DATE,
  total_kwh: DataTypes.DOIBLE,
  total_amount: DataTypes.DOUBLE,
  status:DataTypes.STRING(20),
  pdf_path: DataTypes.STRING(200),
  created_at: DataTypes.DATE
}, {
  sequelize,
  modelName: 'Invoice'
});
Sequelize.define('device', {
  id:serial,
  model_number:Sequelize.STRING(20),
  serial_number:Sequelize.STRING(50),
  device_location:Sequelize.STRING(200),
  max_amperage: DataTypes.DOUBLE,
  evse_count:DataTypes.INTEGER,
  created_at:DataTypes.DATE
},  {
  sequelize,
  modelName: 'Device'
});
Sequelize.define('consumption_record', {
  id:serial,
  device_id: DataTypes.INTEGER,
  time_stamp: DataTypes.DATE,
  kwh_consumption:DataTypes.DOUBLE,
  rate: DataTypes.DOUBLE,
  created_at:DataTypes.DATE
}, {
  sequelize,
  modelName:'Consumption Record'
});
  

// Middleware for JSON and URL-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Register routes
logger.info('Initializing Express application...');
require('./routes')(app); // Assuming routes.js exports a function that takes app as an argument

// Sync database and create tables
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
  res.status(404).render('404.html');
});

app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).render('500.html');
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server is running on http://localhost:${PORT}`);
});

logger.info('Express application initialized successfully');
