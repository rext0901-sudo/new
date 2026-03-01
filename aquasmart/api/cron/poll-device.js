const aquareaService = require('../../lib/aquareaService');

module.exports = async function handler(req, res) {
  try {
    const status = await aquareaService.fetchDeviceStatus();
    res.json({ success: true, status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
