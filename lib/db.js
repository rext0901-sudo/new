const { sql } = require('@vercel/postgres');

let initialized = false;

async function ensureDb() {
  if (initialized) return;

  await sql`
    CREATE TABLE IF NOT EXISTS energy_prices (
      id SERIAL PRIMARY KEY,
      interval_start TIMESTAMPTZ NOT NULL,
      interval_end TIMESTAMPTZ NOT NULL,
      price_eur_mwh REAL NOT NULL,
      fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(interval_start, interval_end)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_prices_interval ON energy_prices(interval_start, interval_end)`;

  await sql`
    CREATE TABLE IF NOT EXISTS device_status (
      id SERIAL PRIMARY KEY,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      outdoor_temp REAL,
      water_temp REAL,
      setpoint REAL,
      mode TEXT,
      power_w REAL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_device_timestamp ON device_status(timestamp)`;

  await sql`
    CREATE TABLE IF NOT EXISTS automation_rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      priority INTEGER NOT NULL DEFAULT 0,
      conditions_json TEXT NOT NULL,
      action_json TEXT NOT NULL,
      last_triggered TIMESTAMPTZ
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS rule_log (
      id SERIAL PRIMARY KEY,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      rule_id TEXT NOT NULL,
      rule_name TEXT NOT NULL,
      triggered INTEGER NOT NULL,
      action_taken TEXT,
      reason TEXT
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_rule_log_timestamp ON rule_log(timestamp)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_rule_log_rule_id ON rule_log(rule_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS session_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await seedDefaultRules();
  initialized = true;
}

async function seedDefaultRules() {
  const { rows } = await sql`SELECT COUNT(*) as cnt FROM automation_rules`;
  if (parseInt(rows[0].cnt) > 0) return;

  const defaults = [
    {
      id: 'rule_cheap_boost',
      name: 'Cheap hours boost',
      enabled: 1,
      priority: 10,
      conditions: JSON.stringify({
        operator: 'AND',
        rules: [
          { variable: 'price_eur_kwh', comparator: '<', value: 0.08 },
          { variable: 'outdoor_temp_c', comparator: '<', value: 5 }
        ]
      }),
      action: JSON.stringify({ type: 'set_temperature', value: 22 })
    },
    {
      id: 'rule_peak_eco',
      name: 'Peak price off',
      enabled: 1,
      priority: 20,
      conditions: JSON.stringify({
        operator: 'AND',
        rules: [
          { variable: 'price_eur_kwh', comparator: '>', value: 0.25 }
        ]
      }),
      action: JSON.stringify({ type: 'set_mode', value: 'eco' })
    },
    {
      id: 'rule_night_comfort',
      name: 'Night comfort',
      enabled: 1,
      priority: 5,
      conditions: JSON.stringify({
        operator: 'AND',
        rules: [
          { variable: 'hour_of_day', comparator: 'between', value: [22, 6] },
          { variable: 'price_eur_kwh', comparator: '<', value: 0.12 }
        ]
      }),
      action: JSON.stringify({ type: 'set_temperature', value: 20 })
    }
  ];

  for (const r of defaults) {
    await sql`
      INSERT INTO automation_rules (id, name, enabled, priority, conditions_json, action_json)
      VALUES (${r.id}, ${r.name}, ${r.enabled}, ${r.priority}, ${r.conditions}, ${r.action})
    `;
  }
}

// --- Session state ---

async function getSessionState(key) {
  const { rows } = await sql`SELECT value, updated_at FROM session_state WHERE key = ${key}`;
  return rows[0] || null;
}

async function setSessionState(key, value) {
  await sql`
    INSERT INTO session_state (key, value, updated_at)
    VALUES (${key}, ${value}, NOW())
    ON CONFLICT(key)
    DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
  `;
}

// --- Price queries ---

async function upsertPrice(intervalStart, intervalEnd, priceEurMwh) {
  await sql`
    INSERT INTO energy_prices (interval_start, interval_end, price_eur_mwh, fetched_at)
    VALUES (${intervalStart}, ${intervalEnd}, ${priceEurMwh}, NOW())
    ON CONFLICT(interval_start, interval_end)
    DO UPDATE SET price_eur_mwh = EXCLUDED.price_eur_mwh, fetched_at = EXCLUDED.fetched_at
  `;
}

async function getPricesByDate(dateStr) {
  const { rows } = await sql`
    SELECT id, interval_start, interval_end, price_eur_mwh, fetched_at
    FROM energy_prices
    WHERE DATE(interval_start) = ${dateStr}::date
    ORDER BY interval_start ASC
  `;
  return rows;
}

async function getLatestPrice() {
  const { rows } = await sql`
    SELECT * FROM energy_prices
    WHERE interval_start <= NOW()
    AND interval_end > NOW()
    ORDER BY interval_start DESC
    LIMIT 1
  `;
  return rows[0] || null;
}

async function getPricesFreshness() {
  const { rows } = await sql`
    SELECT MAX(fetched_at) as last_fetched FROM energy_prices
  `;
  return rows[0] || null;
}

// --- Device status queries ---

async function insertDeviceStatus(status) {
  await sql`
    INSERT INTO device_status (timestamp, outdoor_temp, water_temp, setpoint, mode, power_w)
    VALUES (NOW(), ${status.outdoor_temp}, ${status.water_temp}, ${status.setpoint}, ${status.mode}, ${status.power_w})
  `;
}

async function getLatestDeviceStatus() {
  const { rows } = await sql`
    SELECT * FROM device_status ORDER BY timestamp DESC LIMIT 1
  `;
  return rows[0] || null;
}

async function getDeviceHistory(days = 7) {
  const interval = `${days} days`;
  const { rows } = await sql`
    SELECT * FROM device_status
    WHERE timestamp >= NOW() - CAST(${interval} AS INTERVAL)
    ORDER BY timestamp ASC
  `;
  return rows;
}

// --- Rule queries ---

function parseRule(row) {
  return {
    ...row,
    enabled: !!row.enabled,
    conditions: JSON.parse(row.conditions_json),
    action: JSON.parse(row.action_json)
  };
}

async function getAllRules() {
  const { rows } = await sql`SELECT * FROM automation_rules ORDER BY priority DESC`;
  return rows.map(parseRule);
}

async function getEnabledRules() {
  const { rows } = await sql`SELECT * FROM automation_rules WHERE enabled = 1 ORDER BY priority DESC`;
  return rows.map(parseRule);
}

async function getRuleById(id) {
  const { rows } = await sql`SELECT * FROM automation_rules WHERE id = ${id}`;
  return rows[0] ? parseRule(rows[0]) : null;
}

async function upsertRule(rule) {
  const conditionsJson = JSON.stringify(rule.conditions);
  const actionJson = JSON.stringify(rule.action);
  const enabled = rule.enabled ? 1 : 0;
  await sql`
    INSERT INTO automation_rules (id, name, enabled, priority, conditions_json, action_json, last_triggered)
    VALUES (${rule.id}, ${rule.name}, ${enabled}, ${rule.priority}, ${conditionsJson}, ${actionJson}, ${rule.last_triggered || null})
    ON CONFLICT(id)
    DO UPDATE SET name = EXCLUDED.name, enabled = EXCLUDED.enabled, priority = EXCLUDED.priority,
      conditions_json = EXCLUDED.conditions_json, action_json = EXCLUDED.action_json,
      last_triggered = EXCLUDED.last_triggered
  `;
}

async function deleteRule(id) {
  await sql`DELETE FROM automation_rules WHERE id = ${id}`;
}

async function updateRuleLastTriggered(id) {
  await sql`UPDATE automation_rules SET last_triggered = NOW() WHERE id = ${id}`;
}

// --- Rule log queries ---

async function insertRuleLog(entry) {
  await sql`
    INSERT INTO rule_log (timestamp, rule_id, rule_name, triggered, action_taken, reason)
    VALUES (NOW(), ${entry.rule_id}, ${entry.rule_name}, ${entry.triggered ? 1 : 0}, ${entry.action_taken || null}, ${entry.reason || null})
  `;
}

async function getRecentRuleLogs(limit = 50) {
  const { rows } = await sql`SELECT * FROM rule_log ORDER BY timestamp DESC LIMIT ${limit}`;
  return rows;
}

module.exports = {
  ensureDb,
  getSessionState,
  setSessionState,
  upsertPrice,
  getPricesByDate,
  getLatestPrice,
  getPricesFreshness,
  insertDeviceStatus,
  getLatestDeviceStatus,
  getDeviceHistory,
  getAllRules,
  getEnabledRules,
  getRuleById,
  upsertRule,
  deleteRule,
  updateRuleLastTriggered,
  insertRuleLog,
  getRecentRuleLogs
};
