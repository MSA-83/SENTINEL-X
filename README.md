# SENTINEL OS v8.5

## Global Multi-Domain Situational Awareness Platform

Production-grade OSINT situational awareness system aggregating **25+ live data sources** across **13 intelligence domains**: aviation, maritime, orbital, seismic, wildfire, weather, conflict, disaster, cyber, nuclear, GNSS jamming, social media, and satellite imagery.

**Architecture**: Edge BFF (Backend-for-Frontend) on Cloudflare Workers (Hono). All keyed API calls route through server-side proxy -- the browser never sees secrets. Every record conforms to a canonical event schema with provenance, confidence metadata, SHA-256 payload hashing, and cross-source correlation.

## Live URL

- **Sandbox**: https://3000-imtcnhyw0xv31oywd9i92-dfc00ec5.sandbox.novita.ai

## v8.5 Features (25 Tasks Completed)

### Backend (Hono + Cloudflare Workers)
| # | Feature | Endpoint | Status |
|---|---------|----------|--------|
| 1 | Response Cache (TTL) | In-memory with per-source TTLs | Done |
| 2 | Circuit Breaker | 5-failure threshold, 2min cooldown | Done |
| 3 | SIGMET Aviation Hazards | `GET /api/avwx/sigmets` | Done |
| 4 | NASA EONET Natural Events | `GET /api/eonet/events` | Done |
| 5 | Coordinate-Based METAR | `GET /api/avwx/near?lat=&lon=` | Done |
| 6 | Shodan Geo-Search | `POST /api/shodan/geo` | Done |
| 7 | Shodan Host Intel | `GET /api/shodan/host/:ip` | Done |
| 8 | Shodan Exploit Lookup | `GET /api/shodan/exploits/:cve` | Done |
| 9 | Intel Overview Fan-out | `GET /api/intel/overview?lat=&lon=` | Done |
| 10 | Circuit Status Diagnostic | `GET /api/circuits` | Done |
| 11 | Cache Status Diagnostic | `GET /api/cache/status` | Done |
| 12 | Request-ID Tracing | `X-Request-ID` header on every response | Done |

### Frontend (sentinel.js)
| # | Feature | Description |
|---|---------|-------------|
| 1 | SIGMET Polygon Rendering | Hazard-colored polygons on Leaflet map |
| 2 | EONET Event Markers | Category-specific icons, clustered |
| 3 | Shodan Geo-Pins | Exposed hosts on cyber layer |
| 4 | Intel Overview Panel | Right-click any location for multi-domain summary |
| 5 | Circuit Breaker UI | Shows open/failing circuits in Sources panel |
| 6 | Coordinate METAR | Double-click map for nearest station weather |
| 7 | Cache-Hit Indicators | Shows cached responses with TTL remaining |
| 8 | Entity Parser Hardening | Squawk detection, magnitude filtering, confidence thresholds |
| 9 | Deduplication Enforcement | Fingerprint-based cross-source merge |
| 10 | Correlation Engine | Links related events, tracks correlated sources |
| 11 | Threat-Scoring v2 | Confidence/freshness weighting, new entity types |
| 12 | Domain Tab UI | Horizontal filter tabs (AIR/SEA/SPACE/WEATHER/CONFLICT/CYBER/GNSS/SOCIAL) |
| 13 | Mobile Drawer Panels | Slide-in left panel, bottom-sheet inspector |
| 14 | Confidence/Freshness Chips | Color-coded badges on all markers and cards |
| 15 | Timeline Replay Controls | Play/pause/speed scrubber with time windowing |
| 16 | Viewport-Based Layer Culling | Only render markers in view on mobile |
| 17 | Performance Throttles | Marker caps, render debounce, deferred loading |
| 18 | Copernicus Imagery Tiles | OAuth2 token proxy for Sentinel-2 L2A |
| 19 | GNSS Anomaly Circle Overlays | Jamming/spoofing radius circles on map |
| 20 | Social Feed Integration | Reddit + Mastodon OSINT feeds |
| 21 | Space-Track CDM Visualization | Conjunction markers with collision probability |

## API Endpoints

### Core Intelligence
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | System status, version, enabled features |
| GET | `/api/status` | API key presence, target counts, schema |
| GET | `/api/metrics/health` | Per-layer source health metrics |
| GET | `/api/circuits` | Circuit breaker states |
| GET | `/api/cache/status` | Response cache entries and TTLs |
| POST | `/api/proxy` | Secure server-side API proxy |

### Aviation
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/avwx/global` | METAR for 15 major airports |
| GET | `/api/avwx/sigmets?hazard=` | Active SIGMETs (cached 10 min) |
| GET | `/api/avwx/near?lat=&lon=&limit=` | Nearest station METARs |

### Weather & Natural Events
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/weather/global` | OpenWeatherMap for 20 cities |
| GET | `/api/eonet/events?days=&limit=&lat=&lon=&radius=` | NASA EONET v3 |
| GET | `/api/gnss/anomalies` | GNSS jamming/spoofing zones + news |

