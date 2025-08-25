jest.mock('node-fetch', () => jest.fn());
const fetch = require('node-fetch');
const { handler } = require('../fetchKwh');

describe('fetchKwh handler', () => {
  beforeEach(() => {
    fetch.mockReset();
    'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiI0IiwianRpIjoiODQ2YTk2NjFiMmFkM2E5YTY3N2FhYWQyNTgxMmIxODc0YzVhYjQ4M2UzNGNhYWQ1MjFmZmQ1MDBhMWNjZjFlOWM4ZTIyYzdhOTdlODA4OTgiLCJpYXQiOjE3MjIyNjU1MTcuMDk5NjE0LCJuYmYiOjE3MjIyNjU1MTcuMDk5NjIsImV4cCI6NDg3NzkzOTExNy4wOTI2NSwic3ViIjoiMTc3Iiwic2NvcGVzIjpbXX0.noGdf_SEdLRfnAI22kRRmysCnuCqEc9i1I2GTCvZ3WCxYqtNjaVr-oZ0nIxfhsSGwcdGpz7wnEfuY7YkwLW4Dm-I5CXVh6QhM652IWY8LVE9vwAJmHhS1kR-an5loQ3zaZ5s44eUR6uxW4aAUL4V7iXFiLxEvSDN_8HhvHOmPeD-sqg8ShFnWN6bSIQkKduC-87dKTmWLgd79usAo3r6qm_YYZurvpVuUHuK0Ll59oInH2GRBvIaHwK5-hwdAbsXKU_sNCA8A4cUckq6CPSDXVhvHaBDi-PSrBowP4yaz5pq_vZOqxzsuKfPzUEB5Z9w4bbS13hqQNVuZD2ixb0qb1yqbQ7ecWoXv4HJi2Yh03YTL9oagWfzLzY97H-t0TL8NKT3CE9fpc2ePxMQXU2lfCnS5t6kpk543TYwHWKL-kvY2p4ICq6vdxfRpakWj9XVQyMbDRA_KhBTw-ornuOVf5v4qWp-VMutqzhmWNwmul1ldng6tmvSJaLgKdbGJkNHYJUFm8XhEMvBhnoCj1khrhwD6DwPAXB1RyWREjiS-uCat8OnOJibV6rI4YqMTEi6mjtJUYNCRfKOqPO7bXPuVoiY6uZe77H7i_ooEPAKYMNFn-2V8O4LevPsLBW5vN0PPkXeGFaC_iFmdm2vROUaK3kd24o-YxtwPpFKiavqFrA' = 'test-api-key';
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
