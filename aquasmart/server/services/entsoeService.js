const { upsertPrice, getPricesByDate, getLatestPrice, getPricesFreshness } = require('../db/db');

const ENTSOE_BASE = 'https://web-api.tp.entsoe.eu/api';
const AREA_CODE = '10YNL----------L';
const DOCUMENT_TYPE = 'A44';

function getApiKey() {
  return process.env.ENTSOE_API_KEY;
}

function formatDate(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

async function fetchPrices(startDate, endDate) {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('[ENTSO-E] No API key configured');
    return [];
  }

  const periodStart = `${formatDate(startDate)}0000`;
  const periodEnd = `${formatDate(endDate)}0000`;

  const url = `${ENTSOE_BASE}?securityToken=${encodeURIComponent(apiKey)}` +
    `&documentType=${DOCUMENT_TYPE}` +
    `&in_Domain=${AREA_CODE}` +
    `&out_Domain=${AREA_CODE}` +
    `&periodStart=${periodStart}` +
    `&periodEnd=${periodEnd}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[ENTSO-E] HTTP ${response.status}: ${response.statusText}`);
      return [];
    }

    const xml = await response.text();
    return parseEntsoeXml(xml);
  } catch (err) {
    console.error('[ENTSO-E] Fetch error:', err.message);
    return [];
  }
}

function parseEntsoeXml(xml) {
  const prices = [];
  const xml2js = require('xml2js');

  return new Promise((resolve, reject) => {
    xml2js.parseString(xml, { explicitArray: false }, (err, result) => {
      if (err) {
        console.error('[ENTSO-E] XML parse error:', err.message);
        return resolve([]);
      }

      try {
        const doc = result.Publication_MarketDocument || result;
        let timeSeries = doc.TimeSeries;
        if (!timeSeries) return resolve([]);
        if (!Array.isArray(timeSeries)) timeSeries = [timeSeries];

        for (const ts of timeSeries) {
          let periods = ts.Period;
          if (!periods) continue;
          if (!Array.isArray(periods)) periods = [periods];

          for (const period of periods) {
            const startStr = period.timeInterval?.start;
            if (!startStr) continue;

            const resolution = period.resolution || 'PT60M';
            const minutes = resolution === 'PT15M' ? 15 : 60;

            let points = period.Point;
            if (!points) continue;
            if (!Array.isArray(points)) points = [points];

            const periodStart = new Date(startStr);

            for (const point of points) {
              const position = parseInt(point.position, 10);
              const priceAmount = parseFloat(point['price.amount']);

              if (isNaN(position) || isNaN(priceAmount)) continue;

              const intervalStart = new Date(periodStart.getTime() + (position - 1) * minutes * 60000);
              const intervalEnd = new Date(intervalStart.getTime() + minutes * 60000);

              prices.push({
                interval_start: intervalStart.toISOString(),
                interval_end: intervalEnd.toISOString(),
                price_eur_mwh: priceAmount
              });
            }
          }
        }

        resolve(prices);
      } catch (parseErr) {
        console.error('[ENTSO-E] Parse structure error:', parseErr.message);
        resolve([]);
      }
    });
  });
}

async function fetchAndStorePrices() {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);

  console.log('[ENTSO-E] Fetching prices for today and tomorrow...');

  const prices = await fetchPrices(today, dayAfter);
  let stored = 0;

  for (const p of prices) {
    upsertPrice(p.interval_start, p.interval_end, p.price_eur_mwh);
    stored++;
  }

  console.log(`[ENTSO-E] Stored ${stored} price intervals`);
  return stored;
}

function getPricesForDate(dateStr) {
  const rows = getPricesByDate(dateStr);

  const allPrices = rows.map(r => r.price_eur_mwh / 1000);
  const sorted = [...allPrices].sort((a, b) => a - b);

  return rows.map((row, idx) => {
    const priceKwh = row.price_eur_mwh / 1000;
    const percentile = sorted.length > 0
      ? (sorted.indexOf(priceKwh) / sorted.length) * 100
      : 50;

    return {
      ...row,
      price_eur_kwh: priceKwh,
      percentile: Math.round(percentile)
    };
  });
}

function getCurrentPrice() {
  const row = getLatestPrice();
  if (!row) return null;
  return {
    ...row,
    price_eur_kwh: row.price_eur_mwh / 1000
  };
}

function arePricesFresh() {
  const freshness = getPricesFreshness();
  if (!freshness || !freshness.last_fetched) return false;

  const lastFetched = new Date(freshness.last_fetched);
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  return lastFetched > oneHourAgo;
}

module.exports = {
  fetchAndStorePrices,
  getPricesForDate,
  getCurrentPrice,
  arePricesFresh
};
