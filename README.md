# SENTINEL OS v6.2

**Global Multi-Domain Situational Awareness Platform**

Free-source-first OSINT system aggregating live data across aviation, maritime, orbital, seismic, wildfire, weather, conflict, disaster, cyber, GNSS, social, and satellite imagery domains.

---

## Architecture

```
Browser (public/static/sentinel.js)
  |
  |-- Direct free APIs (USGS, wheretheiss.at, CelesTrak -- no key, no proxy)
  |
  |-- POST /api/proxy  ->  Hono BFF  ->  keyed upstream APIs
  |       Targets: opensky/adsb.one, military/ADS-B Exchange, gfw_fishing,
  |                gfw_gap, firms, n2yo, gdacs, reliefweb,
  |                gdelt_conflict, gdelt_maritime, gdelt_nuclear, gdelt_cyber
  |
  |-- GET /api/cyber/*   ->  CISA KEV, OTX, URLhaus, ThreatFox (+ auth variants)
  |-- GET /api/gnss/*    ->  curated GNSS zones + GDELT news enrichment
  |-- GET /api/social/*  ->  Reddit public JSON
  |-- GET /api/air/*     ->  ADS-B live traffic
  |-- GET /api/sea/*     ->  GFW fishing/dark vessels + GDELT maritime fallback
  |-- GET /api/space/*   ->  CelesTrak JSON + Space-Track.org catalog
  |-- GET /api/weather/* ->  OpenWeatherMap cities, AVWX METAR, GDACS storms
  |-- GET /api/conflict/* -> GDELT conflict + fusion threat zones
  |-- GET /api/intel/*   ->  GDELT geocoding, NewsAPI supplemental
  |-- GET /api/fusion/*  ->  threat zones, viewport filter, global status
  |-- GET /api/imagery/copernicus-token  (Copernicus OAuth2, server-side)
  +-- GET /api/health | /api/status | /api/sources/health

  Leaflet map + SVG markers + MarkerCluster
  Inspector panel + Threat board + Source health + Timeline replay
```

### Key design decisions

| Decision                                | Rationale                                                                                                                                                                                     |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Edge BFF** (Cloudflare Pages Workers) | All keyed API calls are server-side. The browser never sees secrets.                                                                                                                          |
| **Canonical event schema**              | Every entity has a common shape regardless of source.                                                                                                                                         |
| **Provenance tracking**                 | `direct-api`, `geocoded-inferred`, `curated-reference`, `no-location` are always explicit.                                                                                                    |
| **Graceful degradation**                | Each upstream failure returns a structured `_upstream_error` object; layers never hang.                                                                                                       |
| **Free-first**                          | Critical layers work without any API key; keys only unlock additional depth.                                                                                                                  |
| **adsb.one as ADS-B source**            | OpenSky Network is blocked from Cloudflare edge. adsb.one provides 12,000+ live aircraft globally, no key required. Server-side transformation produces OpenSky-compatible `states[]` format. |
| **Curated GNSS model**                  | No free real-time GNSS interference API exists. Data is curated from GPSJam.org, Eurocontrol, C4ADS, EASA, enriched with live GDELT news.                                                     |

---

## Local Development

### Prerequisites

- **Node.js >= 18** (required by Wrangler)
- **npm** (included with Node.js)

### Install

Clone the repository from https://github.com/MSA-83/SENTINEL-X, then:

```bash
cd SENTINEL-X
npm install
```

### Configure secrets

Create `.dev.vars` in the project root. Read automatically by the Wrangler dev adapter. **Never commit it.**

```ini
# Required keys -- app works without them but affected layers return _upstream_error
NASA_FIRMS_KEY=your_key        # https://firms.modaps.eosdis.nasa.gov/api/
OWM_KEY=your_key               # https://openweathermap.org/appid
N2YO_KEY=your_key              # https://www.n2yo.com/api/
GFW_TOKEN=your_jwt             # https://globalfishingwatch.org/our-apis/
AVWX_KEY=your_key              # https://avwx.rest/
RAPIDAPI_KEY=your_key          # https://rapidapi.com/ (ADS-B Exchange)
SHODAN_KEY=your_key            # https://account.shodan.io/
NEWS_API_KEY=your_key          # https://newsapi.org/register
AISSTREAM_KEY=your_key         # https://aisstream.io/
OTX_KEY=your_key               # https://otx.alienvault.com/ (optional)
ABUSECH_KEY=your_key           # https://abuse.ch/auth/ (optional -- higher limits)
ACLED_KEY=your_key             # https://developer.acleddata.com/ (optional)
ACLED_EMAIL=your_email         # required alongside ACLED_KEY

# Optional -- Space and Imagery layers
SPACETRACK_USER=your_username
SPACETRACK_PASS=your_password  # https://www.space-track.org/
CESIUM_TOKEN=your_token        # https://ion.cesium.com/
COPERNICUS_CLIENT_ID=your_id   # https://dataspace.copernicus.eu/
COPERNICUS_CLIENT_SECRET=your_secret
```

### Run the development server

```bash
npm run dev
```

