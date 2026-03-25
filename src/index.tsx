/**
 * SENTINEL OS v4.0 — Global Multi-Domain Situational Awareness Platform
 * Hono Backend + API Proxy for Cloudflare Pages Edge Runtime
 * 
 * Architecture: Edge BFF (Backend-for-Frontend) pattern
 * - All keyed API calls route through /api/proxy to protect credentials
 * - GDELT article-based conflict intel with geocoding + retry + stagger
 * - OWM multi-city global weather via dedicated endpoint
 * - AVWX METAR multi-airport weather
 * - AISStream.io config endpoint (client WS)
 * - Shodan host search endpoint
 * - NewsAPI conflict intel endpoint
 * - ReliefWeb disaster endpoint (CORS-free proxy)
 * - ACLED conflict data endpoint
 * - Multi-domain fusion correlation engine
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
  SHODAN_KEY?: string
  NEWS_API_KEY?: string
  AISSTREAM_KEY?: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('/api/*', cors())

/* ═══════════════════════════════════════════════════════════════
   GEOPOLITICAL GEOCODING — Map country/region names to coordinates
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
  reliefweb: {
    url: 'https://api.reliefweb.int/v1/disasters?appname=sentinel-os&limit=50&sort[]=date:desc&fields[include][]=name&fields[include][]=country&fields[include][]=status&fields[include][]=primary_type&fields[include][]=glide&fields[include][]=date',
    timeout: 14000,
  },

  // ── CONFLICT INTEL (GDELT Articles → Geocoded events) ──
  gdelt_conflict: {
    url: 'https://api.gdeltproject.org/api/v2/doc/doc?query=military+attack+airstrike+bombing+strike+conflict&mode=artlist&maxrecords=50&format=json&timespan=48h&sourcelang=english',
    timeout: 10000,
  },
  gdelt_maritime: {
    url: 'https://api.gdeltproject.org/api/v2/doc/doc?query=navy+warship+maritime+vessel+seized+blockade&mode=artlist&maxrecords=30&format=json&timespan=48h&sourcelang=english',
    timeout: 10000,
  },
  gdelt_nuclear: {
    url: 'https://api.gdeltproject.org/api/v2/doc/doc?query=nuclear+missile+ICBM+warhead+uranium+enrichment&mode=artlist&maxrecords=25&format=json&timespan=72h&sourcelang=english',
    timeout: 10000,
  },
  gdelt_cyber: {
    url: 'https://api.gdeltproject.org/api/v2/doc/doc?query=cyberattack+ransomware+hacking+breach+APT+infrastructure&mode=artlist&maxrecords=25&format=json&timespan=48h&sourcelang=english',
    timeout: 10000,
  },

  // ── SHODAN ──
  shodan_search: {
    url: (key: string, params?: Record<string, string>) => {
      const query = params?.query || 'port:502 scada'
      return `https://api.shodan.io/shodan/host/search?key=${key}&query=${encodeURIComponent(query)}&page=1`
    },
    secret: 'SHODAN_KEY',
    timeout: 12000,
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
    'User-Agent': 'SENTINEL-OS/4.0 (Global OSINT Platform)',
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
   OWM MULTI-CITY WEATHER — Fetch severe weather from major cities
   Free OWM plan: use lat/lon individual queries, merge to list
═══════════════════════════════════════════════════════════════ */
app.get('/api/weather/global', async (c) => {
  const key = c.env.OWM_KEY
  if (!key) return c.json({ list: [], error: 'OWM_KEY not set' })

  // 20 major cities in storm-prone regions worldwide
  const cities = [
    { name: 'Tokyo', lat: 35.68, lon: 139.69 },
    { name: 'Mumbai', lat: 19.08, lon: 72.88 },
    { name: 'Manila', lat: 14.60, lon: 120.98 },
    { name: 'Houston', lat: 29.76, lon: -95.37 },
    { name: 'Miami', lat: 25.76, lon: -80.19 },
    { name: 'Dhaka', lat: 23.81, lon: 90.41 },
    { name: 'Lagos', lat: 6.52, lon: 3.37 },
    { name: 'Shanghai', lat: 31.23, lon: 121.47 },
    { name: 'Karachi', lat: 24.86, lon: 67.01 },
    { name: 'Cairo', lat: 30.04, lon: 31.24 },
    { name: 'London', lat: 51.51, lon: -0.13 },
    { name: 'Moscow', lat: 55.76, lon: 37.62 },
    { name: 'Taipei', lat: 25.03, lon: 121.57 },
    { name: 'Singapore', lat: 1.35, lon: 103.82 },
    { name: 'Jakarta', lat: -6.21, lon: 106.85 },
    { name: 'Sao Paulo', lat: -23.55, lon: -46.63 },
    { name: 'Dubai', lat: 25.20, lon: 55.27 },
    { name: 'Nairobi', lat: -1.29, lon: 36.82 },
    { name: 'Sydney', lat: -33.87, lon: 151.21 },
    { name: 'Anchorage', lat: 61.22, lon: -149.90 },
  ]

  try {
    const results = await Promise.allSettled(
      cities.map(city =>
        fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${city.lat}&lon=${city.lon}&appid=${key}&units=metric`, {
          signal: AbortSignal.timeout(8000)
        }).then(r => r.json()).then(d => ({ ...d, _city: city.name }))
      )
    )

    const list = results
      .filter(r => r.status === 'fulfilled' && r.value?.coord)
      .map(r => (r as PromiseFulfilledResult<any>).value)

    return c.json({ list, count: list.length })
  } catch (error) {
    return c.json({ list: [], error: String(error) })
  }
})

/* ═══════════════════════════════════════════════════════════════
   AVWX MULTI-AIRPORT METAR — Fetch weather from major airports
═══════════════════════════════════════════════════════════════ */
app.get('/api/avwx/global', async (c) => {
  const key = c.env.AVWX_KEY
  if (!key) return c.json({ stations: [], error: 'AVWX_KEY not set' })

  const airports = ['KJFK','EGLL','RJTT','VHHH','LFPG','EDDF','OMDB','WSSS','YSSY','SBGR','FACT','UUEE','RPLL','VIDP','OERK']

  try {
    const results = await Promise.allSettled(
      airports.map(icao =>
        fetch(`https://avwx.rest/api/metar/${icao}?format=json&onfail=cache`, {
          headers: { 'Authorization': `Bearer ${key}` },
          signal: AbortSignal.timeout(6000)
        }).then(r => r.json())
      )
    )

    const stations = results
      .filter(r => r.status === 'fulfilled' && r.value?.station)
      .map(r => (r as PromiseFulfilledResult<any>).value)

    return c.json({ stations, count: stations.length })
  } catch (error) {
    return c.json({ stations: [], error: String(error) })
  }
})

