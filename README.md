# SENTINEL OS v7.0

## Global Multi-Domain Situational Awareness Platform

Production-grade, free-source-first situational awareness system aggregating **20+ live OSINT data sources** across aviation, maritime, orbital, seismic, wildfire, weather, conflict, disaster, cyber, nuclear, GNSS jamming, social media, and satellite imagery intelligence domains.

**Architecture**: Edge BFF (Backend-for-Frontend) on Cloudflare Pages. All keyed API calls route through server-side proxy -- the browser never sees secrets. Every record conforms to a canonical event schema with provenance, confidence metadata, and raw payload hashing for data lineage.

## URLs

- **GitHub**: https://github.com/MSA-83/SENTINEL-X
- **Cloudflare**: Deployed to Cloudflare Pages as `sentinel-os`

## Architecture

```
Browser (sentinel.js)
  |
  |--- Direct free APIs (USGS, ISS, CelesTrak TLE)
  |--- /api/proxy  --> Hono BFF --> Upstream keyed APIs
  |--- /api/cyber/* --> CISA KEV, OTX, URLhaus, ThreatFox
  |--- /api/gnss/*  --> Curated GNSS zones + GDELT enrichment
  |--- /api/social/* --> Reddit public JSON + Mastodon public timelines
  |--- /api/intel/*  --> GDELT article geocoding
  |--- /api/fusion/* --> Threat zones, viewport queries
  |--- /api/avwx/*  --> METAR weather (canonical events)
  |
  Leaflet map + SVG markers + MarkerCluster
  Inspector panel + Threat board + Search + Time scrubber
  Satellite imagery (NASA GIBS + Sentinel-2)
```

### Key Design Decisions

- **Edge BFF pattern**: All keyed API calls go through `/api/proxy` -- secrets are injected server-side
- **Canonical event schema**: Every entity has `id`, `entity_type`, `source`, `confidence`, `severity`, `provenance`, `raw_payload_hash`, etc.
- **Data lineage**: `raw_payload_hash` (SHA-256 or DJB2) tracks upstream data provenance
- **Provenance tracking**: `direct-api` (real coordinates, 80-98%), `geocoded-inferred` (text-matched, 15-35%), `curated-reference` (expert-maintained)
- **Graceful degradation**: Each upstream failure returns a structured error object; UI shows source health
- **Free-first**: All critical layers work without API keys; optional keys unlock additional sources
- **No frontend secrets**: The browser never receives, stores, or transmits any API key

## Data Model

### Canonical Event Schema

Every record reaching the client conforms to this shape:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (prefixed by source) |
| `entity_type` | string | e.g. `aircraft`, `seismic`, `cyber_vulnerability`, `gnss_jamming`, `metar` |
| `source` | string | Data provider name |
| `source_url` | string | Link to upstream source |
| `title` | string | Display name |
| `description` | string | Detail text |
| `lat`, `lon` | number/null | WGS84 coordinates |
| `altitude` | number/null | Feet (aircraft) or km (satellites) |
| `velocity` | number/null | Knots (aircraft) or km/s (orbital) |
| `heading` | number/null | Degrees |
| `timestamp` | ISO string | Event time |
| `observed_at` | ISO string | When SENTINEL observed it |
| `confidence` | 0-100 | Data confidence (30 = text-inferred, 95 = direct API) |
| `severity` | string | `critical`, `high`, `medium`, `low`, `info` |
| `risk_score` | 0-100 | Computed threat score |
| `region` | string | Geographic region |
| `tags` | string[] | Categorization tags |
| `correlations` | string[] | Related entity IDs |
| `metadata` | object | Source-specific fields |
| `raw_payload_hash` | string | SHA-256/DJB2 of upstream data for lineage tracking |
| `provenance` | string | `direct-api`, `geocoded-inferred`, `curated-reference`, `no-location` |

## Live Data Layers

### Free (No API Key Required)

| Layer | Source | Endpoint | Update |
|-------|--------|----------|--------|
| Seismic | USGS Earthquake API | Direct fetch | Real-time |
| ISS Position | wheretheiss.at | Direct fetch | 5s interval |
| CelesTrak TLE | celestrak.org SGP4 | Direct fetch | 3 min |
| GNSS Anomalies | Curated reference model | `/api/gnss/anomalies` | Daily |
| CISA KEV | CISA Known Exploited Vulns | `/api/cyber/cisa-kev` | Daily |
| URLhaus | abuse.ch malware URLs | `/api/cyber/urlhaus` | Hourly |
| ThreatFox | abuse.ch IOC feed | `/api/cyber/threatfox` | 3-day window |
| GDELT Conflict | GDELT 2.0 Article API | `/api/intel/gdelt` | 48h window |
| GDACS Disasters | GDACS API | via `/api/proxy` | Real-time |
| ReliefWeb | UN OCHA disaster data | `/api/reliefweb/disasters` | Daily |
| Social (Reddit) | Reddit public JSON | `/api/social/reddit` | 60s |
| Social (Mastodon) | Mastodon public timeline | `/api/social/mastodon` | 60s |
| Satellite Imagery | NASA GIBS + EOX Sentinel-2 | Client-side tiles | Daily/Annual |

