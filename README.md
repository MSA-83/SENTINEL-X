# SENTINEL-X

SENTINEL-X is a Leaflet-based global situational awareness HUD with a Cloudflare-compatible Hono Backend-for-Frontend (BFF).

## What is implemented

- Secure BFF endpoints (no upstream credentials in browser code).
- Canonical event normalization across domains.
- Layered intelligence domains:
  - Air
  - Sea (fallback maritime-adjacent open feed)
  - Space
  - Weather
  - Conflict
  - Cyber
  - GNSS anomaly
  - Social
- Viewport fusion endpoint for map-bounded event retrieval.
- Analyst HUD with:
  - Domain toggles
  - Source inspector (source, provenance, timestamp, confidence, severity, correlations, original URL)
  - Time slider and replay
  - Clustered map markers
  - Uncertainty styling (`?` marker for inferred geolocation; lower-opacity low-confidence entities)

## Security posture

- **All keyed services must be proxied server-side only.**
- **No secrets are hardcoded in frontend files.**
- `ecosystem.config.cjs` now reads env vars only.
- If tokens were previously exposed, rotate them immediately and invalidate old credentials.

## API

- `GET /api/health`
- `GET /api/status`
- `POST /api/fusion/viewport`
- `GET /api/layers/air`
- `GET /api/layers/sea`
- `GET /api/layers/space`
- `GET /api/layers/weather`
- `GET /api/layers/conflict`
- `GET /api/layers/cyber`
- `GET /api/layers/gnss`
- `GET /api/layers/social`

All domain endpoints return normalized events with this minimum shape:

- `id`
- `entity_type`
- `source`
- `source_url`
- `title`
- `description`
- `lat`
- `lon`
- `altitude`
- `velocity`
- `heading`
- `timestamp`
- `observed_at`
- `confidence`
- `severity`
- `risk_score`
- `region`
- `tags`
- `correlations`
- `metadata`
- `raw_payload_hash`
- `provenance`

## Environment variables

Optional (set in runtime env / deployment platform):

```bash
OTX_KEY=
OPENSKY_USERNAME=
OPENSKY_PASSWORD=
```

## Local development

```bash
npm install
npm run dev
```

## Build and edge preview

```bash
npm run build
npm run preview
```

## Deployment notes

- Runtime target is Cloudflare Pages/Workers-compatible.
- Root route `/` serves HTML shell and static assets from `/static/*`.
- If deploying on Railway with Node process manager, bind to `0.0.0.0:$PORT`.

## Known limitations

- Free unauthenticated global AIS streams are limited; the current maritime layer uses open fallback data until authenticated AIS ingestion is configured.
- GNSS global API availability is inconsistent; this build combines open hotspot references and GNSS-related reporting with explicit confidence labels.
- Social geolocation is treated as inferred unless explicit coordinates are present.
