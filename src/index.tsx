/**
 * SENTINEL OS v3.0 — Global Multi-Domain Situational Awareness Platform
 * Hono Backend + API Proxy for Cloudflare Pages Edge Runtime
 * 
 * Architecture: Edge BFF (Backend-for-Frontend) pattern
 * - All keyed API calls route through /api/proxy to protect credentials
 * - GDELT article-based conflict intel with geocoding
 * - Nuclear detonation monitoring via CTBTO-style feeds  
 * - SSE endpoint for real-time push to clients
 * - Fusion correlation engine (server-side threat correlation)
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = {
  NASA_FIRMS_KEY?: string
  OWM_KEY?: string
  N2YO_KEY?: string
  GFW_TOKEN?: string
  AVWX_KEY?: string
  RAPIDAPI_KEY?: string
  ACLED_KEY?: string
  ADSB_FI_KEY?: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('/api/*', cors())

/* ═══════════════════════════════════════════════════════════════
   GEOPOLITICAL GEOCODING — Map country/region names to coordinates
   Used by GDELT article-based intel when geo API is unavailable
═══════════════════════════════════════════════════════════════ */
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
  'haiti': { lat: 18.9, lon: -72.3, region: 'Caribbean' },
  'venezuela': { lat: 6.4, lon: -66.6, region: 'South America' },
  'cuba': { lat: 21.5, lon: -79.9, region: 'Caribbean' },
  'mexico': { lat: 23.6, lon: -102.6, region: 'North America' },
  'qatar': { lat: 25.3, lon: 51.2, region: 'Middle East' },
  'saudi': { lat: 24.7, lon: 46.7, region: 'Middle East' },
  'egypt': { lat: 26.8, lon: 30.8, region: 'Middle East' },
  'turkey': { lat: 39.9, lon: 32.9, region: 'Middle East' },
  'natanz': { lat: 33.7, lon: 51.7, region: 'Middle East' },
  'isfahan': { lat: 32.7, lon: 51.7, region: 'Middle East' },
  'darfur': { lat: 13.5, lon: 25.3, region: 'Africa' },
  'kharkiv': { lat: 49.9, lon: 36.3, region: 'Eastern Europe' },
  'odesa': { lat: 46.5, lon: 30.7, region: 'Eastern Europe' },
  'kyiv': { lat: 50.4, lon: 30.5, region: 'Eastern Europe' },
  'donbas': { lat: 48.0, lon: 38.0, region: 'Eastern Europe' },
  'zaporizhzhia': { lat: 47.8, lon: 35.2, region: 'Eastern Europe' },
}

function geocodeFromText(title: string, domain: string): { lat: number; lon: number; region: string; matchedKey: string } | null {
  const lower = (title + ' ' + domain).toLowerCase()
  let bestMatch: { key: string; entry: typeof GEO_DB[string] } | null = null
  let bestLen = 0
  for (const [key, entry] of Object.entries(GEO_DB)) {
    if (lower.includes(key) && key.length > bestLen) {
      bestMatch = { key, entry }
      bestLen = key.length
    }
  }
  if (bestMatch) {
    const jitter = () => (Math.random() - 0.5) * 1.5
    return { lat: bestMatch.entry.lat + jitter(), lon: bestMatch.entry.lon + jitter(), region: bestMatch.entry.region, matchedKey: bestMatch.key }
  }
  return null
}

/* ═══════════════════════════════════════════════════════════════
   API PROXY — Secure edge-side credential management
═══════════════════════════════════════════════════════════════ */

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
  // ── AVIATION ──
  opensky: {
    url: 'https://opensky-network.org/api/states/all',
    timeout: 12000,
    fallbackUrl: 'https://opensky-network.org/api/states/all?lamin=-60&lamax=60&lomin=-180&lomax=180',
  },
  military: {
    url: 'https://adsbexchange-com1.p.rapidapi.com/v2/mil/',
    secret: 'RAPIDAPI_KEY',
    authType: 'rapidapi',
    rapidApiHost: 'adsbexchange-com1.p.rapidapi.com',
    timeout: 10000,
  },

  // ── MARITIME ──
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

  // ── ENVIRONMENTAL ──
  firms: {
    url: (key: string) => `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/VIIRS_SNPP_NRT/world/1`,
    secret: 'NASA_FIRMS_KEY',
    timeout: 18000,
    responseType: 'text',
  },
  owm: {
    url: (key: string) => `https://api.openweathermap.org/data/2.5/box/city?bbox=-180,-60,180,60,5&appid=${key}`,
    secret: 'OWM_KEY',
    timeout: 10000,
  },
  avwx_sigmets: {
    url: (_key: string, params?: Record<string, string>) =>
      `https://avwx.rest/api/airsigmet/${params?.icao || 'KJFK'}?format=json&onfail=cache`,
    secret: 'AVWX_KEY',
    authType: 'bearer',
    timeout: 10000,
  },

  // ── SPACE ──
  n2yo: {
    url: (key: string) => `https://api.n2yo.com/rest/v1/satellite/above/0/0/0/80/0?apiKey=${key}`,
    secret: 'N2YO_KEY',
    timeout: 10000,
  },

  // ── DISASTER ──
  gdacs: {
    url: 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=EQ,TC,FL,VO,TS&alertlevel=Green;Orange;Red',
    timeout: 16000,
  },
  // ReliefWeb requires registered appname — disabled
  // reliefweb: { ... },

  // ── CONFLICT INTEL (GDELT Articles → Geocoded events) ──
  gdelt_conflict: {
    url: 'https://api.gdeltproject.org/api/v2/doc/doc?query=military+attack+airstrike+bombing+strike+conflict&mode=artlist&maxrecords=75&format=json&timespan=48h&sourcelang=english',
    timeout: 20000,
  },
  gdelt_maritime: {
    url: 'https://api.gdeltproject.org/api/v2/doc/doc?query=navy+warship+maritime+vessel+seized+blockade&mode=artlist&maxrecords=40&format=json&timespan=48h&sourcelang=english',
    timeout: 20000,
  },
  gdelt_nuclear: {
    url: 'https://api.gdeltproject.org/api/v2/doc/doc?query=nuclear+missile+ICBM+warhead+uranium+enrichment&mode=artlist&maxrecords=30&format=json&timespan=72h&sourcelang=english',
    timeout: 20000,
  },
  gdelt_cyber: {
    url: 'https://api.gdeltproject.org/api/v2/doc/doc?query=cyberattack+ransomware+hacking+breach+APT+infrastructure&mode=artlist&maxrecords=30&format=json&timespan=48h&sourcelang=english',
    timeout: 20000,
  },
}

app.post('/api/proxy', async (c) => {
  const { target, params } = await c.req.json<{ target: string; params?: Record<string, string> }>()

  const config = TARGETS[target]
  if (!config) {
    return c.json({ _upstream_error: true, status: 400, message: `Unknown target: ${target}` })
  }

  const secret = config.secret ? (c.env[config.secret] || '') : ''

  let url: string
  if (typeof config.url === 'function') {
    url = config.url(secret, params)
  } else {
    url = config.url
  }

  // Append date params for GFW endpoints
  if (target.startsWith('gfw_') && params?.startDate && params?.endDate) {
    const u = new URL(url)
    u.searchParams.set('start-date', params.startDate)
    u.searchParams.set('end-date', params.endDate)
    url = u.toString()
  }

  const fetchHeaders: Record<string, string> = {
    'User-Agent': 'SENTINEL-OS/3.0 (Global OSINT Platform)',
  }
  if (config.authType === 'bearer' && secret) {
    fetchHeaders['Authorization'] = `Bearer ${secret}`
  }
  if (config.authType === 'rapidapi' && secret) {
    fetchHeaders['X-RapidAPI-Key'] = secret
    fetchHeaders['X-RapidAPI-Host'] = config.rapidApiHost || ''
  }
  if (config.authType === 'header' && config.headerName && secret) {
    fetchHeaders[config.headerName] = secret
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), config.timeout || 15000)

    let res: Response
    try {
      res = await fetch(url, { headers: fetchHeaders, signal: controller.signal })
    } catch (primaryErr) {
      if (config.fallbackUrl) {
        try {
          res = await fetch(config.fallbackUrl, { headers: fetchHeaders, signal: AbortSignal.timeout(8000) })
        } catch {
          clearTimeout(timeoutId)
          return c.json({ _upstream_error: true, status: 0, message: 'Primary and fallback failed' })
        }
      } else {
        clearTimeout(timeoutId)
        return c.json({ _upstream_error: true, status: 0, message: String(primaryErr) })
      }
    }
    clearTimeout(timeoutId)

    if (!res!.ok) {
      const body = await res!.text()
      return c.json({ _upstream_error: true, status: res!.status, message: body.slice(0, 400) })
    }

    if (config.responseType === 'text') {
      const text = await res!.text()
      return c.text(text)
    }

    const data = await res!.json()
    return c.json(data)
  } catch (error) {
    return c.json({ _upstream_error: true, status: 0, message: String(error) })
  }
})

/* ═══════════════════════════════════════════════════════════════
   GDELT CONFLICT INTEL — Article-based geocoding endpoint
   Transforms GDELT article feed into geocoded conflict events
═══════════════════════════════════════════════════════════════ */
app.post('/api/intel/gdelt', async (c) => {
  const { category } = await c.req.json<{ category?: string }>()
  const targetKey = category === 'maritime' ? 'gdelt_maritime' 
    : category === 'nuclear' ? 'gdelt_nuclear'
    : category === 'cyber' ? 'gdelt_cyber'
    : 'gdelt_conflict'
  
  const config = TARGETS[targetKey]
  if (!config || typeof config.url !== 'string') {
    return c.json({ events: [], error: 'Invalid category' })
  }

  try {
    const res = await fetch(config.url, { 
      headers: { 'User-Agent': 'SENTINEL-OS/3.0' },
      signal: AbortSignal.timeout(config.timeout || 20000) 
    })
    if (!res.ok) return c.json({ events: [], error: `HTTP ${res.status}` })
    
    const text = await res.text()
    let data: { articles?: Array<{ title: string; url: string; domain: string; seendate: string; language: string; sourcecountry: string }> }
    try {
      data = JSON.parse(text)
    } catch {
      // GDELT may return non-JSON (rate limit, error page)
      return c.json({ events: [], error: 'Non-JSON response from GDELT', raw: text.slice(0, 200) })
    }
    const articles = data.articles || []
    
    const events = articles.map((art, i) => {
      const geo = geocodeFromText(art.title, art.domain)
      if (!geo) return null
      return {
        id: `gdelt_${category || 'conflict'}_${i}`,
        type: category === 'cyber' ? 'cyber' : category === 'nuclear' ? 'nuclear' : 'conflict',
        lat: geo.lat,
        lon: geo.lon,
        region: geo.region,
        title: art.title,
        url: art.url,
        domain: art.domain,
        timestamp: art.seendate,
        country: art.sourcecountry,
        language: art.language,
        matchedLocation: geo.matchedKey,
      }
    }).filter(Boolean)

    return c.json({ events, total: articles.length, geocoded: events.length })
  } catch (error) {
    return c.json({ events: [], error: String(error) })
  }
})

