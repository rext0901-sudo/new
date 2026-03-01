const { arePricesFresh } = require('../lib/entsoeService');
const aquareaService = require('../lib/aquareaService');
const { getActiveRule } = require('../lib/ruleEngine');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const type = req.query.type || 'status';

  if (type === 'settings') {
    return res.json({
      timezone: process.env.TIMEZONE || 'Europe/Amsterdam',
      vat_rate: parseFloat(process.env.PRICE_VAT_RATE || '0.21'),
      has_entsoe_key: !!process.env.ENTSOE_API_KEY,
      has_panasonic_credentials: !!(process.env.PANASONIC_EMAIL && process.env.PANASONIC_PASSWORD)
    });
  }

  // Default: system status
  const fresh = await arePricesFresh();
  const active = await getActiveRule();

  res.json({
    prices_fresh: fresh,
    api_reachable: aquareaService.isApiReachable(),
    active_rule: active,
    timezone: process.env.TIMEZONE || 'Europe/Amsterdam'
  });
};
