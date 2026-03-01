const { getActiveRule } = require('../../lib/ruleEngine');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const active = await getActiveRule();
  res.json({ active });
};
