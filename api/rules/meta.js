const db = require('../../lib/db');

module.exports = async function handler(req, res) {
  await db.ensureDb();
  const action = req.query.action || 'logs';

  if (action === 'reorder' && req.method === 'POST') {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ error: 'orderedIds must be an array' });
    }

    for (let i = 0; i < orderedIds.length; i++) {
      const rule = await db.getRuleById(orderedIds[i]);
      if (rule) {
        rule.priority = (orderedIds.length - i) * 10;
        await db.upsertRule(rule);
      }
    }

    const rules = await db.getAllRules();
    return res.json({ success: true, rules });
  }

  // Default: logs
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const limit = parseInt(req.query.limit) || 50;
  const logs = await db.getRecentRuleLogs(limit);
  res.json({ logs });
};
