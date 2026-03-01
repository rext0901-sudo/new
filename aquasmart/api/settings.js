module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  res.json({
    timezone: process.env.TIMEZONE || 'Europe/Amsterdam',
    vat_rate: parseFloat(process.env.PRICE_VAT_RATE || '0.21'),
    has_entsoe_key: !!process.env.ENTSOE_API_KEY,
    has_panasonic_credentials: !!(process.env.PANASONIC_EMAIL && process.env.PANASONIC_PASSWORD)
  });
};