Starts Vite + Hono Cloudflare adapter at **http://localhost:5173**.

The server reads `.dev.vars` via `wrangler.getPlatformProxy()`. If you see `Using secrets defined in .dev.vars` in the console, all keys are loaded.
If `.dev.vars` is missing, all `c.env.*` bindings will be `undefined` and keyed layers return `_upstream_error`.

### Build

```bash
npm run build
```

Produces `dist/` with `dist/_worker.js` -- the Cloudflare Pages Workers bundle.

### Preview the production build locally

```bash
npm run preview
```

Starts `wrangler pages dev dist` on **http://localhost:3000**. Runs the actual Cloudflare Workers runtime locally -- closer to production than `npm run dev`.

### Verify

```bash
curl http://localhost:5173/api/health    # dev server
curl http://localhost:3000/api/health    # preview server
```

Expected response:

```json
{
  "status": "operational",
  "version": "6.2.0",
  "codename": "SENTINEL OS",
  "domains": [
    "aviation",
    "maritime",
    "orbital",
    "seismic",
    "wildfire",
    "weather",
    "conflict",
    "disaster",
    "cyber",
    "nuclear",
    "gnss",
    "social",
    "imagery"
  ]
}
```

Check key configuration:

```bash
curl http://localhost:5173/api/status
```

---

## Cloudflare Pages Deployment

SENTINEL OS is built for **Cloudflare Pages** (edge deployment). This is the recommended production target.

### Deploy

```bash
export CLOUDFLARE_API_TOKEN=your_token
npm run deploy
```

Runs `vite build && wrangler pages deploy dist --project-name sentinel-os`.

### Set production secrets

```bash
npx wrangler pages secret put NASA_FIRMS_KEY --project-name sentinel-os
npx wrangler pages secret put OWM_KEY        --project-name sentinel-os
npx wrangler pages secret put N2YO_KEY       --project-name sentinel-os
npx wrangler pages secret put GFW_TOKEN      --project-name sentinel-os
npx wrangler pages secret put AVWX_KEY       --project-name sentinel-os
npx wrangler pages secret put RAPIDAPI_KEY   --project-name sentinel-os
npx wrangler pages secret put SHODAN_KEY     --project-name sentinel-os
npx wrangler pages secret put NEWS_API_KEY   --project-name sentinel-os
npx wrangler pages secret put AISSTREAM_KEY  --project-name sentinel-os
npx wrangler pages secret put OTX_KEY        --project-name sentinel-os
npx wrangler pages secret put ABUSECH_KEY    --project-name sentinel-os
npx wrangler pages secret put SPACETRACK_USER --project-name sentinel-os
npx wrangler pages secret put SPACETRACK_PASS --project-name sentinel-os
npx wrangler pages secret put CESIUM_TOKEN --project-name sentinel-os
npx wrangler pages secret put COPERNICUS_CLIENT_ID --project-name sentinel-os
npx wrangler pages secret put COPERNICUS_CLIENT_SECRET --project-name sentinel-os
```

### Verify Cloudflare deployment

```bash
curl https://your-project.pages.dev/api/health
curl https://your-project.pages.dev/api/status
```

---

## Railway Deployment

> **Note:** SENTINEL OS runs the Cloudflare Workers runtime via `wrangler pages dev`.
> This works on Railway as a compatibility shim and is suitable for staging.
> Cloudflare Pages is the recommended production target.

### Railway setup

1. Connect your GitHub repository to Railway.
2. Set **Build Command**: `npm install && npm run build`
3. Set **Start Command**: `npm start`
4. Railway injects `PORT` automatically. `npm start` passes it to `wrangler pages dev dist --ip 0.0.0.0 --port`.

### Environment variables on Railway

Set every key from the `.dev.vars` template above as Railway environment variables (Settings -> Variables). They are passed as bindings into the Workers runtime.

### Verify Railway deployment

```bash
curl https://your-app.up.railway.app/
curl https://your-app.up.railway.app/api/health
```

The root `GET /` returns the HTML shell with the Leaflet map. If you see a blank page, confirm that `dist/_worker.js` exists (build succeeded).

---

## Environment Variables

