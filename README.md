# SENTINEL OS v8.3

## Global Multi-Domain Situational Awareness Platform

Production-grade, free-source-first situational awareness system aggregating **25+ live OSINT data sources** across aviation, maritime, orbital, seismic, wildfire, weather, conflict, disaster, cyber, nuclear, GNSS jamming, social media, and satellite imagery intelligence domains.

### v8.3 Improvements
- **Space-Track auth hardening**: Cookie-based auth with proper extraction, cached sessions (~2hr), clear error messages when credentials fail (Space-Track now requires 12+ char passwords)
- **Improved deduplication**: Severity promotion across correlated events, timestamp freshness merge, tag accumulation from multiple sources, higher precision fingerprinting for direct-API sources
- **Mobile bottom-sheet inspector**: Inspector slides up from bottom on mobile (max 55vh), with touch-friendly 36px min tap targets and slide-up animation
- **Quick actions**: Map link, Source link, Copy Coordinates buttons in inspector
- **Domain-specific cards for ALL entity types**: Weather (temp/wind/pressure), Maritime (MMSI/flag/gear), Orbital (NORAD/period/inclination), Wildfire (FRP/brightness), Satellite (full orbital metadata), plus existing Air, Cyber, GNSS, Social, Seismic, Conjunction cards
- **Correlation summary**: Inspector shows "CORRELATED: source1, source2" when entity has cross-source verification
- **Mobile INSPECT tab**: Bottom bar shows inspect shortcut when an entity is selected
- **Space-Track diagnostic**: `/api/spacetrack/status` endpoint for auth troubleshooting

**Architecture**: Edge BFF (Backend-for-Frontend) on Cloudflare Pages. All keyed API calls route through server-side proxy -- the browser never sees secrets. Every record conforms to a canonical event schema with provenance, confidence metadata, and raw payload hashing for data lineage.

## URLs

- **GitHub**: https://github.com/MSA-83/SENTINEL-X
- **Cloudflare**: Deployed to Cloudflare Pages as `sentinel-os`

## Architecture

```
Browser (sentinel.js)
  |
  |--- Direct free APIs (USGS, ISS, CelesTrak TLE)
  |--- /api/proxy  --> Hono BFF --> Upstream keyed APIs (with recordMetric)
  |--- /api/cyber/* --> CISA KEV, OTX, URLhaus, ThreatFox (Abuse.ch auth key)
  |--- /api/gnss/*  --> Curated GNSS zones + GDELT enrichment
  |--- /api/social/* --> Reddit public JSON + Mastodon public timelines
  |--- /api/intel/*  --> GDELT article geocoding
  |--- /api/fusion/* --> Threat zones, viewport queries
  |--- /api/avwx/*  --> METAR weather (canonical events)
  |--- /api/spacetrack/* --> GP satellite catalog, CDM conjunctions, status
  |--- /api/copernicus/token --> Sentinel Hub OAuth2 token proxy
  |--- /api/cesium/token --> Cesium ion token proxy
  |--- /api/metrics/health --> Source health metrics (wired to all fetches)
  |
  Leaflet map + SVG markers + MarkerCluster
  Inspector panel (compact cards with expand + quick actions) + Threat board
  Domain-specific filter tabs + Search + Timestamp-aware replay
  Satellite imagery (NASA GIBS + Sentinel-2 + Copernicus SH)
  Mobile bottom-sheet inspector + Drawer panels + Performance throttles
```

### Key Design Decisions