### Requires Free API Key

| Layer | Source | Key | Registration URL |
|-------|--------|-----|------------------|
| Aircraft (ADS-B) | OpenSky Network | None (free tier) | https://opensky-network.org/index.php/register |
| Wildfires | NASA FIRMS | `NASA_FIRMS_KEY` | https://firms.modaps.eosdis.nasa.gov/api/ — Request MAP_KEY |
| Weather | OpenWeatherMap | `OWM_KEY` | https://openweathermap.org/appid — Free plan available |
| METAR | AVWX | `AVWX_KEY` | https://avwx.rest/ — Free tier available |
| Satellites | N2YO | `N2YO_KEY` | https://www.n2yo.com/api/ — Free registration |
| Fishing / Dark Fleet | Global Fishing Watch | `GFW_TOKEN` | https://globalfishingwatch.org/our-apis/ — Application required |
| OTX Threat Intel | AlienVault OTX | `OTX_KEY` | https://otx.alienvault.com/ — Settings > API Key |
| Internet Exposure | Shodan | `SHODAN_KEY` | https://account.shodan.io/ — Free plan limited |
| News Intel | NewsAPI | `NEWS_API_KEY` | https://newsapi.org/register — Free plan |
| Armed Conflict | ACLED | `ACLED_KEY` + `ACLED_EMAIL` | https://developer.acleddata.com/ — Free academic registration |

### Requires Paid API Key

| Layer | Source | Key | Notes |
|-------|--------|-----|-------|
| Military Air | ADS-B Exchange | `RAPIDAPI_KEY` | Via RapidAPI marketplace |
| Maritime AIS | AISStream.io | `AISSTREAM_KEY` | WebSocket-based, key used server-side only |

## API Endpoints

### Health & Status
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | None | Operational status, version, domain list |
| GET | `/api/status` | None | Key configuration status, target counts, version |

### Secure Proxy
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/proxy` | None | Server-side proxy for keyed upstream APIs. Body: `{target, params}` |

### Domain Endpoints
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/weather/global` | `OWM_KEY` | Weather for 20 global cities |
| GET | `/api/avwx/global` | `AVWX_KEY` | METAR for 15 major airports (canonical events) |
| GET | `/api/ais/config` | None | AIS availability (never exposes key) |
| POST | `/api/shodan/search` | `SHODAN_KEY` | Internet exposure search |
| GET | `/api/reliefweb/disasters` | None | UN disaster data |
| GET | `/api/acled/events` | `ACLED_KEY` | Armed conflict events |
| POST | `/api/intel/gdelt` | None | GDELT article geocoding (conflict/cyber/nuclear/maritime) |
| POST | `/api/intel/news` | `NEWS_API_KEY` | NewsAPI supplemental intel |
| GET | `/api/cyber/cisa-kev` | None | CISA KEV (triple-fallback: CISA → GitHub cisagov → GitHub catalog) |
| GET | `/api/cyber/otx` | `OTX_KEY` (opt) | AlienVault OTX threat pulses |
| GET | `/api/cyber/urlhaus` | None | abuse.ch malware URLs (JSON + CSV fallback) |
| GET | `/api/cyber/threatfox` | None | abuse.ch IOC feed |
| GET | `/api/gnss/anomalies` | None | GNSS jamming/spoofing zones + GDELT news |
| GET | `/api/social/reddit` | None | Reddit OSINT posts (5 subreddits) |
| GET | `/api/social/mastodon` | None | Mastodon security posts (infosec.exchange, ioc.exchange) |
| GET | `/api/fusion/zones` | None | All threat zones |
| GET | `/api/fusion/viewport` | None | Viewport-filtered zones (`?latMin=&latMax=&lonMin=&lonMax=`) |

## Satellite Imagery

Five free satellite tile sources integrated (no API key required):

| Product | Source | Resolution | Update | Max Zoom |
|---------|--------|------------|--------|----------|
| MODIS Terra True Color | NASA GIBS | 250 m/px | Daily (~3h latency) | Z9 |
| MODIS Aqua True Color | NASA GIBS | 250 m/px | Daily (afternoon) | Z9 |
| VIIRS SNPP True Color | NASA GIBS | 250 m/px | Daily | Z9 |
| VIIRS Nighttime Lights | NASA GIBS | Monthly composite | Monthly | Z8 |
| Sentinel-2 Cloudless | EOX S2Maps.eu | 10 m/px | Annual mosaic | Z15 |

