import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = {
  OTX_KEY?: string
  OPENSKY_USERNAME?: string
  OPENSKY_PASSWORD?: string
}

type CanonicalEvent = {
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
  confidence: number
  severity: 'low' | 'medium' | 'high' | 'critical'
  risk_score: number
  region: string
  tags: string[]
  correlations: string[]
  metadata: Record<string, unknown>
  raw_payload_hash: string
  provenance: {
    geolocation: 'direct' | 'inferred' | 'none'
    ingestion: string
    fetched_at: string
  }
}

type UpstreamFailure = {
  _upstream_error: true
  upstream: string
  status: number
  message: string
}

const app = new Hono<{ Bindings: Bindings }>()
app.use('/api/*', cors())

const DEFAULT_REGION = 'Global'

const GEO_HINTS: Array<{ key: string; lat: number; lon: number; region: string }> = [
  { key: 'ukraine', lat: 49, lon: 31, region: 'Eastern Europe' },
  { key: 'gaza', lat: 31.4, lon: 34.3, region: 'Middle East' },
  { key: 'red sea', lat: 21, lon: 38, region: 'Middle East' },
  { key: 'taiwan', lat: 23.8, lon: 121, region: 'Indo-Pacific' },
  { key: 'black sea', lat: 43, lon: 35, region: 'Eastern Europe' },
  { key: 'baltic', lat: 57, lon: 22, region: 'Europe' },
  { key: 'syria', lat: 35, lon: 38, region: 'Middle East' },
  { key: 'iran', lat: 32, lon: 53, region: 'Middle East' },
  { key: 'israel', lat: 31.5, lon: 35, region: 'Middle East' }
]

function hashPayload(payload: unknown): string {
  const raw = JSON.stringify(payload)
  let hash = 0
  for (let i = 0; i < raw.length; i += 1) hash = (hash * 31 + raw.charCodeAt(i)) | 0
  return `h${Math.abs(hash)}`
}

function inferGeo(text: string): { lat: number; lon: number; region: string; confidence: number } | null {
  const normalized = text.toLowerCase()
  for (const hint of GEO_HINTS) {
    if (normalized.includes(hint.key)) {
      return { lat: hint.lat, lon: hint.lon, region: hint.region, confidence: 0.35 }
    }
  }
  return null
}

function canonicalize(input: Partial<CanonicalEvent> & { source: string; source_url: string; title: string; description?: string; metadata?: Record<string, unknown> }, rawPayload: unknown): CanonicalEvent {
  const now = new Date().toISOString()
  const title = input.title.slice(0, 180)
  const description = (input.description ?? '').slice(0, 700)
  const derivedGeo = input.lat != null && input.lon != null ? null : inferGeo(`${title} ${description}`)

  const lat = input.lat ?? derivedGeo?.lat ?? null
  const lon = input.lon ?? derivedGeo?.lon ?? null
  const region = input.region ?? derivedGeo?.region ?? DEFAULT_REGION
  const confidence = Number((input.confidence ?? derivedGeo?.confidence ?? 0.15).toFixed(2))

  return {
    id: input.id ?? crypto.randomUUID(),
    entity_type: input.entity_type ?? 'unknown',
    source: input.source,
    source_url: input.source_url,
    title,
    description,
    lat,
    lon,
    altitude: input.altitude ?? null,
    velocity: input.velocity ?? null,
    heading: input.heading ?? null,
    timestamp: input.timestamp ?? now,
    observed_at: input.observed_at ?? now,
    confidence,
    severity: input.severity ?? (confidence > 0.75 ? 'high' : confidence > 0.45 ? 'medium' : 'low'),
    risk_score: input.risk_score ?? Math.round(confidence * 100),
    region,
    tags: input.tags ?? [],
    correlations: input.correlations ?? [],
    metadata: input.metadata ?? {},
    raw_payload_hash: hashPayload(rawPayload),
    provenance: {
      geolocation: input.lat != null && input.lon != null ? 'direct' : derivedGeo ? 'inferred' : 'none',
      ingestion: input.provenance?.ingestion ?? 'sentinel-bff-v2',
      fetched_at: now
    }
  }
}