| Variable                   | Required                  | Layer                  | Registration                                        |
| -------------------------- | ------------------------- | ---------------------- | --------------------------------------------------- |
| `NASA_FIRMS_KEY`           | Optional                  | Wildfires              | https://firms.modaps.eosdis.nasa.gov/api/           |
| `OWM_KEY`                  | Optional                  | Weather cities         | https://openweathermap.org/appid                    |
| `N2YO_KEY`                 | Optional                  | Satellites             | https://www.n2yo.com/api/                           |
| `GFW_TOKEN`                | Optional                  | Maritime AIS           | https://globalfishingwatch.org/our-apis/            |
| `AVWX_KEY`                 | Optional                  | METAR                  | https://avwx.rest/                                  |
| `RAPIDAPI_KEY`             | Optional                  | Military air           | https://rapidapi.com/adsbexchange                   |
| `SHODAN_KEY`               | Optional                  | Internet exposure      | https://account.shodan.io/                          |
| `NEWS_API_KEY`             | Optional                  | News intel             | https://newsapi.org/register                        |
| `AISSTREAM_KEY`            | Optional                  | AIS WebSocket          | https://aisstream.io/                               |
| `OTX_KEY`                  | Optional                  | Threat intel           | https://otx.alienvault.com/                         |
| `ABUSECH_KEY`              | Optional                  | URLhaus/ThreatFox auth | https://abuse.ch/auth/                              |
| `ACLED_KEY`                | Optional                  | Armed conflict         | https://developer.acleddata.com/                    |
| `ACLED_EMAIL`              | With ACLED_KEY            | Armed conflict         | Same                                                |
| `SPACETRACK_USER`          | Optional                  | Space-Track TLE        | https://www.space-track.org/                        |
| `SPACETRACK_PASS`          | With SPACETRACK_USER      | Space-Track            | Same                                                |
| `CESIUM_TOKEN`             | Optional                  | Cesium Ion 3D          | https://ion.cesium.com/                             |
| `COPERNICUS_CLIENT_ID`     | Optional                  | Copernicus WMTS        | https://dataspace.copernicus.eu/                    |
| `COPERNICUS_CLIENT_SECRET` | With COPERNICUS_CLIENT_ID | Copernicus             | Same                                                |
| `PLANET_API_KEY`           | Optional                  | Planet imagery         | https://www.planet.com/ (no active integration yet) |

All keys are **optional**. Missing keys cause the affected layer to return a structured `_upstream_error` with a message explaining where to register.

---

## Security

### No secrets in frontend code

All API keys live exclusively in server-side environment variables. `public/static/sentinel.js` (the browser bundle) **never** receives a raw key. Upstream calls are proxied through `/api/proxy` or domain-specific routes in `src/index.tsx`.

### AIS key protection

`GET /api/ais/config` returns only `{ "available": true/false }`. The raw `AISSTREAM_KEY` value is never sent to the browser.

### Rotate any exposed secrets immediately

If a key appears in browser network traffic, Git history, CI logs, or error messages, rotate it at the provider dashboard. Re-set it via `wrangler pages secret put` or Railway environment variables.

### Never commit .dev.vars

`.dev.vars` is listed in `.gitignore`. Verify with `git status` before every commit.

### Provenance is always declared

Location data inferred from article text is marked `provenance: "geocoded-inferred"` with `confidence <= 35`. It is visually distinguished (dashed markers, warning badge). Never treat inferred coordinates as precise positions.

---

## Data Model

### Canonical Event Schema

Every entity returned by any `/api/*` domain endpoint conforms to this shape:

| Field              | Type       | Description                                                                                                                                                                                                                                                                       |
| ------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `id`               | `string`   | Unique identifier prefixed by source (e.g. `kev_CVE-2024-1234`, `air_0`)                                                                                                                                                                                                          |
| `entity_type`      | `string`   | `aircraft`, `satellite`, `seismic`, `wildfire`, `cyber_vulnerability`, `cyber_ioc`, `cyber_malware_url`, `cyber_threat_intel`, `gnss_jamming`, `gnss_spoofing`, `gnss_news`, `conflict_intel`, `nuclear_intel`, `social_post`, `fishing_vessel`, `dark_vessel`, `ship`, `weather` |
| `source`           | `string`   | Data provider name (e.g. `CISA KEV`, `URLhaus (abuse.ch)`)                                                                                                                                                                                                                        |
| `source_url`       | `string`   | Canonical upstream URL                                                                                                                                                                                                                                                            |
| `title`            | `string`   | Display name                                                                                                                                                                                                                                                                      |
| `description`      | `string`   | Detail text                                                                                                                                                                                                                                                                       |
| `lat`              | `number    | null`                                                                                                                                                                                                                                                                             | WGS84 latitude. `null` for entities without coordinates (cyber IOCs, satellites pre-propagation). |
| `lon`              | `number    | null`                                                                                                                                                                                                                                                                             | WGS84 longitude                                                                                   |
| `altitude`         | `number    | null`                                                                                                                                                                                                                                                                             | Feet for aircraft; km for satellites                                                              |
| `velocity`         | `number    | null`                                                                                                                                                                                                                                                                             | Knots for aircraft; km/s for orbital                                                              |
| `heading`          | `number    | null`                                                                                                                                                                                                                                                                             | Degrees true                                                                                      |
| `timestamp`        | ISO string | Event time from upstream source                                                                                                                                                                                                                                                   |
| `observed_at`      | ISO string | When SENTINEL fetched the record                                                                                                                                                                                                                                                  |
| `confidence`       | `0-100`    | 95 = direct API/GPS; 30-35 = text-inferred location; 0 = unknown                                                                                                                                                                                                                  |
| `severity`         | `string`   | `critical` / `high` / `medium` / `low` / `info`                                                                                                                                                                                                                                   |
| `risk_score`       | `0-100`    | Computed threat score                                                                                                                                                                                                                                                             |
| `region`           | `string`   | Geographic region label                                                                                                                                                                                                                                                           |
| `tags`             | `string[]` | Categorization tags                                                                                                                                                                                                                                                               |
| `correlations`     | `string[]` | Related entity IDs                                                                                                                                                                                                                                                                |
| `metadata`         | `object`   | Source-specific extra fields                                                                                                                                                                                                                                                      |
| `raw_payload_hash` | `string`   | FNV-1a 32-bit hash for deduplication                                                                                                                                                                                                                                              |
| `provenance`       | `string`   | `direct-api` / `geocoded-inferred` / `curated-reference` / `no-location`                                                                                                                                                                                                          |

