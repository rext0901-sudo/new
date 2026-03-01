const { getPricesForDate, arePricesFresh } = require('../../lib/entsoeService');

function getTodayDateStr() {
  const now = new Date();
  const amsterdam = new Date(now.toLocaleString('en-US', { timeZone: process.env.TIMEZONE || 'Europe/Amsterdam' }));
  const y = amsterdam.getFullYear();
  const m = String(amsterdam.getMonth() + 1).padStart(2, '0');
  const d = String(amsterdam.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const dateStr = req.query.date || getTodayDateStr();
  const vatRate = parseFloat(process.env.PRICE_VAT_RATE || '0.21');
  const includeVat = req.query.vat === 'true';

  const prices = await getPricesForDate(dateStr);
  const fresh = await arePricesFresh();

  const result = prices.map(p => ({
    ...p,
    price_eur_kwh_display: includeVat
      ? +(p.price_eur_kwh * (1 + vatRate)).toFixed(6)
      : p.price_eur_kwh
  }));

  res.json({
    date: dateStr,
    include_vat: includeVat,
    vat_rate: vatRate,
    fresh,
    count: result.length,
    prices: result
  });
};
