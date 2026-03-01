const db = require('../../lib/db');
const crypto = require('crypto');

module.exports = async function handler(req, res) {
  await db.ensureDb();

  if (req.method === 'GET') {
    const rules = await db.getAllRules();
    return res.json({ rules });
  }

  if (req.method === 'POST') {
    const { name, enabled, priority, conditions, action } = req.body;

    if (!name || !conditions || !action) {
      return res.status(400).json({ error: 'name, conditions, and action are required' });
    }

    const rule = {
      id: req.body.id || `rule_${crypto.randomBytes(6).toString('hex')}`,
      name,
      enabled: enabled !== undefined ? enabled : true,
      priority: priority || 0,
      conditions,
      action,
      last_triggered: req.body.last_triggered || null
    };

    await db.upsertRule(rule);
    return res.json({ success: true, rule });
  }

  res.status(405).json({ error: 'Method not allowed' });
};