- **Edge BFF pattern**: All keyed API calls go through `/api/proxy` -- secrets are injected server-side
- **Canonical event schema**: Every entity has `id`, `entity_type`, `source`, `confidence`, `severity`, `provenance`, `raw_payload_hash`, etc.
- **Data lineage**: `raw_payload_hash` (SHA-256 or DJB2) tracks upstream data provenance
- **Provenance tracking**: `direct-api` (real coordinates, 80-98%), `geocoded-inferred` (text-matched, 15-35%), `curated-reference` (expert-maintained)
- **Graceful degradation**: Each upstream failure returns a structured error object; UI shows source health
- **Free-first**: All critical layers work without API keys; optional keys unlock additional sources
- **No frontend secrets**: The browser never receives, stores, or transmits any API key
- **Deduplication**: Fingerprint-based dedup with cross-source correlation, severity promotion, tag merge
- **Mobile-first**: Bottom-sheet inspector, drawer panels, performance throttles, marker caps
- **Unified state**: Single `state` object tracks all map, UI, drawer, replay, viewport, and entity data

## v8.3 Changes (from v8.2)

### Space-Track Auth Hardening
- Fixed 401 auth by implementing proper cookie extraction (getSetCookie + set-cookie header fallback)
- Session cookie cached for ~2 hours for reuse across requests
- Clear error propagation: "Password does not meet minimum length requirements" visible in API response
- Added `/api/spacetrack/status` diagnostic endpoint showing auth state, cached cookie expiry, last error

### Improved Deduplication & Correlation
- **Severity promotion**: When duplicate has higher severity, existing entity is upgraded
- **Timestamp freshness**: Newer timestamps from duplicates are merged into existing entity
- **Tag accumulation**: Unique tags from correlated sources are merged
- **Higher-precision fingerprinting**: Direct-API sources use 1-decimal lat/lon precision; inferred use integer
- **Correlation display**: Inspector shows correlated sources inline in summary

### Mobile Bottom-Sheet Inspector
- Inspector renders as bottom-sheet on mobile (max 55vh) with slide-up animation
- Touch-friendly 36px minimum tap targets throughout
- INSPECT tab appears in mobile bottom bar when entity selected
- Responsive badge/chip sizing for mobile (5.5px font)

### Quick Actions in Inspector
- "MAP" button opens Google Maps at entity coordinates
- "SOURCE" button opens the upstream source URL
- "COORDS" button copies lat/lon to clipboard with confirmation

### Domain-Specific Inspector Cards for All Entity Types
- **Weather**: temperature, wind speed/direction, pressure, humidity, cloud cover
- **Maritime**: MMSI, flag state, gear type, AIS gap hours
- **Orbital/Satellite**: NORAD ID, international designator, country, RCS, period, inclination, apogee/perigee
- **Wildfire**: FRP (MW), brightness, acquisition date
- **Conjunction**: SAT1/SAT2 names/IDs, TCA, miss distance, collision probability, relative speed
- Previously existing: Air, Cyber, GNSS, Social, Seismic

## Data Model

### Canonical Event Schema

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (prefixed by source) |
| `entity_type` | string | e.g. `aircraft`, `seismic`, `cyber_vulnerability`, `gnss_jamming` |
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
| `correlations` | string[] | Related entity IDs (dedup) |
| `metadata` | object | Source-specific fields + `_correlated_sources` |
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
| Wildfires | NASA FIRMS | `NASA_FIRMS_KEY` | https://firms.modaps.eosdis.nasa.gov/api/ |
| Weather | OpenWeatherMap | `OWM_KEY` | https://openweathermap.org/appid |
| METAR | AVWX | `AVWX_KEY` | https://avwx.rest/ |
| Satellites | N2YO | `N2YO_KEY` | https://www.n2yo.com/api/ |
| Fishing / Dark Fleet | Global Fishing Watch | `GFW_TOKEN` | https://globalfishingwatch.org/our-apis/ |
| OTX Threat Intel | AlienVault OTX | `OTX_KEY` | https://otx.alienvault.com/ |
| Internet Exposure | Shodan | `SHODAN_KEY` | https://account.shodan.io/ |
| News Intel | NewsAPI | `NEWS_API_KEY` | https://newsapi.org/register |
| Armed Conflict | ACLED | `ACLED_KEY` + `ACLED_EMAIL` | https://developer.acleddata.com/ |
| Space-Track GP/CDM | Space-Track.org | `SPACETRACK_USER` + `SPACETRACK_PASS` | https://www.space-track.org/auth/createAccount |
| Copernicus Imagery | Sentinel Hub | `COPERNICUS_CLIENT_ID` + `SECRET` | https://dataspace.copernicus.eu/ |
| Cesium 3D | Cesium ion | `CESIUM_ION_TOKEN` | https://ion.cesium.com/ |

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
| GET | `/api/metrics/health` | None | Per-source latency, uptime, error rates, last success |
| GET | `/api/spacetrack/status` | None | Space-Track auth state, cookie expiry, last error |

