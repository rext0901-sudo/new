const aquareaService = require('../../lib/aquareaService');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const status = await aquareaService.getStatus();
  res.json({
    status: status || null,
    api_reachable: aquareaService.isApiReachable()
  });
};
