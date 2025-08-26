const { handler } = require('../calculatebilling');

async function invoke(payload) {
  const event = { body: JSON.stringify(payload) };
  const res = await handler(event);
  if (res.statusCode !== 200) {
    throw new Error(`Handler failed with status ${res.statusCode}: ${res.body}`);
  }
  return JSON.parse(res.body);
}

describe('calculateBilling handler', () => {
  test('computes line items, totals, and formats to two decimals', async () => {
    const reads = [
      {
        date: '2025-01-01T00:00:00.000Z',
        startTime: '2025-01-01T00:00:00.000Z',
        endTime: '2025-01-01T00:15:00.000Z',
        kWh: 2.345, // rounds to 2.35
      },
      {
        date: '2025-01-02T00:00:00.000Z',
        startTime: '2025-01-02T00:00:00.000Z',
        endTime: '2025-01-02T00:15:00.000Z',
        kWh: 1.1, // stays 1.10
      },
    ];
    const rate = 0.15;

    const result = await invoke({ reads, rate });

    expect(result.totalKwh).toBe('3.45'); // 2.35 + 1.10
    expect(result.cost).toBe('0.52'); // (2.345*0.15=0.35175->0.35) + (1.1*0.15=0.165->0.17)

    expect(result.lineItems).toHaveLength(2);
    expect(result.lineItems[0]).toMatchObject({
      energyConsumed: '2.35',
      unitPrice: '0.15',
      amount: '0.35',
    });
    expect(result.lineItems[1]).toMatchObject({
      energyConsumed: '1.10',
      unitPrice: '0.15',
      amount: '0.17',
    });
  });

  test('handles invalid numeric inputs gracefully', async () => {
    const reads = [
      { date: '2025-01-03T00:00:00.000Z', startTime: null, endTime: null, kWh: 'abc' },
    ];
    const rate = '0.20'; // string is fine

    const result = await invoke({ reads, rate });

    expect(result.totalKwh).toBe('0.00');
    expect(result.cost).toBe('0.00');
    expect(result.lineItems[0]).toMatchObject({
      energyConsumed: '0.00',
      unitPrice: '0.20',
      amount: '0.00',
    });
  });

  test('empty reads returns zero totals and empty lineItems', async () => {
    const result = await invoke({ reads: [], rate: 0.25 });
    expect(result.totalKwh).toBe('0.00');
    expect(result.cost).toBe('0.00');
    expect(result.lineItems).toEqual([]);
  });

  test('missing rate results in zero cost', async () => {
    const reads = [{ date: '2025-01-01', startTime: 'a', endTime: 'b', kWh: 3.2 }];
    const result = await invoke({ reads }); // no rate provided
    expect(result.totalKwh).toBe('3.20');
    expect(result.cost).toBe('0.00');
    expect(result.lineItems[0]).toMatchObject({
      unitPrice: '0.00',
      amount: '0.00',
    });
  });
});
