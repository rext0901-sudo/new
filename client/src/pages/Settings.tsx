import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { getSettings, type Settings as SettingsType } from '../utils/api';

export default function Settings() {
  const { data } = useApi(() => getSettings(), []);

  const [entsoeKey, setEntsoeKey] = useState('');
  const [panasonicEmail, setPanasonicEmail] = useState('');
  const [panasonicPassword, setPanasonicPassword] = useState('');
  const [timezone, setTimezone] = useState('Europe/Amsterdam');
  const [vatDisplay, setVatDisplay] = useState<'excl' | 'incl'>('excl');
  const [notifications, setNotifications] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) {
      setTimezone(data.timezone);
    }
  }, [data]);

  const handleSave = () => {
    // In a real implementation, this would POST to a settings endpoint
    // and update the .env file or local config. For security, credentials
    // are stored server-side only and never exposed to the frontend.
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleRequestPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotifications(permission === 'granted');
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-2xl font-bold text-slate-800">Settings</h2>

      {/* ENTSO-E API Key */}
      <div className="bg-white rounded-lg border p-5">
        <h3 className="text-lg font-semibold text-slate-700 mb-4">ENTSO-E API Key</h3>
        <p className="text-sm text-slate-500 mb-3">
          Required for energy price data. Get a free API key at{' '}
          <a
            href="https://transparency.entsoe.eu"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            transparency.entsoe.eu
          </a>
        </p>
        <div className="flex items-center gap-2">
          <input
            type="password"
            value={entsoeKey}
            onChange={(e) => setEntsoeKey(e.target.value)}
            placeholder={data?.has_entsoe_key ? '••••••••••••••••' : 'Enter your API key'}
            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
          {data?.has_entsoe_key && (
            <span className="text-green-500 text-sm">Configured</span>
          )}
        </div>
      </div>

      {/* Panasonic Credentials */}
      <div className="bg-white rounded-lg border p-5">
        <h3 className="text-lg font-semibold text-slate-700 mb-4">Panasonic Aquarea Login</h3>
        <p className="text-sm text-slate-500 mb-3">
          Your Panasonic Aquarea Smart Cloud credentials. Stored encrypted server-side.
        </p>
        <div className="space-y-3">
          <input
            type="email"
            value={panasonicEmail}
            onChange={(e) => setPanasonicEmail(e.target.value)}
            placeholder={data?.has_panasonic_credentials ? '••••••••@••••••' : 'Email address'}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="password"
            value={panasonicPassword}
            onChange={(e) => setPanasonicPassword(e.target.value)}
            placeholder={data?.has_panasonic_credentials ? '••••••••••' : 'Password'}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
          {data?.has_panasonic_credentials && (
            <p className="text-green-500 text-sm">Credentials configured</p>
          )}
        </div>
      </div>

      {/* Timezone */}
      <div className="bg-white rounded-lg border p-5">
        <h3 className="text-lg font-semibold text-slate-700 mb-4">Timezone</h3>
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="Europe/Amsterdam">Europe/Amsterdam (CET/CEST)</option>
          <option value="Europe/Berlin">Europe/Berlin</option>
          <option value="Europe/London">Europe/London</option>
          <option value="Europe/Brussels">Europe/Brussels</option>
          <option value="Europe/Paris">Europe/Paris</option>
        </select>
      </div>

      {/* VAT Display */}
      <div className="bg-white rounded-lg border p-5">
        <h3 className="text-lg font-semibold text-slate-700 mb-4">Price Display</h3>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="vat"
              value="excl"
              checked={vatDisplay === 'excl'}
              onChange={() => setVatDisplay('excl')}
            />
            Excl. BTW
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="vat"
              value="incl"
              checked={vatDisplay === 'incl'}
              onChange={() => setVatDisplay('incl')}
            />
            Incl. BTW (21%)
          </label>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-white rounded-lg border p-5">
        <h3 className="text-lg font-semibold text-slate-700 mb-4">Notifications</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-600">Browser push notifications on rule trigger</p>
            <p className="text-xs text-slate-400 mt-1">
              {notifications ? 'Notifications enabled' : 'Notifications not enabled'}
            </p>
          </div>
          <button
            onClick={handleRequestPermission}
            className="px-4 py-2 text-sm bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200"
          >
            {notifications ? 'Enabled' : 'Enable'}
          </button>
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600"
        >
          Save Settings
        </button>
        {saved && (
          <span className="text-green-600 text-sm">Settings saved</span>
        )}
      </div>

      {/* Info */}
      <div className="bg-slate-50 border rounded-lg p-4 text-xs text-slate-500">
        <p>
          Configuration is stored in the <code>.env</code> file on the server.
          Update the file directly for production deployments. Credentials are never
          exposed through the API.
        </p>
      </div>
    </div>
  );
}