Upstream failures are returned as:

```json
{
  "_upstream_error": true,
  "upstream": "source-name",
  "status": 0,
  "message": "Human-readable reason. Configure KEY at https://...",
  "events": [],
  "timestamp": "..."
}
```

---

## Layers

### Air

**Sources**: adsb.one ADS-B (free, no key), ADS-B Exchange military overlay (`RAPIDAPI_KEY`).

- `POST /api/proxy` with `target: "opensky"` -- live aircraft in OpenSky-compatible `states[]` format. Backed by `https://api.adsb.one/v2/point/20/10/18000` (~12,000+ aircraft globally).
- `GET /api/air/traffic` -- same data as canonical `CanonicalEvent[]` with `entity_type: "aircraft"`.
- `POST /api/proxy` with `target: "military"` -- military-flagged aircraft from ADS-B Exchange. Requires `RAPIDAPI_KEY`.

**Limitations**: OpenSky Network itself is not accessible from Cloudflare edge. adsb.one is the replacement. Coverage excludes aircraft with transponders off.

---

### Sea

**Sources**: Global Fishing Watch (`GFW_TOKEN`), GDELT maritime news (free fallback).

- `GET /api/sea/vessels` -- fishing vessels and AIS-dark (gap) vessels from GFW when `GFW_TOKEN` is set. Falls back to GDELT maritime article geocoding (low confidence, `provenance: "geocoded-inferred"`).
- `GET /api/ais/config` -- returns `{ "available": true/false }`. The AIS WebSocket key (`AISSTREAM_KEY`) is present but a persistent server-side WebSocket handler is not yet implemented.

**Limitations**: GFW events have 24-72h latency. GDELT fallback is approximate. Real-time global AIS requires a paid feed.

---

### Space

**Sources**: CelesTrak (free), Space-Track.org (`SPACETRACK_USER` + `SPACETRACK_PASS`), N2YO (`N2YO_KEY`).

- `GET /api/space/satellites` -- space station TLE JSON from CelesTrak. Lat/lon are `null` (position requires SGP4 propagation via `satellite.js` on the frontend).
- `GET /api/space/spacetrack` -- authenticated TLE catalog from Space-Track.org (up to 150 records with NORAD IDs, inclination, eccentricity, epoch).
- `POST /api/proxy` with `target: "n2yo"` -- N2YO satellite pass predictions. Requires `N2YO_KEY`.

---

### Weather

**Sources**: OpenWeatherMap (`OWM_KEY`), AVWX (`AVWX_KEY`), GDACS (free). Open-Meteo and NOAA/NWS are not currently integrated.

- `GET /api/weather/global` -- current conditions for 20 major cities. Requires `OWM_KEY`.
- `GET /api/avwx/global` -- METAR for 15 international airports. Requires `AVWX_KEY`.
- `GET /api/weather/storm-events` -- tropical cyclone, storm surge, and flood events from GDACS. Free.
- `POST /api/proxy` with `target: "gdacs"` -- raw GDACS event list (EQ, TC, FL, VO, TS).

**Limitations**: OWM data refreshes on each request; no caching. Open-Meteo and NOAA/NWS are not currently wired into the BFF.

---

### Conflict

**Sources**: GDELT 2.0 (free), ACLED (`ACLED_KEY` + `ACLED_EMAIL`), NewsAPI (`NEWS_API_KEY`), curated fusion threat zones.

- `POST /api/conflict/events` -- GDELT article geocoding for conflict or nuclear queries.
- `GET /api/conflict/zones` -- 12 curated fusion threat zones.
- `GET /api/acled/events` -- ACLED armed conflict database. Requires free registration at https://developer.acleddata.com/.
- `POST /api/intel/gdelt` -- GDELT query by category: `conflict`, `maritime`, `nuclear`, `cyber`.
- `POST /api/intel/news` -- NewsAPI geocoded articles. Requires `NEWS_API_KEY`.
- `GET /api/fusion/zones` -- all 12 threat zones with base threat level and type.
- `GET /api/fusion/viewport?latMin=&latMax=&lonMin=&lonMax=` -- viewport-filtered zones.
- `GET /api/fusion/global` -- platform overview: domain coverage, keyed source status.

**Limitations**: GDELT and NewsAPI results are geocoded from article title text. Coordinates are approximate (+/- 0.6 degrees). Confidence is always 15-35 for geocoded events. These are OSINT signals, not verified positions.

---

### Cyber

