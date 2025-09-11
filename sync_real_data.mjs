import { setTimeout } from 'timers/promises';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from 'pg';
import dotenv from 'dotenv';
import pino from 'pino';

// Initialize logger and load environment variables
const logger = pino({ level: 'info' });
dotenv.config();

// Constants
const MEASURING_POINTS = [
  { uuid: "71ef9476-3855-4a3f-8fc5-333cfbf9e898", location: "Building A - Level 1" },
  { uuid: "fd7e69ef-cd01-4b9a-8958-2aa5051428d4", location: "Building A - Level 2" },
  { uuid: "b7423cbc-d622-4247-bb9a-8d125e5e2351", location: "Building B - Parking Garage" },
  { uuid: "88f4f9b6-ce65-48c4-86e6-1969a64ad44c", location: "Building B - Ground Floor" },
  { uuid: "df428bf7-dd2d-479c-b270-f8ac5c1398dc", location: "Building C - East Wing" },
  { uuid: "7744dcfc-a059-4257-ac96-6650feef9c87", location: "Building C - West Wing" },
  { uuid: "b1445e6d-3573-403a-9f8e-e82f70556f7c", location: "Building D - Main Entrance" },
  { uuid: "ef296fba-4fcc-4dcb-8eda-e6d1772cd819", location: "Building D - Loading Dock" },
  { uuid: "50206eae-41b8-4a84-abe4-434c7f79ae0a", location: "Outdoor Lot - Section A" },
  { uuid: "de2d9680-f132-4529-b9a9-721265456a86", location: "Outdoor Lot - Section B" },
  { uuid: "bd36337c-8139-495e-b026-f987b79225b8", location: "Visitor Parking - Main Gate" }
];

const MODULE_UUID = "c667ff46-9730-425e-ad48-1e950691b3f9";
const RETRY_CONFIG = { maxAttempts: 5, initialDelay: 2000 };

// Utility functions
const formatDate = (date) => date.toISOString().split('T')[0];
const addDays = (date, days) => new Date(date.getTime() + days * 86400000);

class CloudOceanAPI {
  constructor() {
    this.apiKey = process.env.API_Key;
    this.baseUrl = process.env.CLOUD_OCEAN_BASE_URL || "https://api.develop.rve.ca/v1";
    if (!this.apiKey) throw new Error('API_Key not set in environment variables');
  }

  async fetchWithRetry(url, options) {
    let delay = RETRY_CONFIG.initialDelay;
    
    for (let attempt = 1; attempt <= RETRY_CONFIG.maxAttempts; attempt++) {
      try {
        const response = await fetch(url, options);
        if (response.ok) return response.json();
        
        if (response.status === 503) {
          if (attempt === RETRY_CONFIG.maxAttempts) throw new Error(`Server unavailable after ${attempt} attempts`);
          logger.warn(`Server unavailable (503), attempt ${attempt}/${RETRY_CONFIG.maxAttempts}, retrying in ${delay/1000}s...`);
          await setTimeout(delay);
          delay *= 2;
          continue;
        }
        
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      } catch (error) {
        if (attempt === RETRY_CONFIG.maxAttempts) throw error;
        logger.warn(`Attempt ${attempt} failed: ${error.message}`);
      }
    }
  }

  async getModuleConsumption(moduleUuid, measuringPoints, startDate, endDate) {
    const result = {};
    for (const point of measuringPoints) {
      try {
        const url = new URL(`${this.baseUrl}/modules/${moduleUuid}/measuring-points/${point.uuid}/reads`);
        url.searchParams.set('start', formatDate(startDate));
        url.searchParams.set('end', formatDate(endDate));

        const data = await this.fetchWithRetry(url.toString(), {
          headers: {
            'Access-Token': this.apiKey,
            'Content-Type': 'application/json'
          }
        });

        result[point.uuid] = parseFloat(data.consumption) || 0;
      } catch (error) {
        logger.error(`Failed to fetch data for measuring point ${point.uuid}: ${error.message}`);
        result[point.uuid] = 0;
      }
    }
    return result;
  }
}

class DatabaseManager {
  constructor(connectionString) {
    this.client = new Client({ 
      connectionString,
      ssl: { rejectUnauthorized: false }
    });
  }

  async connect() {
    await this.client.connect();
  }

  async disconnect() {
    await this.client.end();
  }

  async withTransaction(callback) {
    await this.client.query('BEGIN');
    try {
      const result = await callback();
      await this.client.query('COMMIT');
      return result;
    } catch (error) {
      await this.client.query('ROLLBACK');
      throw error;
    }
  }

  // ... Add other database methods here
}

export async function syncRealData() {
  const dbUrl = process.env.NETLIFY_DATABASE_URL;
  if (!dbUrl) throw new Error('NETLIFY_DATABASE_URL is not set');

  const db = new DatabaseManager(dbUrl);
  const api = new CloudOceanAPI();

  try {
    await db.connect();
    logger.info('Starting data sync...');

    const startDate = new Date(Date.UTC(2024, 9, 16));
    const endDate = new Date(Date.UTC(2024, 10, 25));

    const consumption = await api.getModuleConsumption(
      MODULE_UUID,
      MEASURING_POINTS,
      startDate,
      endDate
    );

    // Process the data and update database
    await db.withTransaction(async () => {
      // Add your database update logic here
    });

    logger.info('Data sync completed successfully');
    return true;
  } catch (error) {
    logger.error('Sync failed:', error);
    return false;
  } finally {
    await db.disconnect();
  }
}

// Run if called directly
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const success = await syncRealData();
    process.exit(success ? 0 : 1);
  } catch (error) {
    logger.error(error);
    process.exit(1);
  }
}