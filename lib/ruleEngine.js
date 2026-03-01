const db = require('./db');
const entsoeService = require('./entsoeService');
const aquareaService = require('./aquareaService');

function getCurrentHour() {
  const now = new Date();
  const amsterdamTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }));
  return amsterdamTime.getHours();
}

function getTodayDateStr() {
  const now = new Date();
  const amsterdamTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }));
  const y = amsterdamTime.getFullYear();
  const m = String(amsterdamTime.getMonth() + 1).padStart(2, '0');
  const d = String(amsterdamTime.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function getPricePercentileToday() {
  const prices = await entsoeService.getPricesForDate(getTodayDateStr());
  const currentPrice = await entsoeService.getCurrentPrice();
  if (!currentPrice || prices.length === 0) return null;

  const allPricesKwh = prices.map(p => p.price_eur_kwh).sort((a, b) => a - b);
  const currentKwh = currentPrice.price_eur_kwh;
  const rank = allPricesKwh.filter(p => p <= currentKwh).length;
  return (rank / allPricesKwh.length) * 100;
}

function evaluateCondition(condition, context) {
  const { variable, comparator, value } = condition;
  const actual = context[variable];
  if (actual === null || actual === undefined) return false;

  switch (comparator) {
    case '>': return actual > value;
    case '<': return actual < value;
    case '>=': return actual >= value;
    case '<=': return actual <= value;
    case '==': return actual === value;
    case 'between': {
      if (!Array.isArray(value) || value.length !== 2) return false;
      const [low, high] = value;
      if (variable === 'hour_of_day' && low > high) {
        return actual >= low || actual <= high;
      }
      return actual >= low && actual <= high;
    }
    default: return false;
  }
}

function evaluateConditions(conditions, context) {
  const { operator, rules } = conditions;
  if (!rules || rules.length === 0) return false;

  if (operator === 'AND') return rules.every(rule => evaluateCondition(rule, context));
  if (operator === 'OR') return rules.some(rule => evaluateCondition(rule, context));
  return false;
}

async function executeAction(action) {
  let result;
  switch (action.type) {
    case 'set_temperature':
      result = await aquareaService.setTemperature(action.value);
      break;
    case 'set_mode':
      result = await aquareaService.setMode(action.value);
      break;
    case 'boost':
      result = await aquareaService.setTemperature(action.value || 24, 'heat');
      break;
    case 'off':
      result = await aquareaService.setMode('off');
      break;
    default:
      return { executed: false, reason: `Unknown action type: ${action.type}` };
  }
  return { executed: result.success, result };
}

async function evaluateRules() {
  await db.ensureDb();

  const pricesFresh = await entsoeService.arePricesFresh();
  const rules = await db.getEnabledRules();
  const currentPrice = await entsoeService.getCurrentPrice();
  const deviceStatus = await aquareaService.getStatus();

  const context = {
    price_eur_kwh: currentPrice?.price_eur_kwh ?? null,
    outdoor_temp_c: deviceStatus?.outdoor_temp ?? null,
    hour_of_day: getCurrentHour(),
    price_percentile_today: await getPricePercentileToday()
  };

  for (const rule of rules) {
    const usesPriceVar = rule.conditions.rules?.some(r =>
      r.variable === 'price_eur_kwh' || r.variable === 'price_percentile_today'
    );
    if (usesPriceVar && !pricesFresh) {
      await db.insertRuleLog({
        rule_id: rule.id,
        rule_name: rule.name,
        triggered: false,
        reason: 'Prices stale — rule skipped'
      });
      continue;
    }

    const matches = evaluateConditions(rule.conditions, context);

    if (matches) {
      await db.insertRuleLog({
        rule_id: rule.id,
        rule_name: rule.name,
        triggered: true,
        action_taken: JSON.stringify(rule.action),
        reason: `Conditions met: ${JSON.stringify(context)}`
      });

      const execResult = await executeAction(rule.action);
      await db.updateRuleLastTriggered(rule.id);

      return {
        evaluated: rules.length,
        triggered: rule.name,
        rule_id: rule.id,
        action: rule.action,
        executed: execResult.executed,
        reason: execResult.reason || 'OK'
      };
    } else {
      await db.insertRuleLog({
        rule_id: rule.id,
        rule_name: rule.name,
        triggered: false,
        reason: 'Conditions not met'
      });
    }
  }

  return { evaluated: rules.length, triggered: null, reason: 'No rules matched' };
}

async function getActiveRule() {
  await db.ensureDb();
  const rules = await db.getEnabledRules();
  const currentPrice = await entsoeService.getCurrentPrice();
  const deviceStatus = await aquareaService.getStatus();

  const context = {
    price_eur_kwh: currentPrice?.price_eur_kwh ?? null,
    outdoor_temp_c: deviceStatus?.outdoor_temp ?? null,
    hour_of_day: getCurrentHour(),
    price_percentile_today: await getPricePercentileToday()
  };

  for (const rule of rules) {
    if (evaluateConditions(rule.conditions, context)) {
      return { id: rule.id, name: rule.name, action: rule.action };
    }
  }

  return null;
}

module.exports = {
  evaluateRules,
  getActiveRule,
  evaluateCondition,
  evaluateConditions
};
