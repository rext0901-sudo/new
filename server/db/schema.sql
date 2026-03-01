CREATE TABLE IF NOT EXISTS energy_prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  interval_start TEXT NOT NULL,
  interval_end TEXT NOT NULL,
  price_eur_mwh REAL NOT NULL,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(interval_start, interval_end)
);

CREATE INDEX IF NOT EXISTS idx_prices_interval ON energy_prices(interval_start, interval_end);

CREATE TABLE IF NOT EXISTS device_status (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  outdoor_temp REAL,
  water_temp REAL,
  setpoint REAL,
  mode TEXT,
  power_w REAL
);

CREATE INDEX IF NOT EXISTS idx_device_timestamp ON device_status(timestamp);

CREATE TABLE IF NOT EXISTS automation_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 0,
  conditions_json TEXT NOT NULL,
  action_json TEXT NOT NULL,
  last_triggered TEXT
);

CREATE TABLE IF NOT EXISTS rule_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  rule_id TEXT NOT NULL,
  rule_name TEXT NOT NULL,
  triggered INTEGER NOT NULL,
  action_taken TEXT,
  reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_rule_log_timestamp ON rule_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_rule_log_rule_id ON rule_log(rule_id);
