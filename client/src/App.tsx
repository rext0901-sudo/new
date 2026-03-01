import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import StatusBanner from './components/StatusBanner';
import Dashboard from './pages/Dashboard';
import Prices from './pages/Prices';
import HeatPump from './pages/HeatPump';
import Rules from './pages/Rules';
import Settings from './pages/Settings';

export default function App() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <StatusBanner />
        <main className="flex-1 p-6 overflow-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/prices" element={<Prices />} />
            <Route path="/heatpump" element={<HeatPump />} />
            <Route path="/rules" element={<Rules />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
