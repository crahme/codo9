import 'dotenv/config';
import express from 'express';
import { Sequelize, DataTypes, Model } from 'sequelize';
const path = require('path');
const fs = require('fs');
const logger = require('pino')({ level: 'info' });

// Express app and DB setup
const app = express();
const DATABASE_URL = process.env.NETLIFY_DATABASE_URL || 'sqlite:./invoices.db';

// ... your existing setup code ...

// At the end of the file, export the app:
module.exports = app;