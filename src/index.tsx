/**
 * SENTINEL OS v5.0 — Global Multi-Domain Situational Awareness Platform
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
 * - AlienVault OTX cyber threat intel endpoint
 * - URLhaus malware URL tracking endpoint
 * - GPS Jamming anomaly detection + known hotspots
 * - Social media conflict OSINT (Reddit)
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
  OTX_KEY?: string
  REDDIT_CLIENT_ID?: string
  REDDIT_SECRET?: string
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
  // v5.0 additions for cyber/GPS/social layers
  'baltic': { lat: 56.0, lon: 22.0, region: 'Europe' },
  'kaliningrad': { lat: 54.7, lon: 20.5, region: 'Eastern Europe' },
  'arctic': { lat: 71.0, lon: 25.0, region: 'Arctic' },
  'mediterranean': { lat: 35.0, lon: 18.0, region: 'Europe' },
  'atlantic': { lat: 45.0, lon: -30.0, region: 'Atlantic' },
  'pacific': { lat: 20.0, lon: -150.0, region: 'Pacific' },
  'finland': { lat: 61.5, lon: 25.7, region: 'Europe' },
  'poland': { lat: 51.9, lon: 19.1, region: 'Europe' },
  'romania': { lat: 45.9, lon: 25.0, region: 'Europe' },
  'georgia': { lat: 42.3, lon: 43.4, region: 'Eastern Europe' },
  'armenia': { lat: 40.0, lon: 45.0, region: 'Middle East' },
  'azerbaijan': { lat: 40.4, lon: 49.9, region: 'Middle East' },
  'singapore': { lat: 1.35, lon: 103.82, region: 'Indo-Pacific' },
  'malacca': { lat: 2.2, lon: 102.2, region: 'Indo-Pacific' },
  'germany': { lat: 51.2, lon: 10.4, region: 'Europe' },
  'france': { lat: 46.2, lon: 2.2, region: 'Europe' },
  'united kingdom': { lat: 55.4, lon: -3.4, region: 'Europe' },
  'uk': { lat: 55.4, lon: -3.4, region: 'Europe' },
  'london': { lat: 51.5, lon: -0.1, region: 'Europe' },
  'new york': { lat: 40.7, lon: -74.0, region: 'North America' },
  'california': { lat: 36.8, lon: -119.4, region: 'North America' },
  'texas': { lat: 31.0, lon: -100.0, region: 'North America' },
  'australia': { lat: -25.3, lon: 133.8, region: 'Indo-Pacific' },
  'brazil': { lat: -14.2, lon: -51.9, region: 'South America' },
  'colombia': { lat: 4.6, lon: -74.1, region: 'South America' },
  'drone': { lat: 48.5, lon: 37.0, region: 'Eastern Europe' },
  'ransomware': { lat: 40.7, lon: -74.0, region: 'Global' },
  'apt': { lat: 39.9, lon: 116.4, region: 'Indo-Pacific' },
  'hacker': { lat: 55.8, lon: 37.6, region: 'Global' },
  'spyware': { lat: 31.0, lon: 34.8, region: 'Middle East' },
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
    url: 'https://api.reliefweb.int/v1/disasters?appname=SMansabdar-SentinelXresearchdashboard-7f9c2a&limit=50&sort[]=date:desc&fields[include][]=name&fields[include][]=country&fields[include][]=status&fields[include][]=primary_type&fields[include][]=glide&fields[include][]=date',
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
    'User-Agent': 'SENTINEL-OS/5.0 (Global OSINT Platform)',
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
    // Try primary search endpoint first
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
    } catch {
      // Search failed, fall through to fallback
    }

    // Search failed or not available — try fallback methods

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
═══════════════════════════════════════════════════════════════ */
app.get('/api/reliefweb/disasters', async (c) => {
  const APPNAME = 'SMansabdar-SentinelXresearchdashboard-7f9c2a'

  try {
    const res = await fetch(`https://api.reliefweb.int/v1/disasters?appname=${APPNAME}&limit=50`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'SENTINEL-OS/5.0' },
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

  try {
    const res = await fetch(
      `https://api.reliefweb.int/v1/disasters?appname=${APPNAME}&limit=50&sort[]=date:desc&fields[include][]=name&fields[include][]=country&fields[include][]=status&fields[include][]=primary_type&fields[include][]=glide&fields[include][]=date`,
      { signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'SENTINEL-OS/5.0' } }
    )
    if (res.ok) {
      const data = await res.json()
      return c.json(data)
    }
  } catch {}

  return c.json({
    data: [],
    error: 'ReliefWeb API request failed',
    note: 'GDACS serves as the primary disaster feed.'
  })
})

/* ═══════════════════════════════════════════════════════════════
   ACLED — Armed Conflict Location & Event Data (free tier)
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
    const res = await fetch(
      `https://api.acleddata.com/acled/read?key=${key}&email=sentinel@osint.platform&limit=100&sort=event_date:desc`,
      { signal: AbortSignal.timeout(12000), headers: { 'User-Agent': 'SENTINEL-OS/5.0' } }
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
═══════════════════════════════════════════════════════════════ */
async function fetchGDELTWithRetry(url: string, retries = 0): Promise<any> {
  for (let i = 0; i <= retries; i++) {
    try {
      if (i > 0) await new Promise(r => setTimeout(r, 2000))
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SentinelOS/5.0)' },
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
    : category === 'gpsjam'
    ? 'GPS+jamming+spoofing+navigation+interference'
    : 'military+attack+conflict+bombing+airstrike'

  try {
    const fromDate = new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0]
    const res = await fetch(
      `https://newsapi.org/v2/everything?q=${query}&sortBy=publishedAt&pageSize=40&language=en&from=${fromDate}&apiKey=${key}`,
      { signal: AbortSignal.timeout(12000), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SentinelOS/5.0)' } }
    )
    if (!res.ok) return c.json({ events: [], error: `HTTP ${res.status}` })
    const data = await res.json() as any
    const articles = data.articles || []

    const events = articles.map((art: any, i: number) => {
      const geo = geocodeFromText(art.title || '', art.source?.name || '')
      if (!geo) return null
      return {
        id: `news_${category || 'conflict'}_${i}`,
        type: category === 'cyber' ? 'cyber' : category === 'nuclear' ? 'nuclear' : category === 'gpsjam' ? 'gpsjam' : 'conflict',
        lat: geo.lat, lon: geo.lon, region: geo.region,
        title: art.title, url: art.url, domain: art.source?.name || '',
        timestamp: art.publishedAt, country: '', language: 'en',
        matchedLocation: geo.matchedKey,
        imageUrl: art.urlToImage || '',
      }
    }).filter(Boolean)

    return c.json({ events, total: articles.length, geocoded: events.length, source: 'newsapi' })
  } catch (error) {
    return c.json({ events: [], error: String(error) })
  }
})

/* ═══════════════════════════════════════════════════════════════
   CYBERSECURITY — AlienVault OTX Public Pulse Feed
   Free API: https://otx.alienvault.com/api
   Get API key at: https://otx.alienvault.com/ (free registration)
═══════════════════════════════════════════════════════════════ */
app.get('/api/cyber/otx', async (c) => {
  // OTX public pulse feed — works without key for public data
  const otxKey = c.env.OTX_KEY || ''
  
  try {
    const headers: Record<string, string> = {
      'User-Agent': 'SENTINEL-OS/5.0',
      'Accept': 'application/json',
    }
    if (otxKey) headers['X-OTX-API-KEY'] = otxKey

    // Try subscribed pulses first (requires API key)
    if (otxKey) {
      try {
        const res = await fetch(
          'https://otx.alienvault.com/api/v1/pulses/subscribed?limit=50&modified_since=' + 
          new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0],
          { headers, signal: AbortSignal.timeout(12000) }
        )
        if (res.ok) {
          const data = await res.json() as any
          return c.json({ results: data.results || [], count: data.count || 0, source: 'otx-subscribed' })
        }
      } catch {}
    }

    // Fallback 1: Activity feed (works without key)
    try {
      const actRes = await fetch(
        'https://otx.alienvault.com/api/v1/pulses/activity?limit=30',
        { headers: { 'User-Agent': 'SENTINEL-OS/5.0', 'Accept': 'application/json' }, signal: AbortSignal.timeout(10000) }
      )
      if (actRes.ok) {
        const actData = await actRes.json() as any
        if (actData.results && actData.results.length > 0) {
          return c.json({ results: actData.results || [], count: actData.count || 0, source: 'otx-activity' })
        }
      }
    } catch {}

    // Fallback 2: Search for recent threat pulses
    try {
      const searchRes = await fetch(
        'https://otx.alienvault.com/api/v1/search/pulses?q=malware+ransomware+apt&sort=modified&limit=25',
        { headers: { 'User-Agent': 'SENTINEL-OS/5.0', 'Accept': 'application/json' }, signal: AbortSignal.timeout(10000) }
      )
      if (searchRes.ok) {
        const searchData = await searchRes.json() as any
        return c.json({ results: searchData.results || [], count: searchData.count || 0, source: 'otx-search' })
      }
    } catch {}

    return c.json({
      results: [],
      error: 'OTX API unavailable',
      registration_url: 'https://otx.alienvault.com/',
      note: 'Register free at otx.alienvault.com to get an OTX API key for full access.'
    })
  } catch (error) {
    return c.json({ results: [], error: String(error) })
  }
})

