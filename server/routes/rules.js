const express = require('express');
const router = express.Router();
const { getAllRules, getRuleById, upsertRule, deleteRule, getRecentRuleLogs } = require('../db/db');
const { getActiveRule, resetActionState } = require('../services/ruleEngine');
const crypto = require('crypto');

// GET /api/rules
router.get('/', (req, res) => {
  const rules = getAllRules();
  res.json({ rules });
});

// GET /api/rules/active
router.get('/active', (req, res) => {
  const active = getActiveRule();
  res.json({ active });
});

// GET /api/rules/logs?limit=50
router.get('/logs', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const logs = getRecentRuleLogs(limit);
  res.json({ logs });
});

// GET /api/rules/:id
router.get('/:id', (req, res) => {
  const rule = getRuleById(req.params.id);
  if (!rule) return res.status(404).json({ error: 'Rule not found' });
  res.json({ rule });
});

// POST /api/rules — create or update a rule
router.post('/', (req, res) => {
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

  upsertRule(rule);
  resetActionState(); // reset idempotency so new rules take effect
  res.json({ success: true, rule });
});

// PUT /api/rules/:id
router.put('/:id', (req, res) => {
  const existing = getRuleById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Rule not found' });

  const rule = {
    id: req.params.id,
    name: req.body.name ?? existing.name,
    enabled: req.body.enabled !== undefined ? req.body.enabled : existing.enabled,
    priority: req.body.priority ?? existing.priority,
    conditions: req.body.conditions ?? existing.conditions,
    action: req.body.action ?? existing.action,
    last_triggered: existing.last_triggered
  };

  upsertRule(rule);
  resetActionState();
  res.json({ success: true, rule });
});

// DELETE /api/rules/:id
router.delete('/:id', (req, res) => {
  const existing = getRuleById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Rule not found' });

  deleteRule(req.params.id);
  resetActionState();
  res.json({ success: true });
});

// POST /api/rules/reorder — { orderedIds: string[] }
router.post('/reorder', (req, res) => {
  const { orderedIds } = req.body;
  if (!Array.isArray(orderedIds)) {
    return res.status(400).json({ error: 'orderedIds must be an array' });
  }

  // Assign descending priorities based on order
  for (let i = 0; i < orderedIds.length; i++) {
    const rule = getRuleById(orderedIds[i]);
    if (rule) {
      rule.priority = (orderedIds.length - i) * 10;
      upsertRule(rule);
    }
  }

  res.json({ success: true, rules: getAllRules() });
});

module.exports = router;
