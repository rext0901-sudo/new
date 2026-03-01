const db = require('../../lib/db');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  await db.ensureDb();
  const limit = parseInt(req.query.limit) || 50;
  const logs = await db.getRecentRuleLogs(limit);
  res.json({ logs });
};
