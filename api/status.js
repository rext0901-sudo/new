const { arePricesFresh } = require('../lib/entsoeService');
const aquareaService = require('../lib/aquareaService');
const { getActiveRule } = require('../lib/ruleEngine');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const fresh = await arePricesFresh();
  const active = await getActiveRule();

  res.json({
    prices_fresh: fresh,
    api_reachable: aquareaService.isApiReachable(),
    active_rule: active,
    timezone: process.env.TIMEZONE || 'Europe/Amsterdam'
  });
};
