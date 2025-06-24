// netlify/functions/calculatebilling.js

const calculateBilling = (reads, cdr) => {
  // Each read must have: date, startTime, endTime, kWh (number)
  // cdr.rate is the price per kWh

  const lineItems = reads.map(read => {
    const energyConsumed = Number(read.kWh) || 0;
    const unitPrice = Number(cdr.rate) || 0;
    const amount = energyConsumed * unitPrice;
    return {
      date: read.date, // ISO string
      startTime: read.startTime, // ISO string
      endTime: read.endTime, // ISO string
      energyConsumed: energyConsumed.toFixed(2), // String, e.g. "2.34"
      unitPrice: unitPrice.toFixed(2),           // String, e.g. "0.12"
      amount: (unitPrice*energyConsumed),                 // String, e.g. "0.28"
    }
  });

  const totalKwh = lineItems.reduce((sum, i) => sum + parseFloat(i.energyConsumed), 0);
  const cost = lineItems.reduce((sum, i) => sum + parseFloat(i.amount), 0);

  return { totalKwh: totalKwh.toFixed(2), cost: cost.toFixed(2), lineItems };
};

module.exports = calculateBilling;
