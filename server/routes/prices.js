const express = require('express');
const router = express.Router();
const { getPricesForDate, getCurrentPrice, arePricesFresh, fetchAndStorePrices } = require('../services/entsoeService');

// GET /api/prices?date=YYYY-MM-DD
router.get('/', (req, res) => {
  const dateStr = req.query.date || getTodayDateStr();
  const vatRate = parseFloat(process.env.PRICE_VAT_RATE || '0.21');
  const includeVat = req.query.vat === 'true';

  const prices = getPricesForDate(dateStr);

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
    fresh: arePricesFresh(),
    count: result.length,
    prices: result
  });
});

// GET /api/prices/current
router.get('/current', (req, res) => {
  const price = getCurrentPrice();
  if (!price) {
    return res.json({ price: null, fresh: false });
  }

  const vatRate = parseFloat(process.env.PRICE_VAT_RATE || '0.21');
  const includeVat = req.query.vat === 'true';

  res.json({
    ...price,
    price_eur_kwh_display: includeVat
      ? +(price.price_eur_kwh * (1 + vatRate)).toFixed(6)
      : price.price_eur_kwh,
    fresh: arePricesFresh()
  });
});

// POST /api/prices/refresh — manually trigger price fetch
router.post('/refresh', async (req, res) => {
  try {
    const count = await fetchAndStorePrices();
    res.json({ success: true, stored: count });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

function getTodayDateStr() {
  const now = new Date();
  const amsterdam = new Date(now.toLocaleString('en-US', { timeZone: process.env.TIMEZONE || 'Europe/Amsterdam' }));
  const y = amsterdam.getFullYear();
  const m = String(amsterdam.getMonth() + 1).padStart(2, '0');
  const d = String(amsterdam.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

module.exports = router;
