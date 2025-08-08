describe('serveinvoice handler', () => {
  test('aggregates consumption and updates Contentful', async () => {
    jest.isolateModules(async () => {
      jest.resetModules();
      jest.doMock('node-fetch', () => jest.fn(async () => ({ ok: true, json: async () => ({ data: [{ consumption: '1.5' }, { consumption: '2.25' }] }) })));
      jest.doMock('../../services/contentful_writer', () => ({ updateInvoiceEntry: jest.fn(async () => ({})) }));

      const fetch = require('node-fetch');
      const { updateInvoiceEntry } = require('../../services/contentful_writer');
      const { handler } = require('../serveinvoice');

      const res = await handler({ queryStringParameters: {} });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(typeof body.totalKwh).toBe('number');
      expect(typeof body.cost).toBe('number');
      expect(updateInvoiceEntry).toHaveBeenCalled();
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });
});


describe('get-consumption handler', () => {
  test('returns database rows when available', async () => {
    jest.isolateModules(async () => {
      jest.resetModules();
      jest.doMock('pg', () => {
        const rows = [{ id: 1, timestamp: '2024-01-01' }];
        return { Client: jest.fn(() => ({ connect: jest.fn(), end: jest.fn(), query: jest.fn(async () => ({ rows })) })) };
      });
      jest.doMock('node-fetch', () => jest.fn());

      const { handler } = require('../get-consumption');

      const res = await handler({ queryStringParameters: { start: '2024-01-01', end: '2024-12-31' } });
      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.source).toBe('database');
      expect(Array.isArray(json.data)).toBe(true);
    });
  });

  test('falls back to API when DB has no rows', async () => {
    jest.isolateModules(async () => {
      jest.resetModules();
      jest.doMock('pg', () => {
        const rows = [];
        return { Client: jest.fn(() => ({ connect: jest.fn(), end: jest.fn(), query: jest.fn(async () => ({ rows })) })) };
      });
      jest.doMock('node-fetch', () => jest.fn(async () => ({ ok: true, json: async () => ([{ consumption: 0.5 }]) })));

      const { handler } = require('../get-consumption');

      const res = await handler({ queryStringParameters: { start: '2024-01-01', end: '2024-12-31' } });
      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.source).toBe('api');
      expect(Array.isArray(json.data)).toBe(true);
    });
  });
});


describe('push-invoice handler', () => {
  test('creates and publishes Contentful entry', async () => {
    jest.isolateModules(async () => {
      jest.resetModules();
      jest.doMock('node-fetch', () => jest.fn(async () => ({ ok: true, json: async () => ({ invoiceNumber: 'INV-001' }) })));
      jest.doMock('contentful-management', () => ({
        createClient: jest.fn(() => ({
          getSpace: jest.fn(async () => ({
            getEnvironment: jest.fn(async () => ({
              createEntry: jest.fn(async () => ({ publish: jest.fn(async () => ({})), sys: { id: 'entry123' } })),
            })),
          })),
        })),
      }));

      const { handler } = require('../push-invoice');

      const res = await handler({ queryStringParameters: { start: '2025-01-01', end: '2025-12-31' } });
      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.entryId).toBe('entry123');
    });
  });
});


describe('generateinvoice handler', () => {
  test('returns base64 PDF', async () => {
    jest.isolateModules(async () => {
      jest.resetModules();
      jest.doMock('../../services/cloudoceanapi', () => jest.fn(function() { return { getMeasuringPointReads: jest.fn(async () => ([{ consumption: '1.5' }, { consumption: '2.5' }])) }; }));
      jest.doMock('../../services/contentful_writer', () => ({ updateInvoiceEntry: jest.fn(async () => ({})) }));
      jest.doMock('pdf-lib', () => ({
        PDFDocument: { create: jest.fn(async () => ({ addPage: jest.fn(() => ({ drawText: jest.fn() })), save: jest.fn(async () => Buffer.from('pdf')) })) },
      }));

      const { handler } = require('../generateinvoice');

      const res = await handler({ queryStringParameters: {} });
      expect(res.statusCode).toBe(200);
      expect(res.isBase64Encoded).toBe(true);
      expect(typeof res.body).toBe('string');
    });
  });
});


describe('sync-cloud-ocean handler', () => {
  test('creates records from Cloud Ocean reads', async () => {
    jest.isolateModules(async () => {
      jest.resetModules();
      jest.doMock('../../services/cloudoceanapi', () => jest.fn(function() { return { getMeasuringPointReads: jest.fn(async () => ([{ timestamp: '2024-01-01', consumption: '1.0', rate: '0.1' }])) }; }));
      jest.doMock('sequelize', () => {
        const createMock = jest.fn(async () => ({}));
        class Sequelize { constructor() {} async sync() { return; } }
        const DataTypes = { INTEGER: 'INTEGER', DATE: 'DATE', DOUBLE: 'DOUBLE' };
        class Model { static init() {} }
        Model.create = createMock;
        Sequelize.NOW = new Date();
        return { Sequelize, DataTypes, Model };
      });

      const { handler } = require('../sync-cloud-ocean');

      const res = await handler({ queryStringParameters: {} });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.count).toBeGreaterThan(0);
    });
  });
});
