/** @jest-environment node */

const dotenv = require('dotenv');
const path = require('path');
const { pathToFileURL } = require('url');
const undici = require('node:undici');

dotenv.config();

describe('CloudOceanService live integration', () => {
  if (process.env.LIVE_CLOUDOCEAN_TEST !== '1') {
    test.skip('skipped: set LIVE_CLOUDOCEAN_TEST=1 to run live CloudOcean tests', () => {});
    return;
  }

  test('uses native undici fetch (not a mock)', () => {
    // Ensure the test environment has not replaced fetch with a mock.
    // In Node >=20, global.fetch should be the undici fetch implementation by default.
    expect(global.fetch).toBe(undici.fetch);
  });

  test(
    'fetches live data from Cloud Ocean API endpoints',
    async () => {
      if (!process.env.API_Key) {
        console.warn('API_Key not set; skipping live test. Provide API_Key in env/.env.');
        return;
      }

      // Dynamically import the ESM service from a CJS test file
      const serviceModulePath = path.resolve(__dirname, '../CloudOceanService.js');
      const { CloudOceanService } = await import(pathToFileURL(serviceModulePath).href);

      const service = new CloudOceanService();
      // Make retries faster for tests
      service.maxRetries = 2;
      service.baseDelay = 500;

      // Wrap fetch to count actual network calls without mocking the response
      const calls = [];
      const originalFetch = global.fetch;
      global.fetch = (...args) => {
        calls.push(args[0]);
        return originalFetch(...args);
      };

      try {
        const start = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const end = new Date().toISOString().slice(0, 10);

        // Use a known measuring point from the service's documented set
        const point = { uuid: '71ef9476-3855-4a3f-8fc5-333cfbf9e898' };

        const reads = await service.getReads(point, start, end);
        const cdr = await service.getCdr(point, start, end);

        // Basic shape assertions
        expect(typeof reads).toBe('object');
        expect(reads).toHaveProperty('date');
        expect(reads).toHaveProperty('cumulative_kwh');
        expect(typeof reads.cumulative_kwh).toBe('number');

        expect(Array.isArray(cdr)).toBe(true);
        if (cdr.length) {
          expect(cdr[0]).toHaveProperty('date');
          expect(cdr[0]).toHaveProperty('daily_kwh');
          expect(typeof cdr[0].daily_kwh).toBe('number');
        }

        // Validate that a real network call happened to the expected host
        expect(calls.length).toBeGreaterThan(0);
        const urls = calls.map(u => (typeof u === 'string' ? u : (u && (u.url || String(u))) ));
        expect(urls.some(u => typeof u === 'string' && u.includes('api.develop.rve.ca'))).toBe(true);
      } finally {
        global.fetch = originalFetch; // restore
      }
    },
    30000 // timeout: live network
  );
});
