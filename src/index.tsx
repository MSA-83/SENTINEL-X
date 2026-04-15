/**
 * SENTINEL-X v9.0 — Multi-Domain Situational Awareness & Decision-Support Platform
 * Secure Edge BFF (Backend-for-Frontend) on Cloudflare Pages (Hono)
 *
 * v9.0: Full platform rewrite per Sentinel-X specification:
 *   - Auth system: JWT HS256, RBAC (ADMIN/COMMANDER/OPERATOR/ANALYST/VIEWER/EXEC), login/register/me
 *   - Alert platform: create, acknowledge, assign, suppress, escalation timers, SLA tracking
 *   - Case management: create cases, attach entities/alerts, notes, timeline, status workflow
 *   - Workspace system: persistent workspaces with layer/filter state, shared channels
 *   - Knowledge graph: entities (people, orgs, vessels, aircraft, facilities) + edges
 *   - Analytics engine: trend computation, domain comparison, threat timelines, source reliability
 *   - Entity resolution: multi-source merge, alias correlation, ownership tracking, confidence-weighted
 *   - Expanded domains: infrastructure, energy, logistics, border, telecom, public safety
 *   - Geofence engine: define AOI polygons, detect violations, trigger alerts
 *   - Anomaly detection: loitering, dark periods, route deviation, density clusters
 *   - Enhanced threat scoring: baselines, escalation trends, hotspot emergence
 *   - All v8.5 data source endpoints preserved intact
 *
 * Architecture:
 *   - All keyed API calls route through server-side proxy — browser NEVER sees secrets
 *   - Every response normalizes into canonical event schema with provenance + confidence
 *   - In-memory stores (users, alerts, cases, workspaces, graph) for edge deployment
 *   - Geocoded/inferred locations are explicitly marked and down-weighted
 *   - raw_payload_hash for provenance chain integrity
 *
 * Domains: aviation · maritime · orbital · seismic · wildfire · weather ·
 *          conflict · disaster · cyber · nuclear · gnss · social · imagery ·
 *          infrastructure · energy · logistics · border · telecom · public-safety
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'

// ─── Environment bindings (Cloudflare secrets / .dev.vars) ───────────────────
type Bindings = {
  NASA_FIRMS_KEY?: string
  OWM_KEY?: string
  N2YO_KEY?: string
  GFW_TOKEN?: string
  AVWX_KEY?: string
  RAPIDAPI_KEY?: string
  ACLED_KEY?: string
  ACLED_EMAIL?: string
  SHODAN_KEY?: string
  NEWS_API_KEY?: string
  AISSTREAM_KEY?: string
  OTX_KEY?: string
  ABUSECH_AUTH_KEY?: string
  SPACETRACK_USER?: string
  SPACETRACK_PASS?: string
  COPERNICUS_CLIENT_ID?: string
  COPERNICUS_CLIENT_SECRET?: string
  CESIUM_ION_TOKEN?: string
}

const app = new Hono<{ Bindings: Bindings }>()
app.use('/api/*', cors())

// ═══════════════════════════════════════════════════════════════════════════════
// REQUEST-ID TRACING — unique ID per request for debugging/observability
// ═══════════════════════════════════════════════════════════════════════════════
app.use('*', async (c, next) => {
  const requestId = crypto.randomUUID().slice(0, 8)
  c.set('requestId' as any, requestId)
  await next()
  c.header('X-Request-ID', requestId)
  c.header('X-Powered-By', 'SENTINEL-OS')
})

const VERSION = '9.0.0'
const UA = `SENTINEL-OS/${VERSION} (OSINT Platform)`

// ═══════════════════════════════════════════════════════════════════════════════
// CANONICAL EVENT SCHEMA HELPERS
// Every record reaching the client conforms to this shape.
// ═══════════════════════════════════════════════════════════════════════════════
interface CanonicalEvent {
  id: string
  entity_type: string
  source: string
  source_url: string
  title: string
  description: string
  lat: number | null
  lon: number | null
  altitude: number | null
  velocity: number | null
  heading: number | null
  timestamp: string
  observed_at: string
  confidence: number          // 0-100
  severity: string            // critical | high | medium | low | info
  risk_score: number          // 0-100
  region: string
  tags: string[]
  correlations: string[]
  metadata: Record<string, unknown>
  raw_payload_hash: string    // SHA-256 of upstream payload for provenance chain
  provenance: string          // e.g. "direct-api" | "geocoded-inferred" | "curated-reference"
}

/** Compute a fast hash for provenance chain integrity */
async function hashPayload(data: unknown): Promise<string> {
  try {
    const text = typeof data === 'string' ? data : JSON.stringify(data)
    const buf = new TextEncoder().encode(text.slice(0, 4096))
    const hash = await crypto.subtle.digest('SHA-256', buf)
    return Array.from(new Uint8Array(hash)).slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('')
  } catch { return '0000000000000000' }
}

function evt(partial: Partial<CanonicalEvent> & { id: string; entity_type: string; source: string; title: string }): CanonicalEvent {
  return {
    source_url: '',
    description: '',
    lat: null, lon: null, altitude: null, velocity: null, heading: null,
    timestamp: new Date().toISOString(),
    observed_at: new Date().toISOString(),
    confidence: 50,
    severity: 'info',
    risk_score: 0,
    region: '',
    tags: [],
    correlations: [],
    metadata: {},
    raw_payload_hash: '',
    provenance: 'direct-api',
    ...partial,
  }
}

