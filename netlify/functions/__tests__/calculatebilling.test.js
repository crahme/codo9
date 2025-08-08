const calculateBilling = require('../calculatebilling');

describe('calculateBilling', () => {
  test('computes line items, totals, and formats to two decimals', () => {
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
    const cdr = { rate: 0.15 };

    const result = calculateBilling(reads, cdr);

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

  test('handles invalid numeric inputs gracefully', () => {
    const reads = [
      { date: '2025-01-03T00:00:00.000Z', startTime: null, endTime: null, kWh: 'abc' },
    ];
    const cdr = { rate: '0.20' }; // string is fine

    const result = calculateBilling(reads, cdr);

    expect(result.totalKwh).toBe('0.00');
    expect(result.cost).toBe('0.00');
    expect(result.lineItems[0]).toMatchObject({
      energyConsumed: '0.00',
      unitPrice: '0.20',
      amount: '0.00',
    });
  });

  test('empty reads returns zero totals and empty lineItems', () => {
    const result = calculateBilling([], { rate: 0.25 });
    expect(result.totalKwh).toBe('0.00');
    expect(result.cost).toBe('0.00');
    expect(result.lineItems).toEqual([]);
  });

  test('missing cdr or rate results in zero cost', () => {
    const reads = [{ date: '2025-01-01', startTime: 'a', endTime: 'b', kWh: 3.2 }];
    const result = calculateBilling(reads, undefined);
    expect(result.totalKwh).toBe('3.20');
    expect(result.cost).toBe('0.00');
    expect(result.lineItems[0]).toMatchObject({
      unitPrice: '0.00',
      amount: '0.00',
    });
  });
});
