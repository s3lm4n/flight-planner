# Flight Planner Pro

A **production-ready**, professional flight planning and simulation system built with React, TypeScript, React Three Fiber, and GSAP.

## 🎯 Features

### Flight Planning (Dispatcher Mode)
- **Airport Management**: Upload CSV with airport data (ICAO, coordinates, elevation)
- **Weather Integration**: Live METAR/TAF from aviationweather.gov via Cloudflare Worker
- **Aircraft Database**: B738, A320, A321, B772, A333 with realistic performance data
- **Professional Dispatch Logic**:
  - Fuel planning (taxi, trip, contingency, alternate, holding, reserve)
  - Weight & balance validation (MTOW, MLW, MZFW)
  - RTOW calculations (runway, climb, temperature limited)
  - Wind component analysis (headwind, crosswind, tailwind)
  - Runway suitability checks
  - **Clear GO / NO-GO / CONDITIONAL decisions**

### Flight Simulation (3D)
- **React Three Fiber** for 3D visualization
- **GSAP Timeline** animation (no freezing, no blocking loops)
- Aircraft model with realistic phases:
  - Pushback → Taxi → Lineup → Takeoff → Climb → Cruise → Descent → Approach → Landing → Taxi
- Camera modes: Orbit and Follow
- Flight path visualization (great circle routing)

