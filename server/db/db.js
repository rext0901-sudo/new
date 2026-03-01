const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'aquasmart.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
    db.exec(schema);

    seedDefaultRules(db);
  }
  return db;
}

function seedDefaultRules(database) {
  const count = database.prepare('SELECT COUNT(*) as cnt FROM automation_rules').get();
  if (count.cnt > 0) return;

  const insert = database.prepare(
    'INSERT INTO automation_rules (id, name, enabled, priority, conditions_json, action_json) VALUES (?, ?, ?, ?, ?, ?)'
  );

  const defaults = [
    {
      id: 'rule_cheap_boost',
      name: 'Cheap hours boost',
      enabled: 1,
      priority: 10,
      conditions: {
        operator: 'AND',
        rules: [
          { variable: 'price_eur_kwh', comparator: '<', value: 0.08 },
          { variable: 'outdoor_temp_c', comparator: '<', value: 5 }
        ]
      },
      action: { type: 'set_temperature', value: 22 }
    },
    {
      id: 'rule_peak_eco',
      name: 'Peak price off',
      enabled: 1,
      priority: 20,
      conditions: {
        operator: 'AND',
        rules: [
          { variable: 'price_eur_kwh', comparator: '>', value: 0.25 }
        ]
      },
      action: { type: 'set_mode', value: 'eco' }
    },
    {
      id: 'rule_night_comfort',
      name: 'Night comfort',
      enabled: 1,
      priority: 5,
      conditions: {
        operator: 'AND',
        rules: [
          { variable: 'hour_of_day', comparator: 'between', value: [22, 6] },
          { variable: 'price_eur_kwh', comparator: '<', value: 0.12 }
        ]
      },
      action: { type: 'set_temperature', value: 20 }
    }
  ];

  const insertMany = database.transaction((rules) => {
    for (const rule of rules) {
      insert.run(
        rule.id,
        rule.name,
        rule.enabled,
        rule.priority,
        JSON.stringify(rule.conditions),
        JSON.stringify(rule.action)
      );
    }
  });

  insertMany(defaults);
}

// --- Price queries ---

function upsertPrice(intervalStart, intervalEnd, priceEurMwh) {
  const stmt = getDb().prepare(`
    INSERT INTO energy_prices (interval_start, interval_end, price_eur_mwh, fetched_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(interval_start, interval_end)
    DO UPDATE SET price_eur_mwh = excluded.price_eur_mwh, fetched_at = excluded.fetched_at
  `);
  return stmt.run(intervalStart, intervalEnd, priceEurMwh);
}

function getPricesByDate(dateStr) {
  const stmt = getDb().prepare(`
    SELECT id, interval_start, interval_end, price_eur_mwh, fetched_at
    FROM energy_prices
    WHERE date(interval_start) = ?
    ORDER BY interval_start ASC
  `);
  return stmt.all(dateStr);
}

function getLatestPrice() {
  const stmt = getDb().prepare(`
    SELECT * FROM energy_prices
    WHERE interval_start <= datetime('now')
    AND interval_end > datetime('now')
    ORDER BY interval_start DESC
    LIMIT 1
  `);
  return stmt.get();
}

function getPricesFreshness() {
  const stmt = getDb().prepare(`
    SELECT MAX(fetched_at) as last_fetched FROM energy_prices
  `);
  return stmt.get();
}

// --- Device status queries ---

function insertDeviceStatus(status) {
  const stmt = getDb().prepare(`
    INSERT INTO device_status (timestamp, outdoor_temp, water_temp, setpoint, mode, power_w)
    VALUES (datetime('now'), ?, ?, ?, ?, ?)
  `);
  return stmt.run(
    status.outdoor_temp,
    status.water_temp,
    status.setpoint,
    status.mode,
    status.power_w
  );
}

function getLatestDeviceStatus() {
  const stmt = getDb().prepare(`
    SELECT * FROM device_status ORDER BY timestamp DESC LIMIT 1
  `);
  return stmt.get();
}

function getDeviceHistory(days = 7) {
  const stmt = getDb().prepare(`
    SELECT * FROM device_status
    WHERE timestamp >= datetime('now', ?)
    ORDER BY timestamp ASC
  `);
  return stmt.all(`-${days} days`);
}

// --- Rule queries ---

function getAllRules() {
  const stmt = getDb().prepare('SELECT * FROM automation_rules ORDER BY priority DESC');
  return stmt.all().map(parseRule);
}

function getEnabledRules() {
  const stmt = getDb().prepare('SELECT * FROM automation_rules WHERE enabled = 1 ORDER BY priority DESC');
  return stmt.all().map(parseRule);
}

function getRuleById(id) {
  const stmt = getDb().prepare('SELECT * FROM automation_rules WHERE id = ?');
  const row = stmt.get(id);
  return row ? parseRule(row) : null;
}

function upsertRule(rule) {
  const stmt = getDb().prepare(`
    INSERT INTO automation_rules (id, name, enabled, priority, conditions_json, action_json, last_triggered)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id)
    DO UPDATE SET name = excluded.name, enabled = excluded.enabled, priority = excluded.priority,
      conditions_json = excluded.conditions_json, action_json = excluded.action_json,
      last_triggered = excluded.last_triggered
  `);
  return stmt.run(
    rule.id,
    rule.name,
    rule.enabled ? 1 : 0,
    rule.priority,
    JSON.stringify(rule.conditions),
    JSON.stringify(rule.action),
    rule.last_triggered || null
  );
}

function deleteRule(id) {
  const stmt = getDb().prepare('DELETE FROM automation_rules WHERE id = ?');
  return stmt.run(id);
}

function updateRuleLastTriggered(id) {
  const stmt = getDb().prepare(`UPDATE automation_rules SET last_triggered = datetime('now') WHERE id = ?`);
  return stmt.run(id);
}

function parseRule(row) {
  return {
    ...row,
    enabled: !!row.enabled,
    conditions: JSON.parse(row.conditions_json),
    action: JSON.parse(row.action_json)
  };
}

// --- Rule log queries ---

function insertRuleLog(entry) {
  const stmt = getDb().prepare(`
    INSERT INTO rule_log (timestamp, rule_id, rule_name, triggered, action_taken, reason)
    VALUES (datetime('now'), ?, ?, ?, ?, ?)
  `);
  return stmt.run(
    entry.rule_id,
    entry.rule_name,
    entry.triggered ? 1 : 0,
    entry.action_taken || null,
    entry.reason || null
  );
}

function getRecentRuleLogs(limit = 50) {
  const stmt = getDb().prepare('SELECT * FROM rule_log ORDER BY timestamp DESC LIMIT ?');
  return stmt.all(limit);
}

module.exports = {
  getDb,
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
