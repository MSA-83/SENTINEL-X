/**
 * SENTINEL OS — Global Situational Awareness Platform
 * Hono Backend + API Proxy for Cloudflare Pages Edge Runtime
 * 
 * Routes all keyed API calls through edge proxy to protect credentials.
 * Free/keyless APIs are called directly from the client.
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { cache } from 'hono/cache'

type Bindings = {
  NASA_FIRMS_KEY?: string
  OWM_KEY?: string
  N2YO_KEY?: string
  GFW_TOKEN?: string
  AVWX_KEY?: string
  RAPIDAPI_KEY?: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('/api/*', cors())

/* ═══════════════════════════════════════════════════════════════
   API PROXY — Secure edge-side credential management
═══════════════════════════════════════════════════════════════ */

interface TargetConfig {
  url: string | ((key: string, params?: Record<string, string>) => string)
  secret?: keyof Bindings
  authType?: 'bearer' | 'rapidapi' | 'query'
  rapidApiHost?: string
  timeout?: number
  fallbackUrl?: string
  responseType?: 'json' | 'text'
}

const TARGETS: Record<string, TargetConfig> = {
  opensky: {
    url: 'https://opensky-network.org/api/states/all',
    timeout: 12000,
    fallbackUrl: 'https://opensky-network.org/api/states/all?lamin=-60&lamax=60&lomin=-180&lomax=180',
  },
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
  n2yo: {
    url: (key: string) => `https://api.n2yo.com/rest/v1/satellite/above/0/0/0/80/0?apiKey=${key}`,
    secret: 'N2YO_KEY',
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
  avwx_sigmets: {
    url: (_key: string, params?: Record<string, string>) =>
      `https://avwx.rest/api/airsigmet/${params?.icao || 'KJFK'}?format=json&onfail=cache`,
    secret: 'AVWX_KEY',
    authType: 'bearer',
    timeout: 10000,
  },
  military: {
    url: 'https://adsbexchange-com1.p.rapidapi.com/v2/mil/',
    secret: 'RAPIDAPI_KEY',
    authType: 'rapidapi',
    rapidApiHost: 'adsbexchange-com1.p.rapidapi.com',
    timeout: 10000,
  },
  gdacs: {
    url: 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=EQ,TC,FL,VO,TS&alertlevel=Green;Orange;Red',
    timeout: 16000,
  },
  gdelt_conflict: {
    url: 'https://api.gdeltproject.org/api/v2/geo/geo?query=military+attack+airstrike+conflict+war&TIMESPAN=48h&MAXPOINTS=80&OUTPUTTYPE=2',
    timeout: 18000,
  },
  gdelt_maritime: {
    url: 'https://api.gdeltproject.org/api/v2/geo/geo?query=ship+vessel+maritime+navy+seized&TIMESPAN=48h&MAXPOINTS=40&OUTPUTTYPE=2',
    timeout: 18000,
  },
  reliefweb: {
    url: 'https://api.reliefweb.int/v1/disasters?appname=sentinel-os&limit=50&filter[field]=status&filter[value][]=alert&filter[value][]=current&fields[include][]=name&fields[include][]=glide&fields[include][]=date&fields[include][]=country&fields[include][]=primary_type&fields[include][]=status',
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

  const fetchHeaders: Record<string, string> = {}
  if (config.authType === 'bearer' && secret) {
    fetchHeaders['Authorization'] = `Bearer ${secret}`
  }
  if (config.authType === 'rapidapi' && secret) {
    fetchHeaders['X-RapidAPI-Key'] = secret
    fetchHeaders['X-RapidAPI-Host'] = config.rapidApiHost || ''
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
          return c.json({ _upstream_error: true, status: 0, message: 'Fallback failed' })
        }
      } else {
        clearTimeout(timeoutId)
        return c.json({ _upstream_error: true, status: 0, message: String(primaryErr) })
      }
    }
    clearTimeout(timeoutId)

    if (!res!.ok) {
      const body = await res!.text()
      return c.json({ _upstream_error: true, status: res!.status, message: body.slice(0, 300) })
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
   HEALTH + STATUS
═══════════════════════════════════════════════════════════════ */
app.get('/api/health', (c) => c.json({ status: 'operational', version: '2.0.0', timestamp: new Date().toISOString() }))

app.get('/api/status', (c) => {
  const keys: Record<string, boolean> = {}
  const envKeys: (keyof Bindings)[] = ['NASA_FIRMS_KEY', 'OWM_KEY', 'N2YO_KEY', 'GFW_TOKEN', 'AVWX_KEY', 'RAPIDAPI_KEY']
  for (const k of envKeys) {
    keys[k] = !!(c.env[k])
  }
  return c.json({ keys, targets: Object.keys(TARGETS) })
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
<title>SENTINEL OS — Global Situational Awareness</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🛰</text></svg>">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css"/>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@400;700;900&display=swap" rel="stylesheet">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
<script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"><\/script>
<script src="https://unpkg.com/satellite.js@5.0.0/dist/satellite.min.js"><\/script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:#010810}::-webkit-scrollbar-thumb{background:#0a2a40;border-radius:2px}
body{background:#010810;color:#8ab4c8;font-family:'Share Tech Mono',monospace;overflow:hidden;height:100vh;width:100vw}
.leaflet-container{background:#000409!important}
.leaflet-control-zoom a{background:#010f1e!important;color:#00d4ff!important;border-color:#0a2040!important;font-size:14px!important}
.leaflet-control-scale-line{background:rgba(1,8,16,0.85)!important;border-color:#0a2040!important;color:#1a3a50!important;font-size:9px!important}
.marker-cluster-small,.marker-cluster-medium,.marker-cluster-large{background:transparent!important}
.marker-cluster-small div,.marker-cluster-medium div,.marker-cluster-large div{background:rgba(0,212,255,0.15)!important;color:#00d4ff!important;border:1px solid rgba(0,212,255,0.4)!important;font-family:'Share Tech Mono',monospace!important;font-size:10px!important}
.sm{display:block;cursor:pointer;transition:transform 0.15s}.sm:hover{transform:scale(1.5)!important}
.sm.emg svg circle:first-child{animation:emgp 0.7s ease-in-out infinite}
.sm.crit svg circle:first-child{animation:critp 1.0s ease-in-out infinite}
@keyframes emgp{0%,100%{opacity:0.9}50%{opacity:1}}
@keyframes critp{0%,100%{opacity:0.8}50%{opacity:1}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.35}}
@keyframes pulse-fast{0%,100%{opacity:1}50%{opacity:0.2}}
@keyframes slidein{from{transform:translateX(14px);opacity:0}to{transform:translateX(0);opacity:1}}
@keyframes slideup{from{transform:translateY(100%)}to{transform:translateY(0)}}
@keyframes ticker{0%{opacity:0;transform:translateY(8px)}12%,88%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(-8px)}}
@keyframes scanline{0%{top:-100%}100%{top:200%}}
@keyframes glow{0%,100%{text-shadow:0 0 8px currentColor}50%{text-shadow:0 0 20px currentColor,0 0 40px currentColor}}
.lr:hover{background:rgba(0,180,255,0.06)!important}
.al:hover{background:rgba(255,50,80,0.08)!important}
.cb:hover{color:#ff6688!important}
.hdr{position:absolute;top:0;left:0;right:0;height:50px;background:linear-gradient(180deg,rgba(1,8,16,0.98),rgba(1,8,16,0.92));border-bottom:1px solid #0a2040;display:flex;align-items:center;justify-content:space-between;padding:0 12px;z-index:500;backdrop-filter:blur(8px)}
.lp{position:absolute;top:50px;left:0;bottom:38px;width:260px;background:rgba(1,8,16,0.96);border-right:1px solid #0a2040;z-index:400;display:flex;flex-direction:column;backdrop-filter:blur(4px)}
.rp{position:absolute;top:50px;right:0;bottom:38px;width:280px;background:rgba(1,8,16,0.97);border-left:1px solid #0a2040;z-index:400;animation:slidein 0.22s ease;overflow-y:auto;backdrop-filter:blur(4px)}
.btk{position:absolute;bottom:0;left:0;right:0;height:38px;background:rgba(1,8,16,0.98);border-top:1px solid #0a2040;display:flex;align-items:center;z-index:500;overflow:hidden}
.tab{flex:1;padding:8px 0;text-align:center;cursor:pointer;font-size:8px;letter-spacing:1.5px;border-bottom:2px solid transparent;transition:all 0.2s}
.tab.active{background:rgba(0,180,255,0.07);border-bottom-color:#00d4ff;color:#00d4ff}
.tab:hover{background:rgba(0,180,255,0.04)}
.threat-crit{background:rgba(255,0,51,0.06);border-left:2px solid #ff0033}
.threat-high{border-left:2px solid #ff7700}
.orb{font-family:'Orbitron',sans-serif}
@media(max-width:767px){
  .lp,.btk-desktop{display:none!important}
  .rp{width:100%!important;bottom:48px!important}
  .mob-bar{display:flex!important}
  .hdr-stats{display:none!important}
}
@media(min-width:768px){.mob-bar{display:none!important}}
</style>
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