/* ═══════════════════════════════════════════════════════════════
   CYBERSECURITY — URLhaus Malware URL Feed (abuse.ch)
   Free, no API key required: https://urlhaus-api.abuse.ch/
═══════════════════════════════════════════════════════════════ */
app.get('/api/cyber/urlhaus', async (c) => {
  try {
    // Try the recent URLs endpoint first
    const res = await fetch('https://urlhaus-api.abuse.ch/v1/urls/recent/limit/50/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'SENTINEL-OS/5.0' },
      signal: AbortSignal.timeout(10000)
    })

    if (res.ok) {
      const ct = res.headers.get('content-type') || ''
      if (ct.includes('json')) {
        const data = await res.json() as any
        if (data.urls && data.urls.length > 0) {
          return c.json({ urls: data.urls, query_status: data.query_status || 'ok' })
        }
      }
    }

    // Fallback: Try CSV feed (more reliable)
    const csvRes = await fetch('https://urlhaus.abuse.ch/downloads/csv_recent/', {
      headers: { 'User-Agent': 'SENTINEL-OS/5.0' },
      signal: AbortSignal.timeout(10000)
    })
    if (csvRes.ok) {
      const csv = await csvRes.text()
      const lines = csv.split('\n').filter(l => l && !l.startsWith('#')).slice(0, 50)
      const urls = lines.map(l => {
        const parts = l.split(',').map(p => p.replace(/^"|"$/g, ''))
        return { id: parts[0], dateadded: parts[1], url: parts[2], url_status: parts[3], threat: parts[5], tags: parts[6]?.split('|') || [], host: parts[7], country: '' }
      }).filter(u => u.url)
      return c.json({ urls, query_status: 'csv_fallback' })
    }

    return c.json({ urls: [], error: 'URLhaus API unavailable from this location', note: 'URLhaus feeds work from Cloudflare Edge. Visit https://urlhaus.abuse.ch/ for direct access.' })
  } catch (error) {
    return c.json({ urls: [], error: String(error) })
  }
})

/* ═══════════════════════════════════════════════════════════════
   CYBERSECURITY — ThreatFox IOC Feed (abuse.ch)
   Free, no API key required: https://threatfox-api.abuse.ch/
═══════════════════════════════════════════════════════════════ */
app.get('/api/cyber/threatfox', async (c) => {
  try {
    const res = await fetch('https://threatfox-api.abuse.ch/api/v1/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'SENTINEL-OS/5.0' },
      body: JSON.stringify({ query: 'get_iocs', days: 3 }),
      signal: AbortSignal.timeout(10000)
    })

    if (res.ok) {
      const ct = res.headers.get('content-type') || ''
      if (ct.includes('json')) {
        const data = await res.json() as any
        return c.json({
          data: Array.isArray(data.data) ? data.data.slice(0, 60) : [],
          query_status: data.query_status || 'no_results',
          source: 'threatfox'
        })
      }
    }

    return c.json({ data: [], error: 'ThreatFox API unavailable from this location', note: 'ThreatFox feeds work from Cloudflare Edge. Visit https://threatfox.abuse.ch/ for direct access.' })
  } catch (error) {
    return c.json({ data: [], error: String(error) })
  }
})

/* ═══════════════════════════════════════════════════════════════
   GPS JAMMING ANOMALIES — Known Interference Hotspots + Analysis
   Sources: GPSJAM.org data model, known conflict zone jamming
   GPSJam.org uses ADS-B data from aircraft — no public API
   We provide curated known jamming zones + GDELT GPS news
═══════════════════════════════════════════════════════════════ */

