const aquareaService = require('../../lib/aquareaService');
const db = require('../../lib/db');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  await db.ensureDb();

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