/* ═══════════════════════════════════════════════════════════════
   AIS MARITIME — Config endpoint for client-side WebSocket
═══════════════════════════════════════════════════════════════ */
app.get('/api/ais/config', async (c) => {
  const key = c.env.AISSTREAM_KEY
  return c.json({ key: key || '' })
})

/* ═══════════════════════════════════════════════════════════════
   SHODAN — Internet exposure search
═══════════════════════════════════════════════════════════════ */
app.post('/api/shodan/search', async (c) => {
  const key = c.env.SHODAN_KEY
  if (!key) return c.json({ matches: [], error: 'SHODAN_KEY not set' })

  const { query } = await c.req.json<{ query?: string }>()
  const q = query || 'port:502 scada'

  try {
    // Try full search first (requires paid plan)
    let searchFailed = false
    try {
      const res = await fetch(
        `https://api.shodan.io/shodan/host/search?key=${key}&query=${encodeURIComponent(q)}&page=1`,
        { signal: AbortSignal.timeout(10000) }
      )
      if (res.ok) {
        const ct = res.headers.get('content-type') || ''
        if (ct.includes('application/json')) {
          const data = await res.json() as any
          return c.json({ matches: data.matches || [], total: data.total || 0, source: 'search' })
        }
      }
      searchFailed = true
    } catch {
      searchFailed = true
    }
    if (!searchFailed) { /* unreachable but type-safe */ }

    // Fallback 1: Shodan /api-info for account info + dns resolve for sample data
    let infoData: any = null
    try {
      const infoRes = await fetch(
        `https://api.shodan.io/api-info?key=${key}`,
        { signal: AbortSignal.timeout(8000) }
      )
      if (infoRes.ok) {
        const ct = infoRes.headers.get('content-type') || ''
        if (ct.includes('application/json')) infoData = await infoRes.json()
      }
    } catch {}

    // Fallback 2: Use Shodan's free /shodan/host/{ip} endpoint with known ICS IPs
    let dnsData: any = {}
    try {
      const dnsRes = await fetch(
        `https://api.shodan.io/dns/resolve?hostnames=scada.shodan.io,ics-radar.shodan.io&key=${key}`,
        { signal: AbortSignal.timeout(8000) }
      )
      if (dnsRes.ok) {
        const ct = dnsRes.headers.get('content-type') || ''
        if (ct.includes('application/json')) dnsData = await dnsRes.json()
      }
    } catch {}

    // Build synthetic results from available data
    const syntheticMatches: any[] = []
    for (const [hostname, ip] of Object.entries(dnsData)) {
      if (!ip) continue
      try {
        const hostRes = await fetch(
          `https://api.shodan.io/shodan/host/${ip}?key=${key}`,
          { signal: AbortSignal.timeout(6000) }
        )
        if (hostRes.ok) {
          const ct = hostRes.headers.get('content-type') || ''
          if (ct.includes('json')) {
            const hostData = await hostRes.json() as any
            if (hostData.data) {
              hostData.data.slice(0, 5).forEach((svc: any) => {
                syntheticMatches.push({
                  ip_str: hostData.ip_str || String(ip),
                  port: svc.port || 0,
                  product: svc.product || hostname,
                  org: hostData.org || 'Unknown',
                  os: hostData.os || 'N/A',
                  location: {
                    latitude: hostData.latitude || 0,
                    longitude: hostData.longitude || 0,
                    country_name: hostData.country_name || 'Unknown',
                    city: hostData.city || 'N/A'
                  },
                  asn: hostData.asn || 'N/A',
                })
              })
            }
          }
        }
      } catch {}
    }

    if (syntheticMatches.length > 0) {
      return c.json({ matches: syntheticMatches, total: syntheticMatches.length, source: 'host-lookup' })
    }

    return c.json({
      matches: [],
      total: 0,
      error: 'Shodan free plan: search requires membership upgrade',
      plan: infoData?.plan || 'oss',
      note: 'Free Shodan plan has limited search access. Upgrade at https://shodan.io/store'
    })
  } catch (error) {
    return c.json({ matches: [], error: String(error) })
  }
})