### Data Sources
- **METAR/TAF**: aviationweather.gov (via Cloudflare Worker)
- **Airport Data**: User-uploaded CSV (ICAO + coordinates are authoritative)
- **Runway Data**: openAIP API (via Cloudflare Worker)

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Cloudflare account (for Worker deployment)
- openAIP API key (get one at [openaip.net](https://www.openaip.net))

### 1. Clone and Install

```bash
cd flight-planner
npm install
```

### 2. Set Up Cloudflare Worker

```bash
# Install Wrangler CLI globally
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Navigate to worker directory
cd worker

# Add your openAIP API key as a secret
wrangler secret put OPENAIP_KEY
# Enter your key when prompted

# Deploy the worker
wrangler deploy

# Note the worker URL (e.g., https://flight-planner-api.your-subdomain.workers.dev)
```

### 3. Configure Frontend

```bash
# Back to project root
cd ..

# Copy environment template
cp .env.example .env

# Edit .env and set your worker URL
# VITE_WORKER_URL=https://flight-planner-api.your-subdomain.workers.dev
```

### 4. Run Development Server

```bash
npm run dev
```

Open http://localhost:3000/flight-planner/

### 5. Build for Production

```bash
npm run build
```

The build output will be in the `dist/` directory.

---

## 📦 Deployment

### GitHub Pages

1. Build the project:
   ```bash
   npm run build
   ```

2. The `dist/` folder is ready for deployment.

3. In your GitHub repository settings:
   - Go to Pages
   - Set source to "GitHub Actions" or deploy from the `dist/` folder

4. If using a custom domain, update `vite.config.ts`:
   ```ts
   base: '/'  // instead of '/flight-planner/'
   ```

### Cloudflare Pages

1. Connect your GitHub repository to Cloudflare Pages
2. Build settings:
   - Build command: `npm run build`
   - Build output directory: `dist`
3. Set environment variable: `VITE_WORKER_URL`

---

## 🔧 Architecture

```
flight-planner/
├── src/
│   ├── api/
│   │   └── aviationClient.ts      # API client for Cloudflare Worker
│   ├── components/
│   │   ├── 3D/
│   │   │   └── FlightScene.tsx    # React Three Fiber 3D scene
│   │   └── FlightPlannerApp.tsx   # Main application component
│   ├── services/
│   │   ├── airports/
│   │   │   └── airportParser.ts   # CSV parser & airport database
│   │   ├── dispatcher/
│   │   │   └── dispatcherService.ts # Dispatcher logic & fuel planning
│   │   └── route/
│   │       └── routeCalculator.ts  # Great circle route generation
│   └── simulation/
│       └── GSAPSimulation.ts       # GSAP-based flight animation
├── worker/
│   ├── index.js                   # Cloudflare Worker
│   └── wrangler.toml              # Worker configuration
└── ...
```

---

## 📋 CSV Airport Format

Upload a CSV file with the following columns:

| Column | Required | Description |
|--------|----------|-------------|
| `icao` or `ident` | ✅ | 4-letter ICAO code |
| `latitude` or `lat` | ✅ | Decimal degrees |
| `longitude` or `lon` | ✅ | Decimal degrees |
| `elevation` | ❌ | Feet MSL (default: 0) |
| `name` | ❌ | Airport name (display only) |
| `iata` | ❌ | 3-letter IATA code |
| `city` | ❌ | City name |
| `country` | ❌ | Country code |
| `type` | ❌ | Airport type |

**Important**: ICAO + coordinates are the only trusted fields. Names may have encoding issues and are for display only.

Example:
```csv
icao,latitude,longitude,elevation,name
KJFK,40.6413,-73.7781,13,John F Kennedy International
EGLL,51.4700,-0.4543,83,London Heathrow
LTAC,40.1281,32.9951,3125,Ankara Esenboga
```

---

## 🔐 Security

### API Keys

**NEVER** put API keys in the frontend code or `.env` files that get committed.

All API keys are stored as Cloudflare Worker secrets:

```bash
wrangler secret put OPENAIP_KEY
```

The Worker proxies all requests, so:
- ✅ Frontend calls Worker → Worker calls APIs with secrets
- ❌ Frontend never calls external APIs directly
- ❌ API keys are never exposed in browser

---

## 🎮 Usage

1. **Upload Airports**: Click "Choose File" and select your airport CSV
2. **Select Departure**: Enter ICAO code (e.g., LTAC)
3. **Select Arrival**: Enter ICAO code (e.g., LTBA)
4. **Select Aircraft**: Choose from the dropdown (B738, A320, etc.)
5. **View Decision**: See GO / NO-GO with full dispatcher analysis
6. **Start Simulation**: Click Play to watch the 3D flight

### Keyboard Shortcuts

- **Scroll**: Zoom camera (orbit mode)
- **Drag**: Rotate camera (orbit mode)
- **Right-click drag**: Pan camera (orbit mode)

---

## 📊 Dispatcher Logic

### Fuel Components (JAR-OPS compliant)

| Fuel Type | Calculation |
|-----------|-------------|
| Taxi | 10 min @ taxi fuel burn |
| Trip | Climb + cruise + descent |
| Contingency | 5% of trip fuel |
| Alternate | Fuel to fly 100nm |
| Holding | 30 min @ holding burn |
| Final Reserve | 30 min @ cruise burn |
| Extra | 10% buffer (discretionary) |

### GO/NO-GO Criteria

**NO-GO if any of these fail:**
- Distance > Aircraft max range
- TOW > RTOW (runway/climb limited)
- Block fuel > Tank capacity
- ZFW > MZFW
- LDW > MLW
- Crosswind > Aircraft limit
- Tailwind > Aircraft limit
- Weather category LIFR at either airport
- No suitable runway available

---

## 🛠️ Development

### Local Worker Development

```bash
cd worker
wrangler dev
```

This runs the worker locally at http://localhost:8787

### Type Checking

```bash
npm run lint
npx tsc --noEmit
```

### Adding Aircraft

Edit `src/services/dispatcher/dispatcherService.ts` and add to `AIRCRAFT_DATABASE`.

---

## 📄 License

MIT License - See LICENSE file for details.

---

## 🙏 Credits

- Weather data: [aviationweather.gov](https://aviationweather.gov)
- Airport/runway data: [openAIP](https://www.openaip.net)
- 3D rendering: [React Three Fiber](https://docs.pmnd.rs/react-three-fiber)
- Animation: [GSAP](https://greensock.com/gsap/)