async function fetchJson(url: string, upstream: string, init?: RequestInit, retries = 1, timeoutMs = 9000): Promise<any | UpstreamFailure> {
  let lastError: unknown
  for (let i = 0; i <= retries; i += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, { ...init, signal: controller.signal, headers: { 'User-Agent': 'SENTINEL-X/2.0', ...(init?.headers || {}) } })
      clearTimeout(timeout)
      if (!res.ok) {
        lastError = `${res.status} ${res.statusText}`
        continue
      }
      return await res.json()
    } catch (err) {
      clearTimeout(timeout)
      lastError = err
    }
  }
  return { _upstream_error: true, upstream, status: 502, message: String(lastError ?? 'unknown upstream error') }
}

function inBounds(evt: CanonicalEvent, bounds: { north: number; south: number; east: number; west: number }): boolean {
  if (evt.lat == null || evt.lon == null) return false
  return evt.lat <= bounds.north && evt.lat >= bounds.south && evt.lon <= bounds.east && evt.lon >= bounds.west
}

async function getConflictEvents(): Promise<Array<CanonicalEvent | UpstreamFailure>> {
  const gdelt = await fetchJson('https://api.gdeltproject.org/api/v2/doc/doc?query=conflict+OR+airstrike+OR+shelling&mode=artlist&maxrecords=40&format=json&timespan=24h', 'GDELT', undefined, 1)
  if ('_upstream_error' in gdelt) return [gdelt]
  const rows = Array.isArray(gdelt.articles) ? gdelt.articles : []
  return rows.map((row: any, idx: number) => canonicalize({
    id: `conflict-${idx}`,
    entity_type: 'conflict',
    source: 'GDELT',
    source_url: row.url || 'https://www.gdeltproject.org/',
    title: row.title || 'Conflict event',
    description: row.seendate || 'Open-source conflict reporting',
    timestamp: row.seendate ? new Date(row.seendate).toISOString() : new Date().toISOString(),
    observed_at: row.seendate ? new Date(row.seendate).toISOString() : new Date().toISOString(),
    confidence: 0.5,
    severity: 'medium',
    risk_score: 55,
    tags: ['conflict', 'osint']
  }, row))
}

async function getWeatherEvents(): Promise<Array<CanonicalEvent | UpstreamFailure>> {
  const nws = await fetchJson('https://api.weather.gov/alerts/active?status=actual&message_type=alert', 'NWS', undefined, 1)
  if ('_upstream_error' in nws) return [nws]
  const features = Array.isArray(nws.features) ? nws.features : []
  return features.slice(0, 80).map((f: any, idx: number) => {
    const coords = f.geometry?.coordinates?.[0]?.[0]
    return canonicalize({
      id: `weather-${idx}`,
      entity_type: 'weather',
      source: 'NOAA/NWS',
      source_url: f.properties?.['@id'] || 'https://weather.gov',
      title: f.properties?.headline || f.properties?.event || 'Weather alert',
      description: f.properties?.description || '',
      lat: Array.isArray(coords) ? coords[1] : null,
      lon: Array.isArray(coords) ? coords[0] : null,
      timestamp: f.properties?.sent || new Date().toISOString(),
      observed_at: f.properties?.effective || new Date().toISOString(),
      confidence: 0.88,
      severity: 'high',
      risk_score: 72,
      tags: ['weather', 'hazard']
    }, f)
  })
}

