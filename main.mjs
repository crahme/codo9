import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import { Sequelize, DataTypes, Model } from 'sequelize';
import path from 'path';
import fs from  'fs';
import pino from 'pino';
 // Import the Express app from app.mjs
const logger = pino({ level: 'info' });
// Express app and DB setup     
const app = express();
const DATABASE_URL = process.env.NETLIFY_DATABASE_URL || 'sqlite:./invoices.db';

const PORT = 5000;
const HOST = '0.0.0.0';
logger.info('Starting Express server...');
app.listen(PORT, HOST, () => {
logger.info(`Server is running on http://${HOST}:${PORT}`);
});
// ... your existing setup code ...

// At the end of the file, export the app:
export default app;