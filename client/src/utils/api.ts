import {
  generateDemoPrices,
  getDemoCurrentPrice,
  getDemoStatus,
  demoRules,
} from './demoData';

const API_BASE = '/api';

// Track whether we're in demo mode (API unavailable)
let _demoMode = false;
export function isDemoMode() { return _demoMode; }

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  try {
    const response = await fetch(`${API_BASE}${url}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  } catch {
    _demoMode = true;
    throw new Error('API unavailable');
  }
}

// Prices (with demo fallback)
export const getPrices = async (date: string, vat = false): Promise<PricesResponse> => {
  try {
    return await fetchJson<PricesResponse>(`/prices?date=${date}&vat=${vat}`);
  } catch {
    const vatRate = 0.21;
    const prices = generateDemoPrices(date).map(p => ({
      ...p,
      price_eur_kwh_display: vat ? +(p.price_eur_kwh * (1 + vatRate)).toFixed(6) : p.price_eur_kwh,
    }));
    return { date, include_vat: vat, vat_rate: vatRate, fresh: true, count: prices.length, prices };
  }
};

export const getCurrentPrice = async (vat = false): Promise<PriceRecord & { fresh: boolean }> => {
  try {
    return await fetchJson<PriceRecord & { fresh: boolean }>(`/prices/current?vat=${vat}`);
  } catch {
    const demo = getDemoCurrentPrice();
    const vatRate = 0.21;
    return {
      ...demo,
      price_eur_kwh_display: vat ? +(demo.price_eur_kwh * (1 + vatRate)).toFixed(6) : demo.price_eur_kwh,
    } as PriceRecord & { fresh: boolean };
  }
};

export const refreshPrices = async () => {
  try {
    return await fetchJson<{ success: boolean; stored: number }>('/prices/refresh', { method: 'POST' });
  } catch {
    return { success: true, stored: 96 };
  }
};

// Heat pump (with demo fallback)
export const getHeatpumpStatus = async () => {
  try {
    return await fetchJson<{ status: DeviceStatus | null; api_reachable: boolean }>('/heatpump?action=status');
  } catch {
    return getDemoStatus();
  }
};

export const getLiveHeatpumpStatus = async () => {
  try {
    return await fetchJson<{ status: DeviceStatus | null; api_reachable: boolean }>('/heatpump?action=live');
  } catch {
    return getDemoStatus();
  }
};

export const setHeatpumpSetpoint = async (targetTemp: number, mode: string) => {
  try {
    return await fetchJson<{ success: boolean }>('/heatpump/control?type=setpoint', {
      method: 'POST',
      body: JSON.stringify({ targetTemp, mode }),
    });
  } catch {
    return { success: true };
  }
};

export const setHeatpumpMode = async (mode: string) => {
  try {
    return await fetchJson<{ success: boolean }>('/heatpump/control?type=mode', {
      method: 'POST',
      body: JSON.stringify({ mode }),
    });
  } catch {
    return { success: true };
  }
};

export const getHeatpumpHistory = async (days = 7) => {
  try {
    return await fetchJson<{ days: number; records: DeviceStatus[] }>(`/heatpump?action=history&days=${days}`);
  } catch {
    const records: DeviceStatus[] = [];
    const now = Date.now();
    for (let i = days * 24; i >= 0; i -= 4) {
      const ts = new Date(now - i * 3600000);
      const hour = ts.getHours();
      const baseTemp = hour >= 10 && hour <= 16 ? 8 : hour >= 0 && hour < 7 ? 2 : 5;
      records.push({
        timestamp: ts.toISOString(),
        outdoor_temp: +(baseTemp + Math.sin(i * 0.1) * 2).toFixed(1),
        water_temp: +(38 + Math.sin(i * 0.05) * 3).toFixed(1),
        setpoint: 20,
        mode: 'heat',
        power_w: Math.round(800 + Math.sin(i * 0.08) * 400),
      });
    }
    return { days, records };
  }
};

// Rules (with demo fallback)
export const getRules = async () => {
  try {
    return await fetchJson<{ rules: Rule[] }>('/rules');
  } catch {
    return { rules: demoRules as unknown as Rule[] };
  }
};

export const getActiveRule = async () => {
  try {
    return await fetchJson<{ active: ActiveRule | null }>('/rules/active');
  } catch {
    return { active: null };
  }
};

export const getRuleLogs = async (limit = 50) => {
  try {
    return await fetchJson<{ logs: RuleLog[] }>(`/rules/meta?action=logs&limit=${limit}`);
  } catch {
    return { logs: [] };
  }
};

export const createRule = async (rule: Partial<Rule>) => {
  try {
    return await fetchJson<{ success: boolean; rule: Rule }>('/rules', {
      method: 'POST',
      body: JSON.stringify(rule),
    });
  } catch {
    const newRule = { ...rule, id: `rule_demo_${Date.now()}` } as Rule;
    demoRules.push(newRule as typeof demoRules[0]);
    return { success: true, rule: newRule };
  }
};

export const updateRule = async (id: string, updates: Partial<Rule>) => {
  try {
    return await fetchJson<{ success: boolean; rule: Rule }>(`/rules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  } catch {
    const idx = demoRules.findIndex(r => r.id === id);
    if (idx >= 0) Object.assign(demoRules[idx], updates);
    return { success: true, rule: demoRules[idx] as unknown as Rule };
  }
};

export const deleteRule = async (id: string) => {
  try {
    return await fetchJson<{ success: boolean }>(`/rules/${id}`, { method: 'DELETE' });
  } catch {
    const idx = demoRules.findIndex(r => r.id === id);
    if (idx >= 0) demoRules.splice(idx, 1);
    return { success: true };
  }
};

export const reorderRules = async (orderedIds: string[]) => {
  try {
    return await fetchJson<{ success: boolean; rules: Rule[] }>('/rules/meta?action=reorder', {
      method: 'POST',
      body: JSON.stringify({ orderedIds }),
    });
  } catch {
    return { success: true, rules: demoRules as unknown as Rule[] };
  }
};

// System (with demo fallback)
export const getSystemStatus = async () => {
  try {
    return await fetchJson<SystemStatus>('/config?type=status');
  } catch {
    return {
      prices_fresh: true,
      api_reachable: false,
      active_rule: null,
      timezone: 'Europe/Amsterdam',
    };
  }
};

export const getSettings = async () => {
  try {
    return await fetchJson<Settings>('/config?type=settings');
  } catch {
    return {
      timezone: 'Europe/Amsterdam',
      vat_rate: 0.21,
      has_entsoe_key: false,
      has_panasonic_credentials: false,
    };
  }
};

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