async function getCyberEvents(env: Bindings): Promise<Array<CanonicalEvent | UpstreamFailure>> {
  const [kev, urlhaus, otx] = await Promise.all([
    fetchJson('https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json', 'CISA KEV', undefined, 1),
    fetchJson('https://urlhaus-api.abuse.ch/v1/urls/recent/', 'URLhaus', { method: 'POST' }, 1),
    env.OTX_KEY
      ? fetchJson('https://otx.alienvault.com/api/v1/pulses/subscribed', 'OTX', { headers: { 'X-OTX-API-KEY': env.OTX_KEY } }, 1)
      : Promise.resolve({ pulses: [] })
  ])

  const out: Array<CanonicalEvent | UpstreamFailure> = []
  if ('_upstream_error' in kev) out.push(kev)
  else {
    const vulns = Array.isArray(kev.vulnerabilities) ? kev.vulnerabilities : []
    out.push(...vulns.slice(0, 60).map((v: any, idx: number) => canonicalize({
      id: `kev-${idx}`,
      entity_type: 'cyber',
      source: 'CISA KEV',
      source_url: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog',
      title: `${v.cveID} exploited vulnerability`,
      description: v.shortDescription || '',
      timestamp: v.dateAdded ? new Date(v.dateAdded).toISOString() : new Date().toISOString(),
      observed_at: v.dateAdded ? new Date(v.dateAdded).toISOString() : new Date().toISOString(),
      confidence: 0.93,
      severity: 'high',
      risk_score: 85,
      region: 'Global',
      tags: ['cyber', 'kev', 'cve'],
      correlations: [v.vendorProject, v.product]
    }, v)))
  }

  if ('_upstream_error' in urlhaus) out.push(urlhaus)
  else {
    const urls = Array.isArray(urlhaus.urls) ? urlhaus.urls : []
    out.push(...urls.slice(0, 40).map((u: any, idx: number) => canonicalize({
      id: `urlhaus-${idx}`,
      entity_type: 'cyber',
      source: 'URLhaus',
      source_url: u.urlhaus_reference || 'https://urlhaus.abuse.ch/',
      title: `Malware URL ${u.url}`,
      description: `Status: ${u.url_status || 'unknown'} | Threat: ${u.threat || 'unknown'}`,
      timestamp: u.date_added ? new Date(u.date_added).toISOString() : new Date().toISOString(),
      observed_at: u.date_added ? new Date(u.date_added).toISOString() : new Date().toISOString(),
      confidence: 0.84,
      severity: 'medium',
      risk_score: 70,
      tags: ['cyber', 'malware', 'ioc'],
      metadata: { host: u.host, reporter: u.reporter }
    }, u)))
  }

  if ('_upstream_error' in otx) out.push(otx)
  else {
    const pulses = Array.isArray(otx.results) ? otx.results : Array.isArray(otx.pulses) ? otx.pulses : []
    out.push(...pulses.slice(0, 25).map((p: any, idx: number) => canonicalize({
      id: `otx-${idx}`,
      entity_type: 'cyber',
      source: 'AlienVault OTX',
      source_url: p.pulse_info?.details || 'https://otx.alienvault.com/',
      title: p.name || 'OTX pulse',
      description: p.description || '',
      timestamp: p.created ? new Date(p.created).toISOString() : new Date().toISOString(),
      observed_at: p.modified ? new Date(p.modified).toISOString() : new Date().toISOString(),
      confidence: 0.7,
      severity: 'medium',
      risk_score: 64,
      tags: ['cyber', 'otx', 'threat-intel']
    }, p)))
  }

  return out
}

async function getGNSSEvents(): Promise<Array<CanonicalEvent | UpstreamFailure>> {
  const hotspots = [
    { title: 'Kaliningrad interference corridor', lat: 54.7, lon: 20.5, confidence: 0.6, severity: 'high' as const },
    { title: 'Eastern Mediterranean GNSS degradation', lat: 33.2, lon: 34.9, confidence: 0.55, severity: 'medium' as const },
    { title: 'Black Sea spoofing reports', lat: 43.0, lon: 36.0, confidence: 0.58, severity: 'high' as const }
  ]

  const gdelt = await fetchJson('https://api.gdeltproject.org/api/v2/doc/doc?query=GPS+jamming+OR+GNSS+spoofing&mode=artlist&maxrecords=20&format=json&timespan=72h', 'GDELT GNSS', undefined, 1)
  const inferred: Array<CanonicalEvent | UpstreamFailure> = hotspots.map((h, idx) => canonicalize({
    id: `gnss-hotspot-${idx}`,
    entity_type: 'gnss',
    source: 'GPSJam + open reporting',
    source_url: 'https://gpsjam.org/',
    title: h.title,
    description: 'Curated hotspot from open-source GNSS interference reporting. Treated as anomaly candidate, not certainty.',
    lat: h.lat,
    lon: h.lon,
    confidence: h.confidence,
    severity: h.severity,
    risk_score: Math.round(h.confidence * 100),
    tags: ['gnss', 'jamming', 'anomaly']
  }, h))

  if ('_upstream_error' in gdelt) return [...inferred, gdelt]
  const rows = Array.isArray(gdelt.articles) ? gdelt.articles : []
  const geocoded = rows.map((row: any, idx: number) => canonicalize({
    id: `gnss-news-${idx}`,
    entity_type: 'gnss',
    source: 'GDELT',
    source_url: row.url || 'https://www.gdeltproject.org/',
    title: row.title || 'GNSS anomaly report',
    description: 'News-derived GNSS report. Geolocation may be inferred from text.',
    confidence: 0.32,
    severity: 'low',
    risk_score: 35,
    tags: ['gnss', 'news', 'inferred-location']
  }, row))
  return [...inferred, ...geocoded]
}

