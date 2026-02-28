const API_BASE = '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

// Prices
export const getPrices = (date: string, vat = false) =>
  fetchJson<PricesResponse>(`/prices?date=${date}&vat=${vat}`);

export const getCurrentPrice = (vat = false) =>
  fetchJson<PriceRecord & { fresh: boolean }>(`/prices/current?vat=${vat}`);

export const refreshPrices = () =>
  fetchJson<{ success: boolean; stored: number }>('/prices/refresh', { method: 'POST' });

// Heat pump
export const getHeatpumpStatus = () =>
  fetchJson<{ status: DeviceStatus | null; api_reachable: boolean }>('/heatpump/status');

export const getLiveHeatpumpStatus = () =>
  fetchJson<{ status: DeviceStatus | null; api_reachable: boolean }>('/heatpump/status/live');

export const setHeatpumpSetpoint = (targetTemp: number, mode: string) =>
  fetchJson<{ success: boolean }>('/heatpump/setpoint', {
    method: 'POST',
    body: JSON.stringify({ targetTemp, mode }),
  });

export const setHeatpumpMode = (mode: string) =>
  fetchJson<{ success: boolean }>('/heatpump/mode', {
    method: 'POST',
    body: JSON.stringify({ mode }),
  });

export const getHeatpumpHistory = (days = 7) =>
  fetchJson<{ days: number; records: DeviceStatus[] }>(`/heatpump/history?days=${days}`);

// Rules
export const getRules = () => fetchJson<{ rules: Rule[] }>('/rules');
export const getActiveRule = () => fetchJson<{ active: ActiveRule | null }>('/rules/active');
export const getRuleLogs = (limit = 50) => fetchJson<{ logs: RuleLog[] }>(`/rules/logs?limit=${limit}`);

export const createRule = (rule: Partial<Rule>) =>
  fetchJson<{ success: boolean; rule: Rule }>('/rules', {
    method: 'POST',
    body: JSON.stringify(rule),
  });

export const updateRule = (id: string, updates: Partial<Rule>) =>
  fetchJson<{ success: boolean; rule: Rule }>(`/rules/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });

export const deleteRule = (id: string) =>
  fetchJson<{ success: boolean }>(`/rules/${id}`, { method: 'DELETE' });

export const reorderRules = (orderedIds: string[]) =>
  fetchJson<{ success: boolean; rules: Rule[] }>('/rules/reorder', {
    method: 'POST',
    body: JSON.stringify({ orderedIds }),
  });

// System
export const getSystemStatus = () =>
  fetchJson<SystemStatus>('/status');

export const getSettings = () =>
  fetchJson<Settings>('/settings');

// Types
export interface PriceRecord {
  id: number;
  interval_start: string;
  interval_end: string;
  price_eur_mwh: number;
  price_eur_kwh: number;
  price_eur_kwh_display: number;
  percentile: number;
  fetched_at: string;
}

export interface PricesResponse {
  date: string;
  include_vat: boolean;
  vat_rate: number;
  fresh: boolean;
  count: number;
  prices: PriceRecord[];
}

export interface DeviceStatus {
  id?: number;
  timestamp?: string;
  outdoor_temp: number | null;
  water_temp: number | null;
  setpoint: number | null;
  mode: string;
  power_w: number | null;
}

export interface RuleCondition {
  variable: string;
  comparator: string;
  value: number | [number, number];
}

export interface RuleConditions {
  operator: 'AND' | 'OR';
  rules: RuleCondition[];
}

export interface RuleAction {
  type: string;
  value?: number | string;
}

export interface Rule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  conditions: RuleConditions;
  action: RuleAction;
  last_triggered: string | null;
  conditions_json?: string;
  action_json?: string;
}

export interface ActiveRule {
  id: string;
  name: string;
  action: RuleAction;
}

export interface RuleLog {
  id: number;
  timestamp: string;
  rule_id: string;
  rule_name: string;
  triggered: number;
  action_taken: string | null;
  reason: string | null;
}

export interface SystemStatus {
  prices_fresh: boolean;
  api_reachable: boolean;
  active_rule: ActiveRule | null;
  timezone: string;
}

export interface Settings {
  timezone: string;
  vat_rate: number;
  has_entsoe_key: boolean;
  has_panasonic_credentials: boolean;
}
