# SENTINEL-X v9.0

## Multi-Domain Situational Awareness & Decision-Support Platform

Production-grade intelligence platform aggregating **25+ live data sources** across **19 domains**, with full auth, alerting, case management, knowledge graph, analytics, and command center UI.

**Architecture**: Edge BFF on Cloudflare Workers (Hono). All keyed API calls route through server-side proxy. In-memory stores for auth, alerts, cases, workspaces, and knowledge graph (production: use D1).

## Live URL

- **Sandbox**: https://3000-imtcnhyw0xv31oywd9i92-dfc00ec5.sandbox.novita.ai
- **GitHub**: https://github.com/MSA-83/SENTINEL-X

## v9.0 Platform Features

### Auth System
- JWT HS256 tokens (30-min expiry)
- 6 roles: ADMIN, COMMANDER, OPERATOR, ANALYST, VIEWER, EXEC
- Login, register, profile, preferences
- Audit logging with IP tracking
- Demo accounts: admin/admin, analyst/analyst, operator/operator, commander/commander, viewer/viewer, exec/exec

### Alert Platform
| Feature | Description |
|---------|-------------|
| Priority Levels | P1_CRITICAL, P2_HIGH, P3_MEDIUM, P4_LOW, P5_INFO |
| Status Workflow | NEW -> ACKNOWLEDGED -> IN_PROGRESS -> RESOLVED / SUPPRESSED / ESCALATED |
| Assignment | Assign to users, comment threads |
| Filtering | By priority, status, domain |
| SLA Tracking | Escalation timers per priority |
| Auto-creation | Create alerts from any entity on the map |

### Case Management
| Feature | Description |
|---------|-------------|
| Cases | Create investigations, attach entities/alerts |
| Notes | Add analyst notes with timestamps |
| Timeline | Automatic action audit trail |
| Status | OPEN -> IN_PROGRESS -> PENDING_REVIEW -> CLOSED -> ARCHIVED |
| Tags | Tagging system for organization |

### Knowledge Graph
| Feature | Description |
|---------|-------------|
| Node Types | person, organization, vessel, aircraft, facility, event, location, network, ip_address, domain |
| Edge Types | owns, operates, visited, linked_to, transmitted_to, observed_near, sanctioned_by, crew_of, flagged_by, parent_of, alias_of |
| Visual Explorer | Full node-edge display with confidence scores |
| Seeded Data | Demo maritime sanctions network, APT29 infrastructure, OSINT relationships |

### Workspace System
- Persistent workspaces with center/zoom, layer configs, domain filters
- Area of Interest (AOI) polygons
- Geofence definitions with enter/exit alerts
- Saved queries and map annotations
- Demo: Global Watch, EUCOM Watch, Cyber Operations, Indo-Pacific Watch

### Analytics Engine
- Global threat index (CRITICAL/ELEVATED/GUARDED/ADVISORY/NOMINAL)
- Alert statistics by priority and domain
- Trend computation (24-hour hourly breakdown)
- Source reliability tracking
- Platform-wide metrics (users, cases, workspaces, graph nodes)

### Entity Resolution
- Multi-source entity merge with alias tracking
- Canonical name resolution
- Position history with source attribution
- Confidence-weighted scoring
- Demo: MV DARK HORIZON (vessel), RCH402 (aircraft), APT29 (threat actor)

### Geofence Engine
- Circle and polygon geofences
- Enter/exit/both alert triggers
- Domain-filtered monitoring
- Violation counting and tracking
- Demo: Hormuz Monitor, Taiwan ADIZ, Gaza Buffer, Baltic GNSS Watch

## API Endpoints (Complete)

### Auth & Admin
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Login with username/password |
| POST | `/api/auth/register` | Create new account |
| GET | `/api/auth/me` | Current user profile |
| PUT | `/api/auth/preferences` | Update preferences |
| GET | `/api/admin/users` | List all users (ADMIN) |
| PUT | `/api/admin/users/:id/role` | Change user role (ADMIN) |
| GET | `/api/admin/audit` | Audit log (COMMANDER+) |

### Alerts
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/alerts?priority=&status=&domain=` | List alerts with filters |
| GET | `/api/alerts/:id` | Alert detail |
| POST | `/api/alerts` | Create alert |
| PUT | `/api/alerts/:id` | Update alert status/assignment |
| POST | `/api/alerts/:id/comment` | Add comment |

### Cases
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/cases?status=` | List cases |
| GET | `/api/cases/:id` | Case detail |
| POST | `/api/cases` | Create case |
| PUT | `/api/cases/:id` | Update case |
| POST | `/api/cases/:id/note` | Add note |