**Sources**: CISA KEV (free), AlienVault OTX (free + optional key), URLhaus/ThreatFox (free + optional auth), Shodan (`SHODAN_KEY`).

- `GET /api/cyber/cisa-kev` -- CISA Known Exploited Vulnerabilities catalog. GitHub mirror fallback. Free.
- `GET /api/cyber/otx` -- AlienVault OTX pulses. Works anonymously; `OTX_KEY` unlocks subscribed pulses.
- `GET /api/cyber/urlhaus` -- abuse.ch malware URL feed (API + CSV fallback). Free.
- `GET /api/cyber/threatfox` -- abuse.ch IOC feed, 3-day window. Free.
- `GET /api/cyber/urlhaus-auth` -- URLhaus with `ABUSECH_KEY` for 100-record limit (vs 50 anonymous).
- `GET /api/cyber/threatfox-auth` -- ThreatFox with `ABUSECH_KEY` for 7-day IOC window (vs 3-day).
- `POST /api/shodan/search` -- Shodan internet exposure search. Requires `SHODAN_KEY`. Falls back to host lookup on free plan.

**Limitations**: Cyber events have no geographic coordinates (lat/lon is null). They appear in the Cyber panel but not on the map. Shodan free plan has limited search capability.

---

### GNSS

**Source**: Curated reference model derived from GPSJam.org, Eurocontrol, EASA, C4ADS, Bellingcat. Enriched with live GDELT GNSS news.

- `GET /api/gnss/anomalies` -- 13 curated jamming/spoofing zones + up to 10 GDELT GNSS news articles.
- `GET /api/gps/anomalies` -- 307 alias to `/api/gnss/anomalies`.
- `GET /api/gps/zones` -- curated zones array only.

**Zones**: Ukraine Eastern Front, Kaliningrad, Eastern Baltic, Syria (Khmeimim), Israel Northern Border, Iran Western Border, North Korea DMZ, Black Sea, Red Sea (Bab el-Mandeb), Strait of Hormuz, South China Sea (Spratly), Eastern Mediterranean.

**Limitations**: No free real-time GNSS interference API exists publicly. GPSJam.org publishes daily visual maps but no machine-readable feed. The curated model represents known persistent interference regions as of the last code update.

---

### Social

**Source**: Reddit public JSON API. No authentication required.

- `GET /api/social/reddit` -- hot posts from `r/CombatFootage`, `r/UkraineWarVideoReport`, `r/CredibleDefense`, `r/UkrainianConflict`, `r/osint`. Up to 60 canonical events with media URLs, scores, inferred geo.

**Legal note**: Only public subreddits with no login wall are queried via the public `.json` endpoint. No private or authenticated Reddit data is accessed.

**Limitations**: Location is inferred from post titles (confidence 15-35 or `no-location`). Reddit rate-limits unauthenticated access; HTTP 429 is possible during high-traffic periods.

---

## API Reference

### Health and Status

| Method | Path                  | Description                                                                                    |
| ------ | --------------------- | ---------------------------------------------------------------------------------------------- |
| `GET`  | `/api/health`         | Platform status, version, domain list                                                          |
| `GET`  | `/api/status`         | Key configuration booleans, target count, zone counts                                          |
| `GET`  | `/api/sources/health` | Live probe (latency + HTTP status) of all free sources; key-configured status for paid sources |

### Secure Proxy

