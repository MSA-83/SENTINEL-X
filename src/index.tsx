/**
 * SENTINEL OS v8.3 — Global Multi-Domain Situational Awareness Platform
 * Secure Edge BFF (Backend-for-Frontend) on Cloudflare Pages
 *
 * v8.3: Space-Track auth hardening, improved dedup/correlation, mobile bottom-sheet inspector,
 *        domain-specific cards for all entity types, quick actions in inspector
 *
 * Architecture:
 *   - All keyed API calls route through server-side proxy — browser NEVER sees secrets
 *   - Every response normalizes into canonical event schema with provenance + confidence
 *   - Geocoded/inferred locations are explicitly marked and down-weighted
 *   - Graceful failure objects returned on upstream errors
 *   - raw_payload_hash for provenance chain integrity
 *
 * Domains: aviation · maritime · orbital · seismic · wildfire · weather ·
 *          conflict · disaster · cyber · nuclear · gnss · social · imagery
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
  ACLED_EMAIL?: string
  ABUSECH_KEY?: string
  SPACETRACK_USER?: string
  SPACETRACK_PASS?: string
  CESIUM_TOKEN?: string
  COPERNICUS_CLIENT_ID?: string
  COPERNICUS_CLIENT_SECRET?: string
  PLANET_API_KEY?: string
}

const app = new Hono<{ Bindings: Bindings }>()
app.use('/api/*', cors())

const VERSION = '6.2.0'
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
  raw_payload_hash: string
  provenance: string          // e.g. "direct-api" | "geocoded-inferred" | "curated-reference"
}

/** FNV-1a 32-bit hash — deterministic deduplication key for canonical events. */
function hashPayload(data: unknown): string {
  const str = JSON.stringify(data) ?? ""
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return (h >>> 0).toString(16).padStart(8, "0")
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
    raw_payload_hash: hashPayload(partial),
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
  // Deterministic jitter from text hash (stable per-text, no random drift)
  let _h = 0; for (let _i = 0; _i < text.length; _i++) _h = Math.imul(31, _h) + text.charCodeAt(_i) | 0
  const jLat = ((_h & 0xffff) / 0xffff - 0.5) * 0.5
  const jLon = (((_h >>> 16) & 0xffff) / 0xffff - 0.5) * 0.5
  const confidence = Math.min(35, 15 + bestLen * 2)
  return { lat: best.entry.lat + jLat, lon: best.entry.lon + jLon, region: best.entry.region, matched: best.key, confidence }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SAFE FETCH HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
async function safeFetch(url: string, opts: RequestInit = {}, timeoutMs = 12000): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const hdrs = new Headers((opts.headers as HeadersInit) || {}); hdrs.set('User-Agent', UA)
    const res = await fetch(url, { ...opts, signal: controller.signal, headers: hdrs })
    return res
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
  opensky: { url: 'https://api.adsb.one/v2/point/20/10/18000', timeout: 15000, fallbackUrl: 'https://api.adsb.one/v2/point/0/0/18000' },
  military: { url: 'https://adsbexchange-com1.p.rapidapi.com/v2/mil/', secret: 'RAPIDAPI_KEY', authType: 'rapidapi', rapidApiHost: 'adsbexchange-com1.p.rapidapi.com', timeout: 10000 },
  gfw_fishing: { url: 'https://gateway.api.globalfishingwatch.org/v3/events?datasets[0]=public-global-fishing-events:latest&limit=50&offset=0', secret: 'GFW_TOKEN', authType: 'bearer', timeout: 14000 },
  gfw_gap: { url: 'https://gateway.api.globalfishingwatch.org/v3/events?datasets[0]=public-global-gaps-events:latest&limit=50&offset=0', secret: 'GFW_TOKEN', authType: 'bearer', timeout: 14000 },
  firms: { url: (key: string) => `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/VIIRS_SNPP_NRT/world/1`, secret: 'NASA_FIRMS_KEY', timeout: 18000, responseType: 'text' },
  n2yo: { url: (key: string) => `https://api.n2yo.com/rest/v1/satellite/above/0/0/0/80/0?apiKey=${key}`, secret: 'N2YO_KEY', timeout: 10000 },
  gdacs: { url: 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=EQ,TC,FL,VO,TS&alertlevel=Green;Orange;Red', timeout: 16000 },
  reliefweb: { url: 'https://api.reliefweb.int/v1/disasters?appname=sentinel-os-osint&limit=50&sort[]=date:desc&fields[include][]=name&fields[include][]=country&fields[include][]=status&fields[include][]=primary_type&fields[include][]=glide&fields[include][]=date', timeout: 14000 },
  gdelt_conflict: { timeout: 30000, url: 'https://api.gdeltproject.org/api/v2/doc/doc?query=military+attack+airstrike+bombing+conflict&mode=artlist&maxrecords=50&format=json&timespan=48h&sourcelang=english' },
  gdelt_maritime: { timeout: 30000, url: 'https://api.gdeltproject.org/api/v2/doc/doc?query=navy+warship+maritime+vessel+blockade&mode=artlist&maxrecords=30&format=json&timespan=48h&sourcelang=english' },
  gdelt_nuclear: { timeout: 30000, url: 'https://api.gdeltproject.org/api/v2/doc/doc?query=nuclear+missile+ICBM+warhead+enrichment&mode=artlist&maxrecords=25&format=json&timespan=72h&sourcelang=english' },
  gdelt_cyber: { timeout: 30000, url: 'https://api.gdeltproject.org/api/v2/doc/doc?query=cyberattack+ransomware+hacking+breach+APT&mode=artlist&maxrecords=25&format=json&timespan=48h&sourcelang=english' },
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
    if (!res!.ok) { const body = await res!.text(); return c.json(upstreamError(target, res!.status, body.slice(0, 400))) }
    // Transform adsb.one format -> OpenSky states[] format for frontend parseOpenSky()
    if (target === 'opensky') {
      const raw = await res!.json() as any
      const ac: any[] = raw.ac || raw.aircraft || []
      const states = ac
        .filter((a: any) => typeof a.lat === 'number' && typeof a.lon === 'number')
        .map((a: any) => [
          a.hex || '',
          (a.flight || '').trim(),
          a.r || '',
          null, null,
          a.lon, a.lat,
          typeof a.alt_baro === 'number' ? a.alt_baro / 3.28084 : null,
          a.alt_baro === 'ground',
          typeof a.gs === 'number' ? a.gs / 1.944 : null,
          a.track || null,
          a.baro_rate || null,
          null,
          typeof a.alt_geom === 'number' ? a.alt_geom / 3.28084 : null,
          a.squawk || null,
          false, 0
        ])
      return c.json({ states, time: Math.floor(Date.now() / 1000) })
    }
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
        title: (gp.OBJECT_NAME || `NORAD:${gp.NORAD_CAT_ID}`).trim(),
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
async function fetchGDELT(url: string, timeoutMs = 30000): Promise<any> {
  try {
  const res = await safeFetch(url, {}, timeoutMs)
  if (res.status === 429) return null
  if (!res.ok) return null
  const text = await res.text()
  try { return JSON.parse(text) } catch { return null }
  } catch { return null }
  return null
}

app.post('/api/intel/gdelt', async (c) => {
  const { category } = await c.req.json<{ category?: string }>().catch(() => ({ category: 'conflict' }))
  const catKey = category === 'maritime' ? 'gdelt_maritime' : category === 'nuclear' ? 'gdelt_nuclear' : category === 'cyber' ? 'gdelt_cyber' : 'gdelt_conflict'
  const config = TARGETS[catKey]
  if (!config || typeof config.url !== 'string') return c.json(upstreamError('gdelt', 400, 'Invalid category'), 400)
  const cat = category || 'conflict'
  const entityType = cat === 'cyber' ? 'cyber_intel' : cat === 'nuclear' ? 'nuclear_intel' : 'conflict_intel'
  // Build NewsAPI query as fast fallback (key-gated, ~1s response)
  const newsKey = c.env.NEWS_API_KEY
  const newsQ = cat === 'cyber' ? 'cyberattack+ransomware+hacking+breach' : cat === 'nuclear' ? 'nuclear+missile+warhead+uranium' : cat === 'maritime' ? 'warship+navy+maritime+vessel' : 'military+attack+conflict+airstrike'
  const fromDate = new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0]
  const newsUrl = newsKey ? ('https://newsapi.org/v2/everything?q=' + newsQ + '&sortBy=publishedAt&pageSize=40&language=en&from=' + fromDate + '&apiKey=' + newsKey) : ''
  function geocodeArticles(articles: any[], sourceLabel: string, prefix: string): CanonicalEvent[] {
    return articles.map((art: any, i: number) => {
      const geo = geocodeFromText(art.title || '')
      if (!geo) return null
      return evt({
        id: prefix + '_' + cat + '_' + i, entity_type: entityType,
        source: sourceLabel, source_url: art.url || '', title: art.title || '',
        description: (art.domain || art.source?.name || '') + (art.sourcecountry ? ' \u2014 ' + art.sourcecountry : ''),
        lat: geo.lat, lon: geo.lon, region: geo.region,
        timestamp: art.seendate || art.publishedAt || new Date().toISOString(),
        confidence: geo.confidence, severity: 'medium', tags: [cat, geo.matched],
        provenance: 'geocoded-inferred',
        metadata: { domain: art.domain || art.source?.name, matched_location: geo.matched }
      })
    }).filter(Boolean) as CanonicalEvent[]
  }
  // Run GDELT and NewsAPI in parallel -- return first that succeeds with geocodeable articles
  const gdeltP = fetchGDELT(config.url)
  const newsP: Promise<any> = newsUrl ? safeJson(newsUrl, {}, 10000) : Promise.reject('no-key')
  const [gdeltR, newsR] = await Promise.allSettled([gdeltP, newsP])
  if (gdeltR.status === 'fulfilled' && gdeltR.value?.articles?.length) {
    const events = geocodeArticles(gdeltR.value.articles, 'GDELT 2.0', 'gdelt')
    if (events.length > 0) return c.json({ events, total: gdeltR.value.articles.length, geocoded: events.length, source: 'gdelt' })
  }
  if (newsR.status === 'fulfilled' && newsR.value?.articles?.length) {
    const events = geocodeArticles(newsR.value.articles, 'NewsAPI (conflict intel)', 'news')
    return c.json({ events, total: newsR.value.articles.length, geocoded: events.length, source: 'newsapi-conflict-fallback' })
  }
  return c.json({ events: [], _upstream_error: true, message: 'GDELT unavailable' + (newsKey ? ' and NewsAPI returned no geocodeable articles' : '. Configure NEWS_API_KEY for fallback.') })
})


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
      data = await safeJson('https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json', {}, 15000)
    } catch {
      // Mirror fallback
      data = await safeJson('https://raw.githubusercontent.com/cisagov/known-exploited-vulnerabilities/main/data/known_exploited_vulnerabilities.json', {}, 12000)
    }
    const vulns = (data.vulnerabilities || []).slice(0, 100)
    const events: CanonicalEvent[] = vulns.map((v: any, i: number) => evt({
      id: `kev_${v.cveID || i}`, entity_type: 'cyber_vulnerability',
      source: 'CISA KEV', source_url: `https://nvd.nist.gov/vuln/detail/${v.cveID}`,
      title: `${v.cveID}: ${v.vulnerabilityName || 'Unknown'}`,
      description: v.shortDescription || '',
      timestamp: v.dateAdded || '', severity: 'high', risk_score: 75,
      confidence: 95, tags: ['cisa-kev', 'known-exploited', v.vendorProject || '', v.product || ''].filter(Boolean),
    provenance: 'direct-api',
      metadata: { cve_id: v.cveID, vendor: v.vendorProject, product: v.product, required_action: v.requiredAction, due_date: v.dueDate, known_ransomware: v.knownRansomwareCampaignUse }
    }))
    return c.json({ events, count: events.length, catalog_date: data.catalogVersion, source: 'cisa-kev' })
  } catch (error) { return c.json(upstreamError('cisa-kev', 0, String(error))) }
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
    provenance: 'direct-api',
        metadata: { ioc_type: ioc.ioc_type, ioc_value: ioc.ioc_value, malware: ioc.malware, malware_alias: ioc.malware_alias, threat_type: ioc.threat_type, reporter: ioc.reporter, reference: ioc.reference }
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
// SOCIAL INTEL — Multi-source: Mastodon + HackerNews + Reddit (fallback)
// Mastodon: free public hashtag timelines, no auth required
// HackerNews: Algolia Search API, no auth required
// Reddit: public JSON (may return 403 from cloud IPs -- used as last fallback)
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/social/reddit', async (c) => {
  const allEvents: CanonicalEvent[] = []

  // ── Mastodon public hashtag timelines (no auth, rate-limit friendly) ──────
  const HASHTAGS = [
    { tag: 'osint',         label: 'osint' },
    { tag: 'infosec',       label: 'cyber' },
    { tag: 'cybersecurity', label: 'cyber' },
    { tag: 'ukraine',       label: 'ukraine-conflict' },
    { tag: 'geopolitics',   label: 'geopolitics' },
  ]
  const mastoResults = await Promise.allSettled(
    HASHTAGS.map(h =>
      safeJson('https://mastodon.social/api/v1/timelines/tag/' + h.tag + '?limit=12', {}, 10000)
        .then((posts: any) => {
          const arr: any[] = Array.isArray(posts) ? posts : []
          return arr.filter((p: any) => p.visibility === 'public').map((p: any) => {
            const rawText = (p.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
            const geo = geocodeFromText(rawText)
            return evt({
              id: 'masto_' + h.tag + '_' + p.id,
              entity_type: 'social_post',
              source: 'Mastodon #' + h.tag,
              source_url: p.url || '',
              title: (rawText || ('Post by ' + (p.account?.display_name || 'unknown'))).slice(0, 200),
              description: '@' + (p.account?.acct || ''),
              lat: geo?.lat ?? null, lon: geo?.lon ?? null, region: geo?.region || '',
              timestamp: p.created_at || '',
              confidence: geo ? geo.confidence : 0,
              severity: 'info',
              tags: [h.label, 'mastodon', h.tag],
              provenance: geo ? 'geocoded-inferred' : 'no-location',
              metadata: {
                subreddit: 'mastodon/' + h.tag,
                author: p.account?.display_name || '',
                score: (p.favourites_count || 0) + (p.reblogs_count || 0),
                num_comments: p.replies_count || 0,
                media_url: p.media_attachments?.[0]?.url || '',
                media_type: p.media_attachments?.[0]?.type || 'text',
                thumbnail: p.media_attachments?.[0]?.preview_url || '',
                nsfw: p.sensitive || false,
                flair: '#' + h.tag,
                external_url: p.url || '',
                matched_location: geo?.matched || null,
                geolocation_method: geo ? 'text-inference' : 'none',
              }
            })
          })
        })
        .catch(() => [] as CanonicalEvent[])
    )
  )
  mastoResults.forEach(r => { if (r.status === 'fulfilled') allEvents.push(...r.value) })

  // ── HackerNews via Algolia Search API (security / OSINT / conflict topics) ─
  const HN_QUERIES = [
    'cybersecurity attack vulnerability exploit',
    'OSINT intelligence surveillance tracking',
    'ukraine russia military conflict airstrike',
    'cyber attack ransomware malware breach',
  ]
  const hnResults = await Promise.allSettled(
    HN_QUERIES.map(q =>
      safeJson(
        'https://hn.algolia.com/api/v1/search_by_date?query=' + encodeURIComponent(q) +
        '&tags=story&hitsPerPage=12',
        {}, 8000
      ).then((data: any) => {
        return (data.hits || []).map((hit: any) => {
          const title = (hit.title || '').trim()
          if (!title) return null
          const geo = geocodeFromText(title)
          let hostname = ''
          try { hostname = new URL(hit.url || 'https://news.ycombinator.com').hostname } catch {}
          return evt({
            id: 'hn_' + hit.objectID,
            entity_type: 'social_post',
            source: 'HackerNews',
            source_url: 'https://news.ycombinator.com/item?id=' + hit.objectID,
            title: title.slice(0, 200),
            description: hostname ? ('via ' + hostname) : '',
            lat: geo?.lat ?? null, lon: geo?.lon ?? null, region: geo?.region || '',
            timestamp: hit.created_at || '',
            confidence: geo ? geo.confidence : 0,
            severity: 'info',
            tags: ['hackernews', q.split(' ')[0].toLowerCase()],
            provenance: geo ? 'geocoded-inferred' : 'no-location',
            metadata: {
              subreddit: 'hackernews',
              author: hit.author || '',
              score: hit.points || 0,
              num_comments: hit.num_comments || 0,
              media_url: '', media_type: 'link', thumbnail: '',
              nsfw: false, flair: 'HN',
              external_url: hit.url || '',
              matched_location: geo?.matched || null,
              geolocation_method: geo ? 'text-inference' : 'none',
            }
          })
        }).filter(Boolean)
      })
      .catch(() => [] as CanonicalEvent[])
    )
  )
  hnResults.forEach(r => { if (r.status === 'fulfilled') allEvents.push(...(r.value as CanonicalEvent[])) })

  // ── Reddit fallback (may return 403 from cloud/edge IPs) ──────────────────
  const SUBS = [
    { name: 'CombatFootage',   tag: 'conflict-video' },
    { name: 'CredibleDefense', tag: 'military-analysis' },
    { name: 'osint',           tag: 'osint' },
  ]
  const redditResults = await Promise.allSettled(
    SUBS.map(sub =>
      safeFetch('https://www.reddit.com/r/' + sub.name + '/hot.json?limit=10&raw_json=1', {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SentinelOS/6.2; OSINT-platform)' }
      }, 8000).then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status)
        return r.json()
      }).then((data: any) => {
        return (data?.data?.children || []).map((child: any) => {
          const p = child.data
          if (!p) return null
          let media_url = '', media_type = 'text'
          if (p.is_video && p.media?.reddit_video?.fallback_url) { media_url = p.media.reddit_video.fallback_url; media_type = 'video' }
          else if (p.url && /\.(mp4|webm|mov)/i.test(p.url)) { media_url = p.url; media_type = 'video' }
          else if (p.url && /v\.redd\.it|streamable|youtube|youtu\.be/i.test(p.url)) { media_url = p.url; media_type = 'video_link' }
          else if (p.url && /\.(jpg|jpeg|png|gif|webp)/i.test(p.url)) { media_url = p.url; media_type = 'image' }
          const geo = geocodeFromText(p.title || '')
          return evt({
            id: 'reddit_' + p.id,
            entity_type: 'social_post',
            source: 'Reddit r/' + sub.name,
            source_url: 'https://reddit.com' + p.permalink,
            title: (p.title || '').slice(0, 200),
            description: (p.selftext || '').slice(0, 200),
            lat: geo?.lat ?? null, lon: geo?.lon ?? null, region: geo?.region || '',
            timestamp: p.created_utc ? new Date(p.created_utc * 1000).toISOString() : '',
            confidence: geo ? geo.confidence : 0,
            severity: 'info',
            tags: [sub.tag, p.link_flair_text || ''].filter(Boolean),
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
  redditResults.forEach(r => { if (r.status === 'fulfilled') allEvents.push(...r.value) })

  // ── Deduplicate, sort by score, return ────────────────────────────────────
  const seen = new Set<string>()
  const unique = allEvents.filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true })
  unique.sort((a, b) => ((b.metadata.score as number) || 0) - ((a.metadata.score as number) || 0))
  const geolocated = unique.filter(e => e.lat !== null)
  return c.json({
    events: unique.slice(0, 80),
    total: unique.length,
    geolocated: geolocated.length,
    source: 'multi-social',
    sources: ['mastodon', 'hackernews', 'reddit-fallback'],
    note: 'Mastodon public hashtag timelines (#osint #infosec #ukraine), HackerNews Algolia search (security/OSINT topics), Reddit public JSON (may be blocked from cloud IPs). Locations inferred from text -- always low-confidence.',
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
// HEALTH + STATUS
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/health', (c) => c.json({
  status: 'operational',
  version: VERSION,
  codename: 'SENTINEL OS',
  timestamp: new Date().toISOString(),
  domains: ['aviation', 'maritime', 'orbital', 'seismic', 'wildfire', 'weather', 'conflict', 'disaster', 'cyber', 'nuclear', 'gnss', 'social', 'imagery'],
}))

app.get('/api/status', (c) => {
  const keyNames: (keyof Bindings)[] = ['NASA_FIRMS_KEY', 'OWM_KEY', 'N2YO_KEY', 'GFW_TOKEN', 'AVWX_KEY', 'RAPIDAPI_KEY', 'SHODAN_KEY', 'NEWS_API_KEY', 'AISSTREAM_KEY', 'OTX_KEY', 'ACLED_KEY', 'ACLED_EMAIL', 'ABUSECH_KEY', 'SPACETRACK_USER', 'SPACETRACK_PASS', 'CESIUM_TOKEN', 'COPERNICUS_CLIENT_ID', 'PLANET_API_KEY']
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
// Source health endpoint — probes free sources with latency measurement
app.get("/api/sources/health", async (c) => {
  const FREE_PROBES = [
    { name: "adsb.one ADS-B",    key: "opensky",   url: "https://api.adsb.one/v2/point/20/10/100" },
    { name: "Mastodon OSINT",    key: "mastodon",  url: "https://mastodon.social/api/v1/timelines/tag/osint?limit=1" },
    { name: "HackerNews Algolia",key: "hackernews",url: "https://hn.algolia.com/api/v1/search?query=security&tags=story&hitsPerPage=1" },
    { name: "USGS Seismic",    key: "usgs",      url: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson" },
    { name: "GDELT 2.0",       key: "gdelt",     url: "https://api.gdeltproject.org/api/v2/doc/doc?query=test&mode=artlist&maxrecords=1&format=json" },
    { name: "ReliefWeb",       key: "reliefweb", url: "https://api.reliefweb.int/v1/disasters?appname=sentinel-os-osint&limit=1" },
    { name: "CISA KEV",        key: "cisa_kev",  url: "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json" },
    { name: "URLhaus",         key: "urlhaus",   url: "https://urlhaus-api.abuse.ch/v1/urls/recent/limit/1/", method: "POST" },
    { name: "ThreatFox", key: "threatfox", url: "https://threatfox-api.abuse.ch/api/v1/", method: "POST", body: '{"query":"get_iocs","days":1}' },
  ]
  const KEY_SOURCES = [
    { name: "NASA FIRMS",         key: "nasa_firms",  envKey: "NASA_FIRMS_KEY" as keyof Bindings },
    { name: "OpenWeatherMap",     key: "owm",         envKey: "OWM_KEY" as keyof Bindings },
    { name: "N2YO Satellites",    key: "n2yo",        envKey: "N2YO_KEY" as keyof Bindings },
    { name: "Global Fish Watch",  key: "gfw",         envKey: "GFW_TOKEN" as keyof Bindings },
    { name: "AlienVault OTX",     key: "otx",         envKey: "OTX_KEY" as keyof Bindings },
    { name: "Shodan",             key: "shodan",      envKey: "SHODAN_KEY" as keyof Bindings },
    { name: "ACLED",              key: "acled",       envKey: "ACLED_KEY" as keyof Bindings },
    { name: "AISStream",          key: "aisstream",   envKey: "AISSTREAM_KEY" as keyof Bindings },
    { name: "NewsAPI",            key: "newsapi",     envKey: "NEWS_API_KEY" as keyof Bindings },
    { name: "RapidAPI (Mil-Air)", key: "rapidapi",    envKey: "RAPIDAPI_KEY" as keyof Bindings },
  ]
  const probeResults = await Promise.all(FREE_PROBES.map(async (p) => {
    const t0 = Date.now()
    try {
      const res = await fetch(p.url, { method: p.method || "GET", body: p.body || undefined, signal: AbortSignal.timeout(8000), headers: { "User-Agent": UA, ...(p.body ? { "Content-Type": "application/json" } : {}) } })
      return { name: p.name, key: p.key, status: res.ok ? "live" : "error", latency_ms: Date.now()-t0, key_configured: true, error: res.ok ? null : "HTTP " + res.status, checked_at: new Date().toISOString() }
    } catch(err) {
      return { name: p.name, key: p.key, status: "error", latency_ms: Date.now()-t0, key_configured: true, error: String(err).slice(0,100), checked_at: new Date().toISOString() }
    }
  }))
  const keyResults = KEY_SOURCES.map((s) => ({
    name: s.name, key: s.key, status: c.env[s.envKey] ? "configured" : "no-key",
    latency_ms: null, key_configured: !!(c.env[s.envKey]), error: c.env[s.envKey] ? null : "API key not set",
    checked_at: new Date().toISOString()
  }))
  const all = [...probeResults, ...keyResults]
  return c.json({ sources: all, checked_at: new Date().toISOString(), total: all.length, live: all.filter(r => r.status === "live").length })
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
<title>SENTINEL OS v${VERSION} — Global Situational Awareness</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>&#x1F6F0;</text></svg>">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&family=Orbitron:wght@400;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css"/>
<link rel="stylesheet" href="/static/style.css">
</head>
<body>
<div id="map"></div>
<div id="hud"></div>
<div id="inspector"></div>
<div id="loading">
  <div class="load-inner">
    <div class="load-spinner"></div>
    <div class="load-text">SENTINEL OS v${VERSION}</div>
    <div class="load-sub" id="load-status">Loading dependencies...</div>
  </div>
</div>
<script>
// Dependency loader — map only initializes after Leaflet is confirmed ready
(function(){
  var deps = [
    {src:'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', check:function(){return window.L}},
    {src:'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js', check:function(){return window.L&&L.MarkerClusterGroup}},
    {src:'https://unpkg.com/satellite.js@5.0.0/dist/satellite.min.js', check:function(){return window.satellite}, optional:true},
  ];
  var loaded=0;
  function setStatus(msg){var el=document.getElementById('load-status');if(el)el.textContent=msg;}
  function loadNext(){
    if(loaded>=deps.length){setStatus('Initializing...');loadApp();return}
    var dep=deps[loaded];
    setStatus('Loading '+(loaded+1)+'/'+deps.length+'...');
    var s=document.createElement('script');
    s.src=dep.src;
    s.onload=function(){loaded++;loadNext()};
    s.onerror=function(){
      if(dep.optional){console.warn('Optional dep failed:',dep.src);loaded++;loadNext()}
      else{setStatus('Failed to load critical dependency');console.error('Failed:',dep.src)}
    };
    document.head.appendChild(s);
  }
  function loadApp(){
    var s=document.createElement('script');s.src='/static/sentinel.js';
    s.onerror=function(){setStatus('Failed to load application')};
    document.head.appendChild(s);
  }
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',loadNext)}
  else{loadNext()}
})();
</script>
</body>
</html>`)  
})

// 
// =============================================================================
// DOMAIN-SPECIFIC ROUTES — GPS, Conflict, Air, Sea, Space, Weather, Fusion
// =============================================================================

// u2500u2500u2500 GPS/GNSS ALIAS ROUTES u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500
app.get('/api/gps/anomalies', (c) => c.redirect('/api/gnss/anomalies', 307))
app.get('/api/gps/zones', (c) => c.json({ events: GNSS_ZONES, count: GNSS_ZONES.length, source: 'gnss-reference-model' }))

// CONFLICT domain routes
app.post('/api/conflict/events', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const cat = (body as any).category || 'conflict'
  const gdeltUrl = cat === 'nuclear'
    ? 'https://api.gdeltproject.org/api/v2/doc/doc?query=nuclear+missile+ICBM+warhead&mode=artlist&maxrecords=25&format=json&timespan=72h&sourcelang=english'
    : 'https://api.gdeltproject.org/api/v2/doc/doc?query=military+attack+airstrike+conflict&mode=artlist&maxrecords=50&format=json&timespan=48h&sourcelang=english'
  const data = await fetchGDELT(gdeltUrl)
  if (!data) return c.json({ events: [], _upstream_error: true, message: 'GDELT unavailable' })
  const arts = (data.articles || []) as any[]
  const events: CanonicalEvent[] = arts.map((art, i) => {
    const geo = geocodeFromText(art.title || '')
    if (!geo) return null
    return evt({
      id: 'conflict_' + cat + '_' + i,
      entity_type: cat === 'nuclear' ? 'nuclear_intel' : 'conflict_intel',
      source: 'GDELT 2.0', source_url: art.url || '', title: art.title || '',
      lat: geo.lat, lon: geo.lon, region: geo.region,
      timestamp: art.seendate || '', confidence: geo.confidence,
      severity: 'medium', tags: [cat, geo.matched],
      provenance: 'geocoded-inferred',
      metadata: { domain: art.domain, matched_location: geo.matched }
    })
  }).filter(Boolean) as CanonicalEvent[]
  return c.json({ events, total: arts.length, geocoded: events.length, source: 'gdelt' })
})
app.get('/api/conflict/zones', (c) => c.json({ zones: FUSION_ZONES, source: 'fusion-reference' }))

// AIR domain
app.get('/api/air/traffic', async (c) => {
  try {
    const data = await safeJson('https://opensky-network.org/api/states/all', {}, 15000) as any
    if (!data?.states) return c.json({ events: [], count: 0, source: 'opensky' })
    const events: CanonicalEvent[] = (data.states as any[][])
      .filter((s: any) => s[6] != null && s[5] != null && s[8] === false)
      .slice(0, 300)
      .map((s: any, i: number) => {
        const cs = (s[1] || '').trim()
        return evt({
          id: 'air_' + i, entity_type: 'aircraft',
          source: 'OpenSky Network', source_url: 'https://opensky-network.org/',
          title: cs || 'ICAO:' + s[0], lat: s[6], lon: s[5],
          altitude: s[7] != null ? Math.round(s[7] * 3.28084) : null,
          velocity: s[9] != null ? Math.round(s[9] * 1.944) : null,
          confidence: 95, severity: 'info', tags: ['aircraft', 'adsb'],
          metadata: { icao24: s[0], callsign: cs, origin_country: s[2] }
        })
      })
    return c.json({ events, count: events.length, source: 'opensky' })
  } catch (error) { return c.json(upstreamError('opensky', 0, String(error))) }
})

// SEA domain -- GFW fishing/dark vessels. Maritime intel via /api/intel/gdelt?category=maritime
app.get('/api/sea/vessels', async (c) => {
  const token = c.env.GFW_TOKEN
  const vessels: CanonicalEvent[] = []
  if (token) {
    try {
      const hdrs = { Authorization: 'Bearer ' + token }
      const u1 = 'https://gateway.api.globalfishingwatch.org/v3/events?datasets[0]=public-global-fishing-events:latest&limit=50&offset=0'
      const u2 = 'https://gateway.api.globalfishingwatch.org/v3/events?datasets[0]=public-global-gaps-events:latest&limit=30&offset=0'
      const [fishR, gapR] = await Promise.allSettled([
        safeJson(u1, { headers: hdrs }, 14000),
        safeJson(u2, { headers: hdrs }, 14000),
      ])
      const addV = (raw: any, type: string, prefix: string) => {
        const entries: any[] = Array.isArray(raw) ? raw : (raw?.entries || [])
        entries.slice(0, 40).forEach((ev: any, i: number) => {
          const lat = ev.position?.lat, lon = ev.position?.lon
          if (lat == null || lon == null) return
          const v = ev.vessel || {}, name = v.name || 'MMSI:' + (v.ssvid || i)
          vessels.push(evt({
            id: prefix + i, entity_type: type,
            source: 'Global Fishing Watch', source_url: 'https://globalfishingwatch.org/',
            title: (type === 'dark_vessel' ? 'DARK \u2014 ' : '') + name, lat, lon,
            confidence: 80, severity: type === 'dark_vessel' ? 'medium' : 'low',
            tags: [type === 'dark_vessel' ? 'ais-gap' : 'fishing'],
            metadata: { mmsi: v.ssvid, flag: v.flag, gap_hours: ev.gap_hours }
          }))
        })
      }
      if (fishR.status === 'fulfilled' && fishR.value && !fishR.value._upstream_error) addV(fishR.value, 'fishing_vessel', 'gfw_fish_')
      if (gapR.status === 'fulfilled' && gapR.value && !gapR.value._upstream_error) addV(gapR.value, 'dark_vessel', 'gfw_gap_')
    } catch { /* GFW unavailable */ }
  }
  if (vessels.length > 0) return c.json({ events: vessels, count: vessels.length, source: 'gfw' })
  return c.json({
    events: [], count: 0, source: 'sea',
    note: token ? 'GFW returned no vessel data. For maritime intel use /api/intel/gdelt with category:maritime' : 'Configure GFW_TOKEN for live AIS. Free maritime intel at /api/intel/gdelt?category=maritime',
  })
})


// SPACE domain
app.get('/api/space/satellites', async (c) => {
  try {
    const data = await safeJson('https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=json', {}, 12000) as any[]
    if (Array.isArray(data) && data.length > 0) {
      const events: CanonicalEvent[] = data.slice(0, 50).map((sat: any, i: number) => evt({
        id: 'space_' + i, entity_type: 'satellite',
        source: 'CelesTrak', source_url: 'https://celestrak.org/',
        title: sat.OBJECT_NAME || 'NORAD:' + sat.NORAD_CAT_ID, lat: null, lon: null,
        confidence: 90, severity: 'info', tags: ['satellite'],
        metadata: { norad_id: sat.NORAD_CAT_ID, epoch: sat.EPOCH, inclination: sat.INCLINATION }
      }))
      return c.json({ events, count: events.length, source: 'celestrak' })
    }
    return c.json(upstreamError('celestrak', 0, 'No data'))
  } catch (error) { return c.json(upstreamError('celestrak', 0, String(error))) }
})

// WEATHER storm events
app.get('/api/weather/storm-events', async (c) => {
  try {
    const data = await safeJson('https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=TC,TS,FL&alertlevel=Green;Orange;Red', {}, 12000) as any
    const features = (data?.features || []) as any[]
    const events: CanonicalEvent[] = features.map((f: any, i: number) => {
      const p = f.properties || {}, coords = f.geometry?.coordinates || []
      if (!coords[1] || !coords[0]) return null
      const alert = (p.alertlevel || '').toLowerCase()
      return evt({ id: 'storm_' + i, entity_type: 'weather',
        source: 'GDACS', source_url: 'https://www.gdacs.org/',
        title: (p.eventtype || 'STORM') + ' ' + (p.eventname || p.country || 'Unknown'),
        lat: coords[1], lon: coords[0], confidence: 90,
        severity: alert === 'red' ? 'critical' : alert === 'orange' ? 'high' : 'medium',
        tags: ['storm', p.eventtype || ''], metadata: { alert_level: p.alertlevel, country: p.country } })
    }).filter(Boolean) as CanonicalEvent[]
    return c.json({ events, count: events.length, source: 'gdacs-weather' })
  } catch (error) { return c.json(upstreamError('gdacs', 0, String(error))) }
})

// FUSION GLOBAL
app.get('/api/fusion/global', async (c) => {
  return c.json({
    timestamp: new Date().toISOString(),
    version: VERSION,
    platform: 'SENTINEL OS',
    status: 'operational',
    threat_zones: FUSION_ZONES,
    gnss_zones: GNSS_ZONES.length,
    domain_coverage: {
      air: true, sea: true, space: true,
      weather: Boolean(c.env.OWM_KEY), wildfire: Boolean(c.env.NASA_FIRMS_KEY),
      conflict: true, cyber: true, gnss: true, social: true,
      maritime_live: Boolean(c.env.GFW_TOKEN), satellites_live: Boolean(c.env.N2YO_KEY),
    },
    free_sources: ['opensky','usgs','gdelt','reliefweb','gdacs','cisa-kev','urlhaus','threatfox','otx','reddit','celestrak','wheretheiss'],
    keyed_sources: {
      NASA_FIRMS_KEY: Boolean(c.env.NASA_FIRMS_KEY), OWM_KEY: Boolean(c.env.OWM_KEY),
      N2YO_KEY: Boolean(c.env.N2YO_KEY), GFW_TOKEN: Boolean(c.env.GFW_TOKEN),
      ACLED_KEY: Boolean(c.env.ACLED_KEY), SHODAN_KEY: Boolean(c.env.SHODAN_KEY),
      NEWS_API_KEY: Boolean(c.env.NEWS_API_KEY), OTX_KEY: Boolean(c.env.OTX_KEY),
      RAPIDAPI_KEY: Boolean(c.env.RAPIDAPI_KEY), AISSTREAM_KEY: Boolean(c.env.AISSTREAM_KEY),
    },
  })
})

// SPACE-TRACK.ORG — authenticated satellite catalog
app.get('/api/space/spacetrack', async (c) => {
  const user = c.env.SPACETRACK_USER, pass = c.env.SPACETRACK_PASS
  if (!user || !pass) return c.json(upstreamError('spacetrack', 0, 'Configure SPACETRACK_USER and SPACETRACK_PASS'))
  try {
    const creds = 'identity=' + encodeURIComponent(user) + '&password=' + encodeURIComponent(pass)
    const login = await safeFetch('https://www.space-track.org/ajaxauth/login',
      { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: creds }, 15000)
    if (!login.ok) return c.json(upstreamError('spacetrack', login.status, 'Login failed'))
    const rawCookie = login.headers.get('set-cookie') || ''
  const cookie = rawCookie.split(';')[0] || ''  // name=value only
    const q = 'https://www.space-track.org/basicspacedata/query/class/gp/EPOCH/>now-1/orderby/NORAD_CAT_ID/limit/200/format/json'
    const dr = await safeFetch(q, { headers: { Cookie: cookie } }, 20000)
    if (!dr.ok) return c.json(upstreamError('spacetrack', dr.status, 'Data fetch failed'))
    const sats = await dr.json() as any[]
    const events: CanonicalEvent[] = sats.slice(0, 150).map((s: any, i: number) => evt({
      id: 'st_' + i, entity_type: 'satellite',
      source: 'Space-Track.org', source_url: 'https://www.space-track.org/',
      title: (s.OBJECT_NAME || 'NORAD:' + s.NORAD_CAT_ID).trim(), lat: null, lon: null,
      confidence: 98, severity: 'info', tags: ['satellite', 'tle'],
      metadata: { norad_id: s.NORAD_CAT_ID, object_type: s.OBJECT_TYPE, epoch: s.EPOCH,
        inclination: s.INCLINATION, eccentricity: s.ECCENTRICITY, country: s.COUNTRY_CODE }
    }))
    return c.json({ events, count: events.length, total: sats.length, source: 'space-track' })
  } catch (error) { return c.json(upstreamError('spacetrack', 0, String(error))) }
})

// URLhaus authenticated (ABUSECH_KEY unlocks higher limits)
app.get('/api/cyber/urlhaus-auth', async (c) => {
  const key = c.env.ABUSECH_KEY
  const hdrs: Record<string,string> = { 'Content-Type': 'application/x-www-form-urlencoded' }
  if (key) hdrs['Auth-Key'] = key
  try {
    const res = await safeFetch('https://urlhaus-api.abuse.ch/v1/urls/recent/limit/100/',
      { method: 'POST', headers: hdrs }, 12000)
    if (res.ok) {
      const data = await res.json() as any
      const urls = data.urls || []
      if (urls.length > 0) {
        const events: CanonicalEvent[] = urls.map((u: any, i: number) => evt({
          id: 'urlhaus_a_' + i, entity_type: 'cyber_malware_url',
          source: 'URLhaus (abuse.ch)', source_url: u.urlhaus_reference || 'https://urlhaus.abuse.ch/',
          title: 'Malware URL: ' + (u.url || '').slice(0, 80),
          description: 'Threat: ' + (u.threat || 'unknown') + ' | ' + (u.url_status || 'unknown'),
          timestamp: u.dateadded || '', confidence: key ? 90 : 80,
          severity: u.url_status === 'online' ? 'high' : 'medium',
          tags: [...(u.tags || []), u.threat || ''].filter(Boolean),
          metadata: { url: u.url, host: u.host, url_status: u.url_status, threat: u.threat }
        }))
        return c.json({ events, count: events.length, authenticated: Boolean(key), source: 'urlhaus-auth' })
      }
    }
    return c.json(upstreamError('urlhaus-auth', 0, 'No data'))
  } catch (error) { return c.json(upstreamError('urlhaus-auth', 0, String(error))) }
})

// ThreatFox authenticated (ABUSECH_KEY unlocks 7-day IOC feed)
app.get('/api/cyber/threatfox-auth', async (c) => {
  const key = c.env.ABUSECH_KEY
  const hdrs: Record<string,string> = { 'Content-Type': 'application/json' }
  if (key) hdrs['Auth-Key'] = key
  try {
    const res = await safeFetch('https://threatfox-api.abuse.ch/api/v1/',
      { method: 'POST', headers: hdrs, body: JSON.stringify({ query: 'get_iocs', days: 7 }) }, 12000)
    if (res.ok) {
      const data = await res.json() as any
      const iocs = Array.isArray(data.data) ? data.data.slice(0, 100) : []
      const events: CanonicalEvent[] = iocs.map((ioc: any, i: number) => evt({
        id: 'tfauth_' + (ioc.id || i), entity_type: 'cyber_ioc',
        source: 'ThreatFox (abuse.ch)',
        source_url: 'https://threatfox.abuse.ch/ioc/' + ioc.id + '/',
        title: 'IOC: ' + (ioc.ioc_value || 'Unknown'),
        description: (ioc.malware || '') + ' - ' + (ioc.threat_type || ''),
        timestamp: ioc.first_seen_utc || '', confidence: ioc.confidence_level || 75,
        severity: (ioc.threat_type || '').includes('botnet') ? 'high' : 'medium',
        tags: (ioc.tags || []).concat([ioc.malware || '', ioc.threat_type || '']).filter(Boolean),
        metadata: { ioc_type: ioc.ioc_type, ioc_value: ioc.ioc_value,
          malware: ioc.malware, threat_type: ioc.threat_type, reporter: ioc.reporter }
      }))
      return c.json({ events, count: events.length, authenticated: Boolean(key), source: 'threatfox-auth' })
    }
    return c.json(upstreamError('threatfox-auth', 0, 'API error'))
  } catch (error) { return c.json(upstreamError('threatfox-auth', 0, String(error))) }
})

// Copernicus Dataspace OAuth2 token (for frontend WMTS/WMS use)
app.get('/api/imagery/copernicus-token', async (c) => {
  const cid = c.env.COPERNICUS_CLIENT_ID
  const csec = c.env.COPERNICUS_CLIENT_SECRET
  if (!cid || !csec) return c.json({ available: false, note: 'Copernicus credentials not configured' })
  try {
    const body = 'grant_type=client_credentials&client_id=' + encodeURIComponent(cid)
      + '&client_secret=' + encodeURIComponent(csec)
    const res = await safeFetch(
      'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token',
      { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body }, 12000)
    if (!res.ok) return c.json({ available: false, error: 'Auth failed HTTP ' + res.status })
    const data = await res.json() as any
    return c.json({ available: true, access_token: data.access_token,
      expires_in: data.expires_in, token_type: data.token_type,
      wmts_base: 'https://sh.dataspace.copernicus.eu/wmts/1.0.0' })
  } catch (error) { return c.json({ available: false, error: String(error) }) }
})

export default app