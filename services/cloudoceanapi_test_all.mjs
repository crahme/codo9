'use strict';

import { fileURLToPath } from 'url';
import 'dotenv/config';
import axios from 'axios';

// ===== Config =====
const BASE_URL = process.env.CLOUD_OCEAN_BASE_URL || 'https://api.develop.rve.ca';
const API_KEY = process.env.API_Key;
const MODULE_UUID = 'c667ff46-9730-425e-ad48-1e950691b3f9';
const START = '2024-10-16';
const END = '2024-11-25';

if (!API_KEY) {
  console.error('❌ Missing API key. Set API_Key in your .env file.');
  process.exit(1);
}

// ===== Axios client =====
const client = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Access-Token': API_KEY.startsWith('Bearer ')
      ? API_KEY
      : `Bearer ${API_KEY}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
});

// ===== Helpers =====
async function listModuleMeasuringPoints(moduleUuid) {
  const all = [];
  let offset = 0;
  const limit = 50;
  while (true) {
    const res = await client.get(`/v1/modules/${moduleUuid}/measuring-points`, {
      params: { limit, offset },
    });
    const data = res.data?.data || [];
    all.push(...data);
    if (data.length < limit) break;
    offset += limit;
  }
  return all;
}

async function listDevices() {
  const all = [];
  let offset = 0;
  const limit = 100;
  while (true) {
    const res = await client.get(`/v1/devices`, { params: { limit, offset } });
    const data = res.data?.data || [];
    all.push(...data);
    if (data.length < limit) break;
    offset += limit;
  }
  return all;
}

// ===== Main =====
async function main() {
  console.log('🔎 Fetching all measuring points & devices');
  console.log({ moduleUuid: MODULE_UUID, start: START, end: END });

  // --- Measuring Points ---
  let measuringPoints = [];
  try {
    measuringPoints = await listModuleMeasuringPoints(MODULE_UUID);
  } catch (e) {
    console.error('⚠️ Failed to list measuring points:', e.message);
    process.exit(1);
  }

  console.log(`Found ${measuringPoints.length} measuring points`);

  let totalReads = 0;
  let totalCdr = 0;
  let totalKwh = 0;

  for (const mp of measuringPoints) {
    const mpUuid = mp.uuid || mp.id;
    if (!mpUuid) continue;

    console.log(`\n📌 Measuring point: ${mpUuid} (${mp.name || 'unknown'})`);

    // Reads
    let reads = [];
    try {
      const res = await client.get(
        `/v1/modules/${MODULE_UUID}/measuring-points/${mpUuid}/reads`,
        { params: { start: START, end: END, limit: 1000, offset: 0 } }
      );
      reads = res.data?.data || [];
      console.log(`   ✅ Reads: ${reads.length}`);
    } catch (e) {
      console.warn(`   ❌ Failed to fetch reads: ${e.message}`);
    }

    // CDR
    let cdr = [];
    try {
      const res = await client.get(
        `/v1/modules/${MODULE_UUID}/measuring-points/${mpUuid}/cdr`,
        { params: { start: START, end: END, limit: 1000, offset: 0 } }
      );
      cdr = res.data?.data || [];
      console.log(`   ✅ CDR: ${cdr.length}`);
    } catch (e) {
      console.warn(`   ❌ Failed to fetch CDR: ${e.message}`);
    }

    // kWh sum
    const mpKwh = reads.reduce(
      (sum, r) => sum + parseFloat(r.consumption || 0),
      0
    );

    totalReads += reads.length;
    totalCdr += cdr.length;
    totalKwh += mpKwh;

    console.log(`   🔋 kWh: ${mpKwh}`);
  }

  // --- Devices ---
  let devices = [];
  try {
    devices = await listDevices();
  } catch (e) {
    console.error('⚠️ Failed to list devices:', e.message);
  }

  console.log(`\nFound ${devices.length} devices`);

  let totalDeviceCons = 0;
  for (const d of devices) {
    const id = d.id || d.uuid;
    if (!id) continue;

    try {
      const info = await client.get(`/v1/devices/${id}`);
      const cons = await client.get(`/v1/devices/${id}/consumption`, {
        params: { start: START, end: END },
      });

      const count = Array.isArray(cons.data?.data)
        ? cons.data.data.length
        : 0;
      console.log(
        `   Device ${id}: info=${info.status === 200 ? 'ok' : 'n/a'}, consumption records=${count}`
      );
      totalDeviceCons += count;
    } catch (e) {
      console.warn(`   Device ${id}: ❌ ${e.message}`);
    }
  }

  // --- Summary ---
  console.log('\n📊 SUMMARY');
  console.log(`  Total measuring points: ${measuringPoints.length}`);
  console.log(`  Total reads: ${totalReads}`);
  console.log(`  Total CDR: ${totalCdr}`);
  console.log(`  Total kWh: ${totalKwh}`);
  console.log(`  Total devices: ${devices.length}`);
  console.log(`  Device consumption records: ${totalDeviceCons}`);
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    console.error('Test failed:', err.message);
    if (err.response) {
      console.error('Status:', err.response.status);
      console.error('Body:', JSON.stringify(err.response.data, null, 2));
    }
    process.exit(2);
  });
}