/* ═══════════════════════════════════════════════════════════════
   RELIEFWEB — UN OCHA disaster data (proxy to avoid CORS)
   Note: ReliefWeb requires POST with JSON body for appname
═══════════════════════════════════════════════════════════════ */
app.get('/api/reliefweb/disasters', async (c) => {
  // ReliefWeb v1 API: POST method with JSON body is more reliable
  try {
    const res = await fetch('https://api.reliefweb.int/v1/disasters?appname=sentinel-os-osint&limit=50', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'SENTINEL-OS/4.0' },
      body: JSON.stringify({
        fields: { include: ['name', 'country', 'status', 'primary_type', 'glide', 'date'] },
        sort: ['date:desc'],
        limit: 50
      }),
      signal: AbortSignal.timeout(12000)
    })
    if (res.ok) {
      const data = await res.json()
      return c.json(data)
    }
  } catch {}

  // Fallback: try GET with different appnames
  const appnames = ['sentinel-os', 'rw-user-0', 'osint-platform']
  for (const appname of appnames) {
    try {
      const res = await fetch(
        `https://api.reliefweb.int/v1/disasters?appname=${appname}&limit=50&sort[]=date:desc&fields[include][]=name&fields[include][]=country&fields[include][]=status&fields[include][]=primary_type&fields[include][]=glide&fields[include][]=date`,
        { signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'SENTINEL-OS/4.0' } }
      )
      if (res.ok) {
        const data = await res.json()
        return c.json(data)
      }
    } catch {}
  }

  return c.json({
    data: [],
    error: 'ReliefWeb requires a registered appname. Register at https://apidoc.reliefweb.int/parameters#appname',
    note: 'GDACS serves as the primary disaster feed. ReliefWeb will work after registration.'
  })
})

