// Demo data for when the API is not available (no database configured)
// Generates realistic Dutch energy price data based on typical patterns

function getAmsterdamDate(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }));
}

function generatePriceForHour(hour: number): number {
  // Simulate typical Dutch energy price curve (€/MWh)
  // Low at night, peaks in morning (7-9) and evening (17-20)
  const basePrice = 45;
  const nightDiscount = -25;
  const morningPeak = 35;
  const eveningPeak = 50;

  let modifier = 0;
  if (hour >= 0 && hour < 6) modifier = nightDiscount + Math.random() * 10;
  else if (hour >= 6 && hour < 9) modifier = morningPeak * (1 + (Math.random() - 0.5) * 0.3);
  else if (hour >= 9 && hour < 16) modifier = Math.random() * 20 - 5;
  else if (hour >= 16 && hour < 21) modifier = eveningPeak * (1 + (Math.random() - 0.5) * 0.3);
  else modifier = Math.random() * 15 - 10;

  return Math.max(5, basePrice + modifier + (Math.random() - 0.5) * 10);
}

// Seeded random for consistent demo data within a session
let seed = Date.now();
function seededRandom(): number {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}

export function generateDemoPrices(dateStr: string) {
  seed = dateStr.split('-').reduce((a, b) => a + parseInt(b), 0) * 12345;

  const prices = [];
  for (let h = 0; h < 24; h++) {
    for (let q = 0; q < 4; q++) {
      const hour = h + q * 0.25;
      const start = new Date(`${dateStr}T${String(h).padStart(2, '0')}:${String(q * 15).padStart(2, '0')}:00+01:00`);
      const end = new Date(start.getTime() + 15 * 60000);

      const basePriceMwh = generatePriceForHour(h);
      const priceMwh = basePriceMwh + seededRandom() * 8 - 4;
      const priceKwh = priceMwh / 1000;

      prices.push({
        id: h * 4 + q + 1,
        interval_start: start.toISOString(),
        interval_end: end.toISOString(),
        price_eur_mwh: +priceMwh.toFixed(2),
        price_eur_kwh: +priceKwh.toFixed(6),
        price_eur_kwh_display: +priceKwh.toFixed(6),
        percentile: 0,
        fetched_at: new Date().toISOString(),
      });
    }
  }

  // Calculate percentiles
  const allPrices = prices.map(p => p.price_eur_kwh).sort((a, b) => a - b);
  for (const p of prices) {
    p.percentile = Math.round((allPrices.indexOf(p.price_eur_kwh) / allPrices.length) * 100);
  }

  return prices;
}

export function getDemoCurrentPrice() {
  const now = getAmsterdamDate();
  const hour = now.getHours();
  const priceMwh = generatePriceForHour(hour);
  const priceKwh = priceMwh / 1000;

  const start = new Date(now);
  start.setMinutes(Math.floor(now.getMinutes() / 15) * 15, 0, 0);
  const end = new Date(start.getTime() + 15 * 60000);

  return {
    id: 1,
    interval_start: start.toISOString(),
    interval_end: end.toISOString(),
    price_eur_mwh: +priceMwh.toFixed(2),
    price_eur_kwh: +priceKwh.toFixed(6),
    price_eur_kwh_display: +priceKwh.toFixed(6),
    percentile: 50,
    fetched_at: new Date().toISOString(),
    fresh: true,
  };
}

export function getDemoStatus() {
  const now = getAmsterdamDate();
  const hour = now.getHours();
  // Simulate outdoor temp (colder at night, warmer afternoon)
  const baseTemp = hour >= 10 && hour <= 16 ? 8 : hour >= 0 && hour < 7 ? 2 : 5;
  return {
    status: {
      outdoor_temp: +(baseTemp + Math.random() * 3 - 1).toFixed(1),
      water_temp: +(38 + Math.random() * 4).toFixed(1),
      setpoint: 20,
      mode: 'heat',
      power_w: Math.round(800 + Math.random() * 600),
      timestamp: now.toISOString(),
    },
    api_reachable: false,
  };
}

export const demoRules = [
  {
    id: 'rule_cheap_boost',
    name: 'Cheap hours boost',
    enabled: true,
    priority: 10,
    conditions: {
      operator: 'AND' as const,
      rules: [
        { variable: 'price_eur_kwh', comparator: '<', value: 0.08 },
        { variable: 'outdoor_temp_c', comparator: '<', value: 5 },
      ],
    },
    action: { type: 'set_temperature', value: 22 },
    last_triggered: null,
  },
  {
    id: 'rule_peak_eco',
    name: 'Peak price off',
    enabled: true,
    priority: 20,
    conditions: {
      operator: 'AND' as const,
      rules: [{ variable: 'price_eur_kwh', comparator: '>', value: 0.25 }],
    },
    action: { type: 'set_mode', value: 'eco' },
    last_triggered: null,
  },
  {
    id: 'rule_night_comfort',
    name: 'Night comfort',
    enabled: true,
    priority: 5,
    conditions: {
      operator: 'AND' as const,
      rules: [
        { variable: 'hour_of_day', comparator: 'between', value: [22, 6] as [number, number] },
        { variable: 'price_eur_kwh', comparator: '<', value: 0.12 },
      ],
    },
    action: { type: 'set_temperature', value: 20 },
    last_triggered: null,
  },
];
