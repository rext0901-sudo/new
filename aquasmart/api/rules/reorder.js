const db = require('../../lib/db');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  await db.ensureDb();

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
  res.json({ success: true, rules });
};