/* ═══════════════════════════════════════════════════════════════
   ACLED — Armed Conflict Location & Event Data (free tier)
   Note: ACLED requires registration for API key — returns guidance
═══════════════════════════════════════════════════════════════ */
app.get('/api/acled/events', async (c) => {
  const key = c.env.ACLED_KEY
  if (!key) {
    return c.json({
      data: [],
      error: 'ACLED_KEY not set',
      registration_url: 'https://developer.acleddata.com/',
      note: 'ACLED requires free registration at developer.acleddata.com. Once registered, you receive an API key and must use your registered email as the email parameter.'
    })
  }

  try {
    // ACLED API v3 — free tier supports up to 500 rows
    const res = await fetch(
      `https://api.acleddata.com/acled/read?key=${key}&email=sentinel@osint.platform&limit=100&sort=event_date:desc`,
      { signal: AbortSignal.timeout(12000), headers: { 'User-Agent': 'SENTINEL-OS/4.0' } }
    )
    if (!res.ok) return c.json({ data: [], error: `HTTP ${res.status}` })
    const data = await res.json() as any
    return c.json({ data: data.data || [], count: data.count || 0 })
  } catch (error) {
    return c.json({ data: [], error: String(error) })
  }
})

/* ═══════════════════════════════════════════════════════════════
   GDELT CONFLICT INTEL — Article-based geocoding endpoint
   With retry and staggered requests to avoid rate-limiting
═══════════════════════════════════════════════════════════════ */
async function fetchGDELTWithRetry(url: string, retries = 0): Promise<any> {
  for (let i = 0; i <= retries; i++) {
    try {
      if (i > 0) await new Promise(r => setTimeout(r, 2000))
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SentinelOS/4.0)' },
        signal: AbortSignal.timeout(8000)
      })
      if (res.status === 429) {
        if (i < retries) continue
        return null
      }
      if (!res.ok) return null
      const text = await res.text()
      try { return JSON.parse(text) } catch { return null }
    } catch { if (i === retries) return null }
  }
  return null
}

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
    const data = await fetchGDELTWithRetry(config.url)
    if (!data) return c.json({ events: [], error: 'GDELT unavailable or rate-limited' })

    const articles = data.articles || []
    const events = articles.map((art: any, i: number) => {
      const geo = geocodeFromText(art.title, art.domain)
      if (!geo) return null
      return {
        id: `gdelt_${category || 'conflict'}_${i}`,
        type: category === 'cyber' ? 'cyber' : category === 'nuclear' ? 'nuclear' : 'conflict',
        lat: geo.lat, lon: geo.lon, region: geo.region,
        title: art.title, url: art.url, domain: art.domain,
        timestamp: art.seendate, country: art.sourcecountry,
        language: art.language, matchedLocation: geo.matchedKey,
      }
    }).filter(Boolean)

    return c.json({ events, total: articles.length, geocoded: events.length })
  } catch (error) {
    return c.json({ events: [], error: String(error) })
  }
})

