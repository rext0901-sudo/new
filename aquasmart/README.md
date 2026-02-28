# AquaSmart — Smart Energy Management for Panasonic Aquarea Heat Pumps

AquaSmart optimizes your Panasonic Aquarea heat pump operation based on real-time Dutch wholesale energy prices (ENTSO-E/Nordpool) and outdoor temperature. It automatically adjusts heating behavior to minimize energy costs while maintaining comfort.

## Features

- **Real-time energy prices** from ENTSO-E Transparency Platform (day-ahead, 15-min intervals)
- **Panasonic Aquarea integration** for monitoring and controlling your heat pump
- **Automation rule engine** with customizable conditions based on price, temperature, and time
- **Dashboard** with live price, temperature, and heat pump status
- **Mobile-responsive** UI built with React + Tailwind CSS

## Prerequisites

- Node.js 18 or later
- A free ENTSO-E API key
- Panasonic Aquarea Smart Cloud account

## Setup

### 1. Get an ENTSO-E API Key

1. Go to [transparency.entsoe.eu](https://transparency.entsoe.eu)
2. Register for a free account
3. After email verification, log in and go to "My Account Settings"
4. Request an API key (under "Web API Security Token")
5. The key is typically issued within minutes

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and fill in your credentials:

```
ENTSOE_API_KEY=your-api-key-here
PANASONIC_EMAIL=your@email.com
PANASONIC_PASSWORD=your-password
```

### 3. Install Dependencies

```bash
# Backend
cd server
npm install

# Frontend
cd ../client
npm install
```

### 4. Start Development

```bash
# Terminal 1 — Backend (port 3000)
cd server
npm run dev

# Terminal 2 — Frontend (port 5173, proxies API to backend)
cd client
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### 5. Production Build

```bash
cd client
npm run build
cd ../server
npm start
```

The server serves the built frontend from `client/dist/` on port 3000.

## Project Structure

```
aquasmart/
  client/              → React frontend (Vite + TypeScript + Tailwind)
    src/
      components/      → Sidebar, StatusBanner
      pages/           → Dashboard, Prices, HeatPump, Rules, Settings
      hooks/           → useApi, usePolling
      utils/           → api.ts (API client), format.ts (Dutch formatting)
  server/              → Express backend
    routes/            → prices.js, heatpump.js, rules.js
    services/          → entsoeService.js, aquareaService.js, ruleEngine.js
    db/                → schema.sql, db.js (SQLite via better-sqlite3)
  .env.example
```

## Default Automation Rules

AquaSmart comes with three starter rules:

1. **Cheap hours boost** — When price < €0,08/kWh AND outdoor temp < 5°C → heat to 22°C
2. **Peak price off** — When price > €0,25/kWh → switch to eco mode
3. **Night comfort** — When hour is 22:00–06:00 AND price < €0,12/kWh → heat to 20°C

Rules are evaluated every 15 minutes, aligned to quarter-hour boundaries.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/prices?date=YYYY-MM-DD&vat=true` | Energy prices for a date |
| GET | `/api/prices/current` | Current interval price |
| POST | `/api/prices/refresh` | Manually fetch latest prices |
| GET | `/api/heatpump/status` | Last known heat pump status |
| GET | `/api/heatpump/status/live` | Fetch fresh status from Panasonic |
| POST | `/api/heatpump/setpoint` | Set temperature and mode |
| POST | `/api/heatpump/mode` | Set operating mode |
| GET | `/api/heatpump/history?days=7` | Historical device data |
| GET | `/api/rules` | List all automation rules |
| POST | `/api/rules` | Create a new rule |
| PUT | `/api/rules/:id` | Update a rule |
| DELETE | `/api/rules/:id` | Delete a rule |
| POST | `/api/rules/reorder` | Reorder rule priorities |
| GET | `/api/status` | System status overview |

## Notes

- All times are displayed in Europe/Amsterdam timezone
- Prices use Dutch locale formatting (comma as decimal separator)
- The SQLite database is created automatically at `server/aquasmart.db`
- Credentials are never exposed through API responses or frontend logs
- Rule evaluation is idempotent — the same command is not re-sent if the heat pump is already in the target state