### Knowledge Graph
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/graph/nodes?type=&search=` | Search nodes |
| GET | `/api/graph/nodes/:id` | Node detail with edges |
| POST | `/api/graph/nodes` | Create node |
| GET | `/api/graph/edges?from=&to=` | Query edges |
| POST | `/api/graph/edges` | Create edge |
| GET | `/api/graph/full` | Full graph export |

### Workspaces
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/workspaces` | List workspaces |
| GET | `/api/workspaces/:id` | Workspace detail |
| POST | `/api/workspaces` | Create workspace |
| PUT | `/api/workspaces/:id` | Update workspace |

### Geofences
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/geofences` | List geofences |
| POST | `/api/geofences` | Create geofence |
| POST | `/api/geofences/check` | Check lat/lon against geofences |

### Analytics
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/analytics/overview` | Full analytics dashboard data |
| GET | `/api/analytics/trends` | 24-hour trend data |

### Entity Resolution
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/entities/resolved?type=&search=` | Search resolved entities |
| GET | `/api/entities/resolved/:id` | Entity detail |

### Global Search
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/search?q=` | Search across alerts, cases, graph, entities |

### Expanded Domain Intelligence
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/intel/infrastructure` | Infrastructure attack monitoring |
| GET | `/api/intel/energy` | Energy sector intelligence |
| GET | `/api/intel/logistics` | Supply chain disruption |
| GET | `/api/intel/border` | Border/migration monitoring |
| GET | `/api/intel/telecom` | Telecom outage/disruption |
| GET | `/api/intel/public-safety` | Public safety threats |

### Core Intelligence (preserved from v8.5)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | System status, version, features |
| GET | `/api/status` | API key presence, schema |
| GET | `/api/metrics/health` | Per-layer source metrics |
| GET | `/api/circuits` | Circuit breaker states |
| GET | `/api/cache/status` | Response cache entries |
| POST | `/api/proxy` | Secure server-side proxy |
| GET | `/api/avwx/sigmets` | Active SIGMETs |
| GET | `/api/avwx/near?lat=&lon=` | Nearest METAR |
| GET | `/api/eonet/events` | NASA EONET |
| POST | `/api/shodan/geo` | Shodan geo-search |
| GET | `/api/intel/overview?lat=&lon=` | Multi-domain fan-out |
| GET | `/api/weather/global` | OpenWeatherMap |
| GET | `/api/spacetrack/gp` | Satellite catalog |
| GET | `/api/spacetrack/cdm` | Conjunction data |
| GET | `/api/cyber/cisa-kev` | CISA KEV |
| GET | `/api/cyber/otx` | AlienVault OTX |
| GET | `/api/gnss/anomalies` | GNSS zones |
| GET | `/api/social/reddit` | Reddit OSINT |
| GET | `/api/social/mastodon` | Mastodon OSINT |
| GET | `/api/fusion/zones` | Threat zones |

## Frontend Views

| View | Key | Description |
|------|-----|-------------|
| Global Watch | `1` | Primary map-centric situational awareness |
| Alerts | `2` | Alert management with priority filtering |
| Cases | `3` | Investigation case management |
| Intel Graph | `4` | Knowledge graph entity-relationship explorer |
| Analytics | `5` | Dashboards, threat index, trend charts |
| Admin | `6` | System administration, users, geofences |

## Keyboard Shortcuts
| Key | Action |
|-----|--------|
| `1-5` | Switch views |
| `R` | Force refresh all data |
| `/` or `F` | Focus global search |
| `Esc` | Close panels/search |
| Right-click | Intel Overview |
| Double-click | Nearest METAR |

## Supported Domains (19)
aviation, maritime, orbital, seismic, wildfire, weather, conflict, disaster, cyber, nuclear, gnss, social, imagery, infrastructure, energy, logistics, border, telecom, public-safety

## Tech Stack
- **Runtime**: Cloudflare Workers (edge)
- **Framework**: Hono v4
- **Frontend**: Vanilla JS + Leaflet + MarkerCluster + Chart.js + satellite.js
- **Styling**: Custom CSS (command center dark-ops theme)
- **Build**: Vite SSR
- **Deployment**: Cloudflare Pages

## Version History
- **v9.0.0** -- Full platform rewrite: auth, alerts, cases, knowledge graph, analytics, workspaces, geofences, entity resolution, 19 domains, command center UI
- **v8.5.0** -- 25-task frontend: SIGMET/EONET/Shodan layers, CDM viz, GNSS circles
- **v8.4.0** -- Backend: response cache, circuit breaker, 9 new endpoints
- **v8.3.0** -- Space-Track auth, mobile inspector, domain cards
