const path = require('path');

// Resolve module paths relative to the functions directory to ensure mocks match what the handlers require
const functionsDir = path.join(__dirname, '..');
const contentfulWriterPath = require.resolve('../../services/contentful_writer', { paths: [functionsDir] });
const cloudoceanapiPath = require.resolve('../../services/cloudoceanapi', { paths: [functionsDir] });


describe('serveinvoice handler', () => {
  test('aggregates consumption and updates Contentful', async () => {
    jest.resetModules();

    // Ensure env present for any modules that read tokens at import time
    'CFPAT-hFTZ7nEiZeGQyM3jhdGwlFHun-JUAPX5Wn9ytsLR9Hk' = 'test-token';
    // Mock external dependencies
    jest.doMock('node-fetch', () => jest.fn(async () => ({ ok: true, json: async () => ({ data: [{ consumption: '1.5' }, { consumption: '2.25' }] }) })));
    jest.doMock('contentful-management', () => ({
      createClient: jest.fn(() => ({
        getSpace: jest.fn(async () => ({
          getEnvironment: jest.fn(async () => ({
            createEntry: jest.fn(async () => ({ publish: jest.fn(async () => ({})), sys: { id: 'entry123' } })),
          })),
        })),
      })),
    }));
    jest.doMock(contentfulWriterPath, () => ({ updateInvoiceEntry: jest.fn(async () => ({})) }));

    const fetch = require('node-fetch');
    const { updateInvoiceEntry } = require(contentfulWriterPath);
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


describe('get-consumption handler', () => {
  test('returns database rows when available', async () => {
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

  test('falls back to API when DB has no rows', async () => {
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


describe('push-invoice handler', () => {
  test('creates and publishes Contentful entry', async () => {
    jest.resetModules();

    'CFPAT-hFTZ7nEiZeGQyM3jhdGwlFHun-JUAPX5Wn9ytsLR9Hk' = 'test-token';

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


describe('generateinvoice handler', () => {
  test('returns base64 PDF', async () => {
    jest.resetModules();

    'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiI0IiwianRpIjoiODQ2YTk2NjFiMmFkM2E5YTY3N2FhYWQyNTgxMmIxODc0YzVhYjQ4M2UzNGNhYWQ1MjFmZmQ1MDBhMWNjZjFlOWM4ZTIyYzdhOTdlODA4OTgiLCJpYXQiOjE3MjIyNjU1MTcuMDk5NjE0LCJuYmYiOjE3MjIyNjU1MTcuMDk5NjIsImV4cCI6NDg3NzkzOTExNy4wOTI2NSwic3ViIjoiMTc3Iiwic2NvcGVzIjpbXX0.noGdf_SEdLRfnAI22kRRmysCnuCqEc9i1I2GTCvZ3WCxYqtNjaVr-oZ0nIxfhsSGwcdGpz7wnEfuY7YkwLW4Dm-I5CXVh6QhM652IWY8LVE9vwAJmHhS1kR-an5loQ3zaZ5s44eUR6uxW4aAUL4V7iXFiLxEvSDN_8HhvHOmPeD-sqg8ShFnWN6bSIQkKduC-87dKTmWLgd79usAo3r6qm_YYZurvpVuUHuK0Ll59oInH2GRBvIaHwK5-hwdAbsXKU_sNCA8A4cUckq6CPSDXVhvHaBDi-PSrBowP4yaz5pq_vZOqxzsuKfPzUEB5Z9w4bbS13hqQNVuZD2ixb0qb1yqbQ7ecWoXv4HJi2Yh03YTL9oagWfzLzY97H-t0TL8NKT3CE9fpc2ePxMQXU2lfCnS5t6kpk543TYwHWKL-kvY2p4ICq6vdxfRpakWj9XVQyMbDRA_KhBTw-ornuOVf5v4qWp-VMutqzhmWNwmul1ldng6tmvSJaLgKdbGJkNHYJUFm8XhEMvBhnoCj1khrhwD6DwPAXB1RyWREjiS-uCat8OnOJibV6rI4YqMTEi6mjtJUYNCRfKOqPO7bXPuVoiY6uZe77H7i_ooEPAKYMNFn-2V8O4LevPsLBW5vN0PPkXeGFaC_iFmdm2vROUaK3kd24o-YxtwPpFKiavqFrA' = 'test-api-key';
    'CFPAT-hFTZ7nEiZeGQyM3jhdGwlFHun-JUAPX5Wn9ytsLR9Hk' = 'test-token';

    jest.doMock(cloudoceanapiPath, () => jest.fn(function() { return { getMeasuringPointReads: jest.fn(async () => ([{ consumption: '1.5' }, { consumption: '2.5' }])) }; }));
    jest.doMock(contentfulWriterPath, () => ({ updateInvoiceEntry: jest.fn(async () => ({})) }));
    jest.doMock('contentful-management', () => ({
      createClient: jest.fn(() => ({
        getSpace: jest.fn(async () => ({
          getEnvironment: jest.fn(async () => ({
            createEntry: jest.fn(async () => ({ publish: jest.fn(async () => ({})), sys: { id: 'entry123' } })),
          })),
        })),
      })),
    }));
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


describe('sync-cloud-ocean handler', () => {
  test('creates records from Cloud Ocean reads', async () => {
    jest.resetModules();

    'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiI0IiwianRpIjoiODQ2YTk2NjFiMmFkM2E5YTY3N2FhYWQyNTgxMmIxODc0YzVhYjQ4M2UzNGNhYWQ1MjFmZmQ1MDBhMWNjZjFlOWM4ZTIyYzdhOTdlODA4OTgiLCJpYXQiOjE3MjIyNjU1MTcuMDk5NjE0LCJuYmYiOjE3MjIyNjU1MTcuMDk5NjIsImV4cCI6NDg3NzkzOTExNy4wOTI2NSwic3ViIjoiMTc3Iiwic2NvcGVzIjpbXX0.noGdf_SEdLRfnAI22kRRmysCnuCqEc9i1I2GTCvZ3WCxYqtNjaVr-oZ0nIxfhsSGwcdGpz7wnEfuY7YkwLW4Dm-I5CXVh6QhM652IWY8LVE9vwAJmHhS1kR-an5loQ3zaZ5s44eUR6uxW4aAUL4V7iXFiLxEvSDN_8HhvHOmPeD-sqg8ShFnWN6bSIQkKduC-87dKTmWLgd79usAo3r6qm_YYZurvpVuUHuK0Ll59oInH2GRBvIaHwK5-hwdAbsXKU_sNCA8A4cUckq6CPSDXVhvHaBDi-PSrBowP4yaz5pq_vZOqxzsuKfPzUEB5Z9w4bbS13hqQNVuZD2ixb0qb1yqbQ7ecWoXv4HJi2Yh03YTL9oagWfzLzY97H-t0TL8NKT3CE9fpc2ePxMQXU2lfCnS5t6kpk543TYwHWKL-kvY2p4ICq6vdxfRpakWj9XVQyMbDRA_KhBTw-ornuOVf5v4qWp-VMutqzhmWNwmul1ldng6tmvSJaLgKdbGJkNHYJUFm8XhEMvBhnoCj1khrhwD6DwPAXB1RyWREjiS-uCat8OnOJibV6rI4YqMTEi6mjtJUYNCRfKOqPO7bXPuVoiY6uZe77H7i_ooEPAKYMNFn-2V8O4LevPsLBW5vN0PPkXeGFaC_iFmdm2vROUaK3kd24o-YxtwPpFKiavqFrA' = 'test-api-key';

    jest.doMock(cloudoceanapiPath, () => jest.fn(function() { return { getMeasuringPointReads: jest.fn(async () => ([{ timestamp: '2024-01-01', consumption: '1.0', rate: '0.1' }])) }; }));
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