| Method | Path         | Description                                                                                                                                                                                                           |
| ------ | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST` | `/api/proxy` | Body: `{ "target": "NAME", "params": {} }`. Valid targets: `opensky`, `military`, `gfw_fishing`, `gfw_gap`, `firms`, `n2yo`, `gdacs`, `reliefweb`, `gdelt_conflict`, `gdelt_maritime`, `gdelt_nuclear`, `gdelt_cyber` |

### Domain Endpoints

| Method | Path                            | Key                                                 | Description                                                         |
| ------ | ------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------- |
| `GET`  | `/api/air/traffic`              | None                                                | Live aircraft as CanonicalEvent[]                                   |
| `GET`  | `/api/sea/vessels`              | `GFW_TOKEN` optional                                | GFW fishing/dark vessels or GDELT fallback                          |
| `GET`  | `/api/space/satellites`         | None                                                | CelesTrak space stations JSON                                       |
| `GET`  | `/api/space/spacetrack`         | `SPACETRACK_USER` + `SPACETRACK_PASS`               | Space-Track.org TLE catalog                                         |
| `GET`  | `/api/weather/global`           | `OWM_KEY`                                           | Current weather for 20 cities                                       |
| `GET`  | `/api/weather/storm-events`     | None                                                | GDACS storm events                                                  |
| `GET`  | `/api/avwx/global`              | `AVWX_KEY`                                          | METAR for 15 airports                                               |
| `GET`  | `/api/ais/config`               | None                                                | AIS availability boolean                                            |
| `POST` | `/api/shodan/search`            | `SHODAN_KEY`                                        | Internet exposure search                                            |
| `GET`  | `/api/reliefweb/disasters`      | None                                                | UN OCHA disaster data                                               |
| `GET`  | `/api/acled/events`             | `ACLED_KEY` + `ACLED_EMAIL`                         | ACLED armed conflict events                                         |
| `POST` | `/api/intel/gdelt`              | None                                                | GDELT geocoded articles (category: conflict/maritime/nuclear/cyber) |
| `POST` | `/api/intel/news`               | `NEWS_API_KEY`                                      | NewsAPI geocoded articles                                           |
| `POST` | `/api/conflict/events`          | None                                                | GDELT conflict/nuclear articles                                     |
| `GET`  | `/api/conflict/zones`           | None                                                | Curated fusion threat zones                                         |
| `GET`  | `/api/cyber/cisa-kev`           | None                                                | CISA KEV catalog                                                    |
| `GET`  | `/api/cyber/otx`                | `OTX_KEY` optional                                  | AlienVault OTX pulses                                               |
| `GET`  | `/api/cyber/urlhaus`            | None                                                | URLhaus malware URLs                                                |
| `GET`  | `/api/cyber/threatfox`          | None                                                | ThreatFox IOC feed (3-day)                                          |
| `GET`  | `/api/cyber/urlhaus-auth`       | `ABUSECH_KEY` optional                              | URLhaus 100-record limit                                            |
| `GET`  | `/api/cyber/threatfox-auth`     | `ABUSECH_KEY` optional                              | ThreatFox 7-day IOC window                                          |
| `GET`  | `/api/gnss/anomalies`           | None                                                | 13 curated GNSS zones + GDELT news                                  |
| `GET`  | `/api/gps/anomalies`            | None                                                | Alias to /api/gnss/anomalies                                        |
| `GET`  | `/api/gps/zones`                | None                                                | Curated GNSS zones only                                             |
| `GET`  | `/api/social/reddit`            | None                                                | Reddit OSINT posts                                                  |
| `GET`  | `/api/fusion/zones`             | None                                                | All threat zones                                                    |
| `GET`  | `/api/fusion/viewport`          | None                                                | Viewport-filtered zones (?latMin&latMax&lonMin&lonMax)              |
| `GET`  | `/api/fusion/global`            | None                                                | Platform overview and domain coverage                               |
| `GET`  | `/api/imagery/copernicus-token` | `COPERNICUS_CLIENT_ID` + `COPERNICUS_CLIENT_SECRET` | Short-lived Copernicus OAuth2 token                                 |

---

## Free Source Reference

### No API key required

| Source                  | URL                              | Used for                                             |
| ----------------------- | -------------------------------- | ---------------------------------------------------- |
| adsb.one ADS-B          | https://api.adsb.one/            | Air layer (replaces blocked OpenSky Network on edge) |
| USGS Earthquake         | https://earthquake.usgs.gov/     | Seismic layer (client-side direct fetch)             |
| wheretheiss.at          | https://wheretheiss.at/          | ISS position (client-side, 5-second polling)         |
| CelesTrak               | https://celestrak.org/           | Space station TLE + frontend SGP4 propagation        |
| NASA GIBS               | https://gibs.earthdata.nasa.gov/ | MODIS/VIIRS satellite imagery tiles                  |
| EOX Sentinel-2          | https://s2maps.eu/               | 10 m/px annual cloudless imagery                     |
| CISA KEV                | https://www.cisa.gov/            | Cyber -- known exploited vulnerabilities             |
| URLhaus                 | https://urlhaus-api.abuse.ch/    | Cyber -- malware URL feed                            |
| ThreatFox               | https://threatfox-api.abuse.ch/  | Cyber -- IOC feed                                    |
| AlienVault OTX (public) | https://otx.alienvault.com/      | Cyber -- threat intelligence pulses                  |
| GDELT 2.0               | https://api.gdeltproject.org/    | Conflict, maritime, nuclear, cyber OSINT             |
| GDACS                   | https://www.gdacs.org/           | Weather storms, earthquakes, volcanoes, floods       |
| ReliefWeb (UN OCHA)     | https://api.reliefweb.int/       | Humanitarian disaster data                           |
| Reddit public JSON      | https://www.reddit.com/          | Social OSINT posts                                   |

### Free registration required

| Source               | Registration URL                          | Variable                                            |
| -------------------- | ----------------------------------------- | --------------------------------------------------- |
| NASA FIRMS           | https://firms.modaps.eosdis.nasa.gov/api/ | `NASA_FIRMS_KEY`                                    |
| OpenWeatherMap       | https://openweathermap.org/appid          | `OWM_KEY`                                           |
| N2YO                 | https://www.n2yo.com/api/                 | `N2YO_KEY`                                          |
| Global Fishing Watch | https://globalfishingwatch.org/our-apis/  | `GFW_TOKEN`                                         |
| AVWX                 | https://avwx.rest/                        | `AVWX_KEY`                                          |
| AlienVault OTX       | https://otx.alienvault.com/               | `OTX_KEY`                                           |
| abuse.ch             | https://abuse.ch/auth/                    | `ABUSECH_KEY`                                       |
| ACLED                | https://developer.acleddata.com/          | `ACLED_KEY` + `ACLED_EMAIL`                         |
| NewsAPI              | https://newsapi.org/register              | `NEWS_API_KEY`                                      |
| Shodan               | https://account.shodan.io/                | `SHODAN_KEY`                                        |
| AISStream            | https://aisstream.io/                     | `AISSTREAM_KEY`                                     |
| Space-Track.org      | https://www.space-track.org/              | `SPACETRACK_USER` + `SPACETRACK_PASS`               |
| Copernicus Dataspace | https://dataspace.copernicus.eu/          | `COPERNICUS_CLIENT_ID` + `COPERNICUS_CLIENT_SECRET` |

### Commercial / paid

| Source                        | Variable         | Notes                                                    |
| ----------------------------- | ---------------- | -------------------------------------------------------- |
| ADS-B Exchange (military air) | `RAPIDAPI_KEY`   | Via RapidAPI marketplace                                 |
| Cesium Ion                    | `CESIUM_TOKEN`   | 3D globe and terrain tiles                               |
| Planet Labs                   | `PLANET_API_KEY` | Commercial satellite imagery (no active integration yet) |

---

## Mobile UX

The interface is optimized for portrait mobile:

- **Drawer**: The HUD panel (Layers, Threat Board, Sources) slides up from the bottom. Swipe down or tap outside to dismiss.
- **Domain tabs**: Tabs switch between Air, Sea, Space, Weather, Conflict, Cyber, GNSS, Social views.
- **Compact cards**: Each event shows a two-line card: title and source/severity badge. Tap to open the full inspector.
- **Inspector**: Slides up from the bottom on mobile. Shows full canonical event detail: coordinates, confidence badge, provenance label, source URL, metadata.
- **Map**: Pinch-to-zoom, single-finger pan. Clusters collapse at zoom < 5.

---

## Timeline / Replay

Press **T** or click the clock icon to open the timeline scrubber.

- **Time windows**: 1H, 6H, 12H, 24H, 48H -- cycle with the window selector.
- **Scrubber**: Drag the cursor to filter map entities to those with `timestamp` at or before the cursor position.
- **Playback**: Play/pause with speed control at 1x, 2x, 4x, 8x.
- **Density histogram**: A density overlay on the scrubber track shows event distribution across the time window.

**Limitation**: The timeline filters already-loaded data client-side. It does not replay historical API snapshots. Sources return their current data on each fetch.

---

## Source Health

The **SOURCES** tab shows the health of all configured sources.

| Status       | Meaning                                                                |
| ------------ | ---------------------------------------------------------------------- |
| `live`       | Source responded within timeout with valid data                        |
| `configured` | API key is set. Not auto-probed (to avoid burning rate limits).        |
| `no-key`     | API key environment variable not set. Layer returns `_upstream_error`. |
| `error`      | HTTP error or timeout on probe                                         |

`GET /api/sources/health` probes all free sources in parallel (8-second timeout) and returns:

```json
{
  "sources": [
    { "name": "USGS Seismic", "status": "live", "latency_ms": 210 },
    { "name": "NASA FIRMS", "status": "configured", "key_configured": true }
  ],
  "total": 17,
  "live": 7
}
```

In the UI: SOURCES tab -> Refresh Sources. Each row shows name, status badge, latency, and timestamp.

---

## Troubleshooting

### Blank page on load

Open DevTools Console. Most common causes:

1. **Leaflet failed to load** from unpkg CDN. Check Network tab -- `leaflet.js` and `leaflet.css` must be HTTP 200.
2. **Dependency loader stalled**: The inline loader in the HTML shell loads Leaflet -> MarkerCluster -> satellite.js sequentially. A failure on a non-optional dep shows "Failed to load critical dependency" in the spinner.
3. **CSP blocking `unpkg.com`**: Check Cloudflare Pages `_headers` file if present.

### 502 or 500 on Railway

1. Check Railway logs for `wrangler pages dev` output.
2. Ensure `dist/` was built before start -- `dist/_worker.js` must exist.
3. Confirm `PORT` environment variable is set and that `npm start` passes it to wrangler.
4. Node.js must be >= 18.

### Missing Leaflet (L is not defined)

Leaflet is loaded from `https://unpkg.com/leaflet@1.9.4/dist/leaflet.js`. If blocked:

