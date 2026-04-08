# SENTINEL OS v8.1

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
  |--- /api/proxy  --> Hono BFF --> Upstream keyed APIs (with recordMetric)
  |--- /api/cyber/* --> CISA KEV, OTX, URLhaus, ThreatFox
  |--- /api/gnss/*  --> Curated GNSS zones + GDELT enrichment
  |--- /api/social/* --> Reddit public JSON + Mastodon public timelines
  |--- /api/intel/*  --> GDELT article geocoding
  |--- /api/fusion/* --> Threat zones, viewport queries
  |--- /api/avwx/*  --> METAR weather (canonical events)
  |--- /api/metrics/health --> Source health metrics (wired to all fetches)
  |
  Leaflet map + SVG markers + MarkerCluster
  Inspector panel (compact cards with expand) + Threat board
  Domain-specific filter tabs + Search + Timestamp-aware replay
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
- **Unified state**: Single `state` object tracks all map, UI, drawer, replay, viewport, and entity data

## v8.1 Changes (from v8.0)

### Unified State Object
- All scattered variables consolidated into `state = {...}` with documented fields
- Includes map instance, entities, layer states, drawer state, replay window, source health/freshness, viewport bounds, mobile mode flags
- Exposed as `window.S._state` for debugging

### Timestamp-Aware Timeline Replay
- **Mode-based** instead of slider: LIVE / 1 HOUR / 24 HOURS / 72 HOURS pill buttons
- `entityInTimeWindow()` filters entities by actual `timestamp` against replay cursor
- Replay sweeps a window from start to present in ~200 steps at configurable speed (1x/2x/4x)
- Progress bar shows percentage completion; auto-stops at present
- Graceful degradation: entities with no timestamp always pass through

### Viewport-Based Layer Culling
- `updateViewportBounds()` tracks map bounds on `moveend`/`zoomend`
- `isInViewport()` culls markers outside visible area (+5deg padding) on mobile
- Entities sorted by severity before rendering (critical/high first)

### Deferred Heavy Layers on Mobile
- Phase 3 (GDACS, GFW, ReliefWeb) deferred by 1s on mobile
- Phase 4 (GDELT intel) deferred by 1.5s on mobile
- Phase 5 (Cyber) deferred by 3s on mobile
- Phase 6 (GNSS + Social) deferred by 5s on mobile
- Desktop gets standard 0s/0s/2s/4s phasing

### Domain-Distinct Inspector Cards
- **Air card**: callsign, ICAO24, origin country, squawk (with code meaning), vertical rate
- **Seismic card**: magnitude, depth, tsunami status, felt reports
- **Cyber card**: CVE, vendor, product, malware, IOC, ransomware, APT
- **GNSS card**: jamming/spoofing type, radius, affected systems
- **Social card**: subreddit/instance, score, geo-inference method
- Domain color accent on inspector header left border

### Source Health Freshness Tracking
- `sourceFreshness` per-layer tracks last successful fetch timestamp
- Sources panel shows freshness chips next to each source row
- `/api/metrics/health` UI shows "last ok: Xm" in metric rows

### recordMetric Wired Into All Fetches
- `/api/proxy` records latency + success/failure for every upstream call
- Weather, ReliefWeb, GDELT, CISA KEV, OTX, URLhaus, ThreatFox endpoints all instrumented
- EMA-smoothed latency, uptime percentage, error counts available at `/api/metrics/health`

### Responsive Enhancements
- Debounced resize handler (150ms) with viewport state update
- Drawer auto-closes on resize to desktop
- Mobile inspector closes drawer to prevent stacking
- Search results show freshness chips inline
- Threat board items use flexbox layout (no float) for clean wrapping
- Replay bar uses pill-mode buttons instead of range slider

### CSS Updates
- Domain-distinct card styles: `.air-card`, `.seismic-card` with accent borders
- Scrubber progress bar (`.scrub-progress`, `.scrub-progress-fill`) replaces range input
- Replay mode buttons (`.scrub-mode-btn`) as horizontal pills
- `.replay-pct` for live percentage display
- `.err-metric` class for red error counts
- Inspector `.rp-header-inner`, `.rp-domain-tag` for domain accent headers
- Threat items `.threat-item-top`, `.threat-item-meta` flexbox layout

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
    sentinel.js        # Frontend (unified state, map, drawers, domain tabs, timestamp-aware replay, dedupe, mobile throttles)
    style.css          # Dark-ops CSS (responsive, drawer, chips, compact cards, domain-distinct cards)
  ecosystem.config.cjs # PM2 config (NO secrets)
  package.json         # Dependencies and scripts
  vite.config.ts       # Vite + Hono Cloudflare Pages plugin
  wrangler.jsonc       # Cloudflare Pages deployment config
  tsconfig.json        # TypeScript config
  .dev.vars            # Local secrets (never committed)
  .gitignore           # Ignores node_modules, dist, .dev.vars, .wrangler
```

## Remaining Limitations

- **Replay is time-window based**: Sweeps a time window from start to end, but does not have per-second timestamp accuracy for individual marker animations
- **Viewport culling**: Only applied on mobile; desktop renders all entities within marker cap
- **GNSS data**: Curated reference zones, no real-time GNSS interference API available
- **Social geolocation**: Text-inference only (15-35% confidence), no GPS coordinates from posts
- **AIS maritime**: Requires paid AISStream key for live vessel tracking
- **recordMetric timing**: Some endpoints use approximate timing due to multi-step processing
- **Satellite imagery**: Tile loading depends on NASA GIBS availability; day-old imagery by default

## Changelog

### v8.1.0 (2026-04-08)
- Unified state object for all map, UI, drawer, replay, viewport, and entity tracking
- Timestamp-aware timeline replay: mode-based (LIVE/1H/24H/72H) with progress bar
- Viewport-based layer culling on mobile
- Deferred heavy layer fetching with mobile-specific delays
- Domain-distinct inspector cards (air, seismic, cyber, gnss, social)
- Source freshness tracking (per-layer last success timestamps)
- `recordMetric()` wired into proxy, weather, reliefweb, gdelt, cisa-kev, otx, urlhaus, threatfox
- Responsive resize debounce, drawer auto-close on breakpoint change
- CSS: domain card accent styles, scrubber progress bar, replay modes, flexbox threat items
- Version bump to 8.1.0

### v8.0.0 (2026-04-07)
- Responsive layout, mobile drawer, compact cards, domain tabs, confidence/freshness chips
- Timeline replay controls, source metrics endpoint, deduplication/correlation
- Mobile performance throttles, cluster optimization, CelesTrak cap

### v7.0.0 (2026-04-04)
- Canonical event schema with `raw_payload_hash` for data lineage
- Mastodon social intelligence, AVWX METAR, time scrubber, health heartbeat

### v6.1.0 (2026-04-02)
- Production-grade rewrite: canonical schema, provenance tracking, satellite imagery engine

## License

Open source. Free for educational and research use.