### Secure Proxy
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/proxy` | None | Server-side proxy for keyed upstream APIs (with metric recording). Body: `{target, params}` |

### Domain Endpoints
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/weather/global` | `OWM_KEY` | Weather for 20 global cities |
| GET | `/api/avwx/global` | `AVWX_KEY` | METAR for 15 major airports |
| GET | `/api/ais/config` | None | AIS availability (never exposes key) |
| POST | `/api/shodan/search` | `SHODAN_KEY` | Internet exposure search |
| GET | `/api/reliefweb/disasters` | None | UN disaster data |
| GET | `/api/acled/events` | `ACLED_KEY` | Armed conflict events |
| POST | `/api/intel/gdelt` | None | GDELT article geocoding |
| POST | `/api/intel/news` | `NEWS_API_KEY` | NewsAPI supplemental intel |
| GET | `/api/cyber/cisa-kev` | None | CISA KEV (triple-fallback) |
| GET | `/api/cyber/otx` | `OTX_KEY` (opt) | AlienVault OTX threat pulses |
| GET | `/api/cyber/urlhaus` | None | abuse.ch malware URLs |
| GET | `/api/cyber/threatfox` | None | abuse.ch IOC feed |
| GET | `/api/gnss/anomalies` | None | GNSS jamming/spoofing zones + GDELT news |
| GET | `/api/social/reddit` | None | Reddit OSINT posts |
| GET | `/api/social/mastodon` | None | Mastodon security posts |
| GET | `/api/fusion/zones` | None | All threat zones |
| GET | `/api/fusion/viewport` | None | Viewport-filtered zones |
| GET | `/api/spacetrack/gp` | `SPACETRACK_USER/PASS` | Space-Track GP satellite catalog |
| GET | `/api/spacetrack/cdm` | `SPACETRACK_USER/PASS` | Space-Track conjunction data |
| GET | `/api/copernicus/token` | `COPERNICUS_CLIENT_ID/SECRET` | Copernicus OAuth2 token |
| GET | `/api/cesium/token` | `CESIUM_ION_TOKEN` | Cesium ion token |

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| 1 | Layers panel |
| 2 | Threat board |
| 3 | Sources / timeline |
| S | Satellite imagery panel |
| Z | Toggle threat zones |
| R | Refresh all feeds |
| T | Toggle time filter / replay |
| / or F | Focus search |
| Escape | Close panel / search / drawer |

## Performance Safeguards

| Control | Mobile (<768px) | Desktop |
|---------|-----------------|---------|
| Marker cap | 200 | 500 |
| Render throttle | 500ms | 100ms |
| Glow animations | Disabled | Enabled |
| Cluster animate | false | true |
| Tooltips | Disabled | Enabled |
| CelesTrak TLE cap | 30 objects | 60 objects |
| Cluster radius | 60px | 30-45px |
| Phase 3 defer | +1000ms | 0ms |
| Phase 5 defer | +3000ms | +2000ms |
| Phase 6 defer | +5000ms | +4000ms |
| Viewport culling | Active | Disabled |
| Resize debounce | 150ms | 150ms |
| Min tap targets | 36px | N/A |

## Known Issues

