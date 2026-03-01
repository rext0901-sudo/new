const aquareaService = require('../../lib/aquareaService');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const days = parseInt(req.query.days) || 7;
  const records = await aquareaService.getHistory(days);
  res.json({ days, records: records || [] });
};
