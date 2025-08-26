jest.mock('node-fetch', () => jest.fn());
const fetch = require('node-fetch');
const { handler } = require('../get-invoice');

describe('get-invoice handler', () => {
  beforeEach(() => fetch.mockReset());

  test('requires invoiceNumber when absent', async () => {
    const res = await handler({ queryStringParameters: {} });
    expect(res.statusCode).toBe(400);
  });

  test('accepts invoiceNumber and returns upstream JSON', async () => {
    const upstream = { invoiceNumber: 'INV-001', total: 100 };
    fetch.mockResolvedValueOnce({ ok: true, json: async () => upstream });

    const res = await handler({ queryStringParameters: { invoiceNumber: 'INV-001' } });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual(upstream);

    const [urlArg] = fetch.mock.calls[0];
    expect(urlArg).toContain('invoiceNumber=INV-001');
  });

  test('supports legacy number param', async () => {
    const upstream = { invoiceNumber: 'INV-LEGACY', total: 50 };
    fetch.mockResolvedValueOnce({ ok: true, json: async () => upstream });

    const res = await handler({ queryStringParameters: { number: 'INV-LEGACY' } });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual(upstream);
  });

  test('propagates non-200 upstream error', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 503 });

    const res = await handler({ queryStringParameters: { invoiceNumber: 'INV-FAIL' } });

    expect(res.statusCode).toBe(503);
  });
});