Press **S** or click **SAT** in the header to open the satellite imagery panel.

## Local Development

### Prerequisites
- Node.js >= 18
- npm

### Setup

```bash
git clone https://github.com/MSA-83/SENTINEL-X.git
cd SENTINEL-X

# Install dependencies
npm install

# Create .dev.vars with your API keys (see Required Keys above)
cat > .dev.vars << 'EOF'
NASA_FIRMS_KEY=your_key
OWM_KEY=your_key
N2YO_KEY=your_key
GFW_TOKEN=your_token
AVWX_KEY=your_key
RAPIDAPI_KEY=your_key
SHODAN_KEY=your_key
NEWS_API_KEY=your_key
AISSTREAM_KEY=your_key
OTX_KEY=your_key
ACLED_KEY=your_key
ACLED_EMAIL=your_email
EOF

# Build
npm run build

# Start local dev server (reads .dev.vars automatically)
npm run preview
# or with PM2:
pm2 start ecosystem.config.cjs
```

The app will be available at http://localhost:3000

### Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Vite dev server (HMR) |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Wrangler Pages local preview |
| `npm run deploy` | Build + deploy to Cloudflare Pages |

## Production Deployment

```bash
# 1. Set Cloudflare API token
export CLOUDFLARE_API_TOKEN=your_token

# 2. Build and deploy
npm run deploy

# 3. Set production secrets
npx wrangler pages secret put NASA_FIRMS_KEY --project-name sentinel-os
npx wrangler pages secret put OWM_KEY --project-name sentinel-os
# ... repeat for each key
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| 1 | Layers panel |
| 2 | Threat board |
| 3 | Sources / timeline |
| S | Satellite imagery panel |
| Z | Toggle threat zones |
| R | Refresh all feeds |
| T | Toggle time filter |
| / or F | Focus search |
| Escape | Close panel / search |

## Project Structure

```
sentinel-os/
  src/
    index.tsx          # Hono BFF backend (all API routes, proxy, canonical schema)
  public/static/
    sentinel.js        # Frontend client (map, parsers, UI, threat scoring, time scrubber)
    style.css          # Dark-ops CSS (Palantir/NATO COP design language)
  ecosystem.config.cjs # PM2 config (NO secrets -- reads .dev.vars)
  package.json         # Dependencies and scripts
  vite.config.ts       # Vite + Hono Cloudflare Pages plugin
  wrangler.jsonc       # Cloudflare Pages deployment config
  tsconfig.json        # TypeScript config
  .dev.vars            # Local secrets (never committed)
  .gitignore           # Ignores node_modules, dist, .dev.vars, .wrangler
