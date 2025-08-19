'use strict';

import 'dotenv/config'; // Load environment variables from .env file
import axios from 'axios';
import '../main.js';
import CloudOceanAPI from '../services/cloudoceanapi.js'; // Adjust the path as needed
const BASE_URL =  'https://api.develop.rve.ca';
const API_KEY = process.env.API_Key;
const MODULE_UUID = 'c667ff46-9730-425e-ad48-1e950691b3f9';
const START = (process.env.RVE_START || '2024-10-16').slice(0, 10);
const END = (process.env.RVE_END || '2024-11-25').slice(0, 10);

if (!API_KEY) {
  console.error('Missing API key. Set CLOUD_OCEAN_API_KEY or API_Key in your environment or .env file.');
  process.exit(1);
}

// Attempt a GET with multiple header schemes to accommodate API variations
async function getWithFallback(url, params) {
  const attempts = [
    { name: 'Authorization (raw)', headers: { Authorization: API_KEY, 'Content-Type': 'application/json' } },
    { name: 'Authorization (Bearer)', headers: { Authorization: API_KEY.startsWith('Bearer ') ? API_KEY : `Bearer ${API_KEY}`, 'Content-Type': 'application/json' } },
    { name: 'Access-Token (raw)', headers: { 'Access-Token': API_KEY, 'Content-Type': 'application/json' } },
    { name: 'Access-Token (Bearer)', headers: { 'Access-Token': API_KEY.startsWith('Bearer ') ? API_KEY : `Bearer ${API_KEY}`, 'Content-Type': 'application/json' } },
    { name: 'X-API-Key', headers: { 'X-API-Key': API_KEY.replace(/^Bearer\s+/, ''), 'Content-Type': 'application/json' } },
  ];

  let lastErr;
  for (const attempt of attempts) {
    try {
      const res = await axios.get(url, { headers: attempt.headers, params });
      return res;
    } catch (e) {
      lastErr = e;
      if (e?.response?.status !== 401) throw e;
    }
  }
  throw lastErr || new Error('All auth attempts failed');
}

async function listModuleMeasuringPoints(moduleUuid) {
  const url = `${BASE_URL}/v1/modules/${encodeURIComponent(moduleUuid)}/measuring-points`;
  const all = [];
  let offset = 0;
  const limit = 50;
  while (true) {
    const res = await getWithFallback(url, { limit, offset });
    const data = res.data?.data || [];
    all.push(...data);
    if (data.length < limit) break;
    offset += limit;
  }
  return all;
}

async function listDevices() {
  const url = `${BASE_URL}/v1/devices`;
  const all = [];
  let offset = 0;
  const limit = 100;
  while (true) {
    const res = await getWithFallback(url, { limit, offset });
    const data = res.data?.data || [];
    all.push(...data);
    if (data.length < limit) break;
    offset += limit;
  }
  return all;
}

