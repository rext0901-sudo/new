require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');

const { getDb } = require('./db/db');
const pricesRouter = require('./routes/prices');
const heatpumpRouter = require('./routes/heatpump');
const rulesRouter = require('./routes/rules');
const { fetchAndStorePrices, arePricesFresh } = require('./services/entsoeService');
const aquareaService = require('./services/aquareaService');
const { evaluateRules, getActiveRule } = require('./services/ruleEngine');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/prices', pricesRouter);
app.use('/api/heatpump', heatpumpRouter);
app.use('/api/rules', rulesRouter);

// System status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    prices_fresh: arePricesFresh(),
    api_reachable: aquareaService.isApiReachable(),
    active_rule: getActiveRule(),
    timezone: process.env.TIMEZONE || 'Europe/Amsterdam'
  });
});

// Settings endpoint
app.get('/api/settings', (req, res) => {
  res.json({
    timezone: process.env.TIMEZONE || 'Europe/Amsterdam',
    vat_rate: parseFloat(process.env.PRICE_VAT_RATE || '0.21'),
    has_entsoe_key: !!process.env.ENTSOE_API_KEY,
    has_panasonic_credentials: !!(process.env.PANASONIC_EMAIL && process.env.PANASONIC_PASSWORD)
  });
});

// Serve React frontend in production
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(clientDist, 'index.html'));
  }
});

// Initialize database
getDb();

// --- Scheduled jobs ---

// Fetch prices every 15 minutes
cron.schedule('*/15 * * * *', async () => {
  console.log('[Cron] Fetching energy prices...');
  await fetchAndStorePrices();
}, { timezone: process.env.TIMEZONE || 'Europe/Amsterdam' });

// Fetch next-day prices at 13:00 (when they're published)
cron.schedule('0 13 * * *', async () => {
  console.log('[Cron] Fetching next-day prices at 13:00...');
  await fetchAndStorePrices();
}, { timezone: process.env.TIMEZONE || 'Europe/Amsterdam' });

// Poll device status every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  console.log('[Cron] Polling heat pump status...');
  await aquareaService.fetchDeviceStatus();
}, { timezone: process.env.TIMEZONE || 'Europe/Amsterdam' });

// Evaluate automation rules every 15 minutes (aligned to quarter hours)
cron.schedule('0,15,30,45 * * * *', async () => {
  console.log('[Cron] Evaluating automation rules...');
  const result = await evaluateRules();
  console.log('[Cron] Rule evaluation result:', JSON.stringify(result));
}, { timezone: process.env.TIMEZONE || 'Europe/Amsterdam' });

// Start server
app.listen(PORT, () => {
  console.log(`[AquaSmart] Server running on http://localhost:${PORT}`);

  // Initial fetch on startup
  fetchAndStorePrices().catch(err => console.error('[Startup] Price fetch error:', err.message));
  aquareaService.fetchDeviceStatus().catch(err => console.error('[Startup] Status fetch error:', err.message));
});
