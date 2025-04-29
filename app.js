const express = require('express');
const { Sequelize, DataTypes, Model } = require('sequelize');
const path = require('path');
const fs = require('fs');

// Configure logging
const logger = require('pino')({ level: 'info' });

// Initialize Express app
const app = express();

// Configuration
const SECRET_KEY = process.env.FLASK_SECRET_KEY || 'dev_secret_key';
const DATABASE_URL = process.env.DATABASE_URL || 'sqlite:./invoices.db';

// Set up Sequelize
const sequelize = new Sequelize(DATABASE_URL, {
  dialect: 'sqlite',
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
}, {
  sequelize,
  modelName: 'Invoice'
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
