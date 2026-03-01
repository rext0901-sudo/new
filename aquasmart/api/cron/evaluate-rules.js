const { evaluateRules } = require('../../lib/ruleEngine');

module.exports = async function handler(req, res) {
  try {
    const result = await evaluateRules();
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
