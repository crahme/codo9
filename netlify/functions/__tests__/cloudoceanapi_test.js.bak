require('dotenv').config();
const CloudOceanAPI = require('../../services/cloudoceanapi');

async function main() {
  const apiKey = process.env.CLOUD_OCEAN_API_KEY || process.env.API_Key || process.env.API_KEY;
  const [,, moduleUuid, measuringPointUuid, startArg, endArg] = process.argv;

  if (!apiKey) {
    console.error('Missing API key. Set CLOUD_OCEAN_API_KEY or API_Key in your environment or .env file.');
    process.exit(1);
  }

  if (!moduleUuid || !measuringPointUuid) {
    console.error('Usage: node netlify/functions/_tests_/cloudoceanapi_test.js <moduleUuid> <measuringPointUuid> [start: YYYY-MM-DD] [end: YYYY-MM-DD]');
    process.exit(1);
  }

  const startDate = startArg ? new Date(startArg) : new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
  const endDate = endArg ? new Date(endArg) : new Date();

  const client = new CloudOceanAPI(apiKey);

  console.log('Testing CloudOceanAPI with parameters:');
  console.log({ moduleUuid, measuringPointUuid, start: startDate.toISOString().slice(0,10), end: endDate.toISOString().slice(0,10) });

  try {
    // Validate measuring point
    const valid = await client.validateMeasuringPoint(moduleUuid, measuringPointUuid);
    console.log(`validateMeasuringPoint => ${valid}`);

    // Reads
    const reads = await client.getMeasuringPointReads(moduleUuid, measuringPointUuid, startDate, endDate);
    console.log(`getMeasuringPointReads => count: ${reads.length}`);
    if (reads.length) console.log('reads[0]:', JSON.stringify(reads[0], null, 2));

    // CDR
    const cdr = await client.getMeasuringPointCdr(moduleUuid, measuringPointUuid, startDate, endDate);
    console.log(`getMeasuringPointCdr => count: ${cdr.length}`);
    if (cdr.length) console.log('cdr[0]:', JSON.stringify(cdr[0], null, 2));

    // Aggregated module consumption across the single measuring point (works with multiple too)
    const consumption = await client.getModuleConsumption(moduleUuid, [measuringPointUuid], startDate, endDate);
    console.log('getModuleConsumption =>', JSON.stringify(consumption, null, 2));

    // Optional: device endpoints if DEVICE_ID provided
    const deviceId = process.env.CLOUD_OCEAN_DEVICE_ID || process.env.DEVICE_ID;
    if (deviceId) {
      const devInfo = await client.getDeviceInfo(deviceId);
      console.log('getDeviceInfo =>', JSON.stringify(devInfo, null, 2));

      const devCons = await client.getDeviceConsumption(deviceId, startDate, endDate);
      console.log(`getDeviceConsumption => count: ${Array.isArray(devCons) ? devCons.length : 'n/a'}`);
      if (Array.isArray(devCons) && devCons.length) console.log('deviceConsumption[0]:', JSON.stringify(devCons[0], null, 2));
    } else {
      console.log('DEVICE_ID not set in env; skipping device info/consumption tests.');
    }

    console.log('CloudOceanAPI test complete.');
  } catch (err) {
    const status = err?.response?.status;
    const body = err?.response?.data;
    console.error('Request failed:', err.message);
    if (status) console.error('Status:', status);
    if (body) console.error('Body:', JSON.stringify(body, null, 2));
    process.exit(2);
  }
}

main();
