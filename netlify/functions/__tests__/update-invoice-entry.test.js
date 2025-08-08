jest.mock('node-fetch', () => jest.fn());
const fetch = require('node-fetch');
jest.mock('pg', () => {
  const end = jest.fn();
  const connect = jest.fn();
  const query = jest.fn();
  return { Client: jest.fn(() => ({ connect, end, query })) };
});
const { handler } = require('../update-invoice-entry');

describe('update-invoice-entry handler', () => {
  beforeEach(() => {
    process.env.URL = 'http://localhost:8888';
    fetch.mockReset();
  });

  test('calls get-consumption, get-invoice, push-invoice and updates DB', async () => {
    // get-consumption
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) });
    // get-invoice
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ invoice_number: 'INV-001' }) });
    // push-invoice
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ message: 'ok' }) });

    const res = await handler({
      queryStringParameters: { start: '2025-01-01', end: '2025-12-31', slug: '/invoice/fac-2024-001', invoiceNumber: 'INV-001' }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.message).toBe('Invoice entry updated');

    // Ensure internal calls were made in correct order and with params
    const calls = fetch.mock.calls.map(c => c[0]);
    expect(calls[0]).toContain('/.netlify/functions/get-consumption');
    expect(calls[0]).toContain('start=2025-01-01');
    expect(calls[0]).toContain('end=2025-12-31');

    expect(calls[1]).toContain('/.netlify/functions/get-invoice');
    expect(calls[1]).toContain('invoiceNumber=INV-001');

    expect(calls[2]).toContain('/.netlify/functions/push-invoice');
  });

  test('surfaces downstream errors', async () => {
    // get-consumption fails
    fetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const res = await handler({ queryStringParameters: { start: '2025-01-01', end: '2025-12-31' } });
    expect(res.statusCode).toBe(500);
  });
});
