import { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useApi } from '../hooks/useApi';
import { getPrices, refreshPrices } from '../utils/api';
import { formatPrice, formatTime, percentileBg, getTodayStr, getTomorrowStr } from '../utils/format';

export default function Prices() {
  const [selectedDate, setSelectedDate] = useState<'today' | 'tomorrow'>('today');
  const [includeVat, setIncludeVat] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const dateStr = selectedDate === 'today' ? getTodayStr() : getTomorrowStr();
  const { data, loading, refetch } = useApi(() => getPrices(dateStr, includeVat), [dateStr, includeVat]);

  const prices = data?.prices ?? [];

  const chartData = prices.map((p) => ({
    time: formatTime(p.interval_start),
    price: p.price_eur_kwh_display,
    percentile: p.percentile,
  }));

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshPrices();
      refetch();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-slate-800">Energy Prices</h2>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-slate-300 overflow-hidden">
            <button
              onClick={() => setSelectedDate('today')}
              className={`px-4 py-2 text-sm ${selectedDate === 'today' ? 'bg-blue-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              Today
            </button>
            <button
              onClick={() => setSelectedDate('tomorrow')}
              className={`px-4 py-2 text-sm ${selectedDate === 'tomorrow' ? 'bg-blue-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              Tomorrow
            </button>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={includeVat}
              onChange={(e) => setIncludeVat(e.target.checked)}
              className="rounded"
            />
            BTW (21%)
          </label>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-3 py-2 text-sm bg-slate-700 text-white rounded-lg hover:bg-slate-600 disabled:opacity-50"
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {!data?.fresh && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
          Price data may be stale. Click "Refresh" to fetch latest prices.
        </div>
      )}

      {/* Chart */}
      <div className="bg-white rounded-lg border p-5">
        <h3 className="text-lg font-semibold text-slate-700 mb-4">Price Chart — {dateStr}</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="time" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `€${v.toFixed(2)}`} width={60} />
              <Tooltip
                formatter={(value: number) => [`€ ${value.toFixed(4)}/kWh`, 'Price']}
                labelFormatter={(label: string) => `Time: ${label}`}
              />
              <Area type="stepAfter" dataKey="price" stroke="#6366f1" fill="url(#priceGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Price Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b">
                <th className="text-left px-4 py-3 font-medium text-slate-600">Time</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">
                  Price (€/kWh) {includeVat ? 'incl. BTW' : 'excl. BTW'}
                </th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Percentile</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400">Loading...</td></tr>
              )}
              {!loading && prices.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400">
                  No price data available for {selectedDate === 'today' ? 'today' : 'tomorrow'}.
                  {selectedDate === 'tomorrow' && ' Next-day prices are typically published around 13:00.'}
                </td></tr>
              )}
              {prices.map((p) => (
                <tr key={p.id} className={`border-b hover:bg-slate-50 ${percentileBg(p.percentile)}`}>
                  <td className="px-4 py-2 text-slate-700">
                    {formatTime(p.interval_start)} – {formatTime(p.interval_end)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-slate-800">
                    € {formatPrice(p.price_eur_kwh_display)}
                  </td>
                  <td className="px-4 py-2 text-right text-slate-600">
                    {p.percentile}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