// Known GPS jamming/spoofing hotspots (curated from GPSJam.org, Eurocontrol, FAA NOTAMs)
const GPS_JAM_ZONES = [
  // Active military jamming zones
  { name: 'Ukraine — Eastern Front', lat: 48.5, lon: 37.0, radius: 300, severity: 'critical', type: 'military_jamming', source: 'GPSJam/ADS-B', description: 'Active GPS jamming from Russian EW systems (Krasukha-4, Pole-21)', affected: 'All GNSS', lastDetected: 'Continuous', confidence: 95 },
  { name: 'Kaliningrad Oblast', lat: 54.7, lon: 20.5, radius: 200, severity: 'high', type: 'military_jamming', source: 'GPSJam/Eurocontrol', description: 'Russian military GNSS jamming affecting Baltic airspace', affected: 'GPS L1/L2', lastDetected: 'Continuous', confidence: 90 },
  { name: 'Eastern Baltic Sea', lat: 57.5, lon: 22.0, radius: 250, severity: 'high', type: 'spoofing', source: 'GPSJam/EASA', description: 'GPS spoofing incidents affecting commercial aviation over Baltic states', affected: 'GPS + Galileo', lastDetected: 'Recent', confidence: 85 },
  { name: 'Syria — Northwest', lat: 35.5, lon: 36.8, radius: 200, severity: 'high', type: 'military_jamming', source: 'GPSJam/Bellingcat', description: 'Russian Khmeimim air base EW operations', affected: 'GPS L1', lastDetected: 'Continuous', confidence: 88 },
  { name: 'Eastern Mediterranean', lat: 34.5, lon: 33.5, radius: 350, severity: 'medium', type: 'spoofing', source: 'GPSJam/C4ADS', description: 'GPS spoofing affecting shipping and aviation near Cyprus, Lebanon', affected: 'GPS', lastDetected: 'Intermittent', confidence: 80 },
  { name: 'Iran — Western Border', lat: 33.5, lon: 46.0, radius: 300, severity: 'high', type: 'military_jamming', source: 'GPSJam', description: 'Iranian military GPS jamming near Iraq border', affected: 'GPS + GLONASS', lastDetected: 'Recent', confidence: 75 },
  { name: 'Israel — Northern Border', lat: 33.0, lon: 35.5, radius: 150, severity: 'high', type: 'spoofing', source: 'GPSJam/OPSGROUP', description: 'Massive GPS spoofing affecting Ben Gurion approaches and regional airspace', affected: 'GPS L1', lastDetected: 'Continuous', confidence: 92 },
  { name: 'North Korea — DMZ', lat: 37.9, lon: 126.7, radius: 120, severity: 'medium', type: 'military_jamming', source: 'GPSJam/ROK MND', description: 'DPRK GPS jamming directed at South Korean targets', affected: 'GPS L1', lastDetected: 'Periodic', confidence: 82 },
  // Maritime chokepoints
  { name: 'Red Sea — Southern', lat: 14.0, lon: 42.8, radius: 200, severity: 'medium', type: 'spoofing', source: 'GPSJam/IMO', description: 'GPS spoofing incidents affecting shipping near Bab el-Mandeb', affected: 'GPS', lastDetected: 'Recent', confidence: 72 },
  { name: 'Strait of Hormuz', lat: 26.5, lon: 56.3, radius: 120, severity: 'medium', type: 'military_jamming', source: 'GPSJam', description: 'Iranian GNSS interference affecting maritime traffic', affected: 'GPS', lastDetected: 'Intermittent', confidence: 68 },
  { name: 'Black Sea — Western', lat: 44.0, lon: 33.0, radius: 250, severity: 'high', type: 'spoofing', source: 'GPSJam/C4ADS', description: 'GPS spoofing centered on Sevastopol naval base, affecting civilian shipping', affected: 'GPS + GLONASS', lastDetected: 'Continuous', confidence: 87 },
  // Additional zones
  { name: 'Finland — Eastern Border', lat: 62.0, lon: 29.5, radius: 150, severity: 'medium', type: 'military_jamming', source: 'GPSJam/Traficom', description: 'GNSS interference from Kola Peninsula military installations', affected: 'GPS + Galileo', lastDetected: 'Periodic', confidence: 78 },
  { name: 'Turkey — Southeast', lat: 37.5, lon: 40.0, radius: 180, severity: 'medium', type: 'military_jamming', source: 'GPSJam', description: 'GPS jamming related to cross-border military operations', affected: 'GPS', lastDetected: 'Recent', confidence: 70 },
  { name: 'South China Sea — Spratly', lat: 10.5, lon: 114.0, radius: 200, severity: 'medium', type: 'spoofing', source: 'C4ADS/SkyTruth', description: 'AIS and GPS spoofing affecting maritime vessels near Chinese installations', affected: 'GPS + BeiDou', lastDetected: 'Intermittent', confidence: 74 },
  { name: 'Taiwan Strait', lat: 24.0, lon: 119.5, radius: 150, severity: 'low', type: 'military_jamming', source: 'GPSJam', description: 'Occasional PLA EW exercises affecting GNSS signals', affected: 'GPS', lastDetected: 'Periodic', confidence: 60 },
]

