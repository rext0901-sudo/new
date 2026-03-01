const { fetchAndStorePrices } = require('../../lib/entsoeService');

module.exports = async function handler(req, res) {
  try {
    const count = await fetchAndStorePrices();
    res.json({ success: true, stored: count });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
