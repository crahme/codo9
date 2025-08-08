jest.mock('@netlify/neon', () => ({ neon: jest.fn(() => jest.fn(async (strings, id) => [{ id, title: 'Hello' }])) }), { virtual: true });
const { handler } = require('../get-post');

describe('get-post handler', () => {
  test('requires postId', async () => {
    const res = await handler({ queryStringParameters: {} });
    expect(res.statusCode).toBe(400);
  });

  test('returns first row from posts', async () => {
    const res = await handler({ queryStringParameters: { postId: 42 } });
    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json).toMatchObject({ id: 42, title: 'Hello' });
  });
});