async function main() {
  const client = new CloudOceanAPI(API_KEY);
  console.log('Testing CloudOceanAPI with all measuring points and devices');
  console.log({ moduleUuid: MODULE_UUID, start: START, end: END });

  // Measuring points
  let measuringPoints = [];
  try {
    measuringPoints = await listModuleMeasuringPoints(MODULE_UUID);
  } catch (e) {
    console.warn('Failed to list measuring points from API; falling back to known set of 11. Error:', e.message);
    measuringPoints = [
      { uuid: '71ef9476-3855-4a3f-8fc5-333cfbf9e898', name: 'EV Charger Station 01', location: 'Building A - Level 1' },
      { uuid: 'fd7e69ef-cd01-4b9a-8958-2aa5051428d4', name: 'EV Charger Station 02', location: 'Building A - Level 2' },
      { uuid: 'b7423cbc-d622-4247-bb9a-8d125e5e2351', name: 'EV Charger Station 03', location: 'Building B - Parking Garage' },
      { uuid: '88f4f9b6-ce65-48c4-86e6-1969a64ad44c', name: 'EV Charger Station 04', location: 'Building B - Ground Floor' },
      { uuid: 'df428bf7-dd2d-479c-b270-f8ac5c1398dc', name: 'EV Charger Station 05', location: 'Building C - East Wing' },
      { uuid: '7744dcfc-a059-4257-ac96-6650feef9c87', name: 'EV Charger Station 06', location: 'Building C - West Wing' },
      { uuid: 'b1445e6d-3573-403a-9f8e-e82f70556f7c', name: 'EV Charger Station 07', location: 'Building D - Main Entrance' },
      { uuid: 'ef296fba-4fcc-4dcb-8eda-e6d1772cd819', name: 'EV Charger Station 08', location: 'Building D - Loading Dock' },
      { uuid: '50206eae-41b8-4a84-abe4-434c7f79ae0a', name: 'EV Charger Station 09', location: 'Outdoor Lot - Section A' },
      { uuid: 'de2d9680-f132-4529-b9a9-721265456a86', name: 'EV Charger Station 10', location: 'Outdoor Lot - Section B' },
      { uuid: 'bd36337c-8139-495e-b026-f987b79225b8', name: 'EV Charger Station 11', location: 'Visitor Parking - Main Gate' },
    ];
  }

  console.log(`Found measuring points: ${measuringPoints.length}`);

  const startDate = new Date(START);
  const endDate = new Date(END);

  let totalMp = 0;
  let totalReads = 0;
  let totalCdr = 0;
  let totalKwh = 0;

  for (const mp of measuringPoints) {
    const mpUuid = mp.uuid || mp.id || mp.measuringPointUuid || mp.measuring_point_uuid;
    if (!mpUuid) continue;
    totalMp += 1;

    const valid = await client.validateMeasuringPoint(MODULE_UUID, mpUuid);
    console.log(`MP ${mpUuid} valid: ${valid}`);

    const reads = await client.getMeasuringPointReads(MODULE_UUID, mpUuid, startDate, endDate);
    const cdr = await client.getMeasuringPointCdr(MODULE_UUID, mpUuid, startDate, endDate);

    totalReads += reads.length;
    totalCdr += cdr.length;
    const mpKwh = reads.reduce((sum, r) => sum + parseFloat(r.consumption || 0), 0);
    totalKwh += mpKwh;

    console.log(`  reads: ${reads.length}, cdr: ${cdr.length}, kWh: ${mpKwh}`);
  }

  // Devices
  let devices = [];
  try {
    devices = await listDevices();
  } catch (e) {
    console.warn('Failed to list devices from API; falling back to env device ID(s) if provided. Error:', e.message);
    const fallbackIds = [];
    if (process.env.CLOUD_OCEAN_DEVICE_ID) fallbackIds.push(process.env.CLOUD_OCEAN_DEVICE_ID);
    if (process.env.DEVICE_ID) fallbackIds.push(process.env.DEVICE_ID);
    const unique = Array.from(new Set(fallbackIds.filter(Boolean)));
    devices = unique.map((id) => ({ id }));
  }

  console.log(`Found devices: ${devices.length}`);

  let totalDeviceCons = 0;
  for (const d of devices) {
    const id = d.id || d.uuid || d.device_id;
    if (!id) continue;
    try {
      const info = await client.getDeviceInfo(id);
      const cons = await client.getDeviceConsumption(id, startDate, endDate);
      const count = Array.isArray(cons) ? cons.length : 0;
      console.log(`Device ${id}: info=${info ? 'ok' : 'n/a'}, consumption records=${count}`);
      totalDeviceCons += count;
    } catch (e) {
      console.warn(`Device ${id}: error => ${e.message}`);
    }
  }

  console.log('\nSUMMARY');
  console.log(`  Measuring points tested: ${totalMp}`);
  console.log(`  Total reads: ${totalReads}`);
  console.log(`  Total CDR: ${totalCdr}`);
  console.log(`  Total kWh: ${totalKwh}`);
  console.log(`  Devices tested: ${devices.length}`);
  console.log(`  Device consumption records: ${totalDeviceCons}`);

  console.log('\nCloudOceanAPI all-points-and-devices test complete.');
}

if (require.main === module) {
  main().catch((err) => {
    const status = err?.response?.status;
    const body = err?.response?.data;
    console.error('Test failed:', err.message);
    if (status) console.error('Status:', status);
    if (body) console.error('Body:', JSON.stringify(body, null, 2));
    process.exit(2);
  });
}