- Verify CSP headers allow `unpkg.com` in `script-src` and `style-src`.
- Consider hosting Leaflet in `public/static/` as a self-hosted fallback.

### Missing static assets (/static/sentinel.js 404)

- In dev: Vite serves `public/` automatically.
- In production: `npm run build` copies `public/` to `dist/`. Confirm `dist/static/sentinel.js` exists.
- If missing: re-run `npm run build` and check Vite output for errors.

### Missing or incorrect API keys

- `curl /api/status` shows `true/false` for each key.
- `curl /api/sources/health` shows live status and key configuration.
- For local dev: confirm `.dev.vars` exists at the project root with `KEY=VALUE` pairs (no quotes, no spaces around `=`).
- After editing `.dev.vars`, restart `npm run dev`. The Wrangler adapter reads it only at startup.

### Upstream source failure (layer shows error badge)

- Check `curl /api/sources/health` to identify the failing source.
- GDELT returns HTTP 429 when rate-limited. The `fetchGDELT()` wrapper retries once after 2 seconds automatically.
- OpenSky Network is not accessible from Cloudflare edge -- adsb.one is used. If adsb.one is down, the aircraft layer returns an empty `states` array with a graceful `_upstream_error`.
- OWM rejects requests when the free plan monthly quota is exceeded.

