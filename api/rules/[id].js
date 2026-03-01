const db = require('../../lib/db');

module.exports = async function handler(req, res) {
  await db.ensureDb();
  const { id } = req.query;

  if (req.method === 'GET') {
    const rule = await db.getRuleById(id);
    if (!rule) return res.status(404).json({ error: 'Rule not found' });
    return res.json({ rule });
  }

  if (req.method === 'PUT') {
    const existing = await db.getRuleById(id);
    if (!existing) return res.status(404).json({ error: 'Rule not found' });

    const rule = {
      id,
      name: req.body.name ?? existing.name,
      enabled: req.body.enabled !== undefined ? req.body.enabled : existing.enabled,
      priority: req.body.priority ?? existing.priority,
      conditions: req.body.conditions ?? existing.conditions,
      action: req.body.action ?? existing.action,
      last_triggered: existing.last_triggered
    };

    await db.upsertRule(rule);
    return res.json({ success: true, rule });
  }

  if (req.method === 'DELETE') {
    const existing = await db.getRuleById(id);
    if (!existing) return res.status(404).json({ error: 'Rule not found' });

    await db.deleteRule(id);
    return res.json({ success: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
};
