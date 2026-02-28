import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { usePolling, useApi } from '../hooks/useApi';
import {
  getHeatpumpStatus,
  setHeatpumpSetpoint,
  setHeatpumpMode,
  getHeatpumpHistory,
  getActiveRule,
} from '../utils/api';
import { formatTemp, formatDateTime } from '../utils/format';

export default function HeatPump() {
  const { data: statusData, refetch: refetchStatus } = usePolling(() => getHeatpumpStatus(), 30000);
  const { data: activeData } = usePolling(() => getActiveRule(), 30000);
  const { data: historyData } = useApi(() => getHeatpumpHistory(7), []);

  const [targetTemp, setTargetTemp] = useState(20);
  const [selectedMode, setSelectedMode] = useState('heat');
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const status = statusData?.status;
  const apiReachable = statusData?.api_reachable ?? false;
  const activeRule = activeData?.active;

  const historyChart = (historyData?.records ?? []).map((r) => ({
    time: r.timestamp ? formatDateTime(r.timestamp) : '',
    outdoor: r.outdoor_temp,
    setpoint: r.setpoint,
  }));

  const handleSetpoint = async () => {
    setSending(true);
    setFeedback(null);
    try {
      const result = await setHeatpumpSetpoint(targetTemp, selectedMode);
      setFeedback(result.success ? 'Setpoint updated' : 'Failed to update setpoint');
      refetchStatus();
    } catch {
      setFeedback('Error sending command');
    } finally {
      setSending(false);
    }
  };

  const handleMode = async (mode: string) => {
    setSending(true);
    setFeedback(null);
    try {
      const result = await setHeatpumpMode(mode);
      setFeedback(result.success ? `Mode set to ${mode}` : 'Failed to set mode');
      refetchStatus();
    } catch {
      setFeedback('Error sending command');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">Heat Pump Control</h2>

      {!apiReachable && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          Panasonic Aquarea API is unreachable. Status data may be outdated.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Live Status */}
        <div className="bg-white rounded-lg border p-5">
          <h3 className="text-lg font-semibold text-slate-700 mb-4">Live Status</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-slate-500">Mode</p>
              <p className="text-lg font-semibold capitalize">{status?.mode ?? '—'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Setpoint</p>
              <p className="text-lg font-semibold">{formatTemp(status?.setpoint ?? null)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Outdoor Temp</p>
              <p className="text-lg font-semibold text-blue-600">{formatTemp(status?.outdoor_temp ?? null)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Water Temp</p>
              <p className="text-lg font-semibold">{formatTemp(status?.water_temp ?? null)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Power Draw</p>
              <p className="text-lg font-semibold">{status?.power_w != null ? `${status.power_w} W` : '—'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Last Updated</p>
              <p className="text-sm text-slate-600">{status?.timestamp ? formatDateTime(status.timestamp) : '—'}</p>
            </div>
          </div>
        </div>

        {/* Manual Controls */}
        <div className="bg-white rounded-lg border p-5">
          <h3 className="text-lg font-semibold text-slate-700 mb-4">Manual Control</h3>

          {activeRule && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-700">
              Automation rule "{activeRule.name}" is currently active. Manual changes may be overridden.
            </div>
          )}

          <div className="space-y-4">
            {/* Mode Selector */}
            <div>
              <label className="text-sm font-medium text-slate-600 block mb-2">Mode</label>
              <div className="flex gap-2">
                {['on', 'off', 'eco'].map((m) => (
                  <button
                    key={m}
                    onClick={() => handleMode(m)}
                    disabled={sending}
                    className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                      status?.mode === m
                        ? 'bg-blue-500 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    } disabled:opacity-50`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Temperature Slider */}
            <div>
              <label className="text-sm font-medium text-slate-600 block mb-2">
                Target Temperature: {targetTemp}°C
              </label>
              <input
                type="range"
                min={15}
                max={25}
                step={0.5}
                value={targetTemp}
                onChange={(e) => setTargetTemp(parseFloat(e.target.value))}
                className="w-full accent-blue-500"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>15°C</span>
                <span>25°C</span>
              </div>
            </div>

            {/* Heating Mode */}
            <div>
              <label className="text-sm font-medium text-slate-600 block mb-2">Heating Mode</label>
              <select
                value={selectedMode}
                onChange={(e) => setSelectedMode(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="heat">Heat</option>
                <option value="cool">Cool</option>
                <option value="auto">Auto</option>
              </select>
            </div>

            <button
              onClick={handleSetpoint}
              disabled={sending}
              className="w-full py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50"
            >
              {sending ? 'Sending...' : 'Apply Setpoint'}
            </button>

            {feedback && (
              <p className={`text-sm ${feedback.includes('Error') || feedback.includes('Failed') ? 'text-red-600' : 'text-green-600'}`}>
                {feedback}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 7-day History Chart */}
      <div className="bg-white rounded-lg border p-5">
        <h3 className="text-lg font-semibold text-slate-700 mb-4">7-Day History</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={historyChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="outdoor" name="Outdoor °C" stroke="#3b82f6" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="setpoint" name="Setpoint °C" stroke="#f59e0b" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