### Build failure

Run `npm run build` and check output:

- TypeScript errors in `src/index.tsx` will block the build.
- The build output should end with `dist/_worker.js XX kB`.
- If wrangler reports an unrecognized `compatibility_date`, update: `npm update wrangler`.

---

## Project Structure

```
sentinel-os/
  src/
    index.tsx             # Hono BFF -- all API routes, proxy, canonical schema
  public/
    static/
      sentinel.js         # Frontend client (Leaflet map, parsers, UI, threat scoring)
      style.css           # Dark-ops CSS (Palantir/NATO COP aesthetic)
  dist/                   # Build output (generated, not committed)
    _worker.js            # Cloudflare Pages Workers bundle
    static/               # Copied from public/static/
  ecosystem.config.cjs    # PM2 config (no secrets hardcoded)
  package.json
  vite.config.ts          # Vite + Hono Cloudflare Pages plugin
  wrangler.jsonc          # Cloudflare Pages deployment config
  tsconfig.json
  .dev.vars               # Local secrets (never committed)
  .gitignore
```

---

## Keyboard Shortcuts

| Key      | Action                          |
| -------- | ------------------------------- |
| `1`      | Layers panel                    |
| `2`      | Threat board                    |
| `3`      | Sources / source health         |
| `S`      | Satellite imagery panel         |
| `Z`      | Toggle threat zone overlays     |
| `R`      | Refresh all feeds               |
| `/ or F` | Focus search                    |
| `T`      | Toggle timeline replay scrubber |
| `Escape` | Close panel / dismiss search    |

---

## Satellite Imagery

Five free tile sources are available via the SAT panel (press `S`):

| Product                | Source        | Resolution        | Cadence       |
| ---------------------- | ------------- | ----------------- | ------------- |
| MODIS Terra True Color | NASA GIBS     | 250 m/px          | Daily         |
| MODIS Aqua True Color  | NASA GIBS     | 250 m/px          | Daily         |
| VIIRS SNPP True Color  | NASA GIBS     | 250 m/px          | Daily         |
| VIIRS Nighttime Lights | NASA GIBS     | Monthly composite | Monthly       |
| Sentinel-2 Cloudless   | EOX S2Maps.eu | 10 m/px           | Annual mosaic |

The authenticated Copernicus WMTS layer requires `COPERNICUS_CLIENT_ID` and `COPERNICUS_CLIENT_SECRET`. The server returns a short-lived OAuth2 token via `/api/imagery/copernicus-token`.

---

## Changelog

### v6.2.0 (current)

- Replaced OpenSky Network (blocked from Cloudflare edge) with adsb.one -- 12,000+ aircraft globally, server-side format transformation to OpenSky `states[]` compatibility
- Fixed `hashPayload(partial)` scoping bug in CISA KEV and ThreatFox handlers
- Created `.dev.vars` loading pipeline -- keyed layers now work correctly in local dev via `wrangler.getPlatformProxy()`
- Added domain routes: `/api/air/traffic`, `/api/sea/vessels`, `/api/space/satellites`, `/api/space/spacetrack`, `/api/weather/storm-events`, `/api/conflict/events`, `/api/conflict/zones`, `/api/fusion/global`
- Added GPS alias routes: `/api/gps/anomalies`, `/api/gps/zones`
- Added authenticated abuse.ch endpoints: `/api/cyber/urlhaus-auth`, `/api/cyber/threatfox-auth`
- Added Copernicus OAuth2 endpoint: `/api/imagery/copernicus-token`
- Added `/api/sources/health` -- live probe with latency for all free sources
- Updated Bindings type: added `ABUSECH_KEY`, `SPACETRACK_USER`, `SPACETRACK_PASS`, `CESIUM_TOKEN`, `COPERNICUS_CLIENT_ID`, `COPERNICUS_CLIENT_SECRET`, `PLANET_API_KEY`

### v6.1.0

- Canonical event schema with provenance tracking and confidence metadata
- Timeline replay scrubber (1H-48H windows, play/pause, 1x-8x speed)
- Source health monitoring in SOURCES tab
- Satellite imagery (NASA GIBS + Sentinel-2) with date picker
- Inspector panel with full event detail, confidence badges, source URLs
- Removed all hardcoded secrets

### v6.0.0

- Production rewrite: Hono BFF on Cloudflare Pages
- Edge proxy pattern -- browser never sees API keys
- CISA KEV, URLhaus, ThreatFox, AlienVault OTX cyber layer
- GNSS jamming/spoofing reference model (13 zones)
- Reddit OSINT social layer
- Fusion threat zones with viewport filtering

---

## License

Open source. Free for educational and research use.