app.get('/api/gps/jamming', async (c) => {
  // Also try to get GPS-related news from GDELT for enrichment
  let gpsNews: any[] = []
  try {
    const newsData = await fetchGDELTWithRetry(
      'https://api.gdeltproject.org/api/v2/doc/doc?query=GPS+jamming+spoofing+GNSS+interference+navigation&mode=artlist&maxrecords=15&format=json&timespan=72h&sourcelang=english'
    )
    if (newsData?.articles) {
      gpsNews = newsData.articles.map((art: any, i: number) => {
        const geo = geocodeFromText(art.title, art.domain)
        return geo ? {
          title: art.title, url: art.url, domain: art.domain,
          lat: geo.lat, lon: geo.lon, region: geo.region,
          timestamp: art.seendate
        } : null
      }).filter(Boolean).slice(0, 10)
    }
  } catch {}

  return c.json({
    zones: GPS_JAM_ZONES,
    count: GPS_JAM_ZONES.length,
    gpsNews,
    lastUpdated: new Date().toISOString(),
    sources: [
      { name: 'GPSJam.org', url: 'https://gpsjam.org/', description: 'Daily maps of GPS interference using ADS-B data', free: true, keyRequired: false },
      { name: 'Eurocontrol', url: 'https://www.eurocontrol.int/', description: 'European aviation GNSS interference reports', free: true, keyRequired: false },
      { name: 'OPSGROUP', url: 'https://ops.group/', description: 'Pilot-reported GPS interference tracking', free: false, keyRequired: true },
      { name: 'C4ADS', url: 'https://c4ads.org/', description: 'GPS spoofing research and analysis', free: true, keyRequired: false },
      { name: 'Flightradar24', url: 'https://www.flightradar24.com/data/gps-jamming', description: 'GPS jamming and interference map', free: true, keyRequired: false },
    ],
    note: 'GPS jamming data is aggregated from multiple OSINT sources. GPSJam.org provides daily interference maps at https://gpsjam.org/. For real-time ADS-B NIC/NAC analysis, integrate ADS-B Exchange data.'
  })
})

