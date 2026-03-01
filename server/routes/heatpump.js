const express = require('express');
const router = express.Router();
const aquareaService = require('../services/aquareaService');
const { insertRuleLog } = require('../db/db');

// GET /api/heatpump/status
router.get('/status', (req, res) => {
  const status = aquareaService.getStatus();
  res.json({
    status: status || null,
    api_reachable: aquareaService.isApiReachable()
  });
});

// GET /api/heatpump/status/live — fetch fresh status from Panasonic API
router.get('/status/live', async (req, res) => {
  const status = await aquareaService.fetchDeviceStatus();
  res.json({
    status: status || null,
    api_reachable: aquareaService.isApiReachable()
  });
});

// POST /api/heatpump/setpoint — { targetTemp: number, mode: "heat"|"cool"|"auto" }
router.post('/setpoint', async (req, res) => {
  const { targetTemp, mode } = req.body;

  if (typeof targetTemp !== 'number' || targetTemp < 15 || targetTemp > 25) {
    return res.status(400).json({ error: 'targetTemp must be between 15 and 25' });
  }

  const validModes = ['heat', 'cool', 'auto'];
  const selectedMode = validModes.includes(mode) ? mode : 'heat';

  // Log manual action before execution
  insertRuleLog({
    rule_id: 'manual',
    rule_name: 'Manual setpoint change',
    triggered: true,
    action_taken: JSON.stringify({ type: 'set_temperature', value: targetTemp, mode: selectedMode }),
    reason: 'Manual control via UI'
  });

  const result = await aquareaService.setTemperature(targetTemp, selectedMode);
  res.json(result);
});

// POST /api/heatpump/mode — { mode: "on"|"off"|"eco" }
router.post('/mode', async (req, res) => {
  const { mode } = req.body;

  const validModes = ['on', 'off', 'eco'];
  if (!validModes.includes(mode)) {
    return res.status(400).json({ error: 'mode must be one of: on, off, eco' });
  }

  // Log manual action before execution
  insertRuleLog({
    rule_id: 'manual',
    rule_name: 'Manual mode change',
    triggered: true,
    action_taken: JSON.stringify({ type: 'set_mode', value: mode }),
    reason: 'Manual control via UI'
  });

  const result = await aquareaService.setMode(mode);
  res.json(result);
});

// GET /api/heatpump/history?days=7
router.get('/history', (req, res) => {
  const days = parseInt(req.query.days) || 7;
  const history = aquareaService.getHistory(days);
  res.json({ days, records: history });
});

module.exports = router;
