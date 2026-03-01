const aquareaService = require('../../lib/aquareaService');
const db = require('../../lib/db');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  await db.ensureDb();
  const { type } = req.query;

  if (type === 'mode') {
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
    return res.json(result);
  }

  // Default: setpoint
  const { targetTemp, mode } = req.body;

  if (typeof targetTemp !== 'number' || targetTemp < 15 || targetTemp > 25) {
    return res.status(400).json({ error: 'targetTemp must be between 15 and 25' });
  }

  const validModes = ['heat', 'cool', 'auto'];
  const selectedMode = validModes.includes(mode) ? mode : 'heat';

  await db.insertRuleLog({
    rule_id: 'manual',
    rule_name: 'Manual setpoint change',
    triggered: true,
    action_taken: JSON.stringify({ type: 'set_temperature', value: targetTemp, mode: selectedMode }),
    reason: 'Manual control via UI'
  });

  const result = await aquareaService.setTemperature(targetTemp, selectedMode);
  res.json(result);
};
