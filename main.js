import 'dotenv/config';
const express = require('express');
const { Sequelize, DataTypes, Model } = require('sequelize');
const path = require('path');
const fs = require('fs');
const logger = require('pino')({ level: 'info' });

// Express app and DB setup
const app = express();
const DATABASE_URL = process.env.NETLIFY_DATABASE_URL || 'sqlite:./invoices.db';

// ... your existing setup code ...

// At the end of the file, export the app:
module.exports = app;