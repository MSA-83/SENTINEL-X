/**
 * SENTINEL OS v7.0 — Global Multi-Domain Situational Awareness Platform
 * Secure Edge BFF (Backend-for-Frontend) on Cloudflare Pages
 *
 * Architecture:
 *   - All keyed API calls route through server-side proxy — browser NEVER sees secrets
 *   - Every response normalizes into canonical event schema with provenance + confidence
 *   - Geocoded/inferred locations are explicitly marked and down-weighted
 *   - Graceful failure objects returned on upstream errors
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
}

const app = new Hono<{ Bindings: Bindings }>()
app.use('/api/*', cors())

const VERSION = '7.0.0'
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
  provenance: string          // e.g. "direct-api" | "geocoded-inferred" | "curated-reference"
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
    provenance: 'direct-api',
    ...partial,
  }
}

function upstreamError(upstream: string, status: number, message: string) {
  return { _upstream_error: true, upstream, status, message, events: [] as CanonicalEvent[], timestamp: new Date().toISOString() }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GEO_DB — deterministic geocoding from text (low-confidence, labeled "inferred")
// ═══════════════════════════════════════════════════════════════════════════════
const GEO_DB: Record<string, { lat: number; lon: number; region: string }> = {
  'ukraine': { lat: 48.4, lon: 31.2, region: 'Eastern Europe' },
  'russia': { lat: 55.8, lon: 37.6, region: 'Eastern Europe' },
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
  'taiwan': { lat: 23.7, lon: 121.0, region: 'Indo-Pacific' },
  'china': { lat: 35.9, lon: 104.2, region: 'Indo-Pacific' },
  'north korea': { lat: 40.0, lon: 127.0, region: 'Indo-Pacific' },
  'south korea': { lat: 35.9, lon: 127.8, region: 'Indo-Pacific' },
  'japan': { lat: 36.2, lon: 138.3, region: 'Indo-Pacific' },
  'philippines': { lat: 12.9, lon: 121.8, region: 'Indo-Pacific' },
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
  'myanmar': { lat: 19.2, lon: 96.7, region: 'Southeast Asia' },
  'afghanistan': { lat: 33.9, lon: 67.7, region: 'Central/South Asia' },
  'pakistan': { lat: 30.4, lon: 69.3, region: 'Central/South Asia' },
  'kashmir': { lat: 34.0, lon: 74.5, region: 'Central/South Asia' },
  'india': { lat: 20.6, lon: 79.0, region: 'Central/South Asia' },
  'nato': { lat: 50.8, lon: 4.4, region: 'Europe' },
  'pentagon': { lat: 38.9, lon: -77.1, region: 'North America' },
  'washington': { lat: 38.9, lon: -77.0, region: 'North America' },
  'moscow': { lat: 55.8, lon: 37.6, region: 'Eastern Europe' },
  'beijing': { lat: 39.9, lon: 116.4, region: 'Indo-Pacific' },
  'crimea': { lat: 44.9, lon: 34.1, region: 'Eastern Europe' },
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
  'finland': { lat: 61.5, lon: 25.7, region: 'Europe' },
  'poland': { lat: 51.9, lon: 19.1, region: 'Europe' },
  'romania': { lat: 45.9, lon: 25.0, region: 'Europe' },
  'georgia': { lat: 42.3, lon: 43.4, region: 'Eastern Europe' },
  'singapore': { lat: 1.35, lon: 103.82, region: 'Indo-Pacific' },
  'germany': { lat: 51.2, lon: 10.4, region: 'Europe' },
  'france': { lat: 46.2, lon: 2.2, region: 'Europe' },
  'united kingdom': { lat: 55.4, lon: -3.4, region: 'Europe' },
  'uk': { lat: 55.4, lon: -3.4, region: 'Europe' },
  'london': { lat: 51.5, lon: -0.1, region: 'Europe' },
  'new york': { lat: 40.7, lon: -74.0, region: 'North America' },
  'australia': { lat: -25.3, lon: 133.8, region: 'Indo-Pacific' },
  'brazil': { lat: -14.2, lon: -51.9, region: 'South America' },
  'kyiv': { lat: 50.4, lon: 30.5, region: 'Eastern Europe' },
  'kharkiv': { lat: 49.9, lon: 36.3, region: 'Eastern Europe' },
  'odesa': { lat: 46.5, lon: 30.7, region: 'Eastern Europe' },
  'donbas': { lat: 48.0, lon: 38.0, region: 'Eastern Europe' },
  'zaporizhzhia': { lat: 47.8, lon: 35.2, region: 'Eastern Europe' },
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
  // Jitter coordinates to avoid false precision
  const jitter = () => (Math.random() - 0.5) * 1.2
  // Confidence: longer match = slightly higher, but never above 35 (it's still text-inferred)
  const confidence = Math.min(35, 15 + bestLen * 2)
  return { lat: best.entry.lat + jitter(), lon: best.entry.lon + jitter(), region: best.entry.region, matched: best.key, confidence }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SAFE FETCH HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
async function safeFetch(url: string, opts: RequestInit = {}, timeoutMs = 12000): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal, headers: { 'User-Agent': UA, ...((opts.headers as Record<string, string>) || {}) } })
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
// Browser sends target name → server resolves URL + injects secret
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
  opensky: { url: 'https://opensky-network.org/api/states/all', timeout: 15000, fallbackUrl: 'https://opensky-network.org/api/states/all?lamin=-60&lamax=60&lomin=-180&lomax=180' },
  military: { url: 'https://adsbexchange-com1.p.rapidapi.com/v2/mil/', secret: 'RAPIDAPI_KEY', authType: 'rapidapi', rapidApiHost: 'adsbexchange-com1.p.rapidapi.com', timeout: 10000 },
  gfw_fishing: { url: 'https://gateway.api.globalfishingwatch.org/v3/events?datasets[0]=public-global-fishing-events:latest&limit=50&offset=0', secret: 'GFW_TOKEN', authType: 'bearer', timeout: 14000 },
  gfw_gap: { url: 'https://gateway.api.globalfishingwatch.org/v3/events?datasets[0]=public-global-gaps-events:latest&limit=50&offset=0', secret: 'GFW_TOKEN', authType: 'bearer', timeout: 14000 },
  firms: { url: (key: string) => `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/VIIRS_SNPP_NRT/world/1`, secret: 'NASA_FIRMS_KEY', timeout: 18000, responseType: 'text' },
  n2yo: { url: (key: string) => `https://api.n2yo.com/rest/v1/satellite/above/0/0/0/80/0?apiKey=${key}`, secret: 'N2YO_KEY', timeout: 10000 },
  gdacs: { url: 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=EQ,TC,FL,VO,TS&alertlevel=Green;Orange;Red', timeout: 16000 },
  reliefweb: { url: 'https://api.reliefweb.int/v1/disasters?appname=sentinel-os-osint&limit=50&sort[]=date:desc&fields[include][]=name&fields[include][]=country&fields[include][]=status&fields[include][]=primary_type&fields[include][]=glide&fields[include][]=date', timeout: 14000 },
  gdelt_conflict: { url: 'https://api.gdeltproject.org/api/v2/doc/doc?query=military+attack+airstrike+bombing+conflict&mode=artlist&maxrecords=50&format=json&timespan=48h&sourcelang=english', timeout: 10000 },
  gdelt_maritime: { url: 'https://api.gdeltproject.org/api/v2/doc/doc?query=navy+warship+maritime+vessel+blockade&mode=artlist&maxrecords=30&format=json&timespan=48h&sourcelang=english', timeout: 10000 },
  gdelt_nuclear: { url: 'https://api.gdeltproject.org/api/v2/doc/doc?query=nuclear+missile+ICBM+warhead+enrichment&mode=artlist&maxrecords=25&format=json&timespan=72h&sourcelang=english', timeout: 10000 },
  gdelt_cyber: { url: 'https://api.gdeltproject.org/api/v2/doc/doc?query=cyberattack+ransomware+hacking+breach+APT&mode=artlist&maxrecords=25&format=json&timespan=48h&sourcelang=english', timeout: 10000 },
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
    const u = new URL(url); u.searchParams.set('start-date', params.startDate); u.searchParams.set('end-date', params.endDate); url = u.toString()
  }

  const headers: Record<string, string> = { 'User-Agent': UA }
  if (config.authType === 'bearer' && secret) headers['Authorization'] = `Bearer ${secret}`
  if (config.authType === 'rapidapi' && secret) { headers['X-RapidAPI-Key'] = secret; headers['X-RapidAPI-Host'] = config.rapidApiHost || '' }
  if (config.authType === 'header' && config.headerName && secret) headers[config.headerName] = secret

  try {
    let res: Response
    try { res = await safeFetch(url, { headers }, config.timeout || 15000) }
    catch (err) {
      if (config.fallbackUrl) {
        try { res = await safeFetch(config.fallbackUrl, { headers }, 8000) } catch { return c.json(upstreamError(target, 0, 'Primary and fallback failed')) }
      } else { return c.json(upstreamError(target, 0, String(err))) }
    }
    if (!res!.ok) { const body = await res!.text(); return c.json(upstreamError(target, res!.status, body.slice(0, 400))) }
    if (config.responseType === 'text') return c.text(await res!.text())
    return c.json(await res!.json())
  } catch (error) { return c.json(upstreamError(target, 0, String(error))) }
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
    return c.json({ events: list, count: list.length, source: 'openweathermap' })
  } catch (error) { return c.json(upstreamError('owm', 0, String(error))) }
})

// ═══════════════════════════════════════════════════════════════════════════════
// WEATHER — Open-Meteo multi-city (free, no key required)
// Fetches the same 20 cities as the OWM endpoint using the Open-Meteo API.
// https://open-meteo.com/
// ═══════════════════════════════════════════════════════════════════════════════

/** Map WMO weather-code → a human-readable description */
function wmoCodeToDescription(code: number): string {
  if (code === 0) return 'Clear sky'
  if (code <= 2) return 'Partly cloudy'
  if (code === 3) return 'Overcast'
  if (code <= 9) return 'Fog / Depositing rime fog'
  if (code <= 19) return 'Drizzle'
  if (code <= 29) return 'Rain'
  if (code <= 39) return 'Snow'
  if (code <= 49) return 'Freezing rain'
  if (code <= 59) return 'Rain showers'
  if (code <= 69) return 'Snow showers'
  if (code <= 79) return 'Thunderstorm'
  if (code <= 89) return 'Heavy thunderstorm'
  return 'Unknown'
}

app.get('/api/weather/openmeteo', async (c) => {
  try {
    const results = await Promise.allSettled(
      WEATHER_CITIES.map(city => {
        const url =
          `https://api.open-meteo.com/v1/forecast` +
          `?latitude=${city.lat}&longitude=${city.lon}` +
          `&current=temperature_2m,wind_speed_10m,wind_direction_10m,` +
          `relative_humidity_2m,apparent_temperature,precipitation,weather_code` +
          `&timezone=auto`
        return safeJson(url, {}, 8000).then(d => ({ ...d, _city: city.name, _lat: city.lat, _lon: city.lon }))
      })
    )

    const events: CanonicalEvent[] = results
      .filter(r => r.status === 'fulfilled' && (r as PromiseFulfilledResult<any>).value?.current)
      .map((r, i) => {
        const d = (r as PromiseFulfilledResult<any>).value
        const cur = d.current
        const code = cur.weather_code ?? 0
        const desc = wmoCodeToDescription(code)
        const windSpd: number = cur.wind_speed_10m ?? 0
        // Severity heuristics: heavy precipitation or strong winds
        const severity = windSpd > 60 ? 'critical' : windSpd > 40 ? 'high' : windSpd > 20 ? 'medium' : 'low'
        return evt({
          id: `openmeteo_${d._city.toLowerCase().replace(/\s+/g, '_')}_${i}`,
          entity_type: 'weather_observation',
          source: 'Open-Meteo',
          source_url: 'https://open-meteo.com/',
          title: `${d._city}: ${desc}, ${cur.temperature_2m}°C`,
          description: `Wind ${windSpd} km/h ${cur.wind_direction_10m}°, Humidity ${cur.relative_humidity_2m}%, Feels like ${cur.apparent_temperature}°C, Precipitation ${cur.precipitation} mm`,
          lat: d._lat,
          lon: d._lon,
          region: GEO_DB[d._city.toLowerCase()]?.region || '',
          timestamp: cur.time || new Date().toISOString(),
          observed_at: cur.time || new Date().toISOString(),
          confidence: 90,
          severity,
          risk_score: Math.min(100, Math.round(windSpd * 0.8 + (cur.precipitation ?? 0) * 2)),
          tags: ['weather', 'open-meteo', desc.toLowerCase().replace(/\s+/g, '-')],
          provenance: 'direct-api',
          metadata: {
            temperature_2m: cur.temperature_2m,
            apparent_temperature: cur.apparent_temperature,
            wind_speed_10m: windSpd,
            wind_direction_10m: cur.wind_direction_10m,
            relative_humidity_2m: cur.relative_humidity_2m,
            precipitation: cur.precipitation,
            weather_code: code,
            timezone: d.timezone,
          },
        })
      })

    return c.json({ events, count: events.length, source: 'open-meteo', note: 'Free weather data — no API key required' })
  } catch (error) {
    return c.json(upstreamError('open-meteo', 0, String(error)))
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
  return c.json({ available: !!(c.env.AISSTREAM_KEY), note: 'AIS WebSocket connection handled server-side. Key never sent to browser.' })
})

// ═══════════════════════════════════════════════════════════════════════════════
// SHODAN — Internet exposure
// Requires: SHODAN_KEY (free at https://shodan.io — limited on free plan)
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
      return c.json({ matches: data.matches || [], total: data.total || 0, source: 'shodan-search' })
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
              matches.push({ ip_str: hostData.ip_str || String(ip), port: svc.port || 0, product: svc.product || hostname, org: hostData.org || '', location: { latitude: hostData.latitude || 0, longitude: hostData.longitude || 0, country_name: hostData.country_name || '', city: hostData.city || '' } })
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
    const data = await safeJson('https://api.reliefweb.int/v1/disasters?appname=sentinel-os-osint&limit=50&sort[]=date:desc&fields[include][]=name&fields[include][]=country&fields[include][]=status&fields[include][]=primary_type&fields[include][]=glide&fields[include][]=date', {}, 12000)
    return c.json(data)
  } catch {
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
    return c.json({ data: data.data || [], count: data.count || 0, source: 'acled' })
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
    const events: CanonicalEvent[] = articles.map((art: any, i: number) => {
      const geo = geocodeFromText(art.title || '')
      if (!geo) return null
      return evt({
        id: `gdelt_${category}_${i}`, entity_type: category === 'cyber' ? 'cyber_intel' : category === 'nuclear' ? 'nuclear_intel' : 'conflict_intel',
        source: 'GDELT 2.0', source_url: art.url || '', title: art.title || '',
        description: `${art.domain || ''} — ${art.sourcecountry || ''}`,
        lat: geo.lat, lon: geo.lon, region: geo.region,
        timestamp: art.seendate || new Date().toISOString(), confidence: geo.confidence,
        severity: 'medium', tags: [category || 'conflict', geo.matched],
        provenance: 'geocoded-inferred',
        metadata: { domain: art.domain, language: art.language, matched_location: geo.matched }
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
    const events: CanonicalEvent[] = articles.map((art: any, i: number) => {
      const geo = geocodeFromText(art.title || '')
      if (!geo) return null
      return evt({
        id: `news_${category}_${i}`, entity_type: category === 'cyber' ? 'cyber_intel' : 'conflict_intel',
        source: 'NewsAPI', source_url: art.url || '', title: art.title || '',
        lat: geo.lat, lon: geo.lon, region: geo.region,
        timestamp: art.publishedAt || '', confidence: geo.confidence,
        severity: 'medium', tags: [category || 'conflict', geo.matched],
        provenance: 'geocoded-inferred',
        metadata: { source_name: art.source?.name, image_url: art.urlToImage || '', matched_location: geo.matched }
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
  try {
    let data: any
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

  // Try subscribed → activity → search (triple fallback)
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
        const events: CanonicalEvent[] = data.results.slice(0, 50).map((p: any, i: number) => evt({
          id: `otx_${p.id || i}`, entity_type: 'cyber_threat_intel',
          source: 'AlienVault OTX', source_url: `https://otx.alienvault.com/pulse/${p.id}`,
          title: p.name || 'Unknown Pulse', description: (p.description || '').slice(0, 300),
          timestamp: p.modified || p.created || '', confidence: 70, severity: p.adversary ? 'high' : 'medium',
          tags: (p.tags || []).slice(0, 10), provenance: 'direct-api',
          metadata: { adversary: p.adversary, malware_families: p.malware_families, targeted_countries: p.targeted_countries, indicator_count: p.indicator_type_counts, tlp: p.tlp, references: (p.references || []).slice(0, 5) }
        }))
        return c.json({ events, count: events.length, source: 'otx' })
      }
    } catch { /* try next fallback */ }
  }
  return c.json(upstreamError('otx', 0, 'OTX API unavailable. Register free at https://otx.alienvault.com/'))
})

// ═══════════════════════════════════════════════════════════════════════════════
// CYBER — URLhaus (abuse.ch) — free, no key
// https://urlhaus-api.abuse.ch/
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/cyber/urlhaus', async (c) => {
  try {
    const res = await safeFetch('https://urlhaus-api.abuse.ch/v1/urls/recent/limit/50/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, 10000)
    if (res.ok) {
      const ct = res.headers.get('content-type') || ''
      if (ct.includes('json')) {
        const data = await res.json() as any
        if (data.urls?.length > 0) {
          const events: CanonicalEvent[] = data.urls.slice(0, 50).map((u: any, i: number) => evt({
            id: `urlhaus_${u.id || i}`, entity_type: 'cyber_malware_url',
            source: 'URLhaus (abuse.ch)', source_url: u.urlhaus_reference || 'https://urlhaus.abuse.ch/',
            title: `Malware URL: ${(u.url || '').slice(0, 80)}`,
            description: `Threat: ${u.threat || 'unknown'} | Status: ${u.url_status || 'unknown'}`,
            timestamp: u.dateadded || '', confidence: 85, severity: u.url_status === 'online' ? 'high' : 'medium',
            tags: [...(u.tags || []), u.threat || ''].filter(Boolean), provenance: 'direct-api',
            metadata: { url: u.url, host: u.host, url_status: u.url_status, threat: u.threat, reporter: u.reporter }
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
        return evt({ id: `urlhaus_csv_${i}`, entity_type: 'cyber_malware_url', source: 'URLhaus (abuse.ch)', source_url: 'https://urlhaus.abuse.ch/', title: `Malware URL: ${(p[2] || '').slice(0, 80)}`, description: `Threat: ${p[5] || 'unknown'}`, timestamp: p[1] || '', confidence: 80, severity: 'medium', tags: (p[6] || '').split('|').filter(Boolean), provenance: 'direct-api', metadata: { url: p[2], url_status: p[3], host: p[7] } })
      })
      return c.json({ events, count: events.length, source: 'urlhaus-csv' })
    }
    return c.json(upstreamError('urlhaus', 0, 'URLhaus API unavailable'))
  } catch (error) { return c.json(upstreamError('urlhaus', 0, String(error))) }
})

// ═══════════════════════════════════════════════════════════════════════════════
// CYBER — ThreatFox IOC (abuse.ch) — free, no key
// https://threatfox-api.abuse.ch/
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/cyber/threatfox', async (c) => {
  try {
    const res = await safeFetch('https://threatfox-api.abuse.ch/api/v1/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: 'get_iocs', days: 3 }) }, 10000)
    if (res.ok) {
      const data = await res.json() as any
      const iocs = Array.isArray(data.data) ? data.data.slice(0, 60) : []
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
  } catch (error) { return c.json(upstreamError('threatfox', 0, String(error))) }
})

// ═══════════════════════════════════════════════════════════════════════════════
// GNSS ANOMALY LAYER — GPS jamming / spoofing reference data + live heatmap
// Sources: Curated from GPSJam.org, Eurocontrol, EASA, C4ADS reports
// Also attempts to fetch the GPSJam.org live heatmap API (best-effort).
// ═══════════════════════════════════════════════════════════════════════════════
const GNSS_ZONES: CanonicalEvent[] = [
  { id: 'gnss_ua_east', entity_type: 'gnss_jamming', source: 'GPSJam.org / ADS-B analysis', source_url: 'https://gpsjam.org/', title: 'Ukraine — Eastern Front', description: 'Active GPS jamming from Russian EW systems (Krasukha-4, Pole-21). Continuous.', lat: 48.5, lon: 37.0, altitude: null, velocity: null, heading: null, timestamp: new Date().toISOString(), observed_at: new Date().toISOString(), confidence: 90, severity: 'critical', risk_score: 85, region: 'Eastern Europe', tags: ['military-jamming', 'continuous', 'GPS', 'GLONASS'], correlations: ['gnss_black_sea'], metadata: { radius_km: 300, affected_systems: 'All GNSS', type: 'military_jamming' }, provenance: 'curated-reference' },
  { id: 'gnss_kaliningrad', entity_type: 'gnss_jamming', source: 'GPSJam.org / Eurocontrol', source_url: 'https://gpsjam.org/', title: 'Kaliningrad Oblast', description: 'Russian military GNSS jamming affecting Baltic airspace.', lat: 54.7, lon: 20.5, altitude: null, velocity: null, heading: null, timestamp: new Date().toISOString(), observed_at: new Date().toISOString(), confidence: 85, severity: 'high', risk_score: 70, region: 'Europe', tags: ['military-jamming', 'continuous', 'GPS-L1/L2'], correlations: ['gnss_baltic'], metadata: { radius_km: 200, affected_systems: 'GPS L1/L2', type: 'military_jamming' }, provenance: 'curated-reference' },
  { id: 'gnss_baltic', entity_type: 'gnss_spoofing', source: 'GPSJam.org / EASA', source_url: 'https://gpsjam.org/', title: 'Eastern Baltic Sea', description: 'GPS spoofing affecting commercial aviation over Baltic states.', lat: 57.5, lon: 22.0, altitude: null, velocity: null, heading: null, timestamp: new Date().toISOString(), observed_at: new Date().toISOString(), confidence: 80, severity: 'high', risk_score: 65, region: 'Europe', tags: ['spoofing', 'aviation-impact', 'GPS', 'Galileo'], correlations: ['gnss_kaliningrad'], metadata: { radius_km: 250, affected_systems: 'GPS + Galileo', type: 'spoofing' }, provenance: 'curated-reference' },
  { id: 'gnss_syria', entity_type: 'gnss_jamming', source: 'GPSJam.org / Bellingcat', source_url: 'https://gpsjam.org/', title: 'Syria — Northwest', description: 'Russian Khmeimim air base EW operations.', lat: 35.5, lon: 36.8, altitude: null, velocity: null, heading: null, timestamp: new Date().toISOString(), observed_at: new Date().toISOString(), confidence: 82, severity: 'high', risk_score: 60, region: 'Middle East', tags: ['military-jamming', 'continuous', 'GPS-L1'], correlations: [], metadata: { radius_km: 200, affected_systems: 'GPS L1', type: 'military_jamming' }, provenance: 'curated-reference' },
  { id: 'gnss_israel', entity_type: 'gnss_spoofing', source: 'GPSJam.org / OPSGROUP', source_url: 'https://gpsjam.org/', title: 'Israel — Northern Border', description: 'Massive GPS spoofing affecting Ben Gurion approaches.', lat: 33.0, lon: 35.5, altitude: null, velocity: null, heading: null, timestamp: new Date().toISOString(), observed_at: new Date().toISOString(), confidence: 88, severity: 'high', risk_score: 72, region: 'Middle East', tags: ['spoofing', 'continuous', 'aviation-impact'], correlations: [], metadata: { radius_km: 150, affected_systems: 'GPS L1', type: 'spoofing' }, provenance: 'curated-reference' },
  { id: 'gnss_iran', entity_type: 'gnss_jamming', source: 'GPSJam.org', source_url: 'https://gpsjam.org/', title: 'Iran — Western Border', description: 'Iranian military GPS jamming near Iraq border.', lat: 33.5, lon: 46.0, altitude: null, velocity: null, heading: null, timestamp: new Date().toISOString(), observed_at: new Date().toISOString(), confidence: 70, severity: 'medium', risk_score: 55, region: 'Middle East', tags: ['military-jamming', 'GPS', 'GLONASS'], correlations: [], metadata: { radius_km: 300, affected_systems: 'GPS + GLONASS', type: 'military_jamming' }, provenance: 'curated-reference' },
  { id: 'gnss_dprk', entity_type: 'gnss_jamming', source: 'GPSJam.org / ROK MND', source_url: 'https://gpsjam.org/', title: 'North Korea — DMZ', description: 'DPRK GPS jamming toward South Korean targets.', lat: 37.9, lon: 126.7, altitude: null, velocity: null, heading: null, timestamp: new Date().toISOString(), observed_at: new Date().toISOString(), confidence: 75, severity: 'medium', risk_score: 50, region: 'Indo-Pacific', tags: ['military-jamming', 'periodic'], correlations: [], metadata: { radius_km: 120, affected_systems: 'GPS L1', type: 'military_jamming' }, provenance: 'curated-reference' },
  { id: 'gnss_black_sea', entity_type: 'gnss_spoofing', source: 'C4ADS', source_url: 'https://c4ads.org/', title: 'Black Sea — Western', description: 'GPS spoofing centered on Sevastopol naval base.', lat: 44.0, lon: 33.0, altitude: null, velocity: null, heading: null, timestamp: new Date().toISOString(), observed_at: new Date().toISOString(), confidence: 82, severity: 'high', risk_score: 65, region: 'Eastern Europe', tags: ['spoofing', 'continuous', 'maritime-impact'], correlations: ['gnss_ua_east'], metadata: { radius_km: 250, affected_systems: 'GPS + GLONASS', type: 'spoofing' }, provenance: 'curated-reference' },
  { id: 'gnss_red_sea', entity_type: 'gnss_spoofing', source: 'GPSJam.org / IMO', source_url: 'https://gpsjam.org/', title: 'Red Sea — Southern', description: 'GPS spoofing incidents near Bab el-Mandeb.', lat: 14.0, lon: 42.8, altitude: null, velocity: null, heading: null, timestamp: new Date().toISOString(), observed_at: new Date().toISOString(), confidence: 65, severity: 'medium', risk_score: 45, region: 'Middle East', tags: ['spoofing', 'maritime-impact'], correlations: [], metadata: { radius_km: 200, affected_systems: 'GPS', type: 'spoofing' }, provenance: 'curated-reference' },
  { id: 'gnss_hormuz', entity_type: 'gnss_jamming', source: 'GPSJam.org', source_url: 'https://gpsjam.org/', title: 'Strait of Hormuz', description: 'Iranian GNSS interference affecting maritime traffic.', lat: 26.5, lon: 56.3, altitude: null, velocity: null, heading: null, timestamp: new Date().toISOString(), observed_at: new Date().toISOString(), confidence: 60, severity: 'medium', risk_score: 40, region: 'Middle East', tags: ['military-jamming', 'maritime-impact', 'intermittent'], correlations: [], metadata: { radius_km: 120, affected_systems: 'GPS', type: 'military_jamming' }, provenance: 'curated-reference' },
  { id: 'gnss_scs', entity_type: 'gnss_spoofing', source: 'C4ADS / SkyTruth', source_url: 'https://c4ads.org/', title: 'South China Sea — Spratly', description: 'AIS and GPS spoofing near Chinese installations.', lat: 10.5, lon: 114.0, altitude: null, velocity: null, heading: null, timestamp: new Date().toISOString(), observed_at: new Date().toISOString(), confidence: 68, severity: 'medium', risk_score: 45, region: 'Indo-Pacific', tags: ['spoofing', 'maritime-impact', 'intermittent'], correlations: [], metadata: { radius_km: 200, affected_systems: 'GPS + BeiDou', type: 'spoofing' }, provenance: 'curated-reference' },
  { id: 'gnss_emed', entity_type: 'gnss_spoofing', source: 'C4ADS', source_url: 'https://c4ads.org/', title: 'Eastern Mediterranean', description: 'GPS spoofing affecting shipping near Cyprus/Lebanon.', lat: 34.5, lon: 33.5, altitude: null, velocity: null, heading: null, timestamp: new Date().toISOString(), observed_at: new Date().toISOString(), confidence: 72, severity: 'medium', risk_score: 50, region: 'Europe', tags: ['spoofing', 'maritime-impact'], correlations: [], metadata: { radius_km: 350, affected_systems: 'GPS', type: 'spoofing' }, provenance: 'curated-reference' },
]

app.get('/api/gnss/anomalies', async (c) => {
  // ── 1. Attempt live heatmap fetch from gpsjam.org (best-effort) ──────────────
  let gpsjamEvents: CanonicalEvent[] = []
  try {
    const heatmapData = await safeJson('https://gpsjam.org/api/v1/heatmap', {}, 8000)
    if (heatmapData && Array.isArray(heatmapData.data)) {
      gpsjamEvents = heatmapData.data
        .filter((pt: any) => pt.lat !== undefined && pt.lon !== undefined && (pt.level ?? 0) > 1)
        .slice(0, 50)
        .map((pt: any, i: number) => evt({
          id: `gpsjam_live_${i}`,
          entity_type: pt.level >= 3 ? 'gnss_jamming' : 'gnss_anomaly',
          source: 'GPSJam.org (live heatmap)',
          source_url: 'https://gpsjam.org/',
          title: `GPSJam Live: interference level ${pt.level ?? '?'} at (${pt.lat.toFixed(2)}, ${pt.lon.toFixed(2)})`,
          description: `ADS-B derived GNSS interference. Level ${pt.level ?? '?'}/5.`,
          lat: pt.lat,
          lon: pt.lon,
          timestamp: pt.time || new Date().toISOString(),
          observed_at: pt.time || new Date().toISOString(),
          confidence: 60,
          severity: (pt.level ?? 0) >= 4 ? 'high' : 'medium',
          risk_score: Math.min(100, (pt.level ?? 1) * 20),
          tags: ['gnss-live', 'gpsjam', 'adsb-derived'],
          provenance: 'direct-api',
          metadata: { level: pt.level, raw: pt },
        }))
    }
  } catch {
    // GPSJam live API is optional — proceed with curated zones only
  }

  // ── 2. Enrich with GDELT GNSS-related news (best-effort) ────────────────────
  let newsEvents: CanonicalEvent[] = []
  try {
    const data = await fetchGDELT('https://api.gdeltproject.org/api/v2/doc/doc?query=GPS+jamming+spoofing+GNSS+interference+navigation&mode=artlist&maxrecords=15&format=json&timespan=72h&sourcelang=english')
    if (data?.articles) {
      newsEvents = data.articles.slice(0, 10).map((art: any, i: number) => {
        const geo = geocodeFromText(art.title || '')
        if (!geo) return null
        return evt({
          id: `gnss_news_${i}`, entity_type: 'gnss_news', source: 'GDELT', source_url: art.url || '',
          title: art.title || '', lat: geo.lat, lon: geo.lon, region: geo.region,
          timestamp: art.seendate || '', confidence: geo.confidence, severity: 'info',
          tags: ['gnss', 'news', geo.matched], provenance: 'geocoded-inferred',
          metadata: { domain: art.domain, matched_location: geo.matched }
        })
      }).filter(Boolean) as CanonicalEvent[]
    }
  } catch { /* GDELT enrichment is optional */ }

  return c.json({
    events: [...GNSS_ZONES, ...gpsjamEvents, ...newsEvents],
    zones: GNSS_ZONES.length,
    live: gpsjamEvents.length,
    news: newsEvents.length,
    source: 'gnss-reference-model',
    sources_info: [
      { name: 'GPSJam.org', url: 'https://gpsjam.org/', free: true, key_required: false, description: 'Daily ADS-B-based GPS interference maps + live heatmap API' },
      { name: 'Eurocontrol', url: 'https://www.eurocontrol.int/', free: true, key_required: false, description: 'European GNSS interference reports' },
      { name: 'C4ADS', url: 'https://c4ads.org/', free: true, key_required: false, description: 'GPS spoofing research' },
      { name: 'EASA', url: 'https://www.easa.europa.eu/', free: true, key_required: false, description: 'Aviation safety bulletins' },
    ],
    note: 'GNSS anomaly data combines a curated reference model with best-effort live data from GPSJam.org. No free real-time GNSS API is guaranteed available.'
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// SOCIAL INTEL — Reddit public JSON
// No key required for public subreddits. Rate limits apply.
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
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SentinelOS/7.0; +https://github.com/MSA-83/SENTINEL-X)' }
      }, 10000).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      }).then((data: any) => {
        return (data?.data?.children || []).map((child: any) => {
          const p = child.data
          if (!p) return null
          // Media extraction
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
            }
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
    note: 'Reddit public JSON API. No authentication required. Locations are inferred from post titles and marked as low-confidence.'
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// SOCIAL INTEL — Mastodon public timelines
// Fetches OSINT/conflict/cybersecurity hashtags from mastodon.social (no key).
// ═══════════════════════════════════════════════════════════════════════════════

/** Mastodon instance / hashtag pairs to poll */
const MASTODON_FEEDS = [
  { instance: 'mastodon.social', tag: 'osint' },
  { instance: 'mastodon.social', tag: 'ukraine' },
  { instance: 'mastodon.social', tag: 'cybersecurity' },
  { instance: 'infosec.exchange', tag: 'infosec' },
  { instance: 'infosec.exchange', tag: 'malware' },
]

app.get('/api/social/mastodon', async (c) => {
  const allEvents: CanonicalEvent[] = []

  const results = await Promise.allSettled(
    MASTODON_FEEDS.map(feed => {
      const url = `https://${feed.instance}/api/v1/timelines/tag/${encodeURIComponent(feed.tag)}?limit=20`
      return safeFetch(url, {
        headers: { 'User-Agent': UA, 'Accept': 'application/json' }
      }, 10000)
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          return r.json()
        })
        .then((statuses: any[]) => {
          return statuses.map((s: any, i: number) => {
            // Strip HTML tags from content for plain text
            const plainText = (s.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300)
            const geo = geocodeFromText(plainText)
            return evt({
              id: `mastodon_${feed.instance}_${feed.tag}_${s.id || i}`,
              entity_type: 'social_post',
              source: `Mastodon ${feed.instance} #${feed.tag}`,
              source_url: s.url || `https://${feed.instance}`,
              title: plainText.slice(0, 160) || `#${feed.tag} post`,
              description: plainText,
              lat: geo?.lat ?? null,
              lon: geo?.lon ?? null,
              region: geo?.region || '',
              timestamp: s.created_at || new Date().toISOString(),
              observed_at: s.created_at || new Date().toISOString(),
              confidence: geo ? geo.confidence : 0,
              severity: 'info',
              tags: [feed.tag, 'mastodon', ...(s.tags || []).map((t: any) => t.name || '').filter(Boolean)].slice(0, 10),
              provenance: geo ? 'geocoded-inferred' : 'no-location',
              metadata: {
                instance: feed.instance,
                hashtag: feed.tag,
                account: s.account?.acct || '',
                display_name: s.account?.display_name || '',
                replies_count: s.replies_count || 0,
                reblogs_count: s.reblogs_count || 0,
                favourites_count: s.favourites_count || 0,
                media_attachments: (s.media_attachments || []).map((m: any) => ({ type: m.type, url: m.url || m.remote_url || '' })).slice(0, 3),
                matched_location: geo?.matched || null,
                geolocation_method: geo ? 'text-inference' : 'none',
              },
            })
          }).filter(Boolean) as CanonicalEvent[]
        })
        .catch(() => [] as CanonicalEvent[])
    })
  )

  results.forEach(r => { if (r.status === 'fulfilled') allEvents.push(...r.value) })
  // Deduplicate by id in case of cross-instance reposts
  const seen = new Set<string>()
  const deduped = allEvents.filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true })
  // Sort by timestamp descending
  deduped.sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1))

  const geolocated = deduped.filter(e => e.lat !== null)

  return c.json({
    events: deduped.slice(0, 80),
    total: deduped.length,
    geolocated: geolocated.length,
    feeds: MASTODON_FEEDS.length,
    source: 'mastodon-public',
    note: 'Mastodon public hashtag timelines. No authentication required. Locations are inferred from post text and marked as low-confidence.',
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
// Accepts optional `since` query param (ISO date string) to filter zones whose
// base_threat was last "updated" after that timestamp. Since FUSION_ZONES are
// static, the since filter is applied to a synthetic updated_at field derived
// from the server start time for forward-compatibility with dynamic data.
// ═══════════════════════════════════════════════════════════════════════════════
const SERVER_START = new Date().toISOString()

app.get('/api/fusion/viewport', (c) => {
  const latMin = parseFloat(c.req.query('latMin') || '-90')
  const latMax = parseFloat(c.req.query('latMax') || '90')
  const lonMin = parseFloat(c.req.query('lonMin') || '-180')
  const lonMax = parseFloat(c.req.query('lonMax') || '180')
  const since = c.req.query('since') || null   // ISO date — optional time-range filter

  let visible = FUSION_ZONES.filter(z =>
    z.lat >= latMin && z.lat <= latMax && z.lon >= lonMin && z.lon <= lonMax
  )

  // Apply since filter — for curated static zones we treat their effective
  // "observed_at" as the server start time. Dynamic data pipelines should
  // attach their own timestamps.
  if (since) {
    try {
      const sinceDate = new Date(since)
      if (!isNaN(sinceDate.getTime())) {
        const serverStartDate = new Date(SERVER_START)
        // If since is after server start the static zones have no "new" data
        if (sinceDate > serverStartDate) {
          visible = []
        }
        // Otherwise all visible zones qualify (they were "loaded" at server start)
      }
    } catch { /* ignore invalid since param */ }
  }

  return c.json({
    zones: visible,
    total: FUSION_ZONES.length,
    visible: visible.length,
    since: since || null,
    server_start: SERVER_START,
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// HEALTH + STATUS
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/health', (c) => c.json({
  status: 'operational', version: VERSION, codename: 'SENTINEL OS',
  timestamp: new Date().toISOString(),
  domains: ['aviation', 'maritime', 'orbital', 'seismic', 'wildfire', 'weather', 'conflict', 'disaster', 'cyber', 'nuclear', 'gnss', 'social', 'imagery'],
}))

app.get('/api/status', (c) => {
  const keyNames: (keyof Bindings)[] = ['NASA_FIRMS_KEY', 'OWM_KEY', 'N2YO_KEY', 'GFW_TOKEN', 'AVWX_KEY', 'RAPIDAPI_KEY', 'SHODAN_KEY', 'NEWS_API_KEY', 'AISSTREAM_KEY', 'OTX_KEY', 'ACLED_KEY', 'ACLED_EMAIL']
  const keys: Record<string, boolean> = {}
  for (const k of keyNames) keys[k] = !!(c.env[k])
  return c.json({ keys, targets: Object.keys(TARGETS).length, fusion_zones: FUSION_ZONES.length, gnss_zones: GNSS_ZONES.length, geocoding_entries: Object.keys(GEO_DB).length })
})

// ═══════════════════════════════════════════════════════════════════════════════
// HTML SHELL — served at /
// Loads all dependencies sequentially before initialising /static/sentinel.js
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
<meta name="theme-color" content="#0a0e1a">
<meta name="description" content="SENTINEL OS v${VERSION} — Global Multi-Domain Situational Awareness Platform">
<meta name="application-name" content="SENTINEL OS">
<meta property="og:title" content="SENTINEL OS v${VERSION}">
<meta property="og:description" content="Global Multi-Domain Situational Awareness Platform — Aviation · Maritime · Cyber · Conflict · GNSS">
<meta property="og:type" content="website">
<title>SENTINEL OS v${VERSION}</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>&#x1F6F0;</text></svg>">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&family=Orbitron:wght@400;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<!-- Map base styles -->
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css"/>
<!-- noUiSlider — time scrub control -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/noUiSlider/15.7.2/nouislider.min.css"/>
<!-- Application stylesheet -->
<link rel="stylesheet" href="/static/style.css">
</head>
<body>
<div id="map"></div>
<div id="hud"></div>
<div id="inspector"></div>
<!-- Loading screen -->
<div id="loading">
  <div class="load-inner">
    <div class="load-spinner"></div>
    <div class="load-logo">&#x1F6F0;</div>
    <div class="load-text">SENTINEL OS</div>
    <div class="load-version">v${VERSION}</div>
    <div class="load-sub" id="load-status">Initialising...</div>
    <div class="load-bar-wrap"><div class="load-bar" id="load-bar"></div></div>
  </div>
</div>
<script>
// ── Dependency loader ──────────────────────────────────────────────────────────
// Loads all JS dependencies sequentially, then bootstraps /static/sentinel.js.
// Dependencies marked optional:true are silently skipped on failure.
(function(){
  'use strict';
  var SENTINEL_VERSION = '${VERSION}';

  var deps = [
    {
      src: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
      check: function(){ return typeof window.L !== 'undefined'; },
      label: 'Leaflet 1.9.4',
      optional: false
    },
    {
      src: 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js',
      check: function(){ return window.L && typeof L.MarkerClusterGroup !== 'undefined'; },
      label: 'MarkerCluster 1.5.3',
      optional: false
    },
    {
      src: 'https://unpkg.com/satellite.js@5.0.0/dist/satellite.min.js',
      check: function(){ return typeof window.satellite !== 'undefined'; },
      label: 'satellite.js 5.0',
      optional: true
    },
    {
      src: 'https://cdnjs.cloudflare.com/ajax/libs/noUiSlider/15.7.2/nouislider.min.js',
      check: function(){ return typeof window.noUiSlider !== 'undefined'; },
      label: 'noUiSlider 15.7.2',
      optional: true
    },
  ];

  var loaded = 0;
  var total = deps.length;

  function setStatus(msg) {
    var el = document.getElementById('load-status');
    if (el) el.textContent = msg;
  }

  function setProgress(pct) {
    var bar = document.getElementById('load-bar');
    if (bar) bar.style.width = Math.min(100, pct) + '%';
  }

  function loadNext() {
    setProgress(Math.round((loaded / (total + 1)) * 100));
    if (loaded >= total) {
      setStatus('Launching SENTINEL OS v' + SENTINEL_VERSION + '...');
      setProgress(95);
      loadApp();
      return;
    }
    var dep = deps[loaded];
    setStatus('Loading ' + dep.label + ' (' + (loaded + 1) + '/' + total + ')...');

    // Skip if already present (e.g. cached inline)
    if (dep.check()) { loaded++; loadNext(); return; }

    var s = document.createElement('script');
    s.src = dep.src;
    s.onload = function() { loaded++; loadNext(); };
    s.onerror = function() {
      if (dep.optional) {
        console.warn('[SENTINEL] Optional dependency failed (skipped):', dep.label, dep.src);
        loaded++;
        loadNext();
      } else {
        setStatus('\u26A0 Failed to load ' + dep.label + '. Check network and reload.');
        console.error('[SENTINEL] Critical dependency failed:', dep.label, dep.src);
      }
    };
    document.head.appendChild(s);
  }

  function loadApp() {
    var s = document.createElement('script');
    s.src = '/static/sentinel.js?v=' + SENTINEL_VERSION;
    s.onload = function() { setProgress(100); };
    s.onerror = function() {
      setStatus('\u26A0 Failed to load application (sentinel.js). Check /static/sentinel.js exists.');
      console.error('[SENTINEL] Application script failed to load.');
    };
    document.head.appendChild(s);
  }

  // Kick off after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadNext);
  } else {
    loadNext();
  }
})();
<\/script>
</body>
</html>`)
})

export default app
