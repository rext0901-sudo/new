const { fetchAndStorePrices } = require('../../lib/entsoeService');
const aquareaService = require('../../lib/aquareaService');
const { evaluateRules } = require('../../lib/ruleEngine');

module.exports = async function handler(req, res) {
  const results = { prices: null, device: null, rules: null };

  try {
    const count = await fetchAndStorePrices();
    results.prices = { success: true, stored: count };
  } catch (err) {
    results.prices = { success: false, error: err.message };
  }

  try {
    const status = await aquareaService.fetchDeviceStatus();
    results.device = { success: true, status };
  } catch (err) {
    results.device = { success: false, error: err.message };
  }

  try {
    const result = await evaluateRules();
    results.rules = { success: true, result };
  } catch (err) {
    results.rules = { success: false, error: err.message };
  }

  res.json(results);
};