async function getSocialEvents(): Promise<Array<CanonicalEvent | UpstreamFailure>> {
  const reddit = await fetchJson('https://www.reddit.com/r/osint+worldnews+ukraine/new.json?limit=50', 'Reddit', undefined, 1)
  if ('_upstream_error' in reddit) return [reddit]
  const posts = Array.isArray(reddit.data?.children) ? reddit.data.children : []

  return posts.map((post: any, idx: number) => {
    const data = post.data || {}
    const hasGeo = typeof data.geo_filter === 'string' && data.geo_filter.length > 0
    return canonicalize({
      id: `social-${idx}`,
      entity_type: 'social',
      source: 'Reddit',
      source_url: `https://reddit.com${data.permalink || ''}`,
      title: data.title || 'Social OSINT post',
      description: data.selftext || '',
      timestamp: data.created_utc ? new Date(data.created_utc * 1000).toISOString() : new Date().toISOString(),
      observed_at: data.created_utc ? new Date(data.created_utc * 1000).toISOString() : new Date().toISOString(),
      confidence: hasGeo ? 0.7 : 0.3,
      severity: 'low',
      risk_score: hasGeo ? 50 : 28,
      tags: ['social', hasGeo ? 'gps-metadata' : 'inferred-location'],
      metadata: { score: data.score, comments: data.num_comments, author: data.author }
    }, data)
  })
}

async function getAirEvents(env: Bindings): Promise<Array<CanonicalEvent | UpstreamFailure>> {
  const basic = 'https://opensky-network.org/api/states/all'
  const url = env.OPENSKY_USERNAME && env.OPENSKY_PASSWORD
    ? `https://${encodeURIComponent(env.OPENSKY_USERNAME)}:${encodeURIComponent(env.OPENSKY_PASSWORD)}@opensky-network.org/api/states/all`
    : basic

  const data = await fetchJson(url, 'OpenSky', undefined, 1)
  if ('_upstream_error' in data) return [data]
  const states = Array.isArray(data.states) ? data.states : []
  return states.slice(0, 250).map((s: any, idx: number) => canonicalize({
    id: `air-${idx}`,
    entity_type: 'air',
    source: 'OpenSky',
    source_url: 'https://opensky-network.org/',
    title: (s[1] || '').trim() || `ICAO ${s[0]}`,
    description: 'OpenSky state vector',
    lat: s[6],
    lon: s[5],
    altitude: s[7] ?? null,
    velocity: s[9] ?? null,
    heading: s[10] ?? null,
    timestamp: s[4] ? new Date(s[4] * 1000).toISOString() : new Date().toISOString(),
    observed_at: s[3] ? new Date(s[3] * 1000).toISOString() : new Date().toISOString(),
    confidence: 0.9,
    severity: 'low',
    risk_score: 40,
    tags: ['air', 'ads-b'],
    metadata: { callsign: (s[1] || '').trim(), squawk: s[14] }
  }, s))
}

async function getSpaceEvents(): Promise<Array<CanonicalEvent | UpstreamFailure>> {
  const celestrak = await fetchJson('https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=json', 'CelesTrak', undefined, 1)
  if ('_upstream_error' in celestrak) return [celestrak]
  return (Array.isArray(celestrak) ? celestrak : []).slice(0, 30).map((obj: any, idx: number) => canonicalize({
    id: `space-${idx}`,
    entity_type: 'space',
    source: 'CelesTrak',
    source_url: 'https://celestrak.org/',
    title: obj.OBJECT_NAME || 'Orbital object',
    description: `NORAD ${obj.NORAD_CAT_ID}`,
    altitude: null,
    velocity: null,
    heading: null,
    timestamp: new Date().toISOString(),
    observed_at: new Date().toISOString(),
    confidence: 0.82,
    severity: 'low',
    risk_score: 30,
    tags: ['space', 'tle'],
    metadata: { norad_id: obj.NORAD_CAT_ID, epoch: obj.EPOCH }
  }, obj))
}

