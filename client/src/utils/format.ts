// Dutch locale number formatting (comma as decimal separator)
export function formatPrice(price: number, digits = 4): string {
  return price.toLocaleString('nl-NL', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatEurKwh(price: number): string {
  return `€ ${formatPrice(price)}/kWh`;
}

export function formatTemp(temp: number | null): string {
  if (temp === null) return '—';
  return `${temp.toLocaleString('nl-NL', { maximumFractionDigits: 1 })}°C`;
}

export function formatTime(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleTimeString('nl-NL', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Amsterdam',
  });
}

export function formatDateTime(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleString('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Amsterdam',
  });
}

export function getTodayStr(): string {
  const d = new Date();
  return d.toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' }); // YYYY-MM-DD
}

export function getTomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' });
}

export function priceColor(priceKwh: number): string {
  if (priceKwh < 0.10) return 'text-green-600';
  if (priceKwh <= 0.20) return 'text-amber-500';
  return 'text-red-600';
}

export function priceBgColor(priceKwh: number): string {
  if (priceKwh < 0.10) return 'bg-green-100 border-green-300';
  if (priceKwh <= 0.20) return 'bg-amber-50 border-amber-300';
  return 'bg-red-100 border-red-300';
}

export function percentileBg(percentile: number): string {
  if (percentile <= 25) return 'bg-green-100';
  if (percentile >= 75) return 'bg-red-100';
  return '';
}

export function ruleToPlainEnglish(
  conditions: { operator: string; rules: Array<{ variable: string; comparator: string; value: number | [number, number] }> },
  action: { type: string; value?: number | string }
): string {
  const varNames: Record<string, string> = {
    price_eur_kwh: 'price',
    outdoor_temp_c: 'outdoor temperature',
    hour_of_day: 'hour of day',
    price_percentile_today: 'price percentile',
  };

  const condTexts = conditions.rules.map((r) => {
    const name = varNames[r.variable] || r.variable;
    if (r.comparator === 'between' && Array.isArray(r.value)) {
      return `${name} is between ${r.value[0]} and ${r.value[1]}`;
    }
    const unit = r.variable === 'price_eur_kwh' ? ' €/kWh'
      : r.variable === 'outdoor_temp_c' ? '°C'
      : r.variable === 'price_percentile_today' ? '%'
      : '';
    return `${name} ${r.comparator} ${r.value}${unit}`;
  });

  const condStr = condTexts.join(` ${conditions.operator} `);

  const actionNames: Record<string, string> = {
    set_temperature: 'Set heating to',
    set_mode: 'Set mode to',
    boost: 'Boost to',
    off: 'Turn off',
  };
  const actionStr = action.type === 'off'
    ? 'Turn off'
    : `${actionNames[action.type] || action.type} ${action.value ?? ''}`;

  return `When ${condStr} → ${actionStr}`;
}