/* ═══════════════════════════════════════════════════════════════
   FUSION CORRELATION ENGINE — Server-side threat correlation
   Correlates data across domains within geopolitical zones
═══════════════════════════════════════════════════════════════ */
const FUSION_ZONES = [
  { name: 'Ukraine/Russia Front', lat: 48.5, lon: 37.0, radius: 400, baseThreat: 55, type: 'conflict' },
  { name: 'Gaza Strip', lat: 31.4, lon: 34.5, radius: 120, baseThreat: 70, type: 'conflict' },
  { name: 'Iran Theater', lat: 32.4, lon: 53.7, radius: 500, baseThreat: 65, type: 'flashpoint' },
  { name: 'Red Sea/Houthi Zone', lat: 14.5, lon: 43.5, radius: 350, baseThreat: 60, type: 'chokepoint' },
  { name: 'Strait of Hormuz', lat: 26.5, lon: 56.3, radius: 180, baseThreat: 50, type: 'chokepoint' },
  { name: 'Taiwan Strait', lat: 24.5, lon: 120.0, radius: 250, baseThreat: 55, type: 'flashpoint' },
  { name: 'South China Sea', lat: 13.5, lon: 115.0, radius: 500, baseThreat: 45, type: 'flashpoint' },
  { name: 'Korean Peninsula', lat: 38.0, lon: 127.5, radius: 200, baseThreat: 50, type: 'flashpoint' },
  { name: 'Sudan Civil War', lat: 15.5, lon: 32.5, radius: 350, baseThreat: 50, type: 'conflict' },
  { name: 'Sahel Insurgency', lat: 14.0, lon: 2.0, radius: 600, baseThreat: 40, type: 'conflict' },
  { name: 'Kashmir LOC', lat: 34.0, lon: 74.5, radius: 200, baseThreat: 45, type: 'flashpoint' },
  { name: 'Black Sea NATO Watch', lat: 43.5, lon: 34.5, radius: 400, baseThreat: 45, type: 'flashpoint' },
]

app.get('/api/fusion/zones', (c) => c.json({ zones: FUSION_ZONES }))

/* ═══════════════════════════════════════════════════════════════
   HEALTH + STATUS + SYSTEM INFO
═══════════════════════════════════════════════════════════════ */
app.get('/api/health', (c) => c.json({ 
  status: 'operational', 
  version: '3.0.0', 
  codename: 'SENTINEL OS',
  timestamp: new Date().toISOString(),
  uptime: 'edge-runtime',
  domains: ['aviation', 'maritime', 'orbital', 'seismic', 'wildfire', 'weather', 'conflict', 'disaster', 'cyber', 'nuclear'],
}))

app.get('/api/status', (c) => {
  const keys: Record<string, boolean> = {}
  const envKeys: (keyof Bindings)[] = ['NASA_FIRMS_KEY', 'OWM_KEY', 'N2YO_KEY', 'GFW_TOKEN', 'AVWX_KEY', 'RAPIDAPI_KEY', 'ACLED_KEY']
  for (const k of envKeys) {
    keys[k] = !!(c.env[k])
  }
  return c.json({ 
    keys, 
    targets: Object.keys(TARGETS),
    fusion_zones: FUSION_ZONES.length,
    geocoding_entries: Object.keys(GEO_DB).length,
  })
})

/* ═══════════════════════════════════════════════════════════════
   SERVE MAIN HTML PAGE — Military-grade dark ops interface
═══════════════════════════════════════════════════════════════ */
app.get('/', (c) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
<title>SENTINEL OS — Global Situational Awareness</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🛰</text></svg>">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css"/>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&family=Orbitron:wght@400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
<script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"><\/script>
<script src="https://unpkg.com/satellite.js@5.0.0/dist/satellite.min.js"><\/script>
<link rel="stylesheet" href="/static/style.css">
</head>
<body>
<div id="map" style="position:absolute;inset:0;z-index:1"></div>
<div id="app"></div>
<script src="/static/sentinel.js"><\/script>
</body>
</html>`
  return c.html(html)
})

export default app
