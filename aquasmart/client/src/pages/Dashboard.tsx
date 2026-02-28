import { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { usePolling } from '../hooks/useApi';
import { getCurrentPrice, getHeatpumpStatus, getPrices, getActiveRule } from '../utils/api';
import { formatEurKwh, formatTemp, formatTime, priceColor, priceBgColor, getTodayStr } from '../utils/format';

export default function Dashboard() {
  const [includeVat, setIncludeVat] = useState(false);

  const { data: priceData } = usePolling(() => getCurrentPrice(includeVat), 60000, [includeVat]);
  const { data: statusData } = usePolling(() => getHeatpumpStatus(), 60000);
  const { data: pricesData } = usePolling(() => getPrices(getTodayStr(), includeVat), 60000, [includeVat]);
  const { data: activeData } = usePolling(() => getActiveRule(), 60000);

  const currentPrice = priceData?.price_eur_kwh_display ?? priceData?.price_eur_kwh;
  const status = statusData?.status;
  const activeRule = activeData?.active;

  const chartData = pricesData?.prices.map((p) => ({
    time: formatTime(p.interval_start),
    price: p.price_eur_kwh_display,
    timestamp: new Date(p.interval_start).getTime(),
  })) ?? [];

  const nowTime = formatTime(new Date().toISOString());

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">Dashboard</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Current Price */}
        <div className={`rounded-lg border-2 p-5 ${currentPrice !== undefined && currentPrice !== null ? priceBgColor(currentPrice) : 'bg-gray-100 border-gray-300'}`}>
          <p className="text-sm text-slate-500 mb-1">Current Energy Price</p>
          <p className={`text-3xl font-bold ${currentPrice !== undefined && currentPrice !== null ? priceColor(currentPrice) : 'text-gray-400'}`}>
            {currentPrice !== undefined && currentPrice !== null ? formatEurKwh(currentPrice) : '— €/kWh'}
          </p>
          <label className="flex items-center gap-2 mt-2 text-xs text-slate-500">
            <input
              type="checkbox"
              checked={includeVat}
              onChange={(e) => setIncludeVat(e.target.checked)}
              className="rounded"
            />
            Include BTW (21%)
          </label>
          {priceData && !priceData.fresh && (
            <p className="text-xs text-amber-600 mt-1">Price data may be stale</p>
          )}
        </div>

        {/* Outdoor Temperature */}
        <div className="rounded-lg border bg-white p-5">
          <p className="text-sm text-slate-500 mb-1">Outdoor Temperature</p>
          <p className="text-3xl font-bold text-blue-600">
            {formatTemp(status?.outdoor_temp ?? null)}
          </p>
          {!statusData?.api_reachable && (
            <p className="text-xs text-red-500 mt-1">API unreachable</p>
          )}
        </div>

        {/* Heat Pump Status */}
        <div className="rounded-lg border bg-white p-5">
          <p className="text-sm text-slate-500 mb-1">Heat Pump</p>
          <p className="text-lg font-semibold text-slate-800 capitalize">
            {status?.mode ?? '—'}
          </p>
          <p className="text-sm text-slate-500">
            Setpoint: {formatTemp(status?.setpoint ?? null)}
          </p>
          <p className="text-sm text-slate-500">
            Power: {status?.power_w != null ? `${status.power_w} W` : '—'}
          </p>
        </div>

        {/* Active Automation */}
        <div className={`rounded-lg border p-5 ${activeRule ? 'bg-blue-50 border-blue-200' : 'bg-white'}`}>
          <p className="text-sm text-slate-500 mb-1">Active Automation</p>
          {activeRule ? (
            <>
              <p className="text-lg font-semibold text-blue-700">{activeRule.name}</p>
              <p className="text-sm text-slate-500">
                Action: {activeRule.action.type} {activeRule.action.value ?? ''}
              </p>
            </>
          ) : (
            <p className="text-lg text-slate-400">No active rule</p>
          )}
        </div>
      </div>

      {/* 24-hour Price Chart */}
      <div className="bg-white rounded-lg border p-5">
        <h3 className="text-lg font-semibold text-slate-700 mb-4">24-Hour Energy Prices</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="time" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v: number) => `€${v.toFixed(2)}`}
                width={60}
              />
              <Tooltip
                formatter={(value: number) => [`€ ${value.toFixed(4)}/kWh`, 'Price']}
                labelFormatter={(label: string) => `Time: ${label}`}
              />
              <ReferenceLine x={nowTime} stroke="#ef4444" strokeDasharray="5 5" label={{ value: 'Now', fill: '#ef4444', fontSize: 11 }} />
              {/* Green zone < 0.10 */}
              <ReferenceLine y={0.10} stroke="#22c55e" strokeDasharray="3 3" strokeOpacity={0.5} />
              {/* Red zone > 0.20 */}
              <ReferenceLine y={0.20} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} />
              <Area type="stepAfter" dataKey="price" stroke="#3b82f6" fill="url(#priceGradient)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
