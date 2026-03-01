const aquareaService = require('../../lib/aquareaService');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const action = req.query.action || 'status';

  if (action === 'live') {
    const status = await aquareaService.fetchDeviceStatus();
    return res.json({ status: status || null, api_reachable: aquareaService.isApiReachable() });
  }

  if (action === 'history') {
    const days = parseInt(req.query.days) || 7;
    const records = await aquareaService.getHistory(days);
    return res.json({ days, records: records || [] });
  }

  // Default: cached status
  const status = await aquareaService.getStatus();
  res.json({ status: status || null, api_reachable: aquareaService.isApiReachable() });
};
