const aquareaService = require('../../lib/aquareaService');
const db = require('../../lib/db');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  await db.ensureDb();

  const { mode } = req.body;
  const validModes = ['on', 'off', 'eco'];
  if (!validModes.includes(mode)) {
    return res.status(400).json({ error: 'mode must be one of: on, off, eco' });
  }

  await db.insertRuleLog({
    rule_id: 'manual',
    rule_name: 'Manual mode change',
    triggered: true,
    action_taken: JSON.stringify({ type: 'set_mode', value: mode }),
    reason: 'Manual control via UI'
  });

  const result = await aquareaService.setMode(mode);
  res.json(result);
};