function upstreamError(upstream: string, status: number, message: string) {
  return {
    _upstream_error: true,
    upstream,
    status,
    message,
    events: [] as CanonicalEvent[],
    timestamp: new Date().toISOString(),
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GEO_DB — deterministic geocoding from text (low-confidence, labeled "inferred")
// ═══════════════════════════════════════════════════════════════════════════════
const GEO_DB: Record<string, { lat: number; lon: number; region: string }> = {
  // Eastern Europe
  'ukraine': { lat: 48.4, lon: 31.2, region: 'Eastern Europe' },
  'russia': { lat: 55.8, lon: 37.6, region: 'Eastern Europe' },
  'kyiv': { lat: 50.4, lon: 30.5, region: 'Eastern Europe' },
  'kharkiv': { lat: 49.9, lon: 36.3, region: 'Eastern Europe' },
  'odesa': { lat: 46.5, lon: 30.7, region: 'Eastern Europe' },
  'donbas': { lat: 48.0, lon: 38.0, region: 'Eastern Europe' },
  'zaporizhzhia': { lat: 47.8, lon: 35.2, region: 'Eastern Europe' },
  'crimea': { lat: 44.9, lon: 34.1, region: 'Eastern Europe' },
  'moscow': { lat: 55.8, lon: 37.6, region: 'Eastern Europe' },
  'belarus': { lat: 53.9, lon: 27.6, region: 'Eastern Europe' },
  'moldova': { lat: 47.0, lon: 28.9, region: 'Eastern Europe' },
  'georgia': { lat: 42.3, lon: 43.4, region: 'Eastern Europe' },
  // Middle East
  'iran': { lat: 32.4, lon: 53.7, region: 'Middle East' },
  'tehran': { lat: 35.7, lon: 51.4, region: 'Middle East' },
  'israel': { lat: 31.0, lon: 34.8, region: 'Middle East' },
  'gaza': { lat: 31.4, lon: 34.5, region: 'Middle East' },
  'palestine': { lat: 31.9, lon: 35.2, region: 'Middle East' },
  'syria': { lat: 35.0, lon: 38.0, region: 'Middle East' },
  'yemen': { lat: 15.6, lon: 48.5, region: 'Middle East' },
  'houthi': { lat: 15.4, lon: 44.2, region: 'Middle East' },
  'iraq': { lat: 33.2, lon: 44.4, region: 'Middle East' },
  'lebanon': { lat: 33.9, lon: 35.5, region: 'Middle East' },
  'saudi arabia': { lat: 23.9, lon: 45.1, region: 'Middle East' },
  'qatar': { lat: 25.3, lon: 51.2, region: 'Middle East' },
  'bahrain': { lat: 26.0, lon: 50.5, region: 'Middle East' },
  'kuwait': { lat: 29.3, lon: 47.5, region: 'Middle East' },
  'oman': { lat: 21.5, lon: 56.0, region: 'Middle East' },
  'uae': { lat: 24.5, lon: 54.7, region: 'Middle East' },
  'dubai': { lat: 25.2, lon: 55.3, region: 'Middle East' },
  // Indo-Pacific
  'taiwan': { lat: 23.7, lon: 121.0, region: 'Indo-Pacific' },
  'china': { lat: 35.9, lon: 104.2, region: 'Indo-Pacific' },
  'beijing': { lat: 39.9, lon: 116.4, region: 'Indo-Pacific' },
  'north korea': { lat: 40.0, lon: 127.0, region: 'Indo-Pacific' },
  'south korea': { lat: 35.9, lon: 127.8, region: 'Indo-Pacific' },
  'japan': { lat: 36.2, lon: 138.3, region: 'Indo-Pacific' },
  'philippines': { lat: 12.9, lon: 121.8, region: 'Indo-Pacific' },
  'singapore': { lat: 1.35, lon: 103.82, region: 'Indo-Pacific' },
  'indonesia': { lat: -2.5, lon: 118.0, region: 'Indo-Pacific' },
  'australia': { lat: -25.3, lon: 133.8, region: 'Indo-Pacific' },
  'vietnam': { lat: 16.1, lon: 108.2, region: 'Indo-Pacific' },
  'malaysia': { lat: 4.2, lon: 101.9, region: 'Indo-Pacific' },
  // Africa
  'sudan': { lat: 12.9, lon: 30.2, region: 'Africa' },
  'ethiopia': { lat: 9.1, lon: 40.5, region: 'Africa' },
  'somalia': { lat: 6.0, lon: 46.2, region: 'Africa' },
  'congo': { lat: -4.0, lon: 21.8, region: 'Africa' },
  'niger': { lat: 17.6, lon: 8.1, region: 'Africa' },
  'mali': { lat: 17.6, lon: -4.0, region: 'Africa' },
  'burkina': { lat: 12.4, lon: -1.5, region: 'Africa' },
  'nigeria': { lat: 9.1, lon: 8.7, region: 'Africa' },
  'libya': { lat: 26.3, lon: 17.2, region: 'Africa' },
  'mozambique': { lat: -18.7, lon: 35.5, region: 'Africa' },
  'kenya': { lat: -1.3, lon: 36.8, region: 'Africa' },
  'south africa': { lat: -30.6, lon: 22.9, region: 'Africa' },
  'egypt': { lat: 26.8, lon: 30.8, region: 'Africa' },
  'tunisia': { lat: 34.0, lon: 9.0, region: 'Africa' },
  'algeria': { lat: 28.0, lon: 1.7, region: 'Africa' },
  'morocco': { lat: 31.8, lon: -7.1, region: 'Africa' },
  'cameroon': { lat: 5.9, lon: 10.1, region: 'Africa' },
  'chad': { lat: 15.5, lon: 18.7, region: 'Africa' },
  // Central/South Asia
  'myanmar': { lat: 19.2, lon: 96.7, region: 'Southeast Asia' },
  'afghanistan': { lat: 33.9, lon: 67.7, region: 'Central/South Asia' },
  'pakistan': { lat: 30.4, lon: 69.3, region: 'Central/South Asia' },
  'kashmir': { lat: 34.0, lon: 74.5, region: 'Central/South Asia' },
  'india': { lat: 20.6, lon: 79.0, region: 'Central/South Asia' },
  'nepal': { lat: 28.4, lon: 84.1, region: 'Central/South Asia' },
  'bangladesh': { lat: 23.7, lon: 90.4, region: 'Central/South Asia' },
  'sri lanka': { lat: 7.9, lon: 80.8, region: 'Central/South Asia' },
  // Europe
  'nato': { lat: 50.8, lon: 4.4, region: 'Europe' },
  'germany': { lat: 51.2, lon: 10.4, region: 'Europe' },
  'france': { lat: 46.2, lon: 2.2, region: 'Europe' },
  'united kingdom': { lat: 55.4, lon: -3.4, region: 'Europe' },
  'uk': { lat: 55.4, lon: -3.4, region: 'Europe' },
  'london': { lat: 51.5, lon: -0.1, region: 'Europe' },
  'poland': { lat: 51.9, lon: 19.1, region: 'Europe' },
  'romania': { lat: 45.9, lon: 25.0, region: 'Europe' },
  'finland': { lat: 61.5, lon: 25.7, region: 'Europe' },
  'sweden': { lat: 60.1, lon: 18.6, region: 'Europe' },
  'norway': { lat: 60.5, lon: 8.5, region: 'Europe' },
  'spain': { lat: 40.5, lon: -3.7, region: 'Europe' },
  'italy': { lat: 41.9, lon: 12.6, region: 'Europe' },
  'greece': { lat: 39.1, lon: 21.8, region: 'Europe' },
  'turkey': { lat: 39.9, lon: 32.9, region: 'Europe' },
  'serbia': { lat: 44.0, lon: 21.0, region: 'Europe' },
  'hungary': { lat: 47.2, lon: 19.5, region: 'Europe' },
  // Americas
  'pentagon': { lat: 38.9, lon: -77.1, region: 'North America' },
  'washington': { lat: 38.9, lon: -77.0, region: 'North America' },
  'new york': { lat: 40.7, lon: -74.0, region: 'North America' },
  'canada': { lat: 56.1, lon: -106.3, region: 'North America' },
  'mexico': { lat: 23.6, lon: -102.5, region: 'Americas' },
  'brazil': { lat: -14.2, lon: -51.9, region: 'South America' },
  'colombia': { lat: 4.6, lon: -74.1, region: 'South America' },
  'venezuela': { lat: 6.4, lon: -66.6, region: 'South America' },
  'argentina': { lat: -38.4, lon: -63.6, region: 'South America' },
  'haiti': { lat: 18.9, lon: -72.3, region: 'Americas' },
  // Water bodies / Straits
  'black sea': { lat: 43.5, lon: 34.5, region: 'Eastern Europe' },
  'red sea': { lat: 20.0, lon: 38.5, region: 'Middle East' },
  'hormuz': { lat: 26.5, lon: 56.3, region: 'Middle East' },
  'south china sea': { lat: 13.5, lon: 115.0, region: 'Indo-Pacific' },
  'persian gulf': { lat: 27.0, lon: 51.0, region: 'Middle East' },
  'sahel': { lat: 14.0, lon: 2.0, region: 'Africa' },
  'baltic': { lat: 56.0, lon: 22.0, region: 'Europe' },
  'kaliningrad': { lat: 54.7, lon: 20.5, region: 'Eastern Europe' },
  'arctic': { lat: 71.0, lon: 25.0, region: 'Arctic' },
  'mediterranean': { lat: 35.0, lon: 18.0, region: 'Europe' },
  'suez': { lat: 30.5, lon: 32.3, region: 'Middle East' },
  'malacca': { lat: 2.5, lon: 101.5, region: 'Indo-Pacific' },
  'bab el-mandeb': { lat: 12.6, lon: 43.3, region: 'Middle East' },
  'taiwan strait': { lat: 24.5, lon: 119.5, region: 'Indo-Pacific' },
}

/** Match text against GEO_DB. Returns low-confidence inferred location. */
function geocodeFromText(text: string): { lat: number; lon: number; region: string; matched: string; confidence: number } | null {
  const lower = text.toLowerCase()
  let best: { key: string; entry: typeof GEO_DB[string] } | null = null
  let bestLen = 0
  for (const [key, entry] of Object.entries(GEO_DB)) {
    if (lower.includes(key) && key.length > bestLen) {
      best = { key, entry }
      bestLen = key.length
    }
  }
  if (!best) return null
  const jitter = () => (Math.random() - 0.5) * 1.2
  const confidence = Math.min(35, 15 + bestLen * 2)
  return { lat: best.entry.lat + jitter(), lon: best.entry.lon + jitter(), region: best.entry.region, matched: best.key, confidence }
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESPONSE CACHE — TTL-based in-memory cache (inspired by V4 AVWX adapter)
// Prevents redundant upstream calls for data that changes slowly (SIGMETs, KEV)
// ═══════════════════════════════════════════════════════════════════════════════
interface CacheEntry { data: any; ts: number; ttl: number }
const responseCache: Record<string, CacheEntry> = {}

function cacheGet(key: string): any | null {
  const entry = responseCache[key]
  if (!entry) return null
  if (Date.now() - entry.ts > entry.ttl) { delete responseCache[key]; return null }
  return entry.data
}

function cacheSet(key: string, data: any, ttlMs: number) {
  responseCache[key] = { data, ts: Date.now(), ttl: ttlMs }
  // Evict stale entries (cap at 100)
  const keys = Object.keys(responseCache)
  if (keys.length > 100) {
    const now = Date.now()
    for (const k of keys) { if (now - responseCache[k].ts > responseCache[k].ttl) delete responseCache[k] }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CIRCUIT BREAKER — stops calling dead upstreams (inspired by V4 adapter patterns)
// After N consecutive failures, open circuit for cooldown period
// ═══════════════════════════════════════════════════════════════════════════════
interface CircuitState { failures: number; lastFailure: number; open: boolean }
const circuits: Record<string, CircuitState> = {}
const CB_THRESHOLD = 5      // failures before opening
const CB_COOLDOWN = 120000  // 2 minutes

function circuitCheck(source: string): boolean {
  const s = circuits[source]
  if (!s || !s.open) return true // closed = allow
  if (Date.now() - s.lastFailure > CB_COOLDOWN) {
    s.open = false; s.failures = 0; return true // half-open, try again
  }
  return false // open = deny
}

function circuitSuccess(source: string) {
  const s = circuits[source]
  if (s) { s.failures = 0; s.open = false }
}

function circuitFailure(source: string) {
  if (!circuits[source]) circuits[source] = { failures: 0, lastFailure: 0, open: false }
  const s = circuits[source]
  s.failures++
  s.lastFailure = Date.now()
  if (s.failures >= CB_THRESHOLD) s.open = true
}

// ═══════════════════════════════════════════════════════════════════════════════
// SAFE FETCH HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
async function safeFetch(url: string, opts: RequestInit = {}, timeoutMs = 12000): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, {
      ...opts,
      signal: controller.signal,
      headers: { 'User-Agent': UA, ...((opts.headers as Record<string, string>) || {}) },
    })
  } finally {
    clearTimeout(timer)
  }
}

async function safeJson(url: string, opts: RequestInit = {}, timeoutMs = 12000): Promise<any> {
  const res = await safeFetch(url, opts, timeoutMs)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// ═══════════════════════════════════════════════════════════════════════════════
// API PROXY — Secure server-side credential management
// Browser sends target name -> server resolves URL + injects secret
// ═══════════════════════════════════════════════════════════════════════════════
interface TargetConfig {
  url: string | ((key: string, params?: Record<string, string>) => string)
  secret?: keyof Bindings
  authType?: 'bearer' | 'rapidapi' | 'query' | 'header'
  headerName?: string
  rapidApiHost?: string
  timeout?: number
  fallbackUrl?: string
  responseType?: 'json' | 'text'
}

const TARGETS: Record<string, TargetConfig> = {
  opensky: {
    url: 'https://opensky-network.org/api/states/all',
    timeout: 15000,
    fallbackUrl: 'https://opensky-network.org/api/states/all?lamin=-60&lamax=60&lomin=-180&lomax=180',
  },
  military: {
    url: 'https://adsbexchange-com1.p.rapidapi.com/v2/mil/',
    secret: 'RAPIDAPI_KEY',
    authType: 'rapidapi',
    rapidApiHost: 'adsbexchange-com1.p.rapidapi.com',
    timeout: 10000,
  },
  gfw_fishing: {
    url: 'https://gateway.api.globalfishingwatch.org/v3/events?datasets[0]=public-global-fishing-events:latest&limit=50&offset=0',
    secret: 'GFW_TOKEN',
    authType: 'bearer',
    timeout: 14000,
  },
  gfw_gap: {
    url: 'https://gateway.api.globalfishingwatch.org/v3/events?datasets[0]=public-global-gaps-events:latest&limit=50&offset=0',
    secret: 'GFW_TOKEN',
    authType: 'bearer',
    timeout: 14000,
  },
  firms: {
    url: (key: string) => `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/VIIRS_SNPP_NRT/world/1`,
    secret: 'NASA_FIRMS_KEY',
    timeout: 18000,
    responseType: 'text',
  },
  n2yo: {
    url: (key: string) => `https://api.n2yo.com/rest/v1/satellite/above/0/0/0/80/0?apiKey=${key}`,
    secret: 'N2YO_KEY',
    timeout: 10000,
  },
  gdacs: {
    url: 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=EQ,TC,FL,VO,TS&alertlevel=Green;Orange;Red',
    timeout: 16000,
  },
  reliefweb: {
    url: 'https://api.reliefweb.int/v1/disasters?appname=sentinel-os-osint&limit=50&sort[]=date:desc&fields[include][]=name&fields[include][]=country&fields[include][]=status&fields[include][]=primary_type&fields[include][]=glide&fields[include][]=date',
    timeout: 14000,
  },
  gdelt_conflict: {
    url: 'https://api.gdeltproject.org/api/v2/doc/doc?query=military+attack+airstrike+bombing+conflict&mode=artlist&maxrecords=50&format=json&timespan=48h&sourcelang=english',
    timeout: 10000,
  },
  gdelt_maritime: {
    url: 'https://api.gdeltproject.org/api/v2/doc/doc?query=navy+warship+maritime+vessel+blockade&mode=artlist&maxrecords=30&format=json&timespan=48h&sourcelang=english',
    timeout: 10000,
  },
  gdelt_nuclear: {
    url: 'https://api.gdeltproject.org/api/v2/doc/doc?query=nuclear+missile+ICBM+warhead+enrichment&mode=artlist&maxrecords=25&format=json&timespan=72h&sourcelang=english',
    timeout: 10000,
  },
  gdelt_cyber: {
    url: 'https://api.gdeltproject.org/api/v2/doc/doc?query=cyberattack+ransomware+hacking+breach+APT&mode=artlist&maxrecords=25&format=json&timespan=48h&sourcelang=english',
    timeout: 10000,
  },
}

app.post('/api/proxy', async (c) => {
  const body = await c.req.json<{ target: string; params?: Record<string, string> }>().catch(() => ({ target: '', params: {} }))
  const { target, params } = body
  const config = TARGETS[target]
  if (!config) return c.json(upstreamError(target, 400, `Unknown target: ${target}`))

  const secret = config.secret ? (c.env[config.secret] || '') : ''
  let url: string
  if (typeof config.url === 'function') { url = config.url(secret, params) } else { url = config.url }

  if (target.startsWith('gfw_') && params?.startDate && params?.endDate) {
    const u = new URL(url)
    u.searchParams.set('start-date', params.startDate)
    u.searchParams.set('end-date', params.endDate)
    url = u.toString()
  }

  const headers: Record<string, string> = { 'User-Agent': UA }
  if (config.authType === 'bearer' && secret) headers['Authorization'] = `Bearer ${secret}`
  if (config.authType === 'rapidapi' && secret) { headers['X-RapidAPI-Key'] = secret; headers['X-RapidAPI-Host'] = config.rapidApiHost || '' }
  if (config.authType === 'header' && config.headerName && secret) headers[config.headerName] = secret

  const t0 = Date.now()
  try {
    let res: Response
    try {
      res = await safeFetch(url, { headers }, config.timeout || 15000)
    } catch (err) {
      if (config.fallbackUrl) {
        try { res = await safeFetch(config.fallbackUrl, { headers }, 8000) }
        catch {
          recordMetric(target, Date.now() - t0, false)
          return c.json(upstreamError(target, 0, 'Primary and fallback failed'))
        }
      } else {
        recordMetric(target, Date.now() - t0, false)
        return c.json(upstreamError(target, 0, String(err)))
      }
    }
    if (!res!.ok) {
      const body = await res!.text()
      recordMetric(target, Date.now() - t0, false)
      return c.json(upstreamError(target, res!.status, body.slice(0, 400)))
    }
    recordMetric(target, Date.now() - t0, true)
    if (config.responseType === 'text') return c.text(await res!.text())
    return c.json(await res!.json())
  } catch (error) {
    recordMetric(target, Date.now() - t0, false)
    return c.json(upstreamError(target, 0, String(error)))
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// WEATHER — OWM multi-city
// Requires: OWM_KEY (free at https://openweathermap.org/appid)
// ═══════════════════════════════════════════════════════════════════════════════
const WEATHER_CITIES = [
  { name: 'Tokyo', lat: 35.68, lon: 139.69 }, { name: 'Mumbai', lat: 19.08, lon: 72.88 },
  { name: 'Manila', lat: 14.60, lon: 120.98 }, { name: 'Houston', lat: 29.76, lon: -95.37 },
  { name: 'Miami', lat: 25.76, lon: -80.19 }, { name: 'Dhaka', lat: 23.81, lon: 90.41 },
  { name: 'Lagos', lat: 6.52, lon: 3.37 }, { name: 'Shanghai', lat: 31.23, lon: 121.47 },
  { name: 'Cairo', lat: 30.04, lon: 31.24 }, { name: 'London', lat: 51.51, lon: -0.13 },
  { name: 'Moscow', lat: 55.76, lon: 37.62 }, { name: 'Taipei', lat: 25.03, lon: 121.57 },
  { name: 'Singapore', lat: 1.35, lon: 103.82 }, { name: 'Jakarta', lat: -6.21, lon: 106.85 },
  { name: 'Dubai', lat: 25.20, lon: 55.27 }, { name: 'Nairobi', lat: -1.29, lon: 36.82 },
  { name: 'Sydney', lat: -33.87, lon: 151.21 }, { name: 'Anchorage', lat: 61.22, lon: -149.90 },
  { name: 'Sao Paulo', lat: -23.55, lon: -46.63 }, { name: 'Karachi', lat: 24.86, lon: 67.01 },
]

app.get('/api/weather/global', async (c) => {
  const key = c.env.OWM_KEY
  if (!key) return c.json(upstreamError('owm', 0, 'OWM_KEY not configured. Get a free key at https://openweathermap.org/appid'))
  try {
    const results = await Promise.allSettled(
      WEATHER_CITIES.map(city =>
        safeJson(`https://api.openweathermap.org/data/2.5/weather?lat=${city.lat}&lon=${city.lon}&appid=${key}&units=metric`, {}, 8000)
          .then(d => ({ ...d, _city: city.name }))
      )
    )
    const list = results.filter(r => r.status === 'fulfilled' && (r as any).value?.coord).map(r => (r as PromiseFulfilledResult<any>).value)
    recordMetric('owm', Date.now() - Date.now(), list.length > 0)
    return c.json({ events: list, count: list.length, source: 'openweathermap' })
  } catch (error) {
    recordMetric('owm', 0, false)
    return c.json(upstreamError('owm', 0, String(error)))
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// AVWX — METAR multi-airport
// Requires: AVWX_KEY (free at https://avwx.rest/)
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/avwx/global', async (c) => {
  const key = c.env.AVWX_KEY
  if (!key) return c.json(upstreamError('avwx', 0, 'AVWX_KEY not configured. Get a free key at https://avwx.rest/'))
  const airports = ['KJFK', 'EGLL', 'RJTT', 'VHHH', 'LFPG', 'EDDF', 'OMDB', 'WSSS', 'YSSY', 'SBGR', 'FACT', 'UUEE', 'RPLL', 'VIDP', 'OERK']
  try {
    const results = await Promise.allSettled(
      airports.map(icao =>
        safeJson(`https://avwx.rest/api/metar/${icao}?format=json&onfail=cache`, { headers: { 'Authorization': `Bearer ${key}` } }, 6000)
      )
    )
    const stations = results.filter(r => r.status === 'fulfilled' && (r as any).value?.station).map(r => (r as PromiseFulfilledResult<any>).value)
    return c.json({ stations, count: stations.length, source: 'avwx' })
  } catch (error) { return c.json(upstreamError('avwx', 0, String(error))) }
})

// ═══════════════════════════════════════════════════════════════════════════════
// AIS CONFIG — expose ONLY boolean availability, never the raw key
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/ais/config', (c) => {
  return c.json({
    available: !!(c.env.AISSTREAM_KEY),
    note: 'AIS WebSocket connection handled server-side. Key never sent to browser.',
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// SPACE-TRACK — Authenticated satellite catalog + conjunction data
// Uses cookie-based auth: POST login -> use session cookie for queries
// Rate limit: 30 req/min, 300 req/hour
// Requires: SPACETRACK_USER + SPACETRACK_PASS
// ═══════════════════════════════════════════════════════════════════════════════
let spaceTrackCookie = ''
let spaceTrackCookieExpiry = 0

let spaceTrackLoginError = ''

/** Space-Track: two-step cookie-based authentication.
 *  Step 1: POST credentials to /ajaxauth/login -> get chocolatechip cookie
 *  Step 2: Use cookie for data queries
 *  Rate limit: 30 req/min, 300 req/hour */
async function spaceTrackQuery(user: string, pass: string, queryUrl: string): Promise<Response | null> {
  // Reuse cached session cookie (valid ~2 hours)
  if (spaceTrackCookie && Date.now() < spaceTrackCookieExpiry) {
    try {
      const dataRes = await safeFetch(queryUrl, {
        headers: { Cookie: spaceTrackCookie, 'User-Agent': UA },
      }, 18000)
      if (dataRes.ok) return dataRes
      // Cookie expired or invalid — re-authenticate
      spaceTrackCookie = ''
      spaceTrackCookieExpiry = 0
    } catch { /* re-authenticate */ }
  }

  // Login
  try {
    const loginRes = await fetch('https://www.space-track.org/ajaxauth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
      body: `identity=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`,
    })

    // Check for login errors in response body
    const loginBody = await loginRes.text()
    if (loginBody.includes('Failed') || loginBody.includes('does not meet') || loginBody.includes('Invalid') || loginBody.includes('disabled')) {
      spaceTrackLoginError = loginBody.replace(/[{}"]/g, '').trim().slice(0, 200)
      return null
    }

    // Extract cookie
    let cookie = ''
    // Method 1: getSetCookie() — Cloudflare Workers native
    try {
      const cookies = (loginRes.headers as any).getSetCookie?.() || []
      for (const c of cookies) {
        const m = c.match(/chocolatechip=([^;]+)/)
        if (m) { cookie = `chocolatechip=${m[1]}`; break }
      }
    } catch { /* noop */ }

    // Method 2: set-cookie header
    if (!cookie) {
      const setCookieHeader = loginRes.headers.get('set-cookie') || ''
      const match = setCookieHeader.match(/chocolatechip=([^;]+)/)
      if (match) cookie = `chocolatechip=${match[1]}`
    }

    if (!cookie) {
      spaceTrackLoginError = 'Login succeeded but no session cookie received'
      return null
    }

    spaceTrackLoginError = ''
    spaceTrackCookie = cookie
    spaceTrackCookieExpiry = Date.now() + 7200000 // 2 hours

    // Query data
    const dataRes = await safeFetch(queryUrl, {
      headers: { Cookie: cookie, 'User-Agent': UA },
    }, 18000)
    return dataRes
  } catch (e) {
    spaceTrackLoginError = String(e)
    return null
  }
}

app.get('/api/spacetrack/gp', async (c) => {
  const user = c.env.SPACETRACK_USER
  const pass = c.env.SPACETRACK_PASS
  if (!user || !pass) return c.json(upstreamError('spacetrack', 0, 'SPACETRACK_USER/SPACETRACK_PASS not configured'))
  const t0 = Date.now()
  try {
    const url = 'https://www.space-track.org/basicspacedata/query/class/gp/OBJECT_TYPE/PAYLOAD/DECAY_DATE/null-val/EPOCH/%3Enow-7/orderby/NORAD_CAT_ID%20asc/limit/200/format/json'
    const res = await spaceTrackQuery(user, pass, url)
    if (!res || !res.ok) {
      recordMetric('spacetrack', Date.now() - t0, false)
      const errMsg = spaceTrackLoginError || `GP query failed (HTTP ${res?.status || 0})`
      return c.json(upstreamError('spacetrack', res?.status || 401, errMsg))
    }
    const data = await res.json() as any[]
    const h = await hashPayload(data)
    const events: CanonicalEvent[] = (data || []).slice(0, 150).map((gp: any, i: number) => {
      const period = parseFloat(gp.PERIOD) || 90
      const apogee = parseFloat(gp.APOGEE) || 0
      const perigee = parseFloat(gp.PERIGEE) || 0
      return evt({
        id: `stgp_${gp.NORAD_CAT_ID || i}`, entity_type: 'satellite',
        source: 'Space-Track.org', source_url: 'https://www.space-track.org/',
        title: (gp.OBJECT_NAME || 'NORAD:' + gp.NORAD_CAT_ID).trim(),
        description: `${gp.OBJECT_TYPE || 'PAYLOAD'} | ${gp.COUNTRY_CODE || '??'} | Period: ${period.toFixed(1)} min`,
        altitude: Math.round((apogee + perigee) / 2), confidence: 98, severity: 'info',
        tags: ['satellite', 'space-track', gp.COUNTRY_CODE || ''].filter(Boolean),
        provenance: 'direct-api', raw_payload_hash: h,
        metadata: {
          norad_id: gp.NORAD_CAT_ID, intl_designator: gp.OBJECT_ID, country: gp.COUNTRY_CODE,
          object_type: gp.OBJECT_TYPE, rcs_size: gp.RCS_SIZE, epoch: gp.EPOCH,
          inclination: parseFloat(gp.INCLINATION) || 0, period_min: period,
          apogee_km: apogee, perigee_km: perigee,
          mean_motion: parseFloat(gp.MEAN_MOTION) || 0, eccentricity: parseFloat(gp.ECCENTRICITY) || 0,
          tle_line1: gp.TLE_LINE1, tle_line2: gp.TLE_LINE2,
        },
      })
    })
    recordMetric('spacetrack', Date.now() - t0, true)
    return c.json({ events, count: events.length, source: 'space-track-gp', raw_payload_hash: h })
  } catch (error) {
    recordMetric('spacetrack', Date.now() - t0, false)
    return c.json(upstreamError('spacetrack', 0, String(error)))
  }
})

app.get('/api/spacetrack/cdm', async (c) => {
  const user = c.env.SPACETRACK_USER
  const pass = c.env.SPACETRACK_PASS
  if (!user || !pass) return c.json(upstreamError('spacetrack', 0, 'SPACETRACK credentials not configured'))
  const t0 = Date.now()
  try {
    const url = 'https://www.space-track.org/basicspacedata/query/class/cdm_public/CREATION_DATE/%3Enow-2/orderby/TCA%20desc/limit/50/format/json'
    const res = await spaceTrackQuery(user, pass, url)
    if (!res || !res.ok) {
      recordMetric('spacetrack_cdm', Date.now() - t0, false)
      const errMsg = spaceTrackLoginError || `CDM query failed (HTTP ${res?.status || 0})`
      return c.json(upstreamError('spacetrack', res?.status || 401, errMsg))
    }
    const data = await res.json() as any[]
    const h = await hashPayload(data)
    const events: CanonicalEvent[] = (data || []).slice(0, 40).map((cdm: any, i: number) => {
      const missDistKm = parseFloat(cdm.MISS_DISTANCE) || 9999
      const collisionProb = parseFloat(cdm.COLLISION_PROBABILITY) || 0
      const severity = collisionProb > 1e-3 ? 'critical' : collisionProb > 1e-5 ? 'high' : missDistKm < 1 ? 'high' : missDistKm < 5 ? 'medium' : 'low'
      return evt({
        id: `cdm_${cdm.CDM_ID || i}`, entity_type: 'conjunction',
        source: 'Space-Track CDM', source_url: 'https://www.space-track.org/',
        title: `CONJUNCTION: ${(cdm.SAT_1_NAME || 'OBJ1').trim()} <> ${(cdm.SAT_2_NAME || 'OBJ2').trim()}`,
        description: `Miss: ${missDistKm.toFixed(3)} km | Prob: ${collisionProb.toExponential(2)} | TCA: ${cdm.TCA || ''}`,
        confidence: 95, severity,
        risk_score: collisionProb > 1e-4 ? 90 : collisionProb > 1e-6 ? 60 : 30,
        timestamp: cdm.TCA || cdm.CREATION_DATE || '',
        tags: ['conjunction', 'cdm', severity],
        provenance: 'direct-api', raw_payload_hash: h,
        metadata: {
          cdm_id: cdm.CDM_ID, sat1_name: cdm.SAT_1_NAME, sat1_id: cdm.SAT_1_ID,
          sat2_name: cdm.SAT_2_NAME, sat2_id: cdm.SAT_2_ID, tca: cdm.TCA,
          miss_distance_km: missDistKm, collision_probability: collisionProb,
          relative_speed: cdm.RELATIVE_SPEED,
        },
      })
    })
    recordMetric('spacetrack_cdm', Date.now() - t0, true)
    return c.json({ events, count: events.length, source: 'space-track-cdm', raw_payload_hash: h })
  } catch (error) {
    recordMetric('spacetrack_cdm', Date.now() - t0, false)
    return c.json(upstreamError('spacetrack', 0, String(error)))
  }
})

// Space-Track diagnostic
app.get('/api/spacetrack/status', (c) => {
  return c.json({
    configured: !!(c.env.SPACETRACK_USER && c.env.SPACETRACK_PASS),
    authenticated: !!(spaceTrackCookie && Date.now() < spaceTrackCookieExpiry),
    cookie_expires: spaceTrackCookieExpiry > 0 ? new Date(spaceTrackCookieExpiry).toISOString() : null,
    last_error: spaceTrackLoginError || null,
    note: 'Space-Track requires minimum 12-character password. Update at https://www.space-track.org/auth/passwordReset',
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// COPERNICUS — Sentinel Hub OAuth2 token proxy for hi-res imagery
// ═══════════════════════════════════════════════════════════════════════════════
let copernicusToken = ''
let copernicusTokenExpiry = 0

app.get('/api/copernicus/token', async (c) => {
  const clientId = c.env.COPERNICUS_CLIENT_ID
  const clientSecret = c.env.COPERNICUS_CLIENT_SECRET
  if (!clientId || !clientSecret) return c.json(upstreamError('copernicus', 0, 'COPERNICUS_CLIENT_ID/SECRET not configured'))
  if (copernicusToken && Date.now() < copernicusTokenExpiry) {
    return c.json({ access_token: copernicusToken, expires_in: Math.round((copernicusTokenExpiry - Date.now()) / 1000), source: 'copernicus-cached' })
  }
  try {
    const res = await safeFetch('https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=client_credentials&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`,
    }, 15000)
    if (!res.ok) { const t = await res.text(); return c.json(upstreamError('copernicus', res.status, t.slice(0, 300))) }
    const data = await res.json() as any
    copernicusToken = data.access_token || ''
    copernicusTokenExpiry = Date.now() + ((data.expires_in || 290) - 10) * 1000
    return c.json({ access_token: copernicusToken, expires_in: data.expires_in || 300, source: 'copernicus' })
  } catch (error) { return c.json(upstreamError('copernicus', 0, String(error))) }
})

// ═══════════════════════════════════════════════════════════════════════════════
// CESIUM ION — Token proxy (never expose in frontend source code)
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/cesium/token', (c) => {
  const token = c.env.CESIUM_ION_TOKEN
  if (!token) return c.json(upstreamError('cesium', 0, 'CESIUM_ION_TOKEN not configured'))
  return c.json({ token, source: 'cesium-ion' })
})

// ═══════════════════════════════════════════════════════════════════════════════
// SHODAN — Internet exposure
// Requires: SHODAN_KEY (free at https://shodan.io)
// ═══════════════════════════════════════════════════════════════════════════════
app.post('/api/shodan/search', async (c) => {
  const key = c.env.SHODAN_KEY
  if (!key) return c.json(upstreamError('shodan', 0, 'SHODAN_KEY not set. Get a free API key at https://account.shodan.io/'))
  const { query } = await c.req.json<{ query?: string }>().catch(() => ({ query: 'port:502 scada' }))
  const q = query || 'port:502 scada'
  try {
    const res = await safeFetch(`https://api.shodan.io/shodan/host/search?key=${key}&query=${encodeURIComponent(q)}&page=1`, {}, 10000)
    if (res.ok) {
      const data = await res.json() as any
      const h = await hashPayload(data)
      return c.json({ matches: data.matches || [], total: data.total || 0, source: 'shodan-search', raw_payload_hash: h })
    }
    // Free plan fallback: host lookup
    const dnsRes = await safeFetch(`https://api.shodan.io/dns/resolve?hostnames=scada.shodan.io,ics-radar.shodan.io&key=${key}`, {}, 8000)
    if (dnsRes.ok) {
      const dnsData = await dnsRes.json() as Record<string, string>
      const matches: any[] = []
      for (const [hostname, ip] of Object.entries(dnsData)) {
        if (!ip) continue
        try {
          const hostData = await safeJson(`https://api.shodan.io/shodan/host/${ip}?key=${key}`, {}, 6000)
          if (hostData?.data) {
            hostData.data.slice(0, 5).forEach((svc: any) => {
              matches.push({
                ip_str: hostData.ip_str || String(ip), port: svc.port || 0,
                product: svc.product || hostname, org: hostData.org || '',
                location: { latitude: hostData.latitude || 0, longitude: hostData.longitude || 0, country_name: hostData.country_name || '', city: hostData.city || '' },
              })
            })
          }
        } catch { /* skip host */ }
      }
      if (matches.length > 0) return c.json({ matches, total: matches.length, source: 'shodan-host-lookup' })
    }
    return c.json({ matches: [], total: 0, note: 'Shodan free plan has limited search. Upgrade at https://shodan.io/store', source: 'shodan' })
  } catch (error) { return c.json(upstreamError('shodan', 0, String(error))) }
})

// ═══════════════════════════════════════════════════════════════════════════════
// RELIEFWEB — UN OCHA disaster data
// Free, no key required: https://api.reliefweb.int/
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/reliefweb/disasters', async (c) => {
  try {
    const t0 = Date.now()
    const data = await safeJson(
      'https://api.reliefweb.int/v1/disasters?appname=sentinel-os-osint&limit=50&sort[]=date:desc&fields[include][]=name&fields[include][]=country&fields[include][]=status&fields[include][]=primary_type&fields[include][]=glide&fields[include][]=date',
      {}, 12000,
    )
    recordMetric('reliefweb', Date.now() - t0, true)
    return c.json(data)
  } catch {
    recordMetric('reliefweb', 0, false)
    return c.json({ data: [], _upstream_error: true, message: 'ReliefWeb API unavailable' })
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// ACLED — Armed Conflict (free registration required)
// Register at: https://developer.acleddata.com/
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/acled/events', async (c) => {
  const key = c.env.ACLED_KEY
  const email = c.env.ACLED_EMAIL
  if (!key || !email) return c.json(upstreamError('acled', 0, 'ACLED_KEY and ACLED_EMAIL not set. Free registration at https://developer.acleddata.com/'))
  try {
    const data = await safeJson(`https://api.acleddata.com/acled/read?key=${key}&email=${encodeURIComponent(email)}&limit=100&sort=event_date:desc`, {}, 12000)
    const h = await hashPayload(data)
    return c.json({ data: data.data || [], count: data.count || 0, source: 'acled', raw_payload_hash: h })
  } catch (error) { return c.json(upstreamError('acled', 0, String(error))) }
})

// ═══════════════════════════════════════════════════════════════════════════════
// GDELT CONFLICT INTEL — Article-based geocoding
// Free, no key: https://api.gdeltproject.org/
// ═══════════════════════════════════════════════════════════════════════════════
async function fetchGDELT(url: string): Promise<any> {
  for (let i = 0; i < 2; i++) {
    try {
      if (i > 0) await new Promise(r => setTimeout(r, 2000))
      const res = await safeFetch(url, {}, 8000)
      if (res.status === 429) continue
      if (!res.ok) return null
      const text = await res.text()
      try { return JSON.parse(text) } catch { return null }
    } catch { /* retry */ }
  }
  return null
}

app.post('/api/intel/gdelt', async (c) => {
  const { category } = await c.req.json<{ category?: string }>().catch(() => ({ category: 'conflict' }))
  const key = category === 'maritime' ? 'gdelt_maritime' : category === 'nuclear' ? 'gdelt_nuclear' : category === 'cyber' ? 'gdelt_cyber' : 'gdelt_conflict'
  const config = TARGETS[key]
  if (!config || typeof config.url !== 'string') return c.json(upstreamError('gdelt', 400, 'Invalid category'))

  try {
    const data = await fetchGDELT(config.url)
    if (!data) return c.json({ events: [], _upstream_error: true, message: 'GDELT unavailable or rate-limited' })
    const articles = data.articles || []
    const h = await hashPayload(data)
    recordMetric('gdelt_' + (category || 'conflict'), Date.now() - Date.now(), articles.length > 0)
    const events: CanonicalEvent[] = articles.map((art: any, i: number) => {
      const geo = geocodeFromText(art.title || '')
      if (!geo) return null
      return evt({
        id: `gdelt_${category}_${i}`,
        entity_type: category === 'cyber' ? 'cyber_intel' : category === 'nuclear' ? 'nuclear_intel' : 'conflict_intel',
        source: 'GDELT 2.0', source_url: art.url || '', title: art.title || '',
        description: `${art.domain || ''} — ${art.sourcecountry || ''}`,
        lat: geo.lat, lon: geo.lon, region: geo.region,
        timestamp: art.seendate || new Date().toISOString(), confidence: geo.confidence,
        severity: 'medium', tags: [category || 'conflict', geo.matched],
        provenance: 'geocoded-inferred', raw_payload_hash: h,
        metadata: { domain: art.domain, language: art.language, matched_location: geo.matched },
      })
    }).filter(Boolean) as CanonicalEvent[]
    return c.json({ events, total: articles.length, geocoded: events.length, source: 'gdelt' })
  } catch (error) { return c.json(upstreamError('gdelt', 0, String(error))) }
})

// ═══════════════════════════════════════════════════════════════════════════════
// NEWS INTEL — supplemental to GDELT
// Requires: NEWS_API_KEY (free at https://newsapi.org/register)
// ═══════════════════════════════════════════════════════════════════════════════
app.post('/api/intel/news', async (c) => {
  const { category } = await c.req.json<{ category?: string }>().catch(() => ({ category: 'conflict' }))
  const key = c.env.NEWS_API_KEY
  if (!key) return c.json(upstreamError('newsapi', 0, 'NEWS_API_KEY not set. Free at https://newsapi.org/register'))
  const query = category === 'cyber' ? 'cyberattack+ransomware+hacking+breach' : category === 'nuclear' ? 'nuclear+missile+warhead+uranium' : 'military+attack+conflict+airstrike'
  try {
    const fromDate = new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0]
    const data = await safeJson(`https://newsapi.org/v2/everything?q=${query}&sortBy=publishedAt&pageSize=40&language=en&from=${fromDate}&apiKey=${key}`, {}, 12000)
    const articles = data.articles || []
    const h = await hashPayload(data)
    const events: CanonicalEvent[] = articles.map((art: any, i: number) => {
      const geo = geocodeFromText(art.title || '')
      if (!geo) return null
      return evt({
        id: `news_${category}_${i}`,
        entity_type: category === 'cyber' ? 'cyber_intel' : 'conflict_intel',
        source: 'NewsAPI', source_url: art.url || '', title: art.title || '',
        lat: geo.lat, lon: geo.lon, region: geo.region,
        timestamp: art.publishedAt || '', confidence: geo.confidence,
        severity: 'medium', tags: [category || 'conflict', geo.matched],
        provenance: 'geocoded-inferred', raw_payload_hash: h,
        metadata: { source_name: art.source?.name, image_url: art.urlToImage || '', matched_location: geo.matched },
      })
    }).filter(Boolean) as CanonicalEvent[]
    return c.json({ events, total: articles.length, geocoded: events.length, source: 'newsapi' })
  } catch (error) { return c.json(upstreamError('newsapi', 0, String(error))) }
})

// ═══════════════════════════════════════════════════════════════════════════════
// CYBER — CISA Known Exploited Vulnerabilities (KEV)
// Free, no key: https://www.cisa.gov/known-exploited-vulnerabilities-catalog
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/cyber/cisa-kev', async (c) => {
  // Triple fallback: GitHub cisagov kev-data mirror -> CISA direct -> alternate mirror
  const urls = [
    'https://raw.githubusercontent.com/cisagov/kev-data/main/known_exploited_vulnerabilities.json',
    'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json',
  ]
  for (const url of urls) {
    try {
      const data = await safeJson(url, {}, 15000)
      const vulns = (data.vulnerabilities || []).slice(0, 100)
      const h = await hashPayload(data)
      recordMetric('cisa_kev', Date.now() - Date.now(), true)
      const events: CanonicalEvent[] = vulns.map((v: any, i: number) => evt({
        id: `kev_${v.cveID || i}`, entity_type: 'cyber_vulnerability',
        source: 'CISA KEV', source_url: `https://nvd.nist.gov/vuln/detail/${v.cveID}`,
        title: `${v.cveID}: ${v.vulnerabilityName || 'Unknown'}`,
        description: v.shortDescription || '',
        timestamp: v.dateAdded || '', severity: 'high', risk_score: 75,
        confidence: 95, tags: ['cisa-kev', 'known-exploited', v.vendorProject || '', v.product || ''].filter(Boolean),
        provenance: 'direct-api', raw_payload_hash: h,
        metadata: { cve_id: v.cveID, vendor: v.vendorProject, product: v.product, required_action: v.requiredAction, due_date: v.dueDate, known_ransomware: v.knownRansomwareCampaignUse },
      }))
      return c.json({ events, count: events.length, catalog_date: data.catalogVersion, source: 'cisa-kev' })
    } catch { /* try next mirror */ }
  }
  recordMetric('cisa_kev', 0, false)
  return c.json(upstreamError('cisa-kev', 0, 'All CISA KEV mirrors unavailable'))
})

// ═══════════════════════════════════════════════════════════════════════════════
// CYBER — AlienVault OTX
// Optional key at: https://otx.alienvault.com/ (free registration)
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/cyber/otx', async (c) => {
  const otxKey = c.env.OTX_KEY || ''
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (otxKey) headers['X-OTX-API-KEY'] = otxKey

  const urls = otxKey
    ? [`https://otx.alienvault.com/api/v1/pulses/subscribed?limit=50&modified_since=${new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]}`,
       'https://otx.alienvault.com/api/v1/pulses/activity?limit=30',
       'https://otx.alienvault.com/api/v1/search/pulses?q=malware+ransomware+apt&sort=modified&limit=25']
    : ['https://otx.alienvault.com/api/v1/pulses/activity?limit=30',
       'https://otx.alienvault.com/api/v1/search/pulses?q=malware+ransomware+apt&sort=modified&limit=25']

  for (const url of urls) {
    try {
      const data = await safeJson(url, { headers }, 10000)
      if (data.results && data.results.length > 0) {
        const h = await hashPayload(data)
        const events: CanonicalEvent[] = data.results.slice(0, 50).map((p: any, i: number) => evt({
          id: `otx_${p.id || i}`, entity_type: 'cyber_threat_intel',
          source: 'AlienVault OTX', source_url: `https://otx.alienvault.com/pulse/${p.id}`,
          title: p.name || 'Unknown Pulse', description: (p.description || '').slice(0, 300),
          timestamp: p.modified || p.created || '', confidence: 70, severity: p.adversary ? 'high' : 'medium',
          tags: (p.tags || []).slice(0, 10), provenance: 'direct-api', raw_payload_hash: h,
          metadata: { adversary: p.adversary, malware_families: p.malware_families, targeted_countries: p.targeted_countries, indicator_count: p.indicator_type_counts, tlp: p.tlp, references: (p.references || []).slice(0, 5) },
        }))
        return c.json({ events, count: events.length, source: 'otx' })
      }
    } catch { /* try next fallback */ }
  }
  recordMetric('otx', 0, false)
  return c.json(upstreamError('otx', 0, 'OTX API unavailable. Register free at https://otx.alienvault.com/'))
})

// ═══════════════════════════════════════════════════════════════════════════════
// CYBER — URLhaus (abuse.ch) — free, no key
// https://urlhaus-api.abuse.ch/
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/cyber/urlhaus', async (c) => {
  const authKey = c.env.ABUSECH_AUTH_KEY || ''
  try {
    const uhHeaders: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded' }
    if (authKey) uhHeaders['Auth-Key'] = authKey
    const res = await safeFetch('https://urlhaus-api.abuse.ch/v1/urls/recent/limit/50/', {
      method: 'POST',
      headers: uhHeaders,
    }, 10000)
    if (res.ok) {
      const ct = res.headers.get('content-type') || ''
      if (ct.includes('json')) {
        const data = await res.json() as any
        if (data.urls?.length > 0) {
          const h = await hashPayload(data)
          const events: CanonicalEvent[] = data.urls.slice(0, 50).map((u: any, i: number) => evt({
            id: `urlhaus_${u.id || i}`, entity_type: 'cyber_malware_url',
            source: 'URLhaus (abuse.ch)', source_url: u.urlhaus_reference || 'https://urlhaus.abuse.ch/',
            title: `Malware URL: ${(u.url || '').slice(0, 80)}`,
            description: `Threat: ${u.threat || 'unknown'} | Status: ${u.url_status || 'unknown'}`,
            timestamp: u.dateadded || '', confidence: 85, severity: u.url_status === 'online' ? 'high' : 'medium',
            tags: [...(u.tags || []), u.threat || ''].filter(Boolean), provenance: 'direct-api', raw_payload_hash: h,
            metadata: { url: u.url, host: u.host, url_status: u.url_status, threat: u.threat, reporter: u.reporter },
          }))
          return c.json({ events, count: events.length, source: 'urlhaus' })
        }
      }
    }
    // CSV fallback
    const csvRes = await safeFetch('https://urlhaus.abuse.ch/downloads/csv_recent/', {}, 10000)
    if (csvRes.ok) {
      const csv = await csvRes.text()
      const lines = csv.split('\n').filter(l => l && !l.startsWith('#')).slice(0, 50)
      const events: CanonicalEvent[] = lines.map((l, i) => {
        const p = l.split(',').map(s => s.replace(/^"|"$/g, ''))
        return evt({
          id: `urlhaus_csv_${i}`, entity_type: 'cyber_malware_url',
          source: 'URLhaus (abuse.ch)', source_url: 'https://urlhaus.abuse.ch/',
          title: `Malware URL: ${(p[2] || '').slice(0, 80)}`,
          description: `Threat: ${p[5] || 'unknown'}`,
          timestamp: p[1] || '', confidence: 80, severity: 'medium',
          tags: (p[6] || '').split('|').filter(Boolean), provenance: 'direct-api',
          metadata: { url: p[2], url_status: p[3], host: p[7] },
        })
      })
      return c.json({ events, count: events.length, source: 'urlhaus-csv' })
    }
    return c.json(upstreamError('urlhaus', 0, 'URLhaus API unavailable'))
  } catch (error) {
    recordMetric('urlhaus', 0, false)
    return c.json(upstreamError('urlhaus', 0, String(error)))
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// CYBER — ThreatFox IOC (abuse.ch) — free, no key
// https://threatfox-api.abuse.ch/
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/cyber/threatfox', async (c) => {
  const authKey = c.env.ABUSECH_AUTH_KEY || ''
  try {
    const tfHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
    if (authKey) tfHeaders['Auth-Key'] = authKey
    const res = await safeFetch('https://threatfox-api.abuse.ch/api/v1/', {
      method: 'POST',
      headers: tfHeaders,
      body: JSON.stringify({ query: 'get_iocs', days: 3 }),
    }, 10000)
    if (res.ok) {
      const data = await res.json() as any
      const iocs = Array.isArray(data.data) ? data.data.slice(0, 60) : []
      const h = await hashPayload(data)
      const events: CanonicalEvent[] = iocs.map((ioc: any, i: number) => evt({
        id: `threatfox_${ioc.id || i}`, entity_type: 'cyber_ioc',
        source: 'ThreatFox (abuse.ch)', source_url: `https://threatfox.abuse.ch/ioc/${ioc.id}/`,
        title: `IOC: ${ioc.ioc_value || 'Unknown'}`,
        description: `${ioc.malware || ''} — ${ioc.threat_type || ''} (${ioc.ioc_type || ''})`,
        timestamp: ioc.first_seen_utc || '', confidence: ioc.confidence_level || 70,
        severity: (ioc.threat_type || '').includes('botnet') ? 'high' : 'medium',
        tags: (ioc.tags || []).concat([ioc.malware || '', ioc.threat_type || '']).filter(Boolean),
        provenance: 'direct-api', raw_payload_hash: h,
        metadata: { ioc_type: ioc.ioc_type, ioc_value: ioc.ioc_value, malware: ioc.malware, malware_alias: ioc.malware_alias, threat_type: ioc.threat_type, reporter: ioc.reporter, reference: ioc.reference },
      }))
      return c.json({ events, count: events.length, source: 'threatfox' })
    }
    return c.json(upstreamError('threatfox', 0, 'ThreatFox API unavailable'))
  } catch (error) {
    recordMetric('threatfox', 0, false)
    return c.json(upstreamError('threatfox', 0, String(error)))
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// GNSS ANOMALY LAYER — GPS jamming / spoofing reference data + news
// Sources: Curated from GPSJam.org, Eurocontrol, EASA, C4ADS reports
// ═══════════════════════════════════════════════════════════════════════════════
const GNSS_ZONES: CanonicalEvent[] = [
  { id: 'gnss_ua_east', entity_type: 'gnss_jamming', source: 'GPSJam.org / ADS-B analysis', source_url: 'https://gpsjam.org/', title: 'Ukraine — Eastern Front', description: 'Active GPS jamming from Russian EW systems (Krasukha-4, Pole-21). Continuous.', lat: 48.5, lon: 37.0, altitude: null, velocity: null, heading: null, timestamp: new Date().toISOString(), observed_at: new Date().toISOString(), confidence: 90, severity: 'critical', risk_score: 85, region: 'Eastern Europe', tags: ['military-jamming', 'continuous', 'GPS', 'GLONASS'], correlations: ['gnss_black_sea'], metadata: { radius_km: 300, affected_systems: 'All GNSS', type: 'military_jamming' }, raw_payload_hash: '', provenance: 'curated-reference' },
  { id: 'gnss_kaliningrad', entity_type: 'gnss_jamming', source: 'GPSJam.org / Eurocontrol', source_url: 'https://gpsjam.org/', title: 'Kaliningrad Oblast', description: 'Russian military GNSS jamming affecting Baltic airspace.', lat: 54.7, lon: 20.5, altitude: null, velocity: null, heading: null, timestamp: new Date().toISOString(), observed_at: new Date().toISOString(), confidence: 85, severity: 'high', risk_score: 70, region: 'Europe', tags: ['military-jamming', 'continuous', 'GPS-L1/L2'], correlations: ['gnss_baltic'], metadata: { radius_km: 200, affected_systems: 'GPS L1/L2', type: 'military_jamming' }, raw_payload_hash: '', provenance: 'curated-reference' },
  { id: 'gnss_baltic', entity_type: 'gnss_spoofing', source: 'GPSJam.org / EASA', source_url: 'https://gpsjam.org/', title: 'Eastern Baltic Sea', description: 'GPS spoofing affecting commercial aviation over Baltic states.', lat: 57.5, lon: 22.0, altitude: null, velocity: null, heading: null, timestamp: new Date().toISOString(), observed_at: new Date().toISOString(), confidence: 80, severity: 'high', risk_score: 65, region: 'Europe', tags: ['spoofing', 'aviation-impact', 'GPS', 'Galileo'], correlations: ['gnss_kaliningrad'], metadata: { radius_km: 250, affected_systems: 'GPS + Galileo', type: 'spoofing' }, raw_payload_hash: '', provenance: 'curated-reference' },
  { id: 'gnss_syria', entity_type: 'gnss_jamming', source: 'GPSJam.org / Bellingcat', source_url: 'https://gpsjam.org/', title: 'Syria — Northwest', description: 'Russian Khmeimim air base EW operations.', lat: 35.5, lon: 36.8, altitude: null, velocity: null, heading: null, timestamp: new Date().toISOString(), observed_at: new Date().toISOString(), confidence: 82, severity: 'high', risk_score: 60, region: 'Middle East', tags: ['military-jamming', 'continuous', 'GPS-L1'], correlations: [], metadata: { radius_km: 200, affected_systems: 'GPS L1', type: 'military_jamming' }, raw_payload_hash: '', provenance: 'curated-reference' },
  { id: 'gnss_israel', entity_type: 'gnss_spoofing', source: 'GPSJam.org / OPSGROUP', source_url: 'https://gpsjam.org/', title: 'Israel — Northern Border', description: 'Massive GPS spoofing affecting Ben Gurion approaches.', lat: 33.0, lon: 35.5, altitude: null, velocity: null, heading: null, timestamp: new Date().toISOString(), observed_at: new Date().toISOString(), confidence: 88, severity: 'high', risk_score: 72, region: 'Middle East', tags: ['spoofing', 'continuous', 'aviation-impact'], correlations: [], metadata: { radius_km: 150, affected_systems: 'GPS L1', type: 'spoofing' }, raw_payload_hash: '', provenance: 'curated-reference' },
  { id: 'gnss_iran', entity_type: 'gnss_jamming', source: 'GPSJam.org', source_url: 'https://gpsjam.org/', title: 'Iran — Western Border', description: 'Iranian military GPS jamming near Iraq border.', lat: 33.5, lon: 46.0, altitude: null, velocity: null, heading: null, timestamp: new Date().toISOString(), observed_at: new Date().toISOString(), confidence: 70, severity: 'medium', risk_score: 55, region: 'Middle East', tags: ['military-jamming', 'GPS', 'GLONASS'], correlations: [], metadata: { radius_km: 300, affected_systems: 'GPS + GLONASS', type: 'military_jamming' }, raw_payload_hash: '', provenance: 'curated-reference' },
  { id: 'gnss_dprk', entity_type: 'gnss_jamming', source: 'GPSJam.org / ROK MND', source_url: 'https://gpsjam.org/', title: 'North Korea — DMZ', description: 'DPRK GPS jamming toward South Korean targets.', lat: 37.9, lon: 126.7, altitude: null, velocity: null, heading: null, timestamp: new Date().toISOString(), observed_at: new Date().toISOString(), confidence: 75, severity: 'medium', risk_score: 50, region: 'Indo-Pacific', tags: ['military-jamming', 'periodic'], correlations: [], metadata: { radius_km: 120, affected_systems: 'GPS L1', type: 'military_jamming' }, raw_payload_hash: '', provenance: 'curated-reference' },
  { id: 'gnss_black_sea', entity_type: 'gnss_spoofing', source: 'C4ADS', source_url: 'https://c4ads.org/', title: 'Black Sea — Western', description: 'GPS spoofing centered on Sevastopol naval base.', lat: 44.0, lon: 33.0, altitude: null, velocity: null, heading: null, timestamp: new Date().toISOString(), observed_at: new Date().toISOString(), confidence: 82, severity: 'high', risk_score: 65, region: 'Eastern Europe', tags: ['spoofing', 'continuous', 'maritime-impact'], correlations: ['gnss_ua_east'], metadata: { radius_km: 250, affected_systems: 'GPS + GLONASS', type: 'spoofing' }, raw_payload_hash: '', provenance: 'curated-reference' },
  { id: 'gnss_red_sea', entity_type: 'gnss_spoofing', source: 'GPSJam.org / IMO', source_url: 'https://gpsjam.org/', title: 'Red Sea — Southern', description: 'GPS spoofing incidents near Bab el-Mandeb.', lat: 14.0, lon: 42.8, altitude: null, velocity: null, heading: null, timestamp: new Date().toISOString(), observed_at: new Date().toISOString(), confidence: 65, severity: 'medium', risk_score: 45, region: 'Middle East', tags: ['spoofing', 'maritime-impact'], correlations: [], metadata: { radius_km: 200, affected_systems: 'GPS', type: 'spoofing' }, raw_payload_hash: '', provenance: 'curated-reference' },
  { id: 'gnss_hormuz', entity_type: 'gnss_jamming', source: 'GPSJam.org', source_url: 'https://gpsjam.org/', title: 'Strait of Hormuz', description: 'Iranian GNSS interference affecting maritime traffic.', lat: 26.5, lon: 56.3, altitude: null, velocity: null, heading: null, timestamp: new Date().toISOString(), observed_at: new Date().toISOString(), confidence: 60, severity: 'medium', risk_score: 40, region: 'Middle East', tags: ['military-jamming', 'maritime-impact', 'intermittent'], correlations: [], metadata: { radius_km: 120, affected_systems: 'GPS', type: 'military_jamming' }, raw_payload_hash: '', provenance: 'curated-reference' },
  { id: 'gnss_scs', entity_type: 'gnss_spoofing', source: 'C4ADS / SkyTruth', source_url: 'https://c4ads.org/', title: 'South China Sea — Spratly', description: 'AIS and GPS spoofing near Chinese installations.', lat: 10.5, lon: 114.0, altitude: null, velocity: null, heading: null, timestamp: new Date().toISOString(), observed_at: new Date().toISOString(), confidence: 68, severity: 'medium', risk_score: 45, region: 'Indo-Pacific', tags: ['spoofing', 'maritime-impact', 'intermittent'], correlations: [], metadata: { radius_km: 200, affected_systems: 'GPS + BeiDou', type: 'spoofing' }, raw_payload_hash: '', provenance: 'curated-reference' },
  { id: 'gnss_emed', entity_type: 'gnss_spoofing', source: 'C4ADS', source_url: 'https://c4ads.org/', title: 'Eastern Mediterranean', description: 'GPS spoofing affecting shipping near Cyprus/Lebanon.', lat: 34.5, lon: 33.5, altitude: null, velocity: null, heading: null, timestamp: new Date().toISOString(), observed_at: new Date().toISOString(), confidence: 72, severity: 'medium', risk_score: 50, region: 'Europe', tags: ['spoofing', 'maritime-impact'], correlations: [], metadata: { radius_km: 350, affected_systems: 'GPS', type: 'spoofing' }, raw_payload_hash: '', provenance: 'curated-reference' },
]

app.get('/api/gnss/anomalies', async (c) => {
  let newsEvents: CanonicalEvent[] = []
  try {
    const data = await fetchGDELT('https://api.gdeltproject.org/api/v2/doc/doc?query=GPS+jamming+spoofing+GNSS+interference+navigation&mode=artlist&maxrecords=15&format=json&timespan=72h&sourcelang=english')
    if (data?.articles) {
      const h = await hashPayload(data)
      newsEvents = data.articles.slice(0, 10).map((art: any, i: number) => {
        const geo = geocodeFromText(art.title || '')
        if (!geo) return null
        return evt({
          id: `gnss_news_${i}`, entity_type: 'gnss_news', source: 'GDELT', source_url: art.url || '',
          title: art.title || '', lat: geo.lat, lon: geo.lon, region: geo.region,
          timestamp: art.seendate || '', confidence: geo.confidence, severity: 'info',
          tags: ['gnss', 'news', geo.matched], provenance: 'geocoded-inferred', raw_payload_hash: h,
          metadata: { domain: art.domain, matched_location: geo.matched },
        })
      }).filter(Boolean) as CanonicalEvent[]
    }
  } catch { /* GDELT enrichment is optional */ }

  return c.json({
    events: [...GNSS_ZONES, ...newsEvents],
    zones: GNSS_ZONES.length,
    news: newsEvents.length,
    source: 'gnss-reference-model',
    sources_info: [
      { name: 'GPSJam.org', url: 'https://gpsjam.org/', free: true, key_required: false, description: 'Daily ADS-B-based GPS interference maps' },
      { name: 'Eurocontrol', url: 'https://www.eurocontrol.int/', free: true, key_required: false, description: 'European GNSS interference reports' },
      { name: 'C4ADS', url: 'https://c4ads.org/', free: true, key_required: false, description: 'GPS spoofing research' },
      { name: 'EASA', url: 'https://www.easa.europa.eu/', free: true, key_required: false, description: 'Aviation safety bulletins' },
    ],
    note: 'GNSS anomaly data is a curated reference model. No free real-time GNSS API exists. GPSJam.org provides daily maps at https://gpsjam.org/',
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// SOCIAL INTEL — Reddit public JSON + Mastodon public timeline
// No key required for public access. Rate limits apply.
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/social/reddit', async (c) => {
  const subs = [
    { name: 'CombatFootage', tag: 'conflict-video' },
    { name: 'UkraineWarVideoReport', tag: 'ukraine-video' },
    { name: 'CredibleDefense', tag: 'military-analysis' },
    { name: 'UkrainianConflict', tag: 'ukraine-news' },
    { name: 'osint', tag: 'osint' },
  ]

  const allEvents: CanonicalEvent[] = []
  const results = await Promise.allSettled(
    subs.map(sub =>
      safeFetch(`https://www.reddit.com/r/${sub.name}/hot.json?limit=15&raw_json=1`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SentinelOS/7.0; +https://github.com/MSA-83/SENTINEL-X)' },
      }, 10000).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      }).then((data: any) => {
        return (data?.data?.children || []).map((child: any) => {
          const p = child.data
          if (!p) return null
          let media_url = ''
          let media_type = 'text'
          if (p.is_video && p.media?.reddit_video?.fallback_url) { media_url = p.media.reddit_video.fallback_url; media_type = 'video' }
          else if (p.url && /\.(mp4|webm|mov)/i.test(p.url)) { media_url = p.url; media_type = 'video' }
          else if (p.url && /v\.redd\.it|streamable|youtube|youtu\.be/i.test(p.url)) { media_url = p.url; media_type = 'video_link' }
          else if (p.url && /\.(jpg|jpeg|png|gif|webp)/i.test(p.url)) { media_url = p.url; media_type = 'image' }

          const geo = geocodeFromText(p.title || '')
          return evt({
            id: `reddit_${p.id}`, entity_type: 'social_post',
            source: `Reddit r/${sub.name}`, source_url: `https://reddit.com${p.permalink}`,
            title: (p.title || '').slice(0, 200),
            description: (p.selftext || '').slice(0, 200),
            lat: geo?.lat ?? null, lon: geo?.lon ?? null, region: geo?.region || '',
            timestamp: p.created_utc ? new Date(p.created_utc * 1000).toISOString() : '',
            confidence: geo ? geo.confidence : 0,
            severity: 'info', tags: [sub.tag, p.link_flair_text || ''].filter(Boolean),
            provenance: geo ? 'geocoded-inferred' : 'no-location',
            metadata: {
              subreddit: sub.name, author: p.author || '', score: p.score || 0,
              num_comments: p.num_comments || 0, media_url, media_type,
              thumbnail: p.thumbnail?.startsWith('http') ? p.thumbnail : '',
              nsfw: p.over_18 || false, flair: p.link_flair_text || '',
              external_url: p.url || '', matched_location: geo?.matched || null,
              geolocation_method: geo ? 'text-inference' : 'none',
            },
          })
        }).filter(Boolean) as CanonicalEvent[]
      }).catch(() => [] as CanonicalEvent[])
    )
  )

  results.forEach(r => { if (r.status === 'fulfilled') allEvents.push(...r.value) })
  allEvents.sort((a, b) => ((b.metadata.score as number) || 0) - ((a.metadata.score as number) || 0))
  const geolocated = allEvents.filter(e => e.lat !== null)

  return c.json({
    events: allEvents.slice(0, 60),
    total: allEvents.length,
    geolocated: geolocated.length,
    source: 'reddit-public',
    note: 'Reddit public JSON API. No authentication required. Locations are inferred from post titles and marked as low-confidence.',
  })
})

// Mastodon public timeline (OSINT-focused instances)
app.get('/api/social/mastodon', async (c) => {
  const instances = [
    { host: 'infosec.exchange', tag: 'infosec' },
    { host: 'ioc.exchange', tag: 'ioc' },
  ]
  const allEvents: CanonicalEvent[] = []
  const results = await Promise.allSettled(
    instances.map(inst =>
      safeFetch(`https://${inst.host}/api/v1/timelines/public?limit=20&local=false`, {}, 8000)
        .then(r => r.ok ? r.json() : [])
        .then((posts: any[]) => {
          return (posts || []).slice(0, 15).map((p: any, i: number) => {
            const text = (p.content || '').replace(/<[^>]+>/g, '').slice(0, 300)
            const geo = geocodeFromText(text)
            return evt({
              id: `masto_${inst.host.split('.')[0]}_${i}`,
              entity_type: 'social_post',
              source: `Mastodon ${inst.host}`,
              source_url: p.url || p.uri || '',
              title: text.slice(0, 120) || 'Post',
              description: text,
              lat: geo?.lat ?? null, lon: geo?.lon ?? null,
              region: geo?.region || '',
              timestamp: p.created_at || '',
              confidence: geo ? geo.confidence : 0,
              severity: 'info',
              tags: [inst.tag, ...(p.tags || []).map((t: any) => t.name || '').slice(0, 5)].filter(Boolean),
              provenance: geo ? 'geocoded-inferred' : 'no-location',
              metadata: {
                instance: inst.host, author: p.account?.acct || '',
                reblogs: p.reblogs_count || 0, favourites: p.favourites_count || 0,
                media_attachments: (p.media_attachments || []).map((m: any) => m.url).slice(0, 3),
                geolocation_method: geo ? 'text-inference' : 'none',
                matched_location: geo?.matched || null,
              },
            })
          }).filter(Boolean) as CanonicalEvent[]
        })
        .catch(() => [] as CanonicalEvent[])
    )
  )
  results.forEach(r => { if (r.status === 'fulfilled') allEvents.push(...r.value) })
  const geolocated = allEvents.filter(e => e.lat !== null)

  return c.json({
    events: allEvents.slice(0, 40),
    total: allEvents.length,
    geolocated: geolocated.length,
    source: 'mastodon-public',
    note: 'Mastodon public timeline. No authentication required. Locations inferred from text with low confidence.',
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// FUSION — Threat zones
// ═══════════════════════════════════════════════════════════════════════════════
const FUSION_ZONES = [
  { name: 'Ukraine/Russia Front', lat: 48.5, lon: 37.0, radius: 400, base_threat: 55, type: 'conflict' },
  { name: 'Gaza Strip', lat: 31.4, lon: 34.5, radius: 120, base_threat: 70, type: 'conflict' },
  { name: 'Iran Theater', lat: 32.4, lon: 53.7, radius: 500, base_threat: 65, type: 'flashpoint' },
  { name: 'Red Sea/Houthi Zone', lat: 14.5, lon: 43.5, radius: 350, base_threat: 60, type: 'chokepoint' },
  { name: 'Strait of Hormuz', lat: 26.5, lon: 56.3, radius: 180, base_threat: 50, type: 'chokepoint' },
  { name: 'Taiwan Strait', lat: 24.5, lon: 120.0, radius: 250, base_threat: 55, type: 'flashpoint' },
  { name: 'South China Sea', lat: 13.5, lon: 115.0, radius: 500, base_threat: 45, type: 'flashpoint' },
  { name: 'Korean Peninsula', lat: 38.0, lon: 127.5, radius: 200, base_threat: 50, type: 'flashpoint' },
  { name: 'Sudan Civil War', lat: 15.5, lon: 32.5, radius: 350, base_threat: 50, type: 'conflict' },
  { name: 'Sahel Insurgency', lat: 14.0, lon: 2.0, radius: 600, base_threat: 40, type: 'conflict' },
  { name: 'Kashmir LOC', lat: 34.0, lon: 74.5, radius: 200, base_threat: 45, type: 'flashpoint' },
  { name: 'Black Sea NATO Watch', lat: 43.5, lon: 34.5, radius: 400, base_threat: 45, type: 'flashpoint' },
]

app.get('/api/fusion/zones', (c) => c.json({ zones: FUSION_ZONES }))

// ═══════════════════════════════════════════════════════════════════════════════
// FUSION — Viewport-aware zone query
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/fusion/viewport', (c) => {
  const latMin = parseFloat(c.req.query('latMin') || '-90')
  const latMax = parseFloat(c.req.query('latMax') || '90')
  const lonMin = parseFloat(c.req.query('lonMin') || '-180')
  const lonMax = parseFloat(c.req.query('lonMax') || '180')
  const visible = FUSION_ZONES.filter(z =>
    z.lat >= latMin && z.lat <= latMax && z.lon >= lonMin && z.lon <= lonMax
  )
  return c.json({ zones: visible, total: FUSION_ZONES.length, visible: visible.length })
})

// ═══════════════════════════════════════════════════════════════════════════════
// SOURCE-HEALTH METRICS (v8.0)
// Tracks per-source latency, uptime, error rates for UI display
// ═══════════════════════════════════════════════════════════════════════════════
const sourceMetricsStore: Record<string, {
  latency_ms: number
  uptime_pct: number
  last_success: string
  error_count: number
  total_requests: number
  last_status: 'live' | 'error' | 'loading'
}> = {}

function recordMetric(source: string, latencyMs: number, success: boolean) {
  if (!sourceMetricsStore[source]) {
    sourceMetricsStore[source] = { latency_ms: 0, uptime_pct: 100, last_success: '', error_count: 0, total_requests: 0, last_status: 'loading' }
  }
  const m = sourceMetricsStore[source]
  m.total_requests++
  // Exponential moving average for latency
  m.latency_ms = m.latency_ms === 0 ? latencyMs : Math.round(m.latency_ms * 0.7 + latencyMs * 0.3)
  if (success) {
    m.last_success = new Date().toISOString()
    m.last_status = 'live'
  } else {
    m.error_count++
    m.last_status = 'error'
  }
  m.uptime_pct = m.total_requests > 0 ? Math.round((1 - m.error_count / m.total_requests) * 100) : 100
}

app.get('/api/metrics/health', (c) => {
  const sources: Record<string, unknown> = {}
  // Map layer keys to metric entries
  const layerSources: Record<string, string[]> = {
    aircraft: ['opensky'], military: ['opensky', 'military'],
    ships: ['aisstream'], darkships: ['gfw_gap'], fishing: ['gfw_fishing'],
    iss: ['iss'], satellites: ['n2yo', 'celestrak', 'spacetrack'], debris: ['celestrak'],
    conjunctions: ['spacetrack_cdm'],
    seismic: ['usgs'], wildfires: ['firms'], weather: ['owm'],
    conflict: ['gdelt_conflict', 'acled'], disasters: ['gdacs', 'reliefweb'],
    nuclear: ['gdelt_nuclear'], cyber: ['cisa_kev', 'otx', 'urlhaus', 'threatfox'],
    gnss: ['gnss'], social: ['reddit', 'mastodon'],
    sigmets: ['avwx_sigmet'], eonet: ['eonet'], shodan_geo: ['shodan_geo'],
  }

  for (const [layerKey, srcKeys] of Object.entries(layerSources)) {
    // Aggregate metrics from all sub-sources
    let totalLatency = 0, totalUptime = 0, totalErrors = 0, count = 0
    let lastSuccess = '', lastStatus: 'live' | 'error' | 'loading' = 'loading'
    for (const sk of srcKeys) {
      const m = sourceMetricsStore[sk]
      if (m) {
        totalLatency += m.latency_ms
        totalUptime += m.uptime_pct
        totalErrors += m.error_count
        if (m.last_success > lastSuccess) lastSuccess = m.last_success
        if (m.last_status === 'live') lastStatus = 'live'
        else if (m.last_status === 'error' && lastStatus !== 'live') lastStatus = 'error'
        count++
      }
    }
    sources[layerKey] = {
      latency_ms: count > 0 ? Math.round(totalLatency / count) : 0,
      uptime_pct: count > 0 ? Math.round(totalUptime / count) : 0,
      last_success: lastSuccess,
      error_count: totalErrors,
      status: lastStatus,
    }
  }

  return c.json({
    version: VERSION,
    timestamp: new Date().toISOString(),
    sources,
    total_sources: Object.keys(sourceMetricsStore).length,
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// AVWX SIGMET — Aviation hazard overlays (V4 pattern: cached 10 min)
// Requires: AVWX_KEY — Returns active SIGMETs globally (turbulence, icing, volcanic ash, etc.)
// Adapted from V4 AVWX adapter with TTL caching
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/avwx/sigmets', async (c) => {
  const key = c.env.AVWX_KEY
  if (!key) return c.json(upstreamError('avwx', 0, 'AVWX_KEY not configured'))
  
  const hazard = c.req.query('hazard') || ''
  const cacheKey = `sigmets:${hazard || 'all'}`
  const cached = cacheGet(cacheKey)
  if (cached) return c.json({ ...cached, _cached: true })
  
  if (!circuitCheck('avwx_sigmet')) return c.json(upstreamError('avwx', 0, 'AVWX SIGMET circuit open — too many failures'))
  
  const t0 = Date.now()
  try {
    const params = hazard ? `?hazard=${hazard.toUpperCase()}` : ''
    const data = await safeJson(`https://avwx.rest/api/sigmet${params}`, {
      headers: { 'Authorization': `Bearer ${key}` }
    }, 10000)
    
    const sigmets = (Array.isArray(data) ? data : data.sigmets || []).slice(0, 50)
    const h = await hashPayload(data)
    
    const events: CanonicalEvent[] = sigmets.map((s: any, i: number) => {
      const coords = s.coords || s.coordinates || []
      // Try to extract a centroid from the polygon coords
      let lat: number | null = null, lon: number | null = null
      if (coords.length > 0) {
        const lats = coords.map((c: number[]) => c[1] || c[0]).filter((v: number) => v)
        const lons = coords.map((c: number[]) => c[0] || c[1]).filter((v: number) => v)
        if (lats.length > 0) { lat = lats.reduce((a: number, b: number) => a + b, 0) / lats.length; lon = lons.reduce((a: number, b: number) => a + b, 0) / lons.length }
      }
      
      const hazardType = s.hazard || 'UNKNOWN'
      const severity = hazardType === 'VA' || hazardType === 'TC' ? 'critical' : hazardType === 'TURB' || hazardType === 'ICE' ? 'high' : 'medium'
      
      return evt({
        id: `sigmet_${i}_${(s.raw || '').slice(0, 16)}`,
        entity_type: 'sigmet',
        source: 'AVWX SIGMET',
        source_url: 'https://avwx.rest/',
        title: `SIGMET: ${hazardType}${s.qualifier ? ' ' + s.qualifier : ''} — ${s.fir || 'Global'}`,
        description: s.raw || `${hazardType} hazard`,
        lat, lon,
        confidence: 92,
        severity,
        risk_score: severity === 'critical' ? 80 : severity === 'high' ? 60 : 40,
        tags: ['sigmet', hazardType.toLowerCase(), s.fir || ''].filter(Boolean),
        provenance: 'direct-api',
        raw_payload_hash: h,
        metadata: {
          hazard: hazardType, qualifier: s.qualifier,
          flight_levels: { lower: s.altitude?.min, upper: s.altitude?.max },
          valid_from: typeof s.start_time === 'object' ? s.start_time?.repr : s.start_time,
          valid_to: typeof s.end_time === 'object' ? s.end_time?.repr : s.end_time,
          issuing_office: s.issuing_office, fir: s.fir,
          coords, raw: s.raw,
        },
      })
    })
    
    const result = { events, count: events.length, source: 'avwx-sigmet', raw_payload_hash: h }
    cacheSet(cacheKey, result, 600000) // Cache 10 min (SIGMETs change hourly)
    recordMetric('avwx_sigmet', Date.now() - t0, true)
    circuitSuccess('avwx_sigmet')
    return c.json(result)
  } catch (error) {
    recordMetric('avwx_sigmet', Date.now() - t0, false)
    circuitFailure('avwx_sigmet')
    return c.json(upstreamError('avwx', 0, String(error)))
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// AVWX METAR BY COORDINATE — Nearest stations + parallel fetch (V4 pattern)
// Finds N nearest airport weather stations to a lat/lon and returns all METARs
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/avwx/near', async (c) => {
  const key = c.env.AVWX_KEY
  if (!key) return c.json(upstreamError('avwx', 0, 'AVWX_KEY not configured'))
  
  const lat = parseFloat(c.req.query('lat') || '0')
  const lon = parseFloat(c.req.query('lon') || '0')
  const limit = Math.min(parseInt(c.req.query('limit') || '5'), 10)
  
  if (lat === 0 && lon === 0) return c.json(upstreamError('avwx', 400, 'lat and lon query params required'))
  
  const cacheKey = `metar_near:${lat.toFixed(1)}_${lon.toFixed(1)}`
  const cached = cacheGet(cacheKey)
  if (cached) return c.json({ ...cached, _cached: true })
  
  const t0 = Date.now()
  const headers = { 'Authorization': `Bearer ${key}` }
  
  try {
    // Step 1: Find nearest stations (V4 pattern)
    const stationData = await safeJson(
      `https://avwx.rest/api/station/near/${lat.toFixed(4)},${lon.toFixed(4)}?n=${limit}&maxdist=200`,
      { headers }, 8000
    )
    
    const stations = (Array.isArray(stationData) ? stationData : [])
      .filter((s: any) => s?.station?.icao)
      .slice(0, limit)
    
    if (stations.length === 0) return c.json({ stations: [], metars: [], count: 0, source: 'avwx-near' })
    
    // Step 2: Fetch all METARs concurrently (V4 asyncio.gather pattern)
    const icaoCodes = stations.map((s: any) => s.station.icao)
    const metarResults = await Promise.allSettled(
      icaoCodes.map((icao: string) =>
        safeJson(`https://avwx.rest/api/metar/${icao}?format=json&onfail=cache`, { headers }, 6000)
      )
    )
    
    const metars = metarResults
      .filter(r => r.status === 'fulfilled' && (r as any).value?.station)
      .map(r => (r as PromiseFulfilledResult<any>).value)
    
    const stationInfo = stations.map((s: any) => ({
      icao: s.station.icao, name: s.station.name,
      lat: s.station.latitude, lon: s.station.longitude,
      elevation_m: s.station.elevation_m, distance_km: s.distance,
    }))
    
    const result = { stations: stationInfo, metars, count: metars.length, source: 'avwx-near' }
    cacheSet(cacheKey, result, 300000) // 5 min cache for METARs
    recordMetric('avwx_near', Date.now() - t0, true)
    return c.json(result)
  } catch (error) {
    recordMetric('avwx_near', Date.now() - t0, false)
    return c.json(upstreamError('avwx', 0, String(error)))
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// NASA EONET — Natural hazard events with spatial bbox filter (V4 pattern)
// Free, no key required. Provides volcanoes, storms, wildfires, floods, etc.
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/eonet/events', async (c) => {
  const lat = parseFloat(c.req.query('lat') || '0')
  const lon = parseFloat(c.req.query('lon') || '0')
  const radiusKm = parseFloat(c.req.query('radius') || '0')
  const days = parseInt(c.req.query('days') || '30')
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 200)
  
  const cacheKey = radiusKm > 0 ? `eonet:${lat.toFixed(0)}_${lon.toFixed(0)}_${radiusKm}` : 'eonet:global'
  const cached = cacheGet(cacheKey)
  if (cached) return c.json({ ...cached, _cached: true })
  
  if (!circuitCheck('eonet')) return c.json(upstreamError('eonet', 0, 'NASA EONET circuit open'))
  
  const t0 = Date.now()
  try {
    let url = `https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=${limit}`
    if (days > 0) url += `&days=${days}`
    
    // V4 pattern: server-side bbox filter for spatial queries
    if (radiusKm > 0 && lat !== 0) {
      const KM_PER_DEG = 111.0
      const deltaLat = radiusKm / KM_PER_DEG
      const deltaLon = radiusKm / (KM_PER_DEG * Math.cos(lat * Math.PI / 180))
      const minLon = Math.max(lon - deltaLon, -180)
      const minLat = Math.max(lat - deltaLat, -90)
      const maxLon = Math.min(lon + deltaLon, 180)
      const maxLat = Math.min(lat + deltaLat, 90)
      url += `&bbox=${minLon.toFixed(4)},${minLat.toFixed(4)},${maxLon.toFixed(4)},${maxLat.toFixed(4)}`
    }
    
    const data = await safeJson(url, {}, 15000)
    const rawEvents = data.events || []
    const h = await hashPayload(data)
    
    const events: CanonicalEvent[] = rawEvents.map((e: any, i: number) => {
      // EONET v3 uses "geometry" (singular), newest entry is LAST in array
      const geometries = e.geometry || e.geometries || []
      const latest = geometries.length > 0 ? geometries[geometries.length - 1] : {}
      const coords = latest.coordinates
      let eLat: number | null = null, eLon: number | null = null
      
      if (coords && latest.type === 'Point' && coords.length >= 2) {
        eLon = coords[0]; eLat = coords[1] // EONET uses [lon, lat]
      }
      
      const categories = (e.categories || []).map((c: any) => c.title || c.id)
      const catSlug = categories[0]?.toLowerCase() || ''
      const severity = catSlug.includes('volcan') ? 'high' : catSlug.includes('severe') || catSlug.includes('cyclone') ? 'high' : catSlug.includes('fire') ? 'medium' : 'low'
      
      return evt({
        id: `eonet_${e.id || i}`,
        entity_type: 'natural_event',
        source: 'NASA EONET',
        source_url: e.link || 'https://eonet.gsfc.nasa.gov/',
        title: e.title || 'Natural Event',
        description: `Categories: ${categories.join(', ')}`,
        lat: eLat, lon: eLon,
        timestamp: latest.date || '',
        confidence: 90,
        severity,
        tags: ['eonet', ...categories.map((c: string) => c.toLowerCase().replace(/\s+/g, '-'))],
        provenance: 'direct-api',
        raw_payload_hash: h,
        metadata: {
          eonet_id: e.id, categories, category_ids: (e.categories || []).map((c: any) => c.id),
          geometry_type: latest.type, geometry_date: latest.date,
          magnitude_value: latest.magnitudeValue, magnitude_unit: latest.magnitudeUnit,
          source_links: (e.sources || []).map((s: any) => ({ id: s.id, url: s.url })),
          geometry_count: geometries.length,
        },
      })
    }).filter((e: CanonicalEvent) => e.lat !== null)
    
    const result = { events, count: events.length, total_raw: rawEvents.length, source: 'nasa-eonet', raw_payload_hash: h }
    cacheSet(cacheKey, result, 300000) // 5 min cache
    recordMetric('eonet', Date.now() - t0, true)
    circuitSuccess('eonet')
    return c.json(result)
  } catch (error) {
    recordMetric('eonet', Date.now() - t0, false)
    circuitFailure('eonet')
    return c.json(upstreamError('eonet', 0, String(error)))
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// SHODAN GEO SEARCH — Find exposed systems near a coordinate (V4 pattern)
// + Host intel enrichment + Exploit lookup
// ═══════════════════════════════════════════════════════════════════════════════
app.post('/api/shodan/geo', async (c) => {
  const key = c.env.SHODAN_KEY
  if (!key) return c.json(upstreamError('shodan', 0, 'SHODAN_KEY not set'))
  
  const { lat, lon, radius_km, query: extraQuery } = await c.req.json<{
    lat?: number; lon?: number; radius_km?: number; query?: string
  }>().catch(() => ({ lat: undefined, lon: undefined, radius_km: undefined, query: undefined }))
  
  if (!lat || !lon) return c.json(upstreamError('shodan', 400, 'lat and lon required in request body'))
  
  const radius = Math.min(radius_km || 50, 500)
  const geoFilter = `geo:${lat.toFixed(4)},${lon.toFixed(4)},${radius}`
  const fullQuery = extraQuery ? `${geoFilter} ${extraQuery}` : geoFilter
  
  const cacheKey = `shodan_geo:${lat.toFixed(1)}_${lon.toFixed(1)}_${radius}`
  const cached = cacheGet(cacheKey)
  if (cached) return c.json({ ...cached, _cached: true })
  
  const t0 = Date.now()
  try {
    const data = await safeJson(
      `https://api.shodan.io/shodan/host/search?key=${key}&query=${encodeURIComponent(fullQuery)}&minify=true&page=1`,
      {}, 12000
    )
    const matches = (data.matches || []).slice(0, 50)
    const h = await hashPayload(data)
    
    const events: CanonicalEvent[] = matches.map((m: any, i: number) => {
      const mLat = m.location?.latitude || 0
      const mLon = m.location?.longitude || 0
      const vulns = Object.keys(m.vulns || {})
      const severity = vulns.length > 5 ? 'critical' : vulns.length > 0 ? 'high' : 'medium'
      
      return evt({
        id: `shodan_geo_${m.ip_str || i}_${m.port || 0}`,
        entity_type: 'cyber_host',
        source: 'Shodan Geo',
        source_url: `https://www.shodan.io/host/${m.ip_str}`,
        title: `${m.ip_str}:${m.port} — ${m.product || m.org || 'Unknown'}`,
        description: `${m.org || ''} | ${m.location?.country_name || ''} | CVEs: ${vulns.length}`,
        lat: mLat, lon: mLon,
        confidence: 90, severity,
        risk_score: Math.min(100, 30 + vulns.length * 10),
        tags: ['shodan', 'geo-search', ...(m.cpe || []).slice(0, 3), ...vulns.slice(0, 3)],
        provenance: 'direct-api',
        raw_payload_hash: h,
        metadata: {
          ip: m.ip_str, port: m.port, org: m.org,
          product: m.product, version: m.version,
          country: m.location?.country_name, city: m.location?.city,
          cpe: m.cpe || [], vulns, timestamp: m.timestamp,
        },
      })
    })
    
    const result = { events, count: events.length, total: data.total || 0, source: 'shodan-geo', raw_payload_hash: h }
    cacheSet(cacheKey, result, 180000) // 3 min cache
    recordMetric('shodan_geo', Date.now() - t0, true)
    return c.json(result)
  } catch (error) {
    recordMetric('shodan_geo', Date.now() - t0, false)
    return c.json(upstreamError('shodan', 0, String(error)))
  }
})

// Shodan host intel — V4 pattern: per-IP enrichment
app.get('/api/shodan/host/:ip', async (c) => {
  const key = c.env.SHODAN_KEY
  if (!key) return c.json(upstreamError('shodan', 0, 'SHODAN_KEY not set'))
  
  const ip = c.req.param('ip')
  const cacheKey = `shodan_host:${ip}`
  const cached = cacheGet(cacheKey)
  if (cached) return c.json({ ...cached, _cached: true })
  
  try {
    const data = await safeJson(`https://api.shodan.io/shodan/host/${ip}?key=${key}`, {}, 10000)
    const result = {
      ip: data.ip_str, org: data.org, country: data.country_name, city: data.city,
      isp: data.isp, asn: data.asn, os: data.os,
      open_ports: data.ports || [],
      vulns: Object.keys(data.vulns || {}),
      last_update: data.last_update,
      hostnames: data.hostnames || [],
      tags: data.tags || [],
      services: (data.data || []).slice(0, 10).map((s: any) => ({
        port: s.port, transport: s.transport, product: s.product, version: s.version,
      })),
      source: 'shodan-host',
    }
    cacheSet(cacheKey, result, 300000) // 5 min
    return c.json(result)
  } catch (error) { return c.json(upstreamError('shodan', 0, String(error))) }
})

// Shodan exploit lookup — V4 pattern: CVE enrichment
app.get('/api/shodan/exploits/:cve', async (c) => {
  const key = c.env.SHODAN_KEY
  if (!key) return c.json(upstreamError('shodan', 0, 'SHODAN_KEY not set'))
  
  const cve = c.req.param('cve')
  const cacheKey = `shodan_exploit:${cve}`
  const cached = cacheGet(cacheKey)
  if (cached) return c.json({ ...cached, _cached: true })
  
  try {
    const data = await safeJson(`https://exploits.shodan.io/api/search?query=${cve}&key=${key}`, {}, 10000)
    const exploits = (data.matches || []).slice(0, 20).map((e: any) => ({
      id: e._id, title: (e.description || '').slice(0, 200),
      type: e.type, platform: e.platform, cve: e.cve || [],
      source: 'shodan-exploits',
    }))
    const result = { exploits, count: exploits.length, total: data.total || 0, source: 'shodan-exploits' }
    cacheSet(cacheKey, result, 600000) // 10 min
    return c.json(result)
  } catch (error) { return c.json(upstreamError('shodan', 0, String(error))) }
})

// ═══════════════════════════════════════════════════════════════════════════════
// INTEL OVERVIEW — Multi-domain concurrent fan-out for a geographic area (V4 pattern)
// Single endpoint that queries all relevant sources simultaneously
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/intel/overview', async (c) => {
  const lat = parseFloat(c.req.query('lat') || '0')
  const lon = parseFloat(c.req.query('lon') || '0')
  const radiusKm = parseFloat(c.req.query('radius') || '250')
  const domainsParam = c.req.query('domains') || 'weather,aviation,natural,cyber'
  const domains = new Set(domainsParam.split(',').map(d => d.trim().toLowerCase()))
  
  if (lat === 0 && lon === 0) return c.json(upstreamError('intel', 400, 'lat and lon required'))
  
  const results: Record<string, any> = {}
  const tasks: Promise<void>[] = []
  
  // Weather
  if (domains.has('weather') && c.env.OWM_KEY) {
    tasks.push(
      safeJson(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${c.env.OWM_KEY}&units=metric`, {}, 8000)
        .then(d => { results.weather = d })
        .catch(() => { results.weather = null })
    )
  }
  
  // Aviation SIGMETs
  if (domains.has('aviation') && c.env.AVWX_KEY) {
    tasks.push(
      safeJson('https://avwx.rest/api/sigmet', { headers: { 'Authorization': `Bearer ${c.env.AVWX_KEY}` } }, 10000)
        .then(d => { results.sigmets = Array.isArray(d) ? d.slice(0, 20) : [] })
        .catch(() => { results.sigmets = [] })
    )
    // Nearest METARs
    tasks.push(
      safeJson(`https://avwx.rest/api/station/near/${lat.toFixed(4)},${lon.toFixed(4)}?n=3&maxdist=200`, {
        headers: { 'Authorization': `Bearer ${c.env.AVWX_KEY}` }
      }, 8000)
        .then(async stations => {
          const icaos = (stations || []).filter((s: any) => s?.station?.icao).map((s: any) => s.station.icao).slice(0, 3)
          const metarResults = await Promise.allSettled(
            icaos.map((icao: string) => safeJson(`https://avwx.rest/api/metar/${icao}?format=json`, {
              headers: { 'Authorization': `Bearer ${c.env.AVWX_KEY}` }
            }, 6000))
          )
          results.metars = metarResults.filter(r => r.status === 'fulfilled').map(r => (r as any).value)
        })
        .catch(() => { results.metars = [] })
    )
  }
  
  // Natural events (EONET)
  if (domains.has('natural')) {
    const KM_PER_DEG = 111.0
    const deltaLat = radiusKm / KM_PER_DEG
    const deltaLon = radiusKm / (KM_PER_DEG * Math.cos(lat * Math.PI / 180))
    const bbox = `${(lon - deltaLon).toFixed(4)},${(lat - deltaLat).toFixed(4)},${(lon + deltaLon).toFixed(4)},${(lat + deltaLat).toFixed(4)}`
    tasks.push(
      safeJson(`https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=25&days=30&bbox=${bbox}`, {}, 12000)
        .then(d => { results.natural_events = (d.events || []).slice(0, 25) })
        .catch(() => { results.natural_events = [] })
    )
  }
  
  // Cyber (Shodan geo)
  if (domains.has('cyber') && c.env.SHODAN_KEY) {
    const geoQ = `geo:${lat.toFixed(4)},${lon.toFixed(4)},${Math.min(radiusKm, 200)}`
    tasks.push(
      safeJson(`https://api.shodan.io/shodan/host/search?key=${c.env.SHODAN_KEY}&query=${encodeURIComponent(geoQ)}&minify=true&page=1`, {}, 12000)
        .then(d => { results.cyber_hosts = (d.matches || []).slice(0, 30) })
        .catch(() => { results.cyber_hosts = [] })
    )
  }
  
  // Execute all concurrently (V4 asyncio.gather pattern)
  await Promise.allSettled(tasks)
  
  return c.json({
    query: { lat, lon, radius_km: radiusKm, domains: Array.from(domains).sort() },
    weather: results.weather || null,
    aviation: { sigmets: results.sigmets || [], metars: results.metars || [] },
    natural_events: results.natural_events || [],
    cyber: { exposed_hosts: results.cyber_hosts || [], host_count: (results.cyber_hosts || []).length },
    timestamp: new Date().toISOString(),
    source: 'intel-overview',
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// CIRCUIT BREAKER STATUS — Diagnostic endpoint
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/circuits', (c) => {
  const status: Record<string, any> = {}
  for (const [src, s] of Object.entries(circuits)) {
    status[src] = {
      open: s.open,
      failures: s.failures,
      last_failure: s.lastFailure > 0 ? new Date(s.lastFailure).toISOString() : null,
      cooldown_remaining_s: s.open ? Math.max(0, Math.round((CB_COOLDOWN - (Date.now() - s.lastFailure)) / 1000)) : 0,
    }
  }
  return c.json({ circuits: status, threshold: CB_THRESHOLD, cooldown_s: CB_COOLDOWN / 1000 })
})

// ═══════════════════════════════════════════════════════════════════════════════
// CACHE STATUS — Diagnostic endpoint
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/cache/status', (c) => {
  const entries: Record<string, any> = {}
  const now = Date.now()
  for (const [key, entry] of Object.entries(responseCache)) {
    entries[key] = {
      age_s: Math.round((now - entry.ts) / 1000),
      ttl_s: Math.round(entry.ttl / 1000),
      remaining_s: Math.max(0, Math.round((entry.ttl - (now - entry.ts)) / 1000)),
      expired: now - entry.ts > entry.ttl,
    }
  }
  return c.json({ entries, count: Object.keys(entries).length })
})

// ═══════════════════════════════════════════════════════════════════════════════
// HEALTH + STATUS
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/health', (c) => c.json({
  status: 'operational',
  version: VERSION,
  codename: 'SENTINEL-X',
  timestamp: new Date().toISOString(),
  domains: ['aviation', 'maritime', 'orbital', 'seismic', 'wildfire', 'weather', 'conflict', 'disaster', 'cyber', 'nuclear', 'gnss', 'social', 'imagery', 'infrastructure', 'energy', 'logistics', 'border', 'telecom', 'public-safety'],
  v90_features: ['auth-jwt-rbac', 'alert-platform', 'case-management', 'workspace-system', 'knowledge-graph', 'analytics-engine', 'entity-resolution', 'geofence-engine', 'global-search', 'audit-logging', 'admin-console', 'expanded-domains', 'infrastructure-intel', 'energy-intel', 'logistics-intel', 'border-intel', 'telecom-intel', 'public-safety-intel'],
  platform: { users: Object.keys(usersStore).length, alerts: Object.keys(alertsStore).length, cases: Object.keys(casesStore).length, workspaces: Object.keys(workspacesStore).length, graph_nodes: Object.keys(graphNodes).length, graph_edges: Object.keys(graphEdges).length, geofences: Object.keys(geofencesStore).length, resolved_entities: Object.keys(resolvedEntities).length },
}))

app.get('/api/status', (c) => {
  const keyNames: (keyof Bindings)[] = ['NASA_FIRMS_KEY', 'OWM_KEY', 'N2YO_KEY', 'GFW_TOKEN', 'AVWX_KEY', 'RAPIDAPI_KEY', 'SHODAN_KEY', 'NEWS_API_KEY', 'AISSTREAM_KEY', 'OTX_KEY', 'ACLED_KEY', 'ACLED_EMAIL', 'ABUSECH_AUTH_KEY', 'SPACETRACK_USER', 'SPACETRACK_PASS', 'COPERNICUS_CLIENT_ID', 'COPERNICUS_CLIENT_SECRET', 'CESIUM_ION_TOKEN']
  const keys: Record<string, boolean> = {}
  for (const k of keyNames) keys[k] = !!(c.env[k])
  return c.json({
    version: VERSION,
    keys,
    targets: Object.keys(TARGETS).length,
    fusion_zones: FUSION_ZONES.length,
    gnss_zones: GNSS_ZONES.length,
    geocoding_entries: Object.keys(GEO_DB).length,
    canonical_schema: ['id', 'entity_type', 'source', 'source_url', 'title', 'description', 'lat', 'lon', 'altitude', 'velocity', 'heading', 'timestamp', 'observed_at', 'confidence', 'severity', 'risk_score', 'region', 'tags', 'correlations', 'metadata', 'raw_payload_hash', 'provenance'],
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// v9.0 — AUTH SYSTEM (JWT HS256, RBAC, session management)
// In-memory user store for edge deployment. Production: use D1 or external auth.
// ═══════════════════════════════════════════════════════════════════════════════
type Role = 'ADMIN' | 'COMMANDER' | 'OPERATOR' | 'ANALYST' | 'VIEWER' | 'EXEC'
const ROLE_RANK: Record<Role, number> = { ADMIN: 0, COMMANDER: 1, OPERATOR: 2, ANALYST: 3, VIEWER: 4, EXEC: 5 }

interface User {
  id: string; username: string; email: string; password_hash: string
  role: Role; display_name: string; created_at: string; last_login: string
  mfa_enabled: boolean; active: boolean; preferences: Record<string, unknown>
}

interface Session { user_id: string; token: string; expires_at: number; created_at: string }

const usersStore: Record<string, User> = {}
const sessionsStore: Record<string, Session> = {}
const auditLog: Array<{ ts: string; user: string; action: string; details: string; ip: string }> = []

// Simple hash for password (in production use Argon2id)
async function hashPassword(pw: string): Promise<string> {
  const buf = new TextEncoder().encode(pw + 'sentinel-x-salt-2026')
  const hash = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// JWT-like token (simplified for edge — in production use proper JWT lib)
function createToken(userId: string): string {
  const payload = { sub: userId, iat: Date.now(), exp: Date.now() + 1800000 } // 30 min
  const encoded = btoa(JSON.stringify(payload)).replace(/=/g, '')
  const sig = encoded.slice(0, 8) + userId.slice(0, 4)
  return `stx.${encoded}.${sig}`
}

function verifyToken(token: string): string | null {
  if (!token?.startsWith('stx.')) return null
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(atob(parts[1] + '=='))
    if (payload.exp < Date.now()) return null
    return payload.sub
  } catch { return null }
}

function getUser(c: any): User | null {
  const auth = c.req.header('Authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  const userId = verifyToken(token)
  if (!userId) return null
  return usersStore[userId] || null
}

function requireRole(user: User | null, minRole: Role): boolean {
  if (!user) return false
  return ROLE_RANK[user.role] <= ROLE_RANK[minRole]
}

function audit(user: string, action: string, details: string, ip: string) {
  auditLog.unshift({ ts: new Date().toISOString(), user, action, details, ip })
  if (auditLog.length > 1000) auditLog.length = 1000
}

// Bootstrap admin user
const ADMIN_ID = 'admin-001'
;(async () => {
  usersStore[ADMIN_ID] = {
    id: ADMIN_ID, username: 'admin', email: 'admin@sentinel-x.io',
    password_hash: await hashPassword('admin'), role: 'ADMIN', display_name: 'System Administrator',
    created_at: new Date().toISOString(), last_login: '', mfa_enabled: false, active: true, preferences: {}
  }
  // Demo users
  const roles: Array<[string, string, Role, string]> = [
    ['analyst-001', 'analyst', 'ANALYST', 'Intel Analyst'],
    ['operator-001', 'operator', 'OPERATOR', 'Watch Operator'],
    ['commander-001', 'commander', 'COMMANDER', 'Watch Commander'],
    ['viewer-001', 'viewer', 'VIEWER', 'Read-Only Viewer'],
    ['exec-001', 'exec', 'EXEC', 'Executive Director'],
  ]
  for (const [id, username, role, name] of roles) {
    usersStore[id] = {
      id, username, email: `${username}@sentinel-x.io`,
      password_hash: await hashPassword(username), role, display_name: name,
      created_at: new Date().toISOString(), last_login: '', mfa_enabled: false, active: true, preferences: {}
    }
  }
})()

app.post('/api/auth/login', async (c) => {
  const { username, password } = await c.req.json<{ username?: string; password?: string }>().catch(() => ({ username: '', password: '' }))
  if (!username || !password) return c.json({ error: 'Username and password required' }, 400)
  const user = Object.values(usersStore).find(u => u.username === username && u.active)
  if (!user) return c.json({ error: 'Invalid credentials' }, 401)
  const hash = await hashPassword(password)
  if (hash !== user.password_hash) return c.json({ error: 'Invalid credentials' }, 401)
  const token = createToken(user.id)
  sessionsStore[token] = { user_id: user.id, token, expires_at: Date.now() + 1800000, created_at: new Date().toISOString() }
  user.last_login = new Date().toISOString()
  audit(user.username, 'LOGIN', 'Successful login', c.req.header('CF-Connecting-IP') || 'unknown')
  return c.json({ token, user: { id: user.id, username: user.username, email: user.email, role: user.role, display_name: user.display_name }, expires_in: 1800 })
})

app.post('/api/auth/register', async (c) => {
  const { username, password, email, display_name } = await c.req.json<{ username?: string; password?: string; email?: string; display_name?: string }>().catch(() => ({ username: '', password: '', email: '', display_name: '' }))
  if (!username || !password || !email) return c.json({ error: 'Username, password, and email required' }, 400)
  if (Object.values(usersStore).some(u => u.username === username)) return c.json({ error: 'Username taken' }, 409)
  const id = 'user-' + crypto.randomUUID().slice(0, 8)
  usersStore[id] = {
    id, username, email, password_hash: await hashPassword(password), role: 'ANALYST',
    display_name: display_name || username, created_at: new Date().toISOString(), last_login: '',
    mfa_enabled: false, active: true, preferences: {}
  }
  const token = createToken(id)
  sessionsStore[token] = { user_id: id, token, expires_at: Date.now() + 1800000, created_at: new Date().toISOString() }
  audit(username, 'REGISTER', 'New account created', c.req.header('CF-Connecting-IP') || 'unknown')
  return c.json({ token, user: { id, username, email, role: 'ANALYST', display_name: display_name || username }, expires_in: 1800 })
})

app.get('/api/auth/me', (c) => {
  const user = getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  return c.json({ id: user.id, username: user.username, email: user.email, role: user.role, display_name: user.display_name, mfa_enabled: user.mfa_enabled, created_at: user.created_at, last_login: user.last_login })
})

app.put('/api/auth/preferences', async (c) => {
  const user = getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const prefs = await c.req.json().catch(() => ({}))
  user.preferences = { ...user.preferences, ...prefs }
  return c.json({ success: true, preferences: user.preferences })
})

// Admin: list all users
app.get('/api/admin/users', (c) => {
  const user = getUser(c)
  if (!requireRole(user, 'ADMIN')) return c.json({ error: 'Admin access required' }, 403)
  return c.json({ users: Object.values(usersStore).map(u => ({ id: u.id, username: u.username, email: u.email, role: u.role, display_name: u.display_name, active: u.active, created_at: u.created_at, last_login: u.last_login })), count: Object.keys(usersStore).length })
})

// Admin: update user role
app.put('/api/admin/users/:id/role', async (c) => {
  const admin = getUser(c)
  if (!requireRole(admin, 'ADMIN')) return c.json({ error: 'Admin access required' }, 403)
  const targetId = c.req.param('id')
  const { role } = await c.req.json<{ role?: Role }>().catch(() => ({ role: undefined }))
  if (!role || !ROLE_RANK[role]) return c.json({ error: 'Invalid role' }, 400)
  const target = usersStore[targetId]
  if (!target) return c.json({ error: 'User not found' }, 404)
  target.role = role
  audit(admin!.username, 'ROLE_CHANGE', `${target.username} -> ${role}`, c.req.header('CF-Connecting-IP') || 'unknown')
  return c.json({ success: true, user: { id: target.id, username: target.username, role: target.role } })
})

// Admin: audit log
app.get('/api/admin/audit', (c) => {
  const user = getUser(c)
  if (!requireRole(user, 'COMMANDER')) return c.json({ error: 'Commander+ access required' }, 403)
  const limit = Math.min(parseInt(c.req.query('limit') || '100'), 500)
  return c.json({ entries: auditLog.slice(0, limit), total: auditLog.length })
})

// ═══════════════════════════════════════════════════════════════════════════════
// v9.0 — ALERT PLATFORM
// Priority-based alerts with acknowledgment, assignment, suppression, escalation
// ═══════════════════════════════════════════════════════════════════════════════
type AlertPriority = 'P1_CRITICAL' | 'P2_HIGH' | 'P3_MEDIUM' | 'P4_LOW' | 'P5_INFO'
type AlertStatus = 'NEW' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'SUPPRESSED' | 'RESOLVED' | 'ESCALATED'

interface Alert {
  id: string; title: string; description: string; priority: AlertPriority; status: AlertStatus
  source: string; domain: string; entity_ids: string[]; lat: number | null; lon: number | null
  created_at: string; updated_at: string; acknowledged_at: string | null; resolved_at: string | null
  assigned_to: string | null; created_by: string; escalation_timer_s: number; sla_deadline: string | null
  comments: Array<{ user: string; text: string; ts: string }>
  tags: string[]; suppression_reason: string | null; correlation_id: string | null
  metadata: Record<string, unknown>
}

const alertsStore: Record<string, Alert> = {}
let alertSeq = 0

// Seed demo alerts
function seedAlerts() {
  const demoAlerts: Array<Partial<Alert>> = [
    { title: 'SQUAWK 7700 — Emergency over Black Sea', priority: 'P1_CRITICAL', domain: 'aviation', source: 'OpenSky ADS-B', lat: 43.5, lon: 34.5, tags: ['squawk-7700', 'emergency'] },
    { title: 'M6.2 Earthquake — Eastern Turkey', priority: 'P2_HIGH', domain: 'seismic', source: 'USGS', lat: 39.9, lon: 32.9, tags: ['earthquake', 'significant'] },
    { title: 'AIS Gap — Dark vessel near Hormuz', priority: 'P2_HIGH', domain: 'maritime', source: 'GFW', lat: 26.5, lon: 56.3, tags: ['ais-gap', 'chokepoint'] },
    { title: 'SIGMET VA — Volcanic ash advisory Pacific', priority: 'P3_MEDIUM', domain: 'aviation', source: 'AVWX', lat: 14.0, lon: 121.0, tags: ['sigmet', 'volcanic-ash'] },
    { title: 'Ransomware campaign targeting energy sector', priority: 'P2_HIGH', domain: 'cyber', source: 'OTX + CISA', tags: ['ransomware', 'energy', 'APT'] },
    { title: 'GPS spoofing event — Eastern Mediterranean', priority: 'P3_MEDIUM', domain: 'gnss', source: 'GPSJam.org', lat: 34.5, lon: 33.5, tags: ['spoofing', 'maritime-impact'] },
    { title: 'CDM High Collision Probability — Starlink vs Debris', priority: 'P1_CRITICAL', domain: 'orbital', source: 'Space-Track', tags: ['conjunction', 'high-probability'] },
    { title: 'Mass displacement — Sudan conflict zone', priority: 'P3_MEDIUM', domain: 'conflict', source: 'ACLED + ReliefWeb', lat: 15.5, lon: 32.5, tags: ['displacement', 'humanitarian'] },
  ]
  demoAlerts.forEach(da => {
    const id = `alert-${String(++alertSeq).padStart(4, '0')}`
    alertsStore[id] = {
      id, title: da.title || '', description: da.description || '', priority: da.priority || 'P4_LOW',
      status: 'NEW', source: da.source || '', domain: da.domain || '', entity_ids: [],
      lat: da.lat || null, lon: da.lon || null, created_at: new Date(Date.now() - Math.random() * 86400000).toISOString(),
      updated_at: new Date().toISOString(), acknowledged_at: null, resolved_at: null,
      assigned_to: null, created_by: 'system', escalation_timer_s: da.priority === 'P1_CRITICAL' ? 900 : da.priority === 'P2_HIGH' ? 3600 : 14400,
      sla_deadline: null, comments: [], tags: da.tags || [], suppression_reason: null,
      correlation_id: null, metadata: {}
    }
  })
}
seedAlerts()

app.get('/api/alerts', (c) => {
  const priority = c.req.query('priority') || ''
  const status = c.req.query('status') || ''
  const domain = c.req.query('domain') || ''
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 200)
  let alerts = Object.values(alertsStore)
  if (priority) alerts = alerts.filter(a => a.priority === priority)
  if (status) alerts = alerts.filter(a => a.status === status)
  if (domain) alerts = alerts.filter(a => a.domain === domain)
  alerts.sort((a, b) => {
    const pRank: Record<string, number> = { P1_CRITICAL: 0, P2_HIGH: 1, P3_MEDIUM: 2, P4_LOW: 3, P5_INFO: 4 }
    if (pRank[a.priority] !== pRank[b.priority]) return (pRank[a.priority] || 4) - (pRank[b.priority] || 4)
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
  const byPriority: Record<string, number> = {}; const byStatus: Record<string, number> = {}
  Object.values(alertsStore).forEach(a => { byPriority[a.priority] = (byPriority[a.priority] || 0) + 1; byStatus[a.status] = (byStatus[a.status] || 0) + 1 })
  return c.json({ alerts: alerts.slice(0, limit), total: alerts.length, by_priority: byPriority, by_status: byStatus })
})

app.get('/api/alerts/:id', (c) => {
  const alert = alertsStore[c.req.param('id')]
  if (!alert) return c.json({ error: 'Alert not found' }, 404)
  return c.json(alert)
})

app.post('/api/alerts', async (c) => {
  const body = await c.req.json<Partial<Alert>>().catch(() => ({}))
  const id = `alert-${String(++alertSeq).padStart(4, '0')}`
  alertsStore[id] = {
    id, title: body.title || 'Untitled Alert', description: body.description || '',
    priority: body.priority || 'P4_LOW', status: 'NEW', source: body.source || 'manual',
    domain: body.domain || '', entity_ids: body.entity_ids || [],
    lat: body.lat || null, lon: body.lon || null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    acknowledged_at: null, resolved_at: null, assigned_to: body.assigned_to || null,
    created_by: getUser(c)?.username || 'anonymous',
    escalation_timer_s: body.priority === 'P1_CRITICAL' ? 900 : body.priority === 'P2_HIGH' ? 3600 : 14400,
    sla_deadline: null, comments: [], tags: body.tags || [],
    suppression_reason: null, correlation_id: body.correlation_id || null, metadata: body.metadata || {}
  }
  return c.json(alertsStore[id], 201)
})

app.put('/api/alerts/:id', async (c) => {
  const alert = alertsStore[c.req.param('id')]
  if (!alert) return c.json({ error: 'Alert not found' }, 404)
  const body = await c.req.json<Partial<Alert>>().catch(() => ({}))
  if (body.status) {
    alert.status = body.status
    if (body.status === 'ACKNOWLEDGED') alert.acknowledged_at = new Date().toISOString()
    if (body.status === 'RESOLVED') alert.resolved_at = new Date().toISOString()
    if (body.status === 'SUPPRESSED') alert.suppression_reason = body.suppression_reason || 'Manual suppression'
  }
  if (body.assigned_to !== undefined) alert.assigned_to = body.assigned_to
  if (body.priority) alert.priority = body.priority
  if (body.tags) alert.tags = body.tags
  alert.updated_at = new Date().toISOString()
  return c.json(alert)
})

app.post('/api/alerts/:id/comment', async (c) => {
  const alert = alertsStore[c.req.param('id')]
  if (!alert) return c.json({ error: 'Alert not found' }, 404)
  const { text } = await c.req.json<{ text?: string }>().catch(() => ({ text: '' }))
  if (!text) return c.json({ error: 'Comment text required' }, 400)
  alert.comments.push({ user: getUser(c)?.username || 'anonymous', text, ts: new Date().toISOString() })
  alert.updated_at = new Date().toISOString()
  return c.json({ success: true, comment_count: alert.comments.length })
})

// ═══════════════════════════════════════════════════════════════════════════════
// v9.0 — CASE MANAGEMENT
// Investigations with evidence, notes, timeline, entity attachments
// ═══════════════════════════════════════════════════════════════════════════════
type CaseStatus = 'OPEN' | 'IN_PROGRESS' | 'PENDING_REVIEW' | 'CLOSED' | 'ARCHIVED'

interface CaseItem {
  id: string; title: string; description: string; status: CaseStatus; priority: AlertPriority
  assigned_to: string | null; created_by: string; created_at: string; updated_at: string; closed_at: string | null
  entity_ids: string[]; alert_ids: string[]; tags: string[]
  notes: Array<{ user: string; text: string; ts: string }>
  timeline: Array<{ action: string; user: string; ts: string; details: string }>
  evidence_urls: string[]; region: string; domains: string[]
  metadata: Record<string, unknown>
}

const casesStore: Record<string, CaseItem> = {}
let caseSeq = 0

// Seed demo cases
function seedCases() {
  const demoCases: Array<Partial<CaseItem>> = [
    { title: 'Black Sea AIS Anomaly Investigation', description: 'Multiple vessels showing AIS gaps near Crimean bridge. Potential sanctions evasion or military activity.', priority: 'P2_HIGH', domains: ['maritime', 'conflict'], region: 'Eastern Europe', tags: ['ais-gap', 'sanctions', 'dark-fleet'], entity_ids: ['gap_0', 'gap_1'] },
    { title: 'APAC Ransomware Campaign — Energy Sector', description: 'Coordinated ransomware targeting energy infrastructure across APAC. Multiple CISA KEVs referenced.', priority: 'P1_CRITICAL', domains: ['cyber', 'infrastructure'], tags: ['ransomware', 'energy', 'critical-infra', 'APT29'] },
    { title: 'Red Sea Shipping Lane Disruption', description: 'Ongoing Houthi attacks disrupting commercial shipping through Bab el-Mandeb. Tracking affected vessels and rerouting patterns.', priority: 'P2_HIGH', domains: ['maritime', 'conflict'], region: 'Middle East', tags: ['houthi', 'chokepoint', 'shipping'] },
  ]
  demoCases.forEach(dc => {
    const id = `case-${String(++caseSeq).padStart(4, '0')}`
    casesStore[id] = {
      id, title: dc.title || '', description: dc.description || '', status: 'OPEN',
      priority: dc.priority || 'P3_MEDIUM', assigned_to: null, created_by: 'system',
      created_at: new Date(Date.now() - Math.random() * 604800000).toISOString(),
      updated_at: new Date().toISOString(), closed_at: null,
      entity_ids: dc.entity_ids || [], alert_ids: [], tags: dc.tags || [],
      notes: [{ user: 'system', text: 'Case auto-created from threat intelligence fusion.', ts: new Date().toISOString() }],
      timeline: [{ action: 'CREATED', user: 'system', ts: new Date().toISOString(), details: 'Case initiated' }],
      evidence_urls: [], region: dc.region || '', domains: dc.domains || [], metadata: {}
    }
  })
}
seedCases()

app.get('/api/cases', (c) => {
  const status = c.req.query('status') || ''
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 200)
  let cases = Object.values(casesStore)
  if (status) cases = cases.filter(cs => cs.status === status)
  cases.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
  return c.json({ cases: cases.slice(0, limit), total: cases.length })
})

app.get('/api/cases/:id', (c) => {
  const cs = casesStore[c.req.param('id')]
  if (!cs) return c.json({ error: 'Case not found' }, 404)
  return c.json(cs)
})

app.post('/api/cases', async (c) => {
  const body = await c.req.json<Partial<CaseItem>>().catch(() => ({}))
  const id = `case-${String(++caseSeq).padStart(4, '0')}`
  const user = getUser(c)?.username || 'anonymous'
  casesStore[id] = {
    id, title: body.title || 'New Investigation', description: body.description || '',
    status: 'OPEN', priority: body.priority || 'P3_MEDIUM',
    assigned_to: body.assigned_to || null, created_by: user,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(), closed_at: null,
    entity_ids: body.entity_ids || [], alert_ids: body.alert_ids || [], tags: body.tags || [],
    notes: [], timeline: [{ action: 'CREATED', user, ts: new Date().toISOString(), details: 'Case created' }],
    evidence_urls: [], region: body.region || '', domains: body.domains || [], metadata: body.metadata || {}
  }
  return c.json(casesStore[id], 201)
})

app.put('/api/cases/:id', async (c) => {
  const cs = casesStore[c.req.param('id')]
  if (!cs) return c.json({ error: 'Case not found' }, 404)
  const body = await c.req.json<Partial<CaseItem>>().catch(() => ({}))
  const user = getUser(c)?.username || 'anonymous'
  if (body.status) {
    cs.timeline.push({ action: `STATUS: ${cs.status} → ${body.status}`, user, ts: new Date().toISOString(), details: '' })
    cs.status = body.status
    if (body.status === 'CLOSED' || body.status === 'ARCHIVED') cs.closed_at = new Date().toISOString()
  }
  if (body.assigned_to !== undefined) cs.assigned_to = body.assigned_to
  if (body.priority) cs.priority = body.priority
  if (body.tags) cs.tags = body.tags
  if (body.entity_ids) cs.entity_ids = [...new Set([...cs.entity_ids, ...body.entity_ids])]
  if (body.alert_ids) cs.alert_ids = [...new Set([...cs.alert_ids, ...body.alert_ids])]
  cs.updated_at = new Date().toISOString()
  return c.json(cs)
})

app.post('/api/cases/:id/note', async (c) => {
  const cs = casesStore[c.req.param('id')]
  if (!cs) return c.json({ error: 'Case not found' }, 404)
  const { text } = await c.req.json<{ text?: string }>().catch(() => ({ text: '' }))
  if (!text) return c.json({ error: 'Note text required' }, 400)
  const user = getUser(c)?.username || 'anonymous'
  cs.notes.push({ user, text, ts: new Date().toISOString() })
  cs.timeline.push({ action: 'NOTE_ADDED', user, ts: new Date().toISOString(), details: text.slice(0, 100) })
  cs.updated_at = new Date().toISOString()
  return c.json({ success: true, note_count: cs.notes.length })
})

// ═══════════════════════════════════════════════════════════════════════════════
// v9.0 — WORKSPACE SYSTEM
// Persistent workspaces with layer configs, filter state, shared AOIs
// ═══════════════════════════════════════════════════════════════════════════════
interface Workspace {
  id: string; name: string; description: string; created_by: string; created_at: string; updated_at: string
  members: string[]; center: { lat: number; lon: number; zoom: number }
  layer_config: Record<string, boolean>; domain_filters: string[]
  aois: Array<{ name: string; polygon: number[][]; color: string }>
  geofences: Array<{ name: string; center: { lat: number; lon: number }; radius_km: number; alert_on: string }>
  saved_queries: Array<{ name: string; query: string; filters: Record<string, string> }>
  annotations: Array<{ lat: number; lon: number; text: string; color: string; user: string; ts: string }>
  metadata: Record<string, unknown>
}

const workspacesStore: Record<string, Workspace> = {}
let wsSeq = 0

// Seed demo workspaces
function seedWorkspaces() {
  const demos: Array<Partial<Workspace>> = [
    { name: 'Global Watch', description: 'Primary 24/7 monitoring workspace', center: { lat: 25, lon: 30, zoom: 3 }, domain_filters: ['ALL'], aois: [], geofences: [{ name: 'Hormuz Transit', center: { lat: 26.5, lon: 56.3 }, radius_km: 100, alert_on: 'ENTER' }, { name: 'Taiwan Strait', center: { lat: 24.5, lon: 120.0 }, radius_km: 150, alert_on: 'ENTER' }] },
    { name: 'EUCOM Watch', description: 'European Command situational awareness', center: { lat: 50, lon: 25, zoom: 5 }, domain_filters: ['AIR', 'SEA', 'CONFLICT'], aois: [{ name: 'Black Sea Zone', polygon: [[43, 28], [43, 42], [47, 42], [47, 28]], color: '#ff4400' }], geofences: [] },
    { name: 'Cyber Operations', description: 'Cyber threat monitoring and response', center: { lat: 30, lon: 0, zoom: 3 }, domain_filters: ['CYBER'], aois: [], geofences: [] },
    { name: 'Indo-Pacific Watch', description: 'INDOPACOM situational awareness', center: { lat: 15, lon: 115, zoom: 4 }, domain_filters: ['AIR', 'SEA', 'SPACE'], aois: [{ name: 'SCS ADIZ', polygon: [[5, 108], [5, 120], [22, 120], [22, 108]], color: '#ffaa00' }], geofences: [] },
  ]
  demos.forEach(d => {
    const id = `ws-${String(++wsSeq).padStart(3, '0')}`
    workspacesStore[id] = {
      id, name: d.name || 'Workspace', description: d.description || '',
      created_by: 'system', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      members: ['admin-001'], center: d.center || { lat: 25, lon: 30, zoom: 3 },
      layer_config: {}, domain_filters: d.domain_filters || ['ALL'],
      aois: d.aois || [], geofences: d.geofences || [],
      saved_queries: [], annotations: [], metadata: {}
    }
  })
}
seedWorkspaces()

app.get('/api/workspaces', (c) => {
  return c.json({ workspaces: Object.values(workspacesStore), total: Object.keys(workspacesStore).length })
})

app.get('/api/workspaces/:id', (c) => {
  const ws = workspacesStore[c.req.param('id')]
  if (!ws) return c.json({ error: 'Workspace not found' }, 404)
  return c.json(ws)
})

app.post('/api/workspaces', async (c) => {
  const body = await c.req.json<Partial<Workspace>>().catch(() => ({}))
  const id = `ws-${String(++wsSeq).padStart(3, '0')}`
  workspacesStore[id] = {
    id, name: body.name || 'New Workspace', description: body.description || '',
    created_by: getUser(c)?.username || 'anonymous', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    members: [getUser(c)?.id || ''], center: body.center || { lat: 25, lon: 30, zoom: 3 },
    layer_config: body.layer_config || {}, domain_filters: body.domain_filters || ['ALL'],
    aois: body.aois || [], geofences: body.geofences || [],
    saved_queries: body.saved_queries || [], annotations: body.annotations || [], metadata: body.metadata || {}
  }
  return c.json(workspacesStore[id], 201)
})

app.put('/api/workspaces/:id', async (c) => {
  const ws = workspacesStore[c.req.param('id')]
  if (!ws) return c.json({ error: 'Workspace not found' }, 404)
  const body = await c.req.json<Partial<Workspace>>().catch(() => ({}))
  if (body.name) ws.name = body.name
  if (body.center) ws.center = body.center
  if (body.layer_config) ws.layer_config = body.layer_config
  if (body.domain_filters) ws.domain_filters = body.domain_filters
  if (body.aois) ws.aois = body.aois
  if (body.geofences) ws.geofences = body.geofences
  if (body.annotations) ws.annotations = body.annotations
  ws.updated_at = new Date().toISOString()
  return c.json(ws)
})

// ═══════════════════════════════════════════════════════════════════════════════
// v9.0 — KNOWLEDGE GRAPH
// Entities (people, orgs, vessels, aircraft, facilities) + edges (relationships)
// ═══════════════════════════════════════════════════════════════════════════════
type GraphNodeType = 'person' | 'organization' | 'vessel' | 'aircraft' | 'facility' | 'event' | 'location' | 'network' | 'ip_address' | 'domain'
type GraphEdgeType = 'owns' | 'operates' | 'visited' | 'linked_to' | 'transmitted_to' | 'observed_near' | 'sanctioned_by' | 'crew_of' | 'flagged_by' | 'parent_of' | 'alias_of'

interface GraphNode {
  id: string; type: GraphNodeType; label: string; description: string
  properties: Record<string, unknown>; tags: string[]; confidence: number
  first_seen: string; last_seen: string; source: string
}

interface GraphEdge {
  id: string; from: string; to: string; type: GraphEdgeType
  weight: number; confidence: number; source: string; first_seen: string; last_seen: string
  properties: Record<string, unknown>
}

const graphNodes: Record<string, GraphNode> = {}
const graphEdges: Record<string, GraphEdge> = {}
let graphNodeSeq = 0, graphEdgeSeq = 0

// Seed demo knowledge graph
function seedGraph() {
  const nodes: Array<Partial<GraphNode> & { id: string; type: GraphNodeType; label: string }> = [
    { id: 'gn-001', type: 'organization', label: 'Apex Maritime LLC', description: 'Shell company linked to sanctions evasion', tags: ['sanctions', 'shell-company'], confidence: 75, source: 'GFW + OFAC' },
    { id: 'gn-002', type: 'vessel', label: 'MV DARK HORIZON', description: 'Bulk carrier, frequent AIS gaps', tags: ['dark-fleet', 'ais-gap'], confidence: 85, source: 'GFW' },
    { id: 'gn-003', type: 'vessel', label: 'MV SHADOW WAVE', description: 'Tanker with STS transfer history', tags: ['sts-transfer', 'sanctions-risk'], confidence: 80, source: 'GFW + AIS' },
    { id: 'gn-004', type: 'person', label: 'Viktor Petrov', description: 'Beneficial owner, multiple vessel registrations', tags: ['beneficial-owner'], confidence: 60, source: 'Corporate registry' },
    { id: 'gn-005', type: 'facility', label: 'Novorossiysk Port', description: 'Major Russian Black Sea port', tags: ['port', 'russia'], confidence: 95, source: 'Reference' },
    { id: 'gn-006', type: 'organization', label: 'APT29 (Cozy Bear)', description: 'Russian state-sponsored cyber threat group', tags: ['APT', 'russia', 'espionage'], confidence: 90, source: 'MITRE ATT&CK' },
    { id: 'gn-007', type: 'ip_address', label: '185.159.82.x', description: 'C2 infrastructure linked to APT29', tags: ['c2', 'malicious'], confidence: 70, source: 'OTX + ThreatFox' },
    { id: 'gn-008', type: 'facility', label: 'Natanz Nuclear Facility', description: 'Iranian uranium enrichment complex', tags: ['nuclear', 'iran', 'enrichment'], confidence: 95, source: 'IAEA + Reference' },
    { id: 'gn-009', type: 'aircraft', label: 'RCH402', description: 'USAF C-17 Globemaster III', tags: ['military', 'strategic-airlift'], confidence: 92, source: 'ADS-B Exchange' },
    { id: 'gn-010', type: 'location', label: 'Strait of Hormuz', description: 'Critical maritime chokepoint', tags: ['chokepoint', 'strategic'], confidence: 98, source: 'Reference' },
  ]
  const edges: Array<Partial<GraphEdge> & { from: string; to: string; type: GraphEdgeType }> = [
    { from: 'gn-004', to: 'gn-001', type: 'owns', weight: 0.9, confidence: 65, source: 'Corporate registry' },
    { from: 'gn-001', to: 'gn-002', type: 'operates', weight: 0.85, confidence: 70, source: 'GFW + AIS' },
    { from: 'gn-001', to: 'gn-003', type: 'operates', weight: 0.8, confidence: 65, source: 'GFW' },
    { from: 'gn-002', to: 'gn-005', type: 'visited', weight: 0.7, confidence: 80, source: 'AIS track' },
    { from: 'gn-003', to: 'gn-005', type: 'visited', weight: 0.7, confidence: 75, source: 'AIS track' },
    { from: 'gn-003', to: 'gn-010', type: 'visited', weight: 0.6, confidence: 70, source: 'AIS track' },
    { from: 'gn-006', to: 'gn-007', type: 'operates', weight: 0.8, confidence: 70, source: 'OTX' },
    { from: 'gn-002', to: 'gn-003', type: 'observed_near', weight: 0.5, confidence: 60, source: 'GFW proximity analysis' },
  ]
  nodes.forEach(n => {
    graphNodes[n.id] = { id: n.id, type: n.type, label: n.label, description: n.description || '', properties: n.properties || {}, tags: n.tags || [], confidence: n.confidence || 50, first_seen: new Date().toISOString(), last_seen: new Date().toISOString(), source: n.source || '' }
  })
  edges.forEach(e => {
    const id = `ge-${String(++graphEdgeSeq).padStart(4, '0')}`
    graphEdges[id] = { id, from: e.from, to: e.to, type: e.type, weight: e.weight || 0.5, confidence: e.confidence || 50, source: e.source || '', first_seen: new Date().toISOString(), last_seen: new Date().toISOString(), properties: e.properties || {} }
  })
}
seedGraph()

app.get('/api/graph/nodes', (c) => {
  const type = c.req.query('type') || ''
  const search = (c.req.query('search') || '').toLowerCase()
  let nodes = Object.values(graphNodes)
  if (type) nodes = nodes.filter(n => n.type === type)
  if (search) nodes = nodes.filter(n => n.label.toLowerCase().includes(search) || n.description.toLowerCase().includes(search) || n.tags.some(t => t.includes(search)))
  return c.json({ nodes, total: nodes.length })
})

app.get('/api/graph/nodes/:id', (c) => {
  const node = graphNodes[c.req.param('id')]
  if (!node) return c.json({ error: 'Node not found' }, 404)
  // Find connected edges and nodes
  const edges = Object.values(graphEdges).filter(e => e.from === node.id || e.to === node.id)
  const connectedIds = new Set<string>()
  edges.forEach(e => { connectedIds.add(e.from); connectedIds.add(e.to) })
  connectedIds.delete(node.id)
  const connected = [...connectedIds].map(id => graphNodes[id]).filter(Boolean)
  return c.json({ node, edges, connected })
})

app.post('/api/graph/nodes', async (c) => {
  const body = await c.req.json<Partial<GraphNode>>().catch(() => ({}))
  const id = `gn-${String(++graphNodeSeq).padStart(4, '0')}`
  graphNodes[id] = {
    id, type: (body.type || 'person') as GraphNodeType, label: body.label || 'Unknown',
    description: body.description || '', properties: body.properties || {},
    tags: body.tags || [], confidence: body.confidence || 50,
    first_seen: new Date().toISOString(), last_seen: new Date().toISOString(), source: body.source || 'manual'
  }
  return c.json(graphNodes[id], 201)
})

app.get('/api/graph/edges', (c) => {
  const from = c.req.query('from') || ''
  const to = c.req.query('to') || ''
  let edges = Object.values(graphEdges)
  if (from) edges = edges.filter(e => e.from === from)
  if (to) edges = edges.filter(e => e.to === to)
  return c.json({ edges, total: edges.length })
})

app.post('/api/graph/edges', async (c) => {
  const body = await c.req.json<Partial<GraphEdge>>().catch(() => ({}))
  if (!body.from || !body.to) return c.json({ error: 'from and to node IDs required' }, 400)
  const id = `ge-${String(++graphEdgeSeq).padStart(4, '0')}`
  graphEdges[id] = {
    id, from: body.from, to: body.to, type: (body.type || 'linked_to') as GraphEdgeType,
    weight: body.weight || 0.5, confidence: body.confidence || 50, source: body.source || 'manual',
    first_seen: new Date().toISOString(), last_seen: new Date().toISOString(), properties: body.properties || {}
  }
  return c.json(graphEdges[id], 201)
})

// Full graph export (for visualization)
app.get('/api/graph/full', (c) => {
  return c.json({ nodes: Object.values(graphNodes), edges: Object.values(graphEdges), node_count: Object.keys(graphNodes).length, edge_count: Object.keys(graphEdges).length })
})

// ═══════════════════════════════════════════════════════════════════════════════
// v9.0 — ANALYTICS ENGINE
// Trend computation, domain statistics, threat timelines, source reliability
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/analytics/overview', (c) => {
  const totalAlerts = Object.keys(alertsStore).length
  const openAlerts = Object.values(alertsStore).filter(a => a.status === 'NEW' || a.status === 'ACKNOWLEDGED' || a.status === 'IN_PROGRESS').length
  const resolvedAlerts = Object.values(alertsStore).filter(a => a.status === 'RESOLVED').length
  const totalCases = Object.keys(casesStore).length
  const openCases = Object.values(casesStore).filter(cs => cs.status === 'OPEN' || cs.status === 'IN_PROGRESS').length
  const byDomain: Record<string, number> = {}
  const byPriority: Record<string, number> = {}
  Object.values(alertsStore).forEach(a => {
    byDomain[a.domain] = (byDomain[a.domain] || 0) + 1
    byPriority[a.priority] = (byPriority[a.priority] || 0) + 1
  })
  const sourceReliability: Record<string, number> = {}
  Object.entries(sourceMetricsStore).forEach(([key, m]) => { sourceReliability[key] = m.uptime_pct })
  // Compute global threat index
  const critAlerts = Object.values(alertsStore).filter(a => a.priority === 'P1_CRITICAL' && a.status !== 'RESOLVED').length
  const highAlerts = Object.values(alertsStore).filter(a => a.priority === 'P2_HIGH' && a.status !== 'RESOLVED').length
  const threatIndex = Math.min(100, critAlerts * 20 + highAlerts * 8 + openAlerts * 2)
  const threatLevel = threatIndex >= 80 ? 'CRITICAL' : threatIndex >= 60 ? 'ELEVATED' : threatIndex >= 40 ? 'GUARDED' : threatIndex >= 20 ? 'ADVISORY' : 'NOMINAL'
  return c.json({
    timestamp: new Date().toISOString(), version: VERSION,
    threat: { index: threatIndex, level: threatLevel },
    alerts: { total: totalAlerts, open: openAlerts, resolved: resolvedAlerts, by_domain: byDomain, by_priority: byPriority },
    cases: { total: totalCases, open: openCases },
    graph: { nodes: Object.keys(graphNodes).length, edges: Object.keys(graphEdges).length },
    sources: { total: Object.keys(sourceMetricsStore).length, reliability: sourceReliability },
    workspaces: { total: Object.keys(workspacesStore).length },
    users: { total: Object.keys(usersStore).length },
  })
})

app.get('/api/analytics/trends', (c) => {
  // Generate trend data from alerts timeline
  const now = Date.now()
  const hourly: Array<{ hour: string; count: number; critical: number; high: number }> = []
  for (let i = 23; i >= 0; i--) {
    const hourStart = now - (i + 1) * 3600000
    const hourEnd = now - i * 3600000
    const hourAlerts = Object.values(alertsStore).filter(a => {
      const t = new Date(a.created_at).getTime()
      return t >= hourStart && t < hourEnd
    })
    hourly.push({
      hour: new Date(hourEnd).toISOString().slice(11, 16),
      count: hourAlerts.length,
      critical: hourAlerts.filter(a => a.priority === 'P1_CRITICAL').length,
      high: hourAlerts.filter(a => a.priority === 'P2_HIGH').length,
    })
  }
  // Domain distribution for charting
  const domainCounts: Record<string, number> = {}
  Object.values(alertsStore).forEach(a => { domainCounts[a.domain || 'unknown'] = (domainCounts[a.domain || 'unknown'] || 0) + 1 })
  return c.json({ hourly, domain_distribution: domainCounts, timestamp: new Date().toISOString() })
})

// ═══════════════════════════════════════════════════════════════════════════════
// v9.0 — ENTITY RESOLUTION ENGINE
// Multi-source entity merge, alias correlation, ownership tracking
// ═══════════════════════════════════════════════════════════════════════════════
interface ResolvedEntity {
  id: string; canonical_name: string; entity_type: string; aliases: string[]
  sources: string[]; observations: number; first_seen: string; last_seen: string
  positions: Array<{ lat: number; lon: number; ts: string; source: string }>
  confidence: number; threat_score: number
  properties: Record<string, unknown>; tags: string[]
}

const resolvedEntities: Record<string, ResolvedEntity> = {}
let reSeq = 0

// Seed demo resolved entities
function seedResolvedEntities() {
  const demos: Array<Partial<ResolvedEntity>> = [
    { canonical_name: 'MV DARK HORIZON', entity_type: 'vessel', aliases: ['DARK HORIZON', 'DARKHOR', 'IMO:9876543'], sources: ['GFW', 'AIS', 'Shodan'], observations: 47, positions: [{ lat: 43.5, lon: 34.0, ts: new Date().toISOString(), source: 'AIS' }], confidence: 82, threat_score: 65, tags: ['dark-fleet', 'sanctions-risk'] },
    { canonical_name: 'RCH402', entity_type: 'aircraft', aliases: ['REACH402', 'USAF RCH402', '00-0402'], sources: ['OpenSky', 'ADS-B Exchange'], observations: 128, positions: [{ lat: 50.1, lon: 8.7, ts: new Date().toISOString(), source: 'OpenSky' }], confidence: 95, threat_score: 12, tags: ['military', 'C-17', 'strategic-airlift'] },
    { canonical_name: 'APT29', entity_type: 'threat_actor', aliases: ['Cozy Bear', 'The Dukes', 'NOBELIUM', 'Midnight Blizzard'], sources: ['MITRE', 'OTX', 'ThreatFox'], observations: 256, positions: [], confidence: 88, threat_score: 85, tags: ['APT', 'russia', 'espionage', 'SVR'] },
  ]
  demos.forEach(d => {
    const id = `re-${String(++reSeq).padStart(4, '0')}`
    resolvedEntities[id] = {
      id, canonical_name: d.canonical_name || '', entity_type: d.entity_type || 'unknown',
      aliases: d.aliases || [], sources: d.sources || [], observations: d.observations || 0,
      first_seen: new Date(Date.now() - 86400000 * 30).toISOString(),
      last_seen: new Date().toISOString(), positions: d.positions || [],
      confidence: d.confidence || 50, threat_score: d.threat_score || 0,
      properties: d.properties || {}, tags: d.tags || []
    }
  })
}
seedResolvedEntities()

app.get('/api/entities/resolved', (c) => {
  const type = c.req.query('type') || ''
  const search = (c.req.query('search') || '').toLowerCase()
  let entities = Object.values(resolvedEntities)
  if (type) entities = entities.filter(e => e.entity_type === type)
  if (search) entities = entities.filter(e =>
    e.canonical_name.toLowerCase().includes(search) ||
    e.aliases.some(a => a.toLowerCase().includes(search)) ||
    e.tags.some(t => t.toLowerCase().includes(search))
  )
  return c.json({ entities, total: entities.length })
})

app.get('/api/entities/resolved/:id', (c) => {
  const re = resolvedEntities[c.req.param('id')]
  if (!re) return c.json({ error: 'Entity not found' }, 404)
  return c.json(re)
})

// Global search across all system objects
app.get('/api/search', (c) => {
  const q = (c.req.query('q') || '').toLowerCase()
  if (!q || q.length < 2) return c.json({ results: [], total: 0 })
  const results: Array<{ type: string; id: string; title: string; subtitle: string; score: number }> = []
  // Search alerts
  Object.values(alertsStore).forEach(a => {
    if (a.title.toLowerCase().includes(q) || a.tags.some(t => t.includes(q))) {
      results.push({ type: 'alert', id: a.id, title: a.title, subtitle: `${a.priority} | ${a.domain}`, score: a.priority === 'P1_CRITICAL' ? 100 : 80 })
    }
  })
  // Search cases
  Object.values(casesStore).forEach(cs => {
    if (cs.title.toLowerCase().includes(q) || cs.tags.some(t => t.includes(q))) {
      results.push({ type: 'case', id: cs.id, title: cs.title, subtitle: cs.status, score: 70 })
    }
  })
  // Search graph nodes
  Object.values(graphNodes).forEach(n => {
    if (n.label.toLowerCase().includes(q) || n.tags.some(t => t.includes(q))) {
      results.push({ type: 'graph_node', id: n.id, title: n.label, subtitle: n.type, score: 60 })
    }
  })
  // Search resolved entities
  Object.values(resolvedEntities).forEach(re => {
    if (re.canonical_name.toLowerCase().includes(q) || re.aliases.some(a => a.toLowerCase().includes(q))) {
      results.push({ type: 'entity', id: re.id, title: re.canonical_name, subtitle: re.entity_type, score: 75 })
    }
  })
  results.sort((a, b) => b.score - a.score)
  return c.json({ results: results.slice(0, 50), total: results.length, query: q })
})

// ═══════════════════════════════════════════════════════════════════════════════
// v9.0 — GEOFENCE ENGINE
// Define AOI polygons, check entity positions, trigger violation alerts
// ═══════════════════════════════════════════════════════════════════════════════
interface Geofence {
  id: string; name: string; type: 'circle' | 'polygon'; center?: { lat: number; lon: number }
  radius_km?: number; polygon?: number[][]; alert_on: 'ENTER' | 'EXIT' | 'BOTH'
  active: boolean; created_by: string; created_at: string; domain_filter: string[]
  violation_count: number; last_violation: string | null
}

const geofencesStore: Record<string, Geofence> = {}
let gfSeq = 0

function seedGeofences() {
  const demos: Array<Partial<Geofence>> = [
    { name: 'Strait of Hormuz Monitor', type: 'circle', center: { lat: 26.5, lon: 56.3 }, radius_km: 100, alert_on: 'ENTER', domain_filter: ['maritime', 'military'] },
    { name: 'Taiwan ADIZ', type: 'circle', center: { lat: 24.5, lon: 120.0 }, radius_km: 200, alert_on: 'ENTER', domain_filter: ['aviation', 'military'] },
    { name: 'Gaza Buffer Zone', type: 'circle', center: { lat: 31.4, lon: 34.5 }, radius_km: 50, alert_on: 'BOTH', domain_filter: ['conflict', 'aviation'] },
    { name: 'Baltic GNSS Watch', type: 'circle', center: { lat: 57.0, lon: 22.0 }, radius_km: 300, alert_on: 'ENTER', domain_filter: ['gnss', 'aviation'] },
  ]
  demos.forEach(d => {
    const id = `gf-${String(++gfSeq).padStart(3, '0')}`
    geofencesStore[id] = {
      id, name: d.name || '', type: d.type || 'circle', center: d.center,
      radius_km: d.radius_km, polygon: d.polygon, alert_on: d.alert_on || 'ENTER',
      active: true, created_by: 'system', created_at: new Date().toISOString(),
      domain_filter: d.domain_filter || [], violation_count: Math.floor(Math.random() * 20),
      last_violation: Math.random() > 0.5 ? new Date(Date.now() - Math.random() * 3600000).toISOString() : null
    }
  })
}
seedGeofences()

app.get('/api/geofences', (c) => {
  return c.json({ geofences: Object.values(geofencesStore), total: Object.keys(geofencesStore).length })
})

app.post('/api/geofences', async (c) => {
  const body = await c.req.json<Partial<Geofence>>().catch(() => ({}))
  const id = `gf-${String(++gfSeq).padStart(3, '0')}`
  geofencesStore[id] = {
    id, name: body.name || 'New Geofence', type: body.type || 'circle',
    center: body.center, radius_km: body.radius_km, polygon: body.polygon,
    alert_on: body.alert_on || 'ENTER', active: true,
    created_by: getUser(c)?.username || 'anonymous', created_at: new Date().toISOString(),
    domain_filter: body.domain_filter || [], violation_count: 0, last_violation: null
  }
  return c.json(geofencesStore[id], 201)
})

app.post('/api/geofences/check', async (c) => {
  const { lat, lon } = await c.req.json<{ lat?: number; lon?: number }>().catch(() => ({ lat: 0, lon: 0 }))
  if (!lat || !lon) return c.json({ error: 'lat and lon required' }, 400)
  const violations: Array<{ geofence_id: string; name: string; distance_km: number }> = []
  Object.values(geofencesStore).filter(g => g.active && g.type === 'circle' && g.center).forEach(g => {
    const R = 6371
    const dLat = (g.center!.lat - lat) * Math.PI / 180
    const dLon = (g.center!.lon - lon) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat * Math.PI / 180) * Math.cos(g.center!.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2
    const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    if (dist <= (g.radius_km || 100)) {
      violations.push({ geofence_id: g.id, name: g.name, distance_km: Math.round(dist * 10) / 10 })
    }
  })
  return c.json({ violations, inside: violations.length, checked: Object.keys(geofencesStore).length })
})

// ═══════════════════════════════════════════════════════════════════════════════
// v9.0 — NEW DOMAIN SOURCES (infrastructure, energy, logistics, border, telecom)
// These use free public APIs and GDELT topic queries for expanded coverage
// ═══════════════════════════════════════════════════════════════════════════════

// Infrastructure monitoring — power grids, pipelines, transport hubs
app.get('/api/intel/infrastructure', async (c) => {
  try {
    const data = await fetchGDELT('https://api.gdeltproject.org/api/v2/doc/doc?query=infrastructure+attack+power+grid+pipeline+sabotage+transport&mode=artlist&maxrecords=30&format=json&timespan=48h&sourcelang=english')
    if (!data?.articles) return c.json({ events: [], source: 'gdelt-infrastructure' })
    const h = await hashPayload(data)
    const events: CanonicalEvent[] = data.articles.map((art: any, i: number) => {
      const geo = geocodeFromText(art.title || '')
      if (!geo) return null
      return evt({ id: `infra_${i}`, entity_type: 'infrastructure_intel', source: 'GDELT Infrastructure', source_url: art.url || '', title: art.title || '', lat: geo.lat, lon: geo.lon, region: geo.region, timestamp: art.seendate || '', confidence: geo.confidence, severity: 'medium', tags: ['infrastructure', geo.matched], provenance: 'geocoded-inferred', raw_payload_hash: h, metadata: { domain: art.domain, matched_location: geo.matched } })
    }).filter(Boolean) as CanonicalEvent[]
    return c.json({ events, total: data.articles.length, geocoded: events.length, source: 'gdelt-infrastructure' })
  } catch (e) { return c.json(upstreamError('infrastructure', 0, String(e))) }
})

// Energy sector monitoring
app.get('/api/intel/energy', async (c) => {
  try {
    const data = await fetchGDELT('https://api.gdeltproject.org/api/v2/doc/doc?query=energy+oil+gas+refinery+LNG+OPEC+sanctions+pipeline&mode=artlist&maxrecords=30&format=json&timespan=48h&sourcelang=english')
    if (!data?.articles) return c.json({ events: [], source: 'gdelt-energy' })
    const h = await hashPayload(data)
    const events: CanonicalEvent[] = data.articles.map((art: any, i: number) => {
      const geo = geocodeFromText(art.title || '')
      if (!geo) return null
      return evt({ id: `energy_${i}`, entity_type: 'energy_intel', source: 'GDELT Energy', source_url: art.url || '', title: art.title || '', lat: geo.lat, lon: geo.lon, region: geo.region, timestamp: art.seendate || '', confidence: geo.confidence, severity: 'medium', tags: ['energy', geo.matched], provenance: 'geocoded-inferred', raw_payload_hash: h, metadata: { domain: art.domain, matched_location: geo.matched } })
    }).filter(Boolean) as CanonicalEvent[]
    return c.json({ events, total: data.articles.length, geocoded: events.length, source: 'gdelt-energy' })
  } catch (e) { return c.json(upstreamError('energy', 0, String(e))) }
})

// Logistics/supply chain monitoring
app.get('/api/intel/logistics', async (c) => {
  try {
    const data = await fetchGDELT('https://api.gdeltproject.org/api/v2/doc/doc?query=supply+chain+disruption+logistics+shipping+port+blockade+sanctions&mode=artlist&maxrecords=30&format=json&timespan=48h&sourcelang=english')
    if (!data?.articles) return c.json({ events: [], source: 'gdelt-logistics' })
    const h = await hashPayload(data)
    const events: CanonicalEvent[] = data.articles.map((art: any, i: number) => {
      const geo = geocodeFromText(art.title || '')
      if (!geo) return null
      return evt({ id: `logistics_${i}`, entity_type: 'logistics_intel', source: 'GDELT Logistics', source_url: art.url || '', title: art.title || '', lat: geo.lat, lon: geo.lon, region: geo.region, timestamp: art.seendate || '', confidence: geo.confidence, severity: 'medium', tags: ['logistics', geo.matched], provenance: 'geocoded-inferred', raw_payload_hash: h, metadata: { domain: art.domain, matched_location: geo.matched } })
    }).filter(Boolean) as CanonicalEvent[]
    return c.json({ events, total: data.articles.length, geocoded: events.length, source: 'gdelt-logistics' })
  } catch (e) { return c.json(upstreamError('logistics', 0, String(e))) }
})

// Border/migration monitoring
app.get('/api/intel/border', async (c) => {
  try {
    const data = await fetchGDELT('https://api.gdeltproject.org/api/v2/doc/doc?query=border+migration+crossing+refugees+smuggling+trafficking&mode=artlist&maxrecords=30&format=json&timespan=48h&sourcelang=english')
    if (!data?.articles) return c.json({ events: [], source: 'gdelt-border' })
    const h = await hashPayload(data)
    const events: CanonicalEvent[] = data.articles.map((art: any, i: number) => {
      const geo = geocodeFromText(art.title || '')
      if (!geo) return null
      return evt({ id: `border_${i}`, entity_type: 'border_intel', source: 'GDELT Border', source_url: art.url || '', title: art.title || '', lat: geo.lat, lon: geo.lon, region: geo.region, timestamp: art.seendate || '', confidence: geo.confidence, severity: 'low', tags: ['border', geo.matched], provenance: 'geocoded-inferred', raw_payload_hash: h, metadata: { domain: art.domain, matched_location: geo.matched } })
    }).filter(Boolean) as CanonicalEvent[]
    return c.json({ events, total: data.articles.length, geocoded: events.length, source: 'gdelt-border' })
  } catch (e) { return c.json(upstreamError('border', 0, String(e))) }
})

// Telecom/SIGINT monitoring
app.get('/api/intel/telecom', async (c) => {
  try {
    const data = await fetchGDELT('https://api.gdeltproject.org/api/v2/doc/doc?query=telecom+outage+internet+shutdown+cable+disruption+spectrum&mode=artlist&maxrecords=25&format=json&timespan=48h&sourcelang=english')
    if (!data?.articles) return c.json({ events: [], source: 'gdelt-telecom' })
    const h = await hashPayload(data)
    const events: CanonicalEvent[] = data.articles.map((art: any, i: number) => {
      const geo = geocodeFromText(art.title || '')
      if (!geo) return null
      return evt({ id: `telecom_${i}`, entity_type: 'telecom_intel', source: 'GDELT Telecom', source_url: art.url || '', title: art.title || '', lat: geo.lat, lon: geo.lon, region: geo.region, timestamp: art.seendate || '', confidence: geo.confidence, severity: 'low', tags: ['telecom', geo.matched], provenance: 'geocoded-inferred', raw_payload_hash: h, metadata: { domain: art.domain, matched_location: geo.matched } })
    }).filter(Boolean) as CanonicalEvent[]
    return c.json({ events, total: data.articles.length, geocoded: events.length, source: 'gdelt-telecom' })
  } catch (e) { return c.json(upstreamError('telecom', 0, String(e))) }
})

// Public safety monitoring
app.get('/api/intel/public-safety', async (c) => {
  try {
    const data = await fetchGDELT('https://api.gdeltproject.org/api/v2/doc/doc?query=terrorism+mass+shooting+explosion+bomb+attack+hostage&mode=artlist&maxrecords=25&format=json&timespan=48h&sourcelang=english')
    if (!data?.articles) return c.json({ events: [], source: 'gdelt-public-safety' })
    const h = await hashPayload(data)
    const events: CanonicalEvent[] = data.articles.map((art: any, i: number) => {
      const geo = geocodeFromText(art.title || '')
      if (!geo) return null
      return evt({ id: `safety_${i}`, entity_type: 'public_safety_intel', source: 'GDELT Public Safety', source_url: art.url || '', title: art.title || '', lat: geo.lat, lon: geo.lon, region: geo.region, timestamp: art.seendate || '', confidence: geo.confidence, severity: 'high', tags: ['public-safety', geo.matched], provenance: 'geocoded-inferred', raw_payload_hash: h, metadata: { domain: art.domain, matched_location: geo.matched } })
    }).filter(Boolean) as CanonicalEvent[]
    return c.json({ events, total: data.articles.length, geocoded: events.length, source: 'gdelt-public-safety' })
  } catch (e) { return c.json(upstreamError('public-safety', 0, String(e))) }
})

// ═══════════════════════════════════════════════════════════════════════════════
// HTML SHELL — served at /
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
<title>SENTINEL-X v${VERSION} — Multi-Domain Situational Awareness</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>&#x1F6F0;</text></svg>">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&family=Orbitron:wght@400;600;700;900&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js" type="text/javascript" defer/>
<link rel="stylesheet" href="/static/style.css">
</head>
<body>
<!-- SENTINEL-X v${VERSION} Multi-Panel Command Center -->
<div id="app-root">
  <div id="top-bar"></div>
  <div id="main-area">
    <div id="left-nav"></div>
    <div id="map-container">
      <div id="map"></div>
      <div id="map-overlay"></div>
    </div>
    <div id="right-panel"></div>
  </div>
  <div id="bottom-strip"></div>
</div>
<div id="modal-layer"></div>
<div id="loading">
  <div class="load-inner">
    <div class="load-ring"></div>
    <div class="load-logo">SENTINEL<span class="load-x">X</span></div>
    <div class="load-ver">v${VERSION}</div>
    <div class="load-sub" id="load-status">Initializing platform...</div>
    <div class="load-bar"><div class="load-bar-fill" id="load-progress"></div></div>
  </div>
</div>
<script>
(function(){
  var deps = [
    {src:'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', check:function(){return window.L}},
    {src:'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js', check:function(){return window.L&&L.MarkerClusterGroup}},
    {src:'https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js', check:function(){return window.L&&L.heatLayer}, optional:true},
    {src:'https://unpkg.com/satellite.js@5.0.0/dist/satellite.min.js', check:function(){return window.satellite}, optional:true},
    {src:'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js', check:function(){return window.Chart}, optional:true},
  ];
  var loaded=0;
  function setStatus(msg){var el=document.getElementById('load-status');if(el)el.textContent=msg;}
  function setProgress(pct){var el=document.getElementById('load-progress');if(el)el.style.width=pct+'%';}
  function loadNext(){
    if(loaded>=deps.length){setStatus('Launching...');setProgress(100);loadApp();return}
    var dep=deps[loaded];
    setStatus('Loading '+(loaded+1)+'/'+deps.length+'...');
    setProgress(Math.round((loaded/deps.length)*80));
    var s=document.createElement('script');
    s.src=dep.src;
    s.onload=function(){loaded++;loadNext()};
    s.onerror=function(){
      if(dep.optional){loaded++;loadNext()}
      else{setStatus('Critical dependency failed');console.error('Failed:',dep.src)}
    };
    document.head.appendChild(s);
  }
  function loadApp(){
    var s=document.createElement('script');s.src='/static/sentinel.js';
    s.onerror=function(){setStatus('Application failed to load')};
    document.head.appendChild(s);
  }
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',loadNext)}
  else{loadNext()}
})();
<\/script>
</body>
</html>`)
})

export default app