```

## Security

- **No frontend keys**: All API keys are server-side only. The browser never sees secrets.
- **No hardcoded secrets**: `ecosystem.config.cjs` reads from `.dev.vars` / environment
- **AIS key protection**: `/api/ais/config` returns only availability boolean, never the raw key
- **Data lineage**: `raw_payload_hash` tracks upstream data provenance via SHA-256/DJB2
- **Provenance tracking**: Inferred locations explicitly labeled with low confidence scores
- **Structured errors**: Upstream failures return graceful error objects, not raw stack traces
- **XSS protection**: All dynamic content in the inspector is HTML-escaped

## Cybersecurity Layer Details

The cybersecurity layer aggregates four independent threat intelligence sources:

| Source | Data Type | Auth | Update Frequency |
|--------|-----------|------|-----------------|
| **CISA KEV** | Known Exploited Vulnerabilities | None (free) | Daily — triple-fallback (CISA → GitHub cisagov → catalog) |
| **AlienVault OTX** | Threat pulses, IOCs, APT tracking | Optional API key | 7-day window — subscribed → activity → search fallback |
| **URLhaus** | Active malware distribution URLs | None (free) | Hourly — JSON API + CSV fallback |
| **ThreatFox** | IOCs (IPs, domains, hashes) | None (free) | 3-day sliding window |

Each cyber event includes: CVE IDs, vendor/product, malware families, threat types, IOC values, ransomware association, confidence scores, and adversary attribution.

## GNSS Anomaly Layer Details

GNSS anomaly data uses a curated reference model of 12 known interference zones, enriched with GDELT news articles about GPS jamming/spoofing. **No free real-time GNSS API exists.**

| Zone | Type | Source | Confidence |
|------|------|--------|------------|
| Ukraine Eastern Front | Jamming | GPSJam.org / ADS-B analysis | 90% |
| Kaliningrad Oblast | Jamming | GPSJam.org / Eurocontrol | 85% |
| Eastern Baltic Sea | Spoofing | GPSJam.org / EASA | 80% |
| Israel Northern Border | Spoofing | GPSJam.org / OPSGROUP | 88% |
| Black Sea Western | Spoofing | C4ADS | 82% |
| ... and 7 more | Mixed | Various | 60-82% |

Reference sources: [GPSJam.org](https://gpsjam.org/), [Eurocontrol](https://www.eurocontrol.int/), [C4ADS](https://c4ads.org/), [EASA](https://www.easa.europa.eu/)

## Social Intelligence Layer Details

- **Reddit**: Polls 5 OSINT-relevant subreddits (CombatFootage, UkraineWarVideoReport, CredibleDefense, UkrainianConflict, osint). No authentication required.
- **Mastodon**: Polls public timelines from infosec.exchange and ioc.exchange. Filters for security-relevant content. No authentication required.
- **Geolocation**: Locations inferred from post titles using deterministic text matching. All inferred locations are marked with low confidence (15-35%) and labeled `geocoded-inferred`.
- **Media**: Extracts video, image, and link URLs from Reddit posts.

## Free OSINT Source Reference

| Source | URL | Key Required | Notes |
|--------|-----|--------------|-------|
| USGS Earthquake | https://earthquake.usgs.gov/ | No | Real-time GeoJSON feed |
| ISS Position | https://wheretheiss.at/ | No | 5-second polling |
| CelesTrak | https://celestrak.org/ | No | TLE data for SGP4 propagation |
| NASA GIBS | https://gibs.earthdata.nasa.gov/ | No | Satellite imagery tiles |
| EOX Sentinel-2 | https://s2maps.eu/ | No | 10 m/px annual mosaic |
| CISA KEV | https://www.cisa.gov/known-exploited-vulnerabilities-catalog | No | Known exploited vulns |
| URLhaus | https://urlhaus-api.abuse.ch/ | No | Malware URL database |
| ThreatFox | https://threatfox-api.abuse.ch/ | No | IOC sharing platform |
| GDELT 2.0 | https://api.gdeltproject.org/ | No | Global news geocoding |
| GDACS | https://www.gdacs.org/ | No | Disaster alerts |
| ReliefWeb | https://api.reliefweb.int/ | No | UN disaster data |
| GPSJam.org | https://gpsjam.org/ | No | Daily GNSS interference maps |
| Reddit JSON | https://www.reddit.com/r/*/hot.json | No | Public subreddit data |
| Mastodon | https://infosec.exchange/ | No | Public timeline API |
| OpenSky | https://opensky-network.org/ | Optional | ADS-B aircraft tracking |
| NASA FIRMS | https://firms.modaps.eosdis.nasa.gov/ | Free key | Wildfire hotspots |
| OpenWeatherMap | https://openweathermap.org/ | Free key | Global weather data |
| AVWX | https://avwx.rest/ | Free key | METAR aviation weather |
| AlienVault OTX | https://otx.alienvault.com/ | Free key | Threat intelligence |

## Changelog

### v7.0.0 (2026-04-04)
- **Breaking**: Canonical event schema now includes `raw_payload_hash` field for data lineage
- Added DJB2 + SHA-256 payload hashing for all upstream data
- Added Mastodon social intelligence (`/api/social/mastodon`) — infosec.exchange, ioc.exchange
- Added AVWX METAR canonical events with aviation weather parsing
- Added time scrubber (T key) for temporal filtering (1h-168h)
- Added connection health heartbeat (30s interval)
- Added auto-refresh countdown in header
- Added freshness badges in inspector (LIVE / Xh / Xd)
- Added METAR inspector card with raw METAR, flight rules, wind, visibility, temperature
- Expanded GEO_DB from ~67 to ~120 locations (cities, regions, military terms)
- Fixed duplicate ACLED_KEY in Bindings type
- Improved CISA KEV resilience (triple-fallback: CISA → cisagov GitHub → catalog GitHub)
- Added @cloudflare/workers-types to devDependencies
- XSS protection: All dynamic inspector content HTML-escaped
- Version bump to 7.0.0

### v6.1.0 (2026-04-02)
- Production-grade rewrite: canonical event schema, provenance tracking, confidence metadata
- Removed all hardcoded secrets from ecosystem.config.cjs
- Fixed malformed package.json (was invalid JSON with comments)
- Complete style.css rewrite to match v6 frontend
- Added CelesTrak TLE parsing with SGP4 orbital propagation
- Added satellite imagery engine (NASA GIBS + Sentinel-2) with date picker
- Inspector panel with full provenance, confidence badges, source URLs
- Cyber/GNSS/Social domain-specific inspector cards

### v5.1.0 (2026-03-31)
- NASA GIBS satellite imagery
- Satellite imagery HUD panel with date picker

### v5.0.0 (2026-03-29)
- Cybersecurity layer (AlienVault OTX, URLhaus, ThreatFox)
- GPS Jamming layer
- Social Media OSINT layer
- Enhanced GEO_DB with fusion zones

## License

Open source. Free for educational and research use.
