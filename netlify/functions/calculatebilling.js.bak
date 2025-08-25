function toNumber(val) {
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function fmt2(n) {
  return round2(n).toFixed(2);
}

export function calculateBilling(reads, rate) {
  const rateNum = toNumber(rate);

  const lineItems = Array.isArray(reads)
    ? reads.map((r) => {
        const kWhNum = toNumber(r && (r.kWh ?? r.consumption));
        const energy = round2(kWhNum);
        const unitPrice = round2(rateNum);
        const amount = round2(energy * unitPrice);
        return {
          date: r && (r.date ?? r.timestamp) || null,
          startTime: r && r.startTime || null,
          endTime: r && r.endTime || null,
          energyConsumed: fmt2(energy),
          unitPrice: fmt2(unitPrice),
          amount: fmt2(amount),
        };
      })
    : [];

  const totalKwhNum = lineItems.reduce((sum, li) => sum + Number(li.energyConsumed), 0);
  const totalCostNum = lineItems.reduce((sum, li) => sum + Number(li.amount), 0);

  return {
    lineItems,
    totalKwh: fmt2(totalKwhNum),
    cost: fmt2(totalCostNum),
  };
}

export async function handler(event) {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const reads = body.reads || [];
    const rate = body.rate ?? 0;

    const result = calculateBilling(reads, rate);
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (err) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid input', details: err.message }) };
  }
};

