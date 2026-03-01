const { getCurrentPrice, arePricesFresh } = require('../../lib/entsoeService');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const price = await getCurrentPrice();
  const fresh = await arePricesFresh();

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
    fresh
  });
};
