# SENTINEL OS v8.0

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
  |--- /api/metrics/health --> Source health metrics (v8.0)
  |
  Leaflet map + SVG markers + MarkerCluster
  Inspector panel (compact cards with expand) + Threat board
  Domain-specific filter tabs + Search + Timeline replay
  Satellite imagery (NASA GIBS + Sentinel-2)
  Mobile drawer panels + Performance throttles
```

### Key Design Decisions

- **Edge BFF pattern**: All keyed API calls go through `/api/proxy` -- secrets are injected server-side
- **Canonical event schema**: Every entity has `id`, `entity_type`, `source`, `confidence`, `severity`, `provenance`, `raw_payload_hash`, etc.
- **Data lineage**: `raw_payload_hash` (SHA-256 or DJB2) tracks upstream data provenance
- **Provenance tracking**: `direct-api` (real coordinates, 80-98%), `geocoded-inferred` (text-matched, 15-35%), `curated-reference` (expert-maintained)
- **Graceful degradation**: Each upstream failure returns a structured error object; UI shows source health
- **Free-first**: All critical layers work without API keys; optional keys unlock additional sources
- **No frontend secrets**: The browser never receives, stores, or transmits any API key
- **Deduplication**: Fingerprint-based dedup with cross-source correlation tracking
- **Mobile-first**: Responsive drawer panels, performance throttles, marker caps

## v8.0 Improvements

### 1. Responsive Layout
- Mobile-first CSS with proper viewport scaling
- No overflow or content leaks on small screens
- CSS custom properties (`--lp-w`, `--rp-w`, `--hdr-h`) for consistent sizing
- Fixed `html/body` to `position:fixed` to prevent mobile scroll bounce

### 2. Mobile Drawer Panels
- Left panel slides in as a drawer from the left edge on mobile (`<768px`)
- Semi-transparent backdrop overlay (`drawer-overlay`) dims background
- Hamburger menu button in header to toggle drawer open/close
- Mobile bottom bar tabs open drawer with panel pre-selected
- Drawer closes on backdrop tap or Escape key

### 3. Compact Event Cards
- Inspector shows compact summary line (source, region, coordinates) by default
- "SHOW DETAILS" / "COLLAPSE DETAILS" toggle reveals full field list
- Reduces visual noise; user drills in only when interested
- Domain-specific cards (Cyber, GNSS, Social) still render inside expandable

### 4. Domain-Specific Layer Tabs
- Horizontal scrollable pill tabs: ALL, AIR, SEA, SPACE, WEATHER, CONFLICT, CYBER, GNSS, SOCIAL
- Filters the layer list to show only matching domain
- Touch-friendly horizontal scroll on mobile
- Active tab highlighted with cyan border

### 5. Confidence / Freshness Chips
- Inline colored chips in inspector badges row
- **Confidence chip**: `conf-high` (green, >=80%), `conf-med` (amber, 50-79%), `conf-low` (red, <50%)
- **Freshness chip**: `fresh-live` (green, <1h), `fresh-stale` (amber, 1-24h), `fresh-old` (grey, >24h)
- Compact rounded pill design (8px border-radius)

### 6. Timeline Replay Control
- Play/Pause button in the time scrubber bar
- Speed selector: 1x, 2x, 4x (click to cycle)
- Replay sweeps from 72h ago to present (scrubber hours decrements)
- Auto-stops at present; can be paused/resumed
- Keyboard: T toggles scrubber, replay controls in-bar

### 7. Source Health Metrics Endpoint
- **`GET /api/metrics/health`**: Returns per-source latency (EMA), uptime percentage, error count
- `recordMetric()` server-side function tracks each upstream call
- Client polls every 30 seconds and renders latency bars and uptime percentages in Sources tab
- Color-coded bars: green (<3s), amber (3-8s), red (>8s)

### 8. Deduplication / Correlation
- `fingerprint()` generates dedup key from `entity_type + rounded coords + normalized title`
- `deduplicateEntities()` merges duplicates: highest confidence wins
- Cross-source correlation: `metadata._correlated_sources` tracks which sources reported same event
- `correlations` array links related entity IDs
- Inspector shows "X CORR" badge and "ALSO IN" field for correlated entities

### 9. Mobile Performance Throttles
- `MARKER_CAP`: 200 on mobile (vs 500 desktop)
- `RENDER_THROTTLE_MS`: 500ms on mobile (vs 100ms desktop)
- Marker glow animation disabled on mobile CSS
- Cluster `animate: false` on mobile
- Tooltips disabled on mobile (saves DOM nodes)
- CelesTrak TLE cap: 30 objects on mobile (vs 60 desktop)
- Cluster radius increased to 60px on mobile (more aggressive grouping)
- `prefers-reduced-motion` media query support

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
| `correlations` | string[] | Related entity IDs (v8.0 dedup) |
| `metadata` | object | Source-specific fields + `_correlated_sources` (v8.0) |
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
| GET | `/api/metrics/health` | None | Per-source latency, uptime, error rates (v8.0) |

### Secure Proxy
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/proxy` | None | Server-side proxy for keyed upstream APIs. Body: `{target, params}` |

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
    sentinel.js        # Frontend (map, drawers, domain tabs, replay, dedupe, mobile throttles)
    style.css          # Dark-ops CSS (responsive, drawer, chips, compact cards)
  ecosystem.config.cjs # PM2 config (NO secrets)
  package.json         # Dependencies and scripts
  vite.config.ts       # Vite + Hono Cloudflare Pages plugin
  wrangler.jsonc       # Cloudflare Pages deployment config
  tsconfig.json        # TypeScript config
  .dev.vars            # Local secrets (never committed)
  .gitignore           # Ignores node_modules, dist, .dev.vars, .wrangler
