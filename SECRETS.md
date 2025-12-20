# Cloudflare Worker Secrets Configuration

This document lists all secrets required by the Flight Planner Cloudflare Worker.

## ⚠️ SECURITY NOTICE

**NEVER** commit API keys or secrets to version control.

All secrets must be set using `wrangler secret put` command.

## Required Secrets

### `ADMIN_PASSWORD`
**Required**: Yes  
**Description**: Password for the admin panel authentication  
**Usage**: Basic auth for `/admin/*` routes

```bash
cd worker
wrangler secret put ADMIN_PASSWORD
# Enter your secure admin password when prompted
```

---

### `ICAO_API_KEY`
**Required**: For airport/runway data features  
**Description**: API key for ICAO Data Services  
**Obtain from**: https://applications.icao.int/dataservices  
**Usage**: Proxied through `/api/icao/*` routes

```bash
cd worker
wrangler secret put ICAO_API_KEY
# Enter your ICAO API key when prompted
```

---

### `OPENAIP_CLIENT_ID`
**Required**: For airspace data features  
**Description**: Client ID for OpenAIP API  
**Obtain from**: https://www.openaip.net/  
**Usage**: Proxied through `/api/openaip/*` routes

```bash
cd worker
wrangler secret put OPENAIP_CLIENT_ID
# Enter your OpenAIP client ID when prompted
```

---

### `WEATHER_API_KEY`
**Required**: Optional (free AWC data available)  
**Description**: API key for premium weather service (metar-taf.com)  
**Obtain from**: https://metar-taf.com/api  
**Usage**: Proxied through `/api/weather/*` routes  
**Note**: The app uses free AviationWeather.gov data via `/api/awc/*` by default

```bash
cd worker
wrangler secret put WEATHER_API_KEY
# Enter your weather API key when prompted
```

---

### `API_SECRET_KEY`
**Required**: Optional  
**Description**: Secret key for internal API authentication  
**Usage**: Used for generating/validating internal API tokens

```bash
cd worker
wrangler secret put API_SECRET_KEY
# Enter a secure random string when prompted
```

---

### `AIRPORTDB_API_KEY`
**Required**: For airport database features  
**Description**: API key for AirportDB  
**Obtain from**: https://airportdb.io  
**Usage**: Proxied through `/api/airportdb/*` routes

```bash
cd worker
wrangler secret put AIRPORTDB_API_KEY
# Enter your AirportDB API key when prompted
```

---

### `AVIATIONSTACK_API_KEY`
**Required**: For flight/airport data  
**Description**: API key for AviationStack  
**Obtain from**: https://aviationstack.com  
**Usage**: Proxied through `/api/aviationstack/*` routes

```bash
cd worker
wrangler secret put AVIATIONSTACK_API_KEY
# Enter your AviationStack API key when prompted
```

---

### `AIRPORTGAP_API_KEY`
**Required**: For airport distance calculations  
**Description**: API token for AirportGap  
**Obtain from**: https://airportgap.com  
**Usage**: Proxied through `/api/airportgap/*` routes

```bash
cd worker
wrangler secret put AIRPORTGAP_API_KEY
# Enter your AirportGap API token when prompted
```

---

## Verification

After setting secrets, verify they are configured:

```bash
cd worker
wrangler secret list
```

Expected output:
```
🌀  Fetching secrets for script "flight-planner-worker"
┌──────────────────┐
│ Name             │
├──────────────────┤
│ ADMIN_PASSWORD   │
│ ICAO_API_KEY     │
│ OPENAIP_CLIENT_ID│
│ WEATHER_API_KEY  │
└──────────────────┘
```

## API Proxy Architecture

```
┌─────────────────┐     ┌──────────────────────┐     ┌──────────────────┐
│   Frontend      │────▶│  Cloudflare Worker   │────▶│  External API    │
│  (No API Keys)  │     │  (Injects API Keys)  │     │  (ICAO, OpenAIP) │
└─────────────────┘     └──────────────────────┘     └──────────────────┘
                              │
                              │ env.ICAO_API_KEY
                              │ env.OPENAIP_CLIENT_ID
                              ▼
                        ┌──────────────┐
                        │   Secrets    │
                        │   (Wrangler) │
                        └──────────────┘
```

## Local Development

For local development, create a `.dev.vars` file (gitignored):

```bash
# .dev.vars (DO NOT COMMIT)
ADMIN_PASSWORD=dev_password_123
ICAO_API_KEY=your_icao_key
OPENAIP_CLIENT_ID=your_openaip_id
```

Then run the worker locally:

```bash
cd worker
wrangler dev
```

## Rotating Secrets

To update a secret:

```bash
wrangler secret put ICAO_API_KEY
# Enter new key when prompted
```

The change takes effect immediately for new requests.