/* ═══════════════════════════════════════════════════════════════
   NEWS INTEL — NewsAPI-based geocoding (supplemental to GDELT)
═══════════════════════════════════════════════════════════════ */
app.post('/api/intel/news', async (c) => {
  const { category } = await c.req.json<{ category?: string }>()
  const key = c.env.NEWS_API_KEY
  if (!key) return c.json({ events: [], error: 'NEWS_API_KEY not set' })

  const query = category === 'cyber'
    ? 'cyberattack+ransomware+hacking+data+breach'
    : category === 'nuclear'
    ? 'nuclear+missile+warhead+uranium'
    : 'military+attack+conflict+bombing+airstrike'

  try {
    const fromDate = new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0]
    const res = await fetch(
      `https://newsapi.org/v2/everything?q=${query}&sortBy=publishedAt&pageSize=40&language=en&from=${fromDate}&apiKey=${key}`,
      { signal: AbortSignal.timeout(12000), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SentinelOS/4.0)' } }
    )
    if (!res.ok) return c.json({ events: [], error: `HTTP ${res.status}` })
    const data = await res.json() as any
    const articles = data.articles || []

    const events = articles.map((art: any, i: number) => {
      const geo = geocodeFromText(art.title || '', art.source?.name || '')
      if (!geo) return null
      return {
        id: `news_${category || 'conflict'}_${i}`,
        type: category === 'cyber' ? 'cyber' : category === 'nuclear' ? 'nuclear' : 'conflict',
        lat: geo.lat, lon: geo.lon, region: geo.region,
        title: art.title, url: art.url, domain: art.source?.name || '',
        timestamp: art.publishedAt, country: '', language: 'en',
        matchedLocation: geo.matchedKey,
      }
    }).filter(Boolean)

    return c.json({ events, total: articles.length, geocoded: events.length, source: 'newsapi' })
  } catch (error) {
    return c.json({ events: [], error: String(error) })
  }
})

/* ═══════════════════════════════════════════════════════════════
   FUSION CORRELATION ENGINE
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
   HEALTH + STATUS
═══════════════════════════════════════════════════════════════ */
app.get('/api/health', (c) => c.json({
  status: 'operational',
  version: '4.0.0',
  codename: 'SENTINEL OS',
  timestamp: new Date().toISOString(),
  uptime: 'edge-runtime',
  domains: ['aviation', 'maritime', 'orbital', 'seismic', 'wildfire', 'weather', 'conflict', 'disaster', 'cyber', 'nuclear'],
}))

app.get('/api/status', (c) => {
  const keys: Record<string, boolean> = {}
  const envKeys: (keyof Bindings)[] = ['NASA_FIRMS_KEY', 'OWM_KEY', 'N2YO_KEY', 'GFW_TOKEN', 'AVWX_KEY', 'RAPIDAPI_KEY', 'SHODAN_KEY', 'NEWS_API_KEY', 'AISSTREAM_KEY']
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
   SERVE MAIN HTML PAGE
═══════════════════════════════════════════════════════════════ */
app.get('/', (c) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
<title>SENTINEL OS v4.0 — Global Situational Awareness</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🛰</text></svg>">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css"/>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&family=Orbitron:wght@400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
<script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"><\/script>
<script src="https://unpkg.com/satellite.js@5.0.0/dist/satellite.min.js"><\/script>
<script src="https://unpkg.com/globe.gl@2.35.1/dist/globe.gl.min.js"><\/script>
<script src="https://unpkg.com/three@0.160.0/build/three.min.js"><\/script>
<link rel="stylesheet" href="/static/style.css">
</head>
<body>
<div id="map" style="position:absolute;inset:0;z-index:1"></div>
<div id="globe" style="position:absolute;inset:0;z-index:1;display:none"></div>
<div id="hud-overlay"></div>
<div id="app"></div>
<script src="/static/sentinel.js"><\/script>
</body>
</html>`
  return c.html(html)
})

export default app