```

## Security

- **No frontend keys**: All API keys are server-side only
- **No hardcoded secrets**: `ecosystem.config.cjs` reads from `.dev.vars`
- **AIS key protection**: `/api/ais/config` returns only availability boolean
- **Data lineage**: `raw_payload_hash` tracks upstream data provenance
- **Provenance tracking**: Inferred locations explicitly labeled with low confidence
- **Structured errors**: Upstream failures return graceful error objects
- **XSS protection**: All dynamic content in the inspector is HTML-escaped
- **Deduplication integrity**: Fingerprints prevent duplicate events from inflating counts

## Changelog

### v8.0.0 (2026-04-07)
- **Responsive layout**: Mobile-first CSS, CSS custom properties for panel widths, `position:fixed` body
- **Mobile drawer**: Left panel slides in from left on mobile, overlay backdrop, hamburger menu
- **Compact cards**: Inspector shows summary by default, "SHOW DETAILS" expands full fields
- **Domain tabs**: Horizontal scrollable pill tabs (ALL/AIR/SEA/SPACE/WEATHER/CONFLICT/CYBER/GNSS/SOCIAL)
- **Confidence chips**: Inline colored pills (green >=80%, amber 50-79%, red <50%)
- **Freshness chips**: Inline colored pills (green <1h, amber 1-24h, grey >24h)
- **Timeline replay**: Play/Pause button, speed selector (1x/2x/4x), sweeps 72h to present
- **Source metrics**: `GET /api/metrics/health` endpoint, per-source latency/uptime/error tracking
- **Source metrics UI**: Latency bars, uptime percentages in Sources tab, color-coded health
- **Deduplication**: Fingerprint-based dedupe (entity_type + coords + title), cross-source correlation
- **Correlation tracking**: `_correlated_sources` metadata, "ALSO IN" inspector field
- **Mobile performance**: Marker cap 200, render throttle 500ms, no glow animations, disabled tooltips
- **Cluster optimization**: Increased radius on mobile (60px), disabled animate on mobile
- **CelesTrak cap**: 30 objects on mobile (vs 60 desktop)
- **Reduced-motion**: `prefers-reduced-motion` media query support
- **Version bump to 8.0.0**

### v7.0.0 (2026-04-04)
- Canonical event schema with `raw_payload_hash` for data lineage
- Mastodon social intelligence, AVWX METAR, time scrubber, health heartbeat
- Expanded GEO_DB to ~120 locations, CISA KEV triple-fallback
- CSS overhaul: connection indicators, time scrubber, tablet/XL breakpoints

### v6.1.0 (2026-04-02)
- Production-grade rewrite: canonical schema, provenance tracking, satellite imagery engine

## License

Open source. Free for educational and research use.
