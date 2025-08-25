jest.mock('node-fetch', () => jest.fn());
const fetch = require('node-fetch');
const { handler } = require('../fetchKwh');

describe('fetchKwh handler', () => {
  beforeEach(() => {
    fetch.mockReset();
    process.env.API_Key = 'test-api-key';
  });

  test('returns 200 and upstream JSON when response is ok', async () => {
    const upstream = { data: [{ consumption: 1.23 }] };
    fetch.mockResolvedValueOnce({ ok: true, json: async () => upstream });

    const event = {
      queryStringParameters: {
        moduleUuid: 'mod-123',
        measuringPointUuid: 'mp-456',
        start: '2024-10-01',
        end: '2024-10-31',
      },
    };

    const res = await handler(event);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual(upstream);

    expect(fetch).toHaveBeenCalledTimes(1);
    const [urlArg, opts] = fetch.mock.calls[0];
    expect(urlArg).toContain('mod-123');
    expect(urlArg).toContain('mp-456');
    expect(urlArg).toContain('start=2024-10-01');
    expect(urlArg).toContain('end=2024-10-31');
    expect(opts && opts.headers && opts.headers['Access-Token']).toBe('test-api-key');
  });

  test('propagates upstream non-200 status code', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 502 });

    const res = await handler({ queryStringParameters: {} });

    expect(res.statusCode).toBe(502);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test('uses default params when missing', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    await handler({ queryStringParameters: {} });

    const [urlArg, opts] = fetch.mock.calls[0];
    expect(urlArg).toContain('/measuring-points/');
    expect(urlArg).toContain('start=2024-10-16');
    expect(urlArg).toContain('end=2024-11-25');
    expect(opts && opts.headers && opts.headers['Access-Token']).toBe('test-api-key');
  });
});