async function getSeaEvents(): Promise<Array<CanonicalEvent | UpstreamFailure>> {
  const relief = await fetchJson('https://api.reliefweb.int/v1/disasters?appname=sentinelx&limit=20&query[value]=flood%20OR%20storm', 'ReliefWeb', undefined, 1)
  if ('_upstream_error' in relief) return [relief]
  const rows = Array.isArray(relief.data) ? relief.data : []
  return rows.map((r: any, idx: number) => canonicalize({
    id: `sea-${idx}`,
    entity_type: 'sea',
    source: 'ReliefWeb (AIS substitute when free AIS unavailable)',
    source_url: r.fields?.url || 'https://reliefweb.int/',
    title: r.fields?.name || 'Maritime-relevant disaster',
    description: 'No free unauthenticated global AIS stream was reachable in this build; using maritime-adjacent open incident feed.',
    confidence: 0.3,
    severity: 'low',
    risk_score: 20,
    tags: ['sea', 'limited-feed', 'fallback']
  }, r))
}

app.get('/', (c) => c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>SENTINEL-X</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css" />
  <link rel="stylesheet" href="/static/style.css" />
</head>
<body>
  <div id="app">Booting SENTINEL-X…</div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
  <script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
  <script src="/static/sentinel.js" defer></script>
</body>
</html>`))

app.get('/api/health', (c) => c.json({ status: 'ok', service: 'SENTINEL-X BFF', version: '2.0.0', time: new Date().toISOString() }))

app.get('/api/status', (c) => c.json({
  runtime: 'cloudflare-pages-compatible',
  keyed_services: {
    alienvault_otx: Boolean(c.env.OTX_KEY),
    opensky_auth: Boolean(c.env.OPENSKY_USERNAME && c.env.OPENSKY_PASSWORD)
  },
  notes: [
    'No secrets are exposed to browser code.',
    'GPS/GNSS anomalies include inferred confidence and provenance labels.'
  ]
}))

app.get('/api/layers/air', async (c) => c.json({ events: await getAirEvents(c.env) }))
app.get('/api/layers/sea', async (c) => c.json({ events: await getSeaEvents() }))
app.get('/api/layers/space', async (c) => c.json({ events: await getSpaceEvents() }))
app.get('/api/layers/weather', async (c) => c.json({ events: await getWeatherEvents() }))
app.get('/api/layers/conflict', async (c) => c.json({ events: await getConflictEvents() }))
app.get('/api/layers/cyber', async (c) => c.json({ events: await getCyberEvents(c.env) }))
app.get('/api/layers/gnss', async (c) => c.json({ events: await getGNSSEvents() }))
app.get('/api/layers/social', async (c) => c.json({ events: await getSocialEvents() }))

app.post('/api/fusion/viewport', async (c) => {
  const body = await c.req.json().catch(() => ({})) as { north?: number; south?: number; east?: number; west?: number; domains?: string[] }
  const bounds = {
    north: body.north ?? 90,
    south: body.south ?? -90,
    east: body.east ?? 180,
    west: body.west ?? -180
  }

  const domainFns: Record<string, () => Promise<Array<CanonicalEvent | UpstreamFailure>>> = {
    air: () => getAirEvents(c.env),
    sea: getSeaEvents,
    space: getSpaceEvents,
    weather: getWeatherEvents,
    conflict: getConflictEvents,
    cyber: () => getCyberEvents(c.env),
    gnss: getGNSSEvents,
    social: getSocialEvents
  }

  const domains = (body.domains && body.domains.length ? body.domains : Object.keys(domainFns)).filter((d) => d in domainFns)
  const resolved = await Promise.all(domains.map(async (domain) => ({ domain, events: await domainFns[domain]() })))

  const data = resolved.map(({ domain, events }) => ({
    domain,
    events: events.filter((event) => '_upstream_error' in event || inBounds(event, bounds))
  }))

  return c.json({
    generated_at: new Date().toISOString(),
    bounds,
    domains,
    data
  })
})

export default app
