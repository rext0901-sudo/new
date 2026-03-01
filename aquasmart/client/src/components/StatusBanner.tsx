import { usePolling } from '../hooks/useApi';
import { getSystemStatus, isDemoMode } from '../utils/api';

export default function StatusBanner() {
  const { data } = usePolling(() => getSystemStatus(), 30000);

  if (isDemoMode()) {
    return (
      <div className="bg-blue-100 border-b border-blue-300 px-4 py-2">
        <p className="text-blue-800 text-sm font-medium">
          Demo mode — Showing simulated Dutch energy prices and heat pump data. Connect ENTSO-E API and Vercel Postgres for live data.
        </p>
      </div>
    );
  }

  if (!data) return null;

  const warnings: string[] = [];
  if (!data.api_reachable) warnings.push('Panasonic API unreachable — automation disabled');
  if (!data.prices_fresh) warnings.push('Energy prices are stale (>1 hour) — price-based rules paused');

  if (warnings.length === 0) return null;

  return (
    <div className="bg-amber-100 border-b border-amber-300 px-4 py-2">
      {warnings.map((w, i) => (
        <p key={i} className="text-amber-800 text-sm font-medium">{w}</p>
      ))}
    </div>
  );
}