- **Space-Track**: Password `Angelo01!` is only 9 characters; Space-Track now requires minimum 12 characters. User needs to reset their password at https://www.space-track.org/auth/passwordReset
- **Replay**: Time-window based sweep, no per-second marker animations
- **GNSS data**: Curated reference zones only, no real-time GNSS interference API
- **Social geolocation**: Text-inference only (15-35% confidence)
- **AIS maritime**: Requires paid AISStream key for live vessel tracking

## Local Development

### Prerequisites
- Node.js >= 18
- npm

### Setup

```bash
git clone https://github.com/MSA-83/SENTINEL-X.git
cd SENTINEL-X

npm install

# Create .dev.vars with your API keys
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
ABUSECH_AUTH_KEY=your_key
SPACETRACK_USER=your_email
SPACETRACK_PASS=your_password_12chars_min
COPERNICUS_CLIENT_ID=your_client_id
COPERNICUS_CLIENT_SECRET=your_secret
CESIUM_ION_TOKEN=your_token
EOF

npm run build
npm run preview
# or: pm2 start ecosystem.config.cjs
```

## Project Structure

```
sentinel-os/
  src/
    index.tsx          # Hono BFF backend (all API routes, proxy, metrics, canonical schema)
  public/static/
    sentinel.js        # Frontend (unified state, map, drawers, domain tabs, timestamp-aware replay, dedupe, mobile throttles)
    style.css          # Dark-ops CSS (responsive, drawer, chips, compact cards, domain-distinct cards, bottom-sheet)
  ecosystem.config.cjs # PM2 config (NO secrets)
  package.json         # Dependencies and scripts
  vite.config.ts       # Vite + Hono Cloudflare Pages plugin
  wrangler.jsonc       # Cloudflare Pages deployment config
  tsconfig.json        # TypeScript config
  .dev.vars            # Local secrets (never committed)
  .gitignore           # Ignores node_modules, dist, .dev.vars, .wrangler
```

## Changelog

### v8.3.0 (2026-04-10)
- Space-Track auth hardening: proper cookie extraction, cached sessions, clear error messaging
- `/api/spacetrack/status` diagnostic endpoint
- Improved deduplication: severity promotion, timestamp freshness, tag merge, precision fingerprinting
- Mobile bottom-sheet inspector with slide-up animation
- Quick actions: Map, Source, Copy Coords in inspector
- Domain-specific cards for weather, maritime, orbital, wildfire, satellite entities
- Correlation summary in inspector
- Mobile INSPECT tab in bottom bar
- Touch-friendly 36px minimum tap targets

### v8.2.0 (2026-04-09)
- Space-Track.org GP/CDM integration (satellite catalog + conjunction alerts)
- Copernicus Sentinel Hub OAuth2 token proxy (10m/px imagery)
- Cesium ion token proxy (3D globe readiness)
- Abuse.ch authenticated feeds (URLhaus + ThreatFox)
- New conjunctions layer in SPACE domain
- 6 new environment bindings
- Source metrics tracking for 18 layer groups

### v8.1.0 (2026-04-08)
- Unified state object
- Timestamp-aware timeline replay (LIVE/1H/24H/72H modes)
- Viewport-based layer culling on mobile
- Deferred heavy layer fetching
- Domain-distinct inspector cards (air, seismic, cyber, gnss, social)
- Source freshness tracking, recordMetric wired into all fetches
- Responsive resize debounce, drawer auto-close

### v8.0.0 (2026-04-07)
- Responsive layout, mobile drawer, compact cards, domain tabs, confidence/freshness chips
- Timeline replay controls, source metrics endpoint, deduplication/correlation
- Mobile performance throttles, cluster optimization

### v7.0.0 (2026-04-04)
- Canonical event schema with `raw_payload_hash` for data lineage
- Mastodon social intelligence, AVWX METAR, time scrubber, health heartbeat

### v6.1.0 (2026-04-02)
- Production-grade rewrite: canonical schema, provenance tracking, satellite imagery engine

## License

Open source. Free for educational and research use.