/* ═══════════════════════════════════════════════════════════════
   SOCIAL MEDIA CONFLICT — Reddit OSINT Posts
   Subreddits: r/CombatFootage, r/UkraineWarVideoReport, r/CredibleDefense
   Uses Reddit JSON API (no auth required for public subreddits)
═══════════════════════════════════════════════════════════════ */
app.get('/api/social/reddit', async (c) => {
  const subreddits = [
    { name: 'CombatFootage', type: 'video', description: 'Combat and conflict footage' },
    { name: 'UkraineWarVideoReport', type: 'video', description: 'Ukraine conflict videos' },
    { name: 'CredibleDefense', type: 'analysis', description: 'Military analysis & discussion' },
    { name: 'UkrainianConflict', type: 'news', description: 'Ukraine conflict news' },
    { name: 'osint', type: 'intel', description: 'Open Source Intelligence' },
  ]

  const allPosts: any[] = []

  try {
    const results = await Promise.allSettled(
      subreddits.map(sub =>
        fetch(`https://www.reddit.com/r/${sub.name}/hot.json?limit=15&t=week&raw_json=1`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SentinelOS/5.0; +https://github.com/sentinel-os)' },
          signal: AbortSignal.timeout(10000)
        }).then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          return r.json()
        }).then((data: any) => {
          const posts = (data?.data?.children || []).map((child: any) => {
            const p = child.data
            if (!p) return null

            // Extract video/media URLs
            let mediaUrl = ''
            let mediaType = 'text'
            if (p.is_video && p.media?.reddit_video?.fallback_url) {
              mediaUrl = p.media.reddit_video.fallback_url
              mediaType = 'video'
            } else if (p.url && /\.(mp4|webm|mov)/i.test(p.url)) {
              mediaUrl = p.url
              mediaType = 'video'
            } else if (p.url && /v\.redd\.it|streamable|youtube|youtu\.be|twitter\.com|x\.com/i.test(p.url)) {
              mediaUrl = p.url
              mediaType = 'video_link'
            } else if (p.url && /\.(jpg|jpeg|png|gif|webp)/i.test(p.url)) {
              mediaUrl = p.url
              mediaType = 'image'
            } else if (p.thumbnail && p.thumbnail.startsWith('http')) {
              mediaUrl = p.thumbnail
              mediaType = 'thumbnail'
            }

            // Geocode from title
            const geo = geocodeFromText(p.title || '', sub.name)

            return {
              id: p.id,
              subreddit: sub.name,
              subType: sub.type,
              title: p.title || '',
              author: p.author || 'unknown',
              score: p.score || 0,
              numComments: p.num_comments || 0,
              permalink: `https://reddit.com${p.permalink}`,
              url: p.url || '',
              mediaUrl,
              mediaType,
              thumbnail: p.thumbnail && p.thumbnail.startsWith('http') ? p.thumbnail : '',
              created: p.created_utc ? new Date(p.created_utc * 1000).toISOString() : '',
              flair: p.link_flair_text || '',
              selftext: (p.selftext || '').slice(0, 200),
              geo: geo ? { lat: geo.lat, lon: geo.lon, region: geo.region, matchedKey: geo.matchedKey } : null,
              nsfw: p.over_18 || false,
            }
          }).filter(Boolean)

          return posts
        }).catch(() => [])
      )
    )

    results.forEach(r => {
      if (r.status === 'fulfilled' && Array.isArray(r.value)) {
        allPosts.push(...r.value)
      }
    })

    // Sort by score descending, take top posts
    allPosts.sort((a, b) => b.score - a.score)
    const geolocated = allPosts.filter(p => p.geo !== null)
    const withMedia = allPosts.filter(p => p.mediaType === 'video' || p.mediaType === 'video_link')

    return c.json({
      posts: allPosts.slice(0, 60),
      total: allPosts.length,
      geolocated: geolocated.length,
      withVideo: withMedia.length,
      subreddits: subreddits.map(s => s.name),
      source: 'reddit-public-json'
    })
  } catch (error) {
    return c.json({ posts: [], error: String(error) })
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
  version: '5.1.0',
  codename: 'SENTINEL OS',
  timestamp: new Date().toISOString(),
  uptime: 'edge-runtime',
  domains: ['aviation', 'maritime', 'orbital', 'seismic', 'wildfire', 'weather', 'conflict', 'disaster', 'cyber', 'nuclear', 'gpsjam', 'social', 'satellite-imagery'],
  satellite_imagery: {
    sources: ['NASA GIBS (MODIS Terra/Aqua, VIIRS SNPP)', 'EOX Sentinel-2 Cloudless'],
    update_frequency: 'daily (GIBS) / annual (S2)',
    api_key_required: false,
  },
}))

app.get('/api/status', (c) => {
  const keys: Record<string, boolean> = {}
  const envKeys: (keyof Bindings)[] = ['NASA_FIRMS_KEY', 'OWM_KEY', 'N2YO_KEY', 'GFW_TOKEN', 'AVWX_KEY', 'RAPIDAPI_KEY', 'SHODAN_KEY', 'NEWS_API_KEY', 'AISSTREAM_KEY', 'OTX_KEY']
  for (const k of envKeys) {
    keys[k] = !!(c.env[k])
  }
  return c.json({
    keys,
    targets: Object.keys(TARGETS),
    fusion_zones: FUSION_ZONES.length,
    geocoding_entries: Object.keys(GEO_DB).length,
    gps_jam_zones: GPS_JAM_ZONES.length,
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
<title>SENTINEL OS v5.1 — Global Situational Awareness</title>
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