### Orbital
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/spacetrack/gp` | Active satellite catalog (150 payloads) |
| GET | `/api/spacetrack/cdm` | Conjunction data messages (collision risk) |
| GET | `/api/spacetrack/status` | Auth diagnostic |

### Maritime
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/ais/config` | AIS availability check |

### Cyber
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/shodan/search` | Keyword search |
| POST | `/api/shodan/geo` | Geospatial search (lat/lon/radius) |
| GET | `/api/shodan/host/:ip` | Per-IP enrichment |
| GET | `/api/shodan/exploits/:cve` | CVE exploit lookup |
| GET | `/api/cyber/cisa-kev` | CISA Known Exploited Vulnerabilities |
| GET | `/api/cyber/otx` | AlienVault OTX pulses |
| GET | `/api/cyber/urlhaus` | Malware URL feed |
| GET | `/api/cyber/threatfox` | IOC feed |

### Conflict & Disaster
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/intel/gdelt` | GDELT article-based intel (conflict/cyber/nuclear) |
| POST | `/api/intel/news` | NewsAPI supplemental |
| GET | `/api/acled/events` | Armed conflict events |
| GET | `/api/reliefweb/disasters` | UN OCHA disaster data |

### Social
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/social/reddit` | Reddit OSINT subreddits |
| GET | `/api/social/mastodon` | Mastodon infosec timelines |

### Imagery
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/copernicus/token` | Sentinel Hub OAuth2 token proxy |
| GET | `/api/cesium/token` | Cesium ion token proxy |

### Fusion
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/intel/overview?lat=&lon=&radius=&domains=` | Multi-domain concurrent fan-out |
| GET | `/api/fusion/zones` | Threat zone definitions |
| GET | `/api/fusion/viewport?latMin=&latMax=&lonMin=&lonMax=` | Viewport-filtered zones |

## Keyboard Shortcuts
| Key | Action |
|-----|--------|
| `1` | Layers panel |
| `2` | Threat board |
| `3` | Sources/Health panel |
| `Z` | Toggle threat zones |
| `S` | Toggle satellite imagery panel |
| `T` | Toggle timeline replay |
| `R` | Force refresh all data |
| `/` or `F` | Focus search |
| `Esc` | Close panels/inspector |
| Right-click | Intel Overview for any location |
| Double-click | Nearest METAR weather |

## Data Sources (18 API Keys)
| Key | Service | Domain |
|-----|---------|--------|
| `OWM_KEY` | OpenWeatherMap | Weather |
| `AVWX_KEY` | AVWX REST | Aviation METAR/SIGMET |
| `NASA_FIRMS_KEY` | NASA FIRMS | Wildfires |
| `N2YO_KEY` | N2YO | Satellites |
| `SPACETRACK_USER/PASS` | Space-Track | Orbital/CDM |
| `GFW_TOKEN` | Global Fishing Watch | Maritime |
| `SHODAN_KEY` | Shodan | Cyber |
| `RAPIDAPI_KEY` | RapidAPI | Military aviation |
| `ACLED_KEY/EMAIL` | ACLED | Armed conflict |
| `NEWS_API_KEY` | NewsAPI | Conflict intel |
| `OTX_KEY` | AlienVault OTX | Cyber threat intel |
| `ABUSECH_AUTH_KEY` | abuse.ch | Malware feeds |
| `AISSTREAM_KEY` | AISStream.io | Maritime AIS |
| `COPERNICUS_CLIENT_ID/SECRET` | Copernicus | Satellite imagery |
| `CESIUM_ION_TOKEN` | Cesium ion | 3D globe |

## Free Sources (No Key Required)
- USGS Earthquake API (seismic)
- NASA EONET v3 (natural events)
- GDACS (disasters)
- ReliefWeb (UN OCHA disasters)
- GDELT 2.0 (conflict/cyber/nuclear intel)
- CelesTrak (satellite TLE/SGP4)
- wheretheiss.at (ISS tracking)
- CISA KEV (cyber vulnerabilities)
- URLhaus (malware URLs)
- ThreatFox (IOCs)
- Reddit (public JSON)
- Mastodon (public timelines)
- GPSJam.org data (GNSS reference model)

## Tech Stack
- **Runtime**: Cloudflare Workers (edge)
- **Framework**: Hono v4
- **Frontend**: Vanilla JS + Leaflet + MarkerCluster + satellite.js
- **Styling**: Custom CSS (dark-ops theme, responsive breakpoints)
- **Build**: Vite SSR
- **Deployment**: Cloudflare Pages

## Deployment
```bash
npm run build
npm run deploy  # -> wrangler pages deploy dist --project-name sentinel-os
```

## Version History
- **v8.5.0** — 25-task implementation: full frontend integration, SIGMET/EONET/Shodan layers, Intel Overview, CDM viz, GNSS circles, mobile hardening
- **v8.4.0** — Backend: response cache, circuit breaker, 9 new endpoints
- **v8.3.0** — Space-Track auth, mobile inspector, domain cards
- **v8.0.0** — Source metrics, CelesTrak SGP4, GNSS/Social layers
