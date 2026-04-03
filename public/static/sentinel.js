/**
 * SENTINEL OS v6.1 — Global Situational Awareness Client
 *
 * Architecture:
 *   - Waits for Leaflet before initializing (loaded by HTML shell dependency loader)
 *   - All API calls go through backend BFF (/api/*) — no secrets in browser
 *   - Every entity uses canonical event schema with provenance + confidence
 *   - Inferred locations explicitly marked and visually down-weighted
 *   - Domain-organized layer groups with graceful failure per source
 *   - Inspector panel shows full provenance, confidence, severity, source URL
 */
;(function () {
  'use strict'

  // ═══════════════════════════════════════════════════════════════════════════
  // FETCH HELPERS — all traffic via BFF
  // ═══════════════════════════════════════════════════════════════════════════
  async function api(path, opts) {
    try {
      const r = await fetch(path, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts?.headers || {}) } })
      const ct = r.headers.get('content-type') || ''
      if (ct.includes('text/plain') || ct.includes('text/csv')) return await r.text()
      return await r.json()
    } catch (e) { return { _upstream_error: true, message: String(e), events: [] } }
  }
  function proxy(target, params) { return api('/api/proxy', { method: 'POST', body: JSON.stringify({ target, params }) }) }
  function postApi(path, body) { return api(path, { method: 'POST', body: JSON.stringify(body) }) }
  function getApi(path) { return api(path) }
  function isErr(v) { return v && typeof v === 'object' && v._upstream_error === true }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSTANTS
  // ═══════════════════════════════════════════════════════════════════════════
  const DIRECT = {
    USGS: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson',
    ISS: 'https://api.wheretheiss.at/v1/satellites/25544',
  }

  const LAYERS = {
    aircraft:   { label: 'AIRCRAFT',       icon: '\u2708',  color: '#00ccff', domain: 'AIR',     src: 'OpenSky ADS-B' },
    military:   { label: 'MIL AIR',        icon: '\u2708',  color: '#ff3355', domain: 'AIR',     src: 'ADS-B Exchange + OpenSky' },
    ships:      { label: 'MARITIME AIS',   icon: '\u2693',  color: '#00ff88', domain: 'SEA',     src: 'AISStream.io' },
    darkships:  { label: 'DARK FLEET',     icon: '\u2753',  color: '#9933ff', domain: 'SEA',     src: 'GFW Gap Events' },
    fishing:    { label: 'FISHING',        icon: '\uD83D\uDC1F', color: '#33ffcc', domain: 'SEA', src: 'GFW Events' },
    iss:        { label: 'ISS',            icon: '\uD83D\uDE80', color: '#ff6600', domain: 'SPACE', src: 'wheretheiss.at + SGP4' },
    satellites: { label: 'SATELLITES',     icon: '\u2605',  color: '#ffcc00', domain: 'SPACE',   src: 'N2YO + CelesTrak' },
    debris:     { label: 'DEBRIS',         icon: '\u2715',  color: '#cc2255', domain: 'SPACE',   src: 'CelesTrak SGP4' },
    seismic:    { label: 'SEISMIC',        icon: '!',       color: '#ffee00', domain: 'WEATHER', src: 'USGS Earthquake API' },
    wildfires:  { label: 'WILDFIRES',      icon: '\uD83D\uDD25', color: '#ff5500', domain: 'WEATHER', src: 'NASA FIRMS' },
    weather:    { label: 'WEATHER',        icon: '\uD83C\uDF00', color: '#4477ff', domain: 'WEATHER', src: 'OpenWeatherMap' },
    conflict:   { label: 'CONFLICT',       icon: '\u2694',  color: '#ff2200', domain: 'CONFLICT', src: 'GDELT + NewsAPI' },
    disasters:  { label: 'DISASTERS',      icon: '\u26A0',  color: '#ff8c00', domain: 'CONFLICT', src: 'GDACS + ReliefWeb' },
    nuclear:    { label: 'NUCLEAR',        icon: '\u2622',  color: '#ff00ff', domain: 'CONFLICT', src: 'GDELT Nuclear' },
    cyber:      { label: 'CYBER',          icon: '\uD83D\uDD12', color: '#66ffcc', domain: 'CYBER', src: 'CISA + OTX + URLhaus + ThreatFox' },
    gnss:       { label: 'GNSS',           icon: '\uD83D\uDCE1', color: '#ff6633', domain: 'GNSS', src: 'Curated + GDELT' },
    social:     { label: 'SOCIAL',         icon: '\uD83D\uDCF1', color: '#ff44aa', domain: 'SOCIAL', src: 'Reddit OSINT' },
  }

  const THREAT_ZONES = [
    { name:'Ukraine/Russia Front',  lat:48.5, lon:37.0, r:400, base:55, type:'conflict' },
    { name:'Gaza Strip',            lat:31.4, lon:34.5, r:120, base:70, type:'conflict' },
    { name:'Iran Theater',          lat:32.4, lon:53.7, r:500, base:65, type:'flashpoint' },
    { name:'Red Sea/Houthi',        lat:14.5, lon:43.5, r:350, base:60, type:'chokepoint' },
    { name:'Strait of Hormuz',      lat:26.5, lon:56.3, r:180, base:50, type:'chokepoint' },
    { name:'Taiwan Strait',         lat:24.5, lon:120.0, r:250, base:55, type:'flashpoint' },
    { name:'South China Sea',       lat:13.5, lon:115.0, r:500, base:45, type:'flashpoint' },
    { name:'Korean Peninsula',      lat:38.0, lon:127.5, r:200, base:50, type:'flashpoint' },
    { name:'Sudan Civil War',       lat:15.5, lon:32.5, r:350, base:50, type:'conflict' },
    { name:'Black Sea',             lat:43.5, lon:34.5, r:400, base:45, type:'flashpoint' },
    { name:'Sahel Insurgency',      lat:14.0, lon:2.0,  r:600, base:40, type:'conflict' },
    { name:'Kashmir LOC',           lat:34.0, lon:74.5, r:200, base:45, type:'flashpoint' },
  ]

  const SQUAWK_DB = {
    '7500': { label:'HIJACK', sev:'critical' },
    '7600': { label:'COMMS FAIL', sev:'high' },
    '7700': { label:'EMERGENCY', sev:'critical' },
    '7777': { label:'MIL INTERCEPT', sev:'high' },
    '7400': { label:'UAV LOST LINK', sev:'high' },
  }

  const MIL_RE = /^(RCH|USAF|REACH|DUKE|NATO|JAKE|VIPER|GHOST|BRONC|BLADE|EVAC|KNIFE|EAGLE|COBRA|REAPER|FURY|IRON|WOLF|HAWK|RAPTOR|TITAN|NAVY|SKULL|DEMON|PYTHON)/i

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════════
  let map = null
  const entities = []          // CanonicalEvent[]
  const layerGroups = {}       // layerKey → L.LayerGroup
  const layerState = {}        // layerKey → boolean (visible)
  const sourceHealth = {}      // layerKey → 'live'|'error'|'loading'
  const counts = {}            // layerKey → number
  let selected = null          // inspected entity
  let searchQuery = ''
  let searchResults = []
  let searchOpen = false
  let panel = 'layers'         // layers | threat | sources
  let showZones = true
  let cycle = 0
  let timeline = []            // log entries
  // ── TIMELINE ──
  let tlEnabled = false, tlCursor = Date.now(), tlWindow = 86400000, tlPlaying = false, tlSpeed = 1, tlPlayTimer = null
  // ── UI STATE ──
  let activeDomain = "ALL"
  let drawerOpen = false
  let drawerTarget = "layers"
  let cardExpanded = {}
  const seenHashes = new Set()
  let sourceHealthData = []
  let lastFetchMs = 0
  let renderScheduled = false
  const zoneCircles = []
  const zoneLabels = []

  Object.keys(LAYERS).forEach(k => { layerState[k] = true; sourceHealth[k] = 'loading'; counts[k] = 0 })
  // Off by default
  ;['ships', 'debris'].forEach(k => { layerState[k] = false })

  // ═══════════════════════════════════════════════════════════════════════════
  // THREAT SCORING
  // ═══════════════════════════════════════════════════════════════════════════
  function haversine(a, b, c, d) { const R=6371,x=(c-a)*Math.PI/180,y=(d-b)*Math.PI/180,z=Math.sin(x/2)**2+Math.cos(a*Math.PI/180)*Math.cos(c*Math.PI/180)*Math.sin(y/2)**2; return R*2*Math.atan2(Math.sqrt(z),Math.sqrt(1-z)) }

  function scoreThreat(e) {
    let s = 0; const reasons = []
    if (e.entity_type === 'aircraft' && e.metadata?.squawk && SQUAWK_DB[e.metadata.squawk]) { s += 70; reasons.push('SQUAWK ' + e.metadata.squawk) }
    if (e.entity_type === 'military_air') { s += 12; reasons.push('Military asset') }
    if (e.entity_type === 'dark_vessel') { s += 28; reasons.push('AIS gap') }
    if (e.entity_type === 'seismic') { const m = e.metadata?.magnitude || 0; if (m >= 7) { s += 75; reasons.push('M' + m) } else if (m >= 5) { s += 35; reasons.push('M' + m) } }
    if (e.entity_type === 'wildfire') { const f = e.metadata?.frp || 0; if (f >= 200) { s += 35; reasons.push('FRP ' + f) } }
    if (e.entity_type?.startsWith('conflict')) { s += 22; reasons.push('Conflict intel') }
    if (e.entity_type?.startsWith('nuclear')) { s += 35; reasons.push('Nuclear intel') }
    if (e.entity_type?.startsWith('cyber')) { s += 15; reasons.push('Cyber threat') }
    if (e.entity_type?.startsWith('gnss')) { s += 20; reasons.push('GNSS anomaly') }
    if (e.entity_type === 'disaster') { s += (e.severity === 'critical' ? 40 : 15); reasons.push('Disaster') }
    // Zone proximity
    if (e.lat != null && e.lon != null) {
      for (const z of THREAT_ZONES) {
        const d = haversine(e.lat, e.lon, z.lat, z.lon)
        if (d < z.r) { const bonus = Math.round(z.base * (1 - d / z.r)); s += bonus; if (bonus >= 8) reasons.push(z.name + ' +' + bonus); break }
      }
    }
    s = Math.min(100, Math.round(s))
    const level = s >= 75 ? 'CRITICAL' : s >= 50 ? 'HIGH' : s >= 28 ? 'MEDIUM' : s >= 10 ? 'LOW' : 'MINIMAL'
    const col = s >= 75 ? '#ff0033' : s >= 50 ? '#ff7700' : s >= 28 ? '#ffcc00' : s >= 10 ? '#44aaff' : '#2a4060'
    return { score: s, level, col, reasons }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PARSERS — convert upstream responses to canonical events
  // ═══════════════════════════════════════════════════════════════════════════
  function ce(partial) {
    return Object.assign({
      id: '', entity_type: '', source: '', source_url: '', title: '', description: '',
      lat: null, lon: null, altitude: null, velocity: null, heading: null,
      timestamp: new Date().toISOString(), observed_at: new Date().toISOString(),
      confidence: 50, severity: 'info', risk_score: 0, region: '', tags: [],
      correlations: [], metadata: {}, provenance: 'direct-api'
    }, partial)
  }

  function parseOpenSky(data) {
    if (!data?.states) return []
    return data.states.filter(s => s[6] != null && s[5] != null && s[8] === false).slice(0, 500).map((s, i) => {
      const cs = (s[1] || '').trim(), isMil = MIL_RE.test(cs)
      const sq = s[14] ? String(s[14]).padStart(4, '0') : null
      const isEmg = sq && SQUAWK_DB[sq]
      return ce({
        id: (isMil ? 'mil_' : 'ac_') + i, entity_type: isMil ? 'military_air' : 'aircraft',
        source: 'OpenSky Network', source_url: 'https://opensky-network.org/',
        title: cs || ('ICAO:' + s[0]), lat: s[6], lon: s[5],
        altitude: s[7] != null ? Math.round(s[7] * 3.28084) : null,
        velocity: s[9] != null ? Math.round(s[9] * 1.944) : null,
        heading: s[10] != null ? Math.round(s[10]) : null,
        confidence: 95, severity: isEmg ? 'critical' : isMil ? 'medium' : 'info',
        tags: [isMil ? 'military' : 'civilian', sq ? 'squawk-' + sq : ''].filter(Boolean),
        metadata: { icao24: s[0], callsign: cs, origin_country: s[2], squawk: sq, baro_alt: s[13], vert_rate: s[11] }
      })
    })
  }

  function parseUSGS(data) {
    if (!data?.features) return []
    return data.features.slice(0, 200).map((f, i) => {
      const p = f.properties, c = f.geometry.coordinates, mag = p.mag != null ? parseFloat(p.mag.toFixed(1)) : 0
      return ce({
        id: 'eq_' + i, entity_type: 'seismic', source: 'USGS', source_url: p.url || 'https://earthquake.usgs.gov/',
        title: 'M' + mag + ' \u2014 ' + (p.place || 'Unknown').slice(0, 60),
        lat: c[1], lon: c[0], altitude: c[2] ? -c[2] : null,
        timestamp: p.time ? new Date(p.time).toISOString() : '', confidence: 95,
        severity: mag >= 7 ? 'critical' : mag >= 5 ? 'high' : mag >= 3 ? 'medium' : 'low',
        tags: ['earthquake', p.tsunami ? 'tsunami-warning' : ''].filter(Boolean),
        metadata: { magnitude: mag, depth_km: c[2], place: p.place, tsunami: p.tsunami, felt: p.felt, significance: p.sig }
      })
    })
  }

  function parseISS(d) {
    if (!d || d.latitude == null) return []
    return [ce({
      id: 'iss_live', entity_type: 'iss', source: 'wheretheiss.at', source_url: 'https://wheretheiss.at/',
      title: 'ISS (ZARYA)', lat: d.latitude, lon: d.longitude,
      altitude: d.altitude ? Math.round(d.altitude) : 408, velocity: d.velocity ? Math.round(d.velocity) : 7660,
      confidence: 98, severity: 'info', tags: ['space-station'],
      metadata: { footprint: d.footprint, visibility: d.visibility }
    })]
  }

  function parseFIRMS(csv) {
    if (!csv || typeof csv !== 'string') return []
    const lines = csv.trim().split('\n'); if (lines.length < 2) return []
    const hdr = lines[0].split(','), li = hdr.indexOf('latitude'), lo = hdr.indexOf('longitude'), fr = hdr.indexOf('frp'), cf = hdr.indexOf('confidence')
    if (li < 0 || lo < 0) return []
    return lines.slice(1, 150).map((row, i) => {
      const c = row.split(','), lat = parseFloat(c[li]), lon = parseFloat(c[lo])
      if (isNaN(lat) || isNaN(lon)) return null
      const frp = parseFloat(c[fr] || '0')
      return ce({
        id: 'fire_' + i, entity_type: 'wildfire', source: 'NASA FIRMS', source_url: 'https://firms.modaps.eosdis.nasa.gov/',
        title: 'VIIRS Hotspot \u2014 ' + (c[5] || 'Unknown'), lat, lon,
        confidence: parseInt(c[cf]) || 50, severity: frp >= 200 ? 'high' : frp >= 50 ? 'medium' : 'low',
        tags: ['wildfire', 'viirs'], metadata: { frp, brightness: c[hdr.indexOf('bright_ti4')], acq_date: c[hdr.indexOf('acq_date')] }
      })
    }).filter(Boolean)
  }

  function parseOWM(data) {
    if (!data?.events) return []
    return data.events.map((s, i) => ce({
      id: 'wx_' + i, entity_type: 'weather', source: 'OpenWeatherMap', source_url: 'https://openweathermap.org/',
      title: (s.name || s._city || 'SYSTEM') + ' \u2014 ' + (s.weather?.[0]?.description || '').toUpperCase(),
      lat: s.coord?.lat, lon: s.coord?.lon, confidence: 90, severity: 'info',
      metadata: { temp_c: s.main?.temp, wind_speed: s.wind?.speed, wind_deg: s.wind?.deg, pressure: s.main?.pressure, humidity: s.main?.humidity, clouds: s.clouds?.all }
    }))
  }

  function parseN2YO(data) {
    if (!data?.above) return []
    return data.above.map((s, i) => ce({
      id: 'sat_' + i, entity_type: 'satellite', source: 'N2YO', source_url: 'https://www.n2yo.com/',
      title: s.satname?.trim() || 'NORAD:' + s.satid, lat: s.satlat, lon: s.satlng,
      altitude: s.satalt ? Math.round(s.satalt) : null, confidence: 90,
      tags: ['satellite'], metadata: { norad_id: s.satid, int_designator: s.intDesignator }
    }))
  }

  function parseGFW(data, type) {
    const entries = Array.isArray(data) ? data : (data?.entries || [])
    return entries.slice(0, 60).map((ev, i) => {
      const pos = ev.position || {}, lat = pos.lat, lon = pos.lon; if (lat == null || lon == null) return null
      const vessel = ev.vessel || {}, name = vessel.name || 'MMSI:' + (vessel.ssvid || i)
      return ce({
        id: (type === 'dark' ? 'gap_' : 'fish_') + i, entity_type: type === 'dark' ? 'dark_vessel' : 'fishing_vessel',
        source: 'Global Fishing Watch', source_url: 'https://globalfishingwatch.org/',
        title: (type === 'dark' ? 'DARK \u2014 ' : '') + name, lat, lon,
        confidence: 80, severity: type === 'dark' ? 'medium' : 'low',
        tags: [type === 'dark' ? 'ais-gap' : 'fishing'],
        metadata: { mmsi: vessel.ssvid, flag: vessel.flag, gap_hours: ev.gap_hours, gear_type: vessel.gear_type }
      })
    }).filter(Boolean)
  }

  function parseGDACS(data) {
    return (data?.features || []).map((f, i) => {
      const p = f.properties || {}, c = f.geometry?.coordinates || []
      if (!c[1] || !c[0]) return null
      const alert = (p.alertlevel || '').toLowerCase()
      return ce({
        id: 'gdacs_' + i, entity_type: 'disaster', source: 'GDACS', source_url: 'https://www.gdacs.org/',
        title: (p.eventtype || 'EV').toUpperCase() + ' \u2014 ' + (p.eventname || p.country || 'Unknown'),
        lat: c[1], lon: c[0], confidence: 90,
        severity: alert === 'red' ? 'critical' : alert === 'orange' ? 'high' : 'medium',
        tags: ['disaster', p.eventtype || ''], metadata: { alert_level: p.alertlevel, country: p.country, severity_value: p.severity, population_affected: p.pop_affected }
      })
    }).filter(Boolean)
  }

  function parseReliefWeb(data) {
    const items = data?.data || []
    return items.slice(0, 50).map((item, i) => {
      const f = item.fields || {}, countries = f.country || []
      const countryName = countries[0]?.name || 'Unknown'
      // ReliefWeb doesn't provide coordinates — use text geocoding
      const geo = GEO_LITE[countryName.toLowerCase()] || null
      return ce({
        id: 'rw_' + i, entity_type: 'disaster', source: 'ReliefWeb',
        source_url: 'https://reliefweb.int/', title: (f.name || 'Disaster Event').slice(0, 100),
        description: `${f.primary_type || ''} — ${f.status || ''} — ${countryName}`,
        lat: geo?.lat || null, lon: geo?.lon || null, region: geo?.region || '',
        timestamp: f.date?.created || '', confidence: geo ? 30 : 0,
        severity: (f.status || '') === 'alert' ? 'high' : 'medium',
        tags: ['disaster', f.primary_type || '', countryName].filter(Boolean),
        provenance: geo ? 'geocoded-inferred' : 'no-location',
        metadata: { country: countryName, type: f.primary_type, status: f.status, glide: f.glide }
      })
    }).filter(Boolean)
  }

  function parseShodan(data) {
    const matches = data?.matches || []
    return matches.slice(0, 40).map((m, i) => ce({
      id: 'shodan_' + i, entity_type: 'cyber_intel',
      source: 'Shodan', source_url: 'https://www.shodan.io/',
      title: `${m.product || 'Service'} on ${m.ip_str || ''}:${m.port || ''}`,
      lat: m.location?.latitude || null, lon: m.location?.longitude || null,
      region: m.location?.country_name || '', confidence: 80, severity: 'medium',
      tags: ['ics', 'scada', m.product || ''].filter(Boolean), provenance: 'direct-api',
      metadata: { ip: m.ip_str, port: m.port, org: m.org, product: m.product, os: m.os, asn: m.asn, city: m.location?.city }
    }))
  }

  // Lightweight geocoder for country names (subset for ReliefWeb/GDELT)
  const GEO_LITE = {
    'ukraine': { lat: 48.4, lon: 31.2, region: 'Eastern Europe' },
    'russia': { lat: 55.8, lon: 37.6, region: 'Eastern Europe' },
    'syria': { lat: 35.0, lon: 38.0, region: 'Middle East' },
    'israel': { lat: 31.0, lon: 34.8, region: 'Middle East' },
    'iran': { lat: 32.4, lon: 53.7, region: 'Middle East' },
    'iraq': { lat: 33.2, lon: 44.4, region: 'Middle East' },
    'yemen': { lat: 15.6, lon: 48.5, region: 'Middle East' },
    'afghanistan': { lat: 33.9, lon: 67.7, region: 'Central Asia' },
    'pakistan': { lat: 30.4, lon: 69.3, region: 'Central Asia' },
    'india': { lat: 20.6, lon: 79.0, region: 'South Asia' },
    'china': { lat: 35.9, lon: 104.2, region: 'Indo-Pacific' },
    'japan': { lat: 36.2, lon: 138.3, region: 'Indo-Pacific' },
    'philippines': { lat: 12.9, lon: 121.8, region: 'Indo-Pacific' },
    'indonesia': { lat: -2.5, lon: 118.0, region: 'Indo-Pacific' },
    'sudan': { lat: 12.9, lon: 30.2, region: 'Africa' },
    'ethiopia': { lat: 9.1, lon: 40.5, region: 'Africa' },
    'somalia': { lat: 6.0, lon: 46.2, region: 'Africa' },
    'nigeria': { lat: 9.1, lon: 8.7, region: 'Africa' },
    'congo': { lat: -4.0, lon: 21.8, region: 'Africa' },
    'mozambique': { lat: -18.7, lon: 35.5, region: 'Africa' },
    'myanmar': { lat: 19.2, lon: 96.7, region: 'Southeast Asia' },
    'turkey': { lat: 39.9, lon: 32.9, region: 'Middle East' },
    'mexico': { lat: 23.6, lon: -102.5, region: 'Americas' },
    'brazil': { lat: -14.2, lon: -51.9, region: 'Americas' },
    'haiti': { lat: 18.9, lon: -72.3, region: 'Americas' },
    'nepal': { lat: 28.4, lon: 84.1, region: 'South Asia' },
    'bangladesh': { lat: 23.7, lon: 90.4, region: 'South Asia' },
  }

  // CelesTrak TLE → SGP4 propagation (if satellite.js loaded)
  function parseCelesTrakTLE(text, type) {
    if (!window.satellite || !text || typeof text !== 'string') return []
    const lines = text.trim().split('\n')
    const results = []
    for (let i = 0; i < lines.length - 2 && results.length < 60; i += 3) {
      const name = lines[i].trim(), line1 = lines[i + 1], line2 = lines[i + 2]
      if (!line1 || !line2 || !line1.startsWith('1') || !line2.startsWith('2')) continue
      try {
        const satrec = satellite.twoline2satrec(line1, line2)
        const now = new Date()
        const posVel = satellite.propagate(satrec, now)
        if (!posVel.position) continue
        const gmst = satellite.gstime(now)
        const geo = satellite.eciToGeodetic(posVel.position, gmst)
        const lat = satellite.degreesLat(geo.latitude)
        const lon = satellite.degreesLong(geo.longitude)
        const alt = geo.height
        if (isNaN(lat) || isNaN(lon)) continue
        const norad = line2.slice(2, 7).trim()
        results.push(ce({
          id: (type === 'debris' ? 'deb_' : 'tle_') + results.length,
          entity_type: type === 'debris' ? 'debris_object' : 'satellite',
          source: 'CelesTrak SGP4', source_url: 'https://celestrak.org/',
          title: name.slice(0, 24), lat, lon,
          altitude: alt ? Math.round(alt) : null, confidence: 92,
          tags: [type || 'satellite', 'tle'], provenance: 'direct-api',
          metadata: { norad_id: norad, inclination: satrec.inclo * 180 / Math.PI, period_min: 2 * Math.PI / satrec.no * 1440 / (2 * Math.PI) }
        }))
      } catch { /* skip invalid TLE */ }
    }
    return results
  }

  // Canonical events from backend (already normalized)
  function passthrough(data, type) {
    if (!data?.events) return []
    return data.events.map(e => Object.assign(ce({}), e))
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ENTITY MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════
  function typeToLayer(et) {
    const map = {
      aircraft: 'aircraft', military_air: 'military', iss: 'iss', satellite: 'satellites', debris_object: 'debris',
      seismic: 'seismic', wildfire: 'wildfires', weather: 'weather',
      fishing_vessel: 'fishing', dark_vessel: 'darkships', ship: 'ships',
      conflict_intel: 'conflict', disaster: 'disasters', nuclear_intel: 'nuclear',
      cyber_vulnerability: 'cyber', cyber_threat_intel: 'cyber', cyber_malware_url: 'cyber', cyber_ioc: 'cyber', cyber_intel: 'cyber',
      gnss_jamming: 'gnss', gnss_spoofing: 'gnss', gnss_news: 'gnss',
      social_post: 'social',
    }
    return map[et] || 'conflict'
  }

  function replaceEntities(newEntities, prefix) {
    // Remove old entities and clear their hashes from dedup set
    const toRemove = entities.filter(e => e.id.startsWith(prefix))
    toRemove.forEach(e => seenHashes.delete(e.raw_payload_hash || e.id))
    // Remove old entities matching prefix
    for (let i = entities.length - 1; i >= 0; i--) {
      if (entities[i].id.startsWith(prefix)) entities.splice(i, 1)
    }
    const deduped = newEntities.filter(e => { const h = e.raw_payload_hash || e.id; if (seenHashes.has(h)) return false; seenHashes.add(h); return true }); entities.push(...deduped)
    refreshMap()
  }

  function refreshCounts() {
    Object.keys(LAYERS).forEach(k => { counts[k] = 0 })
    entities.forEach(e => { const l = typeToLayer(e.entity_type); if (counts[l] !== undefined) counts[l]++ })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAP RENDERING
  // ═══════════════════════════════════════════════════════════════════════════
  const markers = {} // id → L.Marker

  function markerIcon(color, size, severity) {
    const r = size / 2, glow = severity === 'critical' || severity === 'high'
    const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">${glow ? `<circle cx="${r}" cy="${r}" r="${r}" fill="none" stroke="${color}" stroke-width="0.6" opacity="0.4"/>` : ''}<circle cx="${r}" cy="${r}" r="${r - 1}" fill="${color}" opacity="0.8"/><circle cx="${r}" cy="${r}" r="${size * 0.18}" fill="#e0f0ff" opacity="0.9"/></svg>`
    return L.divIcon({ html: `<div class="sm${glow ? ' sm-glow' : ''}">${svg}</div>`, className: '', iconSize: [size, size], iconAnchor: [r, r] })
  }

  function inferredIcon(color, size) {
    const r = size / 2
    const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><circle cx="${r}" cy="${r}" r="${r - 1}" fill="none" stroke="${color}" stroke-width="1.2" stroke-dasharray="3 2" opacity="0.6"/><circle cx="${r}" cy="${r}" r="${size * 0.15}" fill="${color}" opacity="0.5"/></svg>`
    return L.divIcon({ html: `<div class="sm sm-inferred">${svg}</div>`, className: '', iconSize: [size, size], iconAnchor: [r, r] })
  }

  function refreshMap() {
    if (!map) return
    refreshCounts()

    // Clear all layer groups
    Object.values(layerGroups).forEach(g => g.clearLayers())

    var mobile = (typeof isMobile === 'function') && isMobile()
    var mobileLimit = mobile ? 150 : 9999
    var rendered = 0
    var domainKeys = activeDomain === 'ALL' ? null : new Set(domainLayerKeys(activeDomain))
    // Add entities to appropriate layer groups
    tlVisibleEntities().forEach(e => {
      if (e.lat == null || e.lon == null) return
      const layerKey = typeToLayer(e.entity_type)
      const cfg = LAYERS[layerKey]
      if (!cfg || !layerGroups[layerKey]) return
      if (!layerState[layerKey]) return
      if (domainKeys && !domainKeys.has(layerKey)) return
      if (rendered >= mobileLimit) return
      rendered++

      const isInferred = e.provenance === 'geocoded-inferred' || e.provenance === 'no-location'
      const sz = e.severity === 'critical' ? 14 : e.severity === 'high' ? 11 : 9
      const icon = isInferred ? inferredIcon(cfg.color, sz) : markerIcon(cfg.color, sz, e.severity)

      const m = L.marker([e.lat, e.lon], { icon })
      m.on('click', () => { selected = e; renderUI() })

      // Tooltip
      const conf = e.confidence != null ? ` [${e.confidence}%]` : ''
      const prov = isInferred ? ' (INFERRED)' : ''
      m.bindTooltip(`<b>${e.title}</b><br><span style="opacity:0.7">${e.source}${conf}${prov}</span>`, { className: 'sentinel-tooltip', direction: 'top', offset: [0, -6] })

      layerGroups[layerKey].addLayer(m)
    })

    renderUI()
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INIT MAP
  // ═══════════════════════════════════════════════════════════════════════════
  function initMap() {
    if (!window.L) { console.error('Leaflet not loaded'); return }

    map = L.map('map', { center: [25, 30], zoom: 3, zoomControl: false, attributionControl: false, minZoom: 2, maxZoom: 18, worldCopyJump: true, preferCanvas: true })
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18 }).addTo(map)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png', { subdomains: 'abcd', maxZoom: 18, opacity: 0.7 }).addTo(map)

    // Threat zones
    const ztc = { conflict: '#ff2200', chokepoint: '#ff8800', flashpoint: '#ffcc00' }
    THREAT_ZONES.forEach(z => {
      const col = ztc[z.type] || '#ff4400'
      const outer = L.circle([z.lat, z.lon], { radius: z.r * 1000, color: col, weight: 0.6, opacity: 0.3, fillColor: col, fillOpacity: 0.02, dashArray: '5 8', interactive: false }).addTo(map)
      const label = L.marker([z.lat, z.lon], { icon: L.divIcon({ html: `<div style="color:${col};font-size:7px;font-family:'JetBrains Mono',monospace;white-space:nowrap;opacity:0.5;letter-spacing:1.5px;text-transform:uppercase;pointer-events:none">${z.name}</div>`, className: '', iconAnchor: [0, 0] }), interactive: false, zIndexOffset: -1000 }).addTo(map)
      zoneCircles.push(outer)
      zoneLabels.push(label)
    })

    // Create layer groups (clustered for dense layers)
    const CLUSTERED = new Set(['aircraft', 'satellites', 'debris', 'seismic'])
    Object.keys(LAYERS).forEach(k => {
      if (CLUSTERED.has(k) && L.MarkerClusterGroup) {
        const mcg = L.markerClusterGroup({ maxClusterRadius: k === 'seismic' ? 30 : 45, showCoverageOnHover: false, iconCreateFunction: c => {
          const n = c.getChildCount(), col = LAYERS[k].color, sz = n > 100 ? 30 : n > 30 ? 24 : 20
          return L.divIcon({ html: `<div style="width:${sz}px;height:${sz}px;border-radius:50%;background:${col}18;border:1px solid ${col}55;display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono';color:${col};font-size:9px;font-weight:600">${n}</div>`, className: '', iconSize: [sz, sz] })
        }})
        layerGroups[k] = mcg
      } else {
        layerGroups[k] = L.layerGroup()
      }
      if (layerState[k]) layerGroups[k].addTo(map)
    })

    L.control.zoom({ position: 'bottomright' }).addTo(map)
    L.control.scale({ position: 'bottomright', imperial: false }).addTo(map)
  }

  function toggleLayer(k) {
    layerState[k] = !layerState[k]
    if (layerState[k]) { if (map && layerGroups[k]) layerGroups[k].addTo(map) }
    else { if (map && layerGroups[k]) map.removeLayer(layerGroups[k]) }
    renderUI()
  }

  function toggleZones() {
    showZones = !showZones
    zoneCircles.forEach(c => { if (showZones) c.addTo(map); else map.removeLayer(c) })
    zoneLabels.forEach(l => { if (showZones) l.addTo(map); else map.removeLayer(l) })
    renderUI()
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SEARCH
  // ═══════════════════════════════════════════════════════════════════════════
  function doSearch(q) {
    searchQuery = q
    if (!q || q.length < 2) { searchResults = []; return }
    const lower = q.toLowerCase()
    searchResults = entities.filter(e => e.title.toLowerCase().includes(lower) || (e.tags || []).some(t => t.toLowerCase().includes(lower)) || (e.region || '').toLowerCase().includes(lower) || (e.source || '').toLowerCase().includes(lower)).slice(0, 15)
  }

  function flyTo(e) {
    if (e && e.lat != null && e.lon != null && map) {
      map.flyTo([e.lat, e.lon], 8, { duration: 1 })
      selected = e
      renderUI()
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOG
  // ═══════════════════════════════════════════════════════════════════════════
  function log(msg, sev) {
    timeline.unshift({ msg, sev: sev || 'info', time: new Date().toISOString() })
    if (timeline.length > 100) timeline.length = 100
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DATA FETCH — phased loading
  // ═══════════════════════════════════════════════════════════════════════════
  let fetching = false

  async function fetchAll() {
    if (fetching) return
    fetching = true; cycle++
    log('Fetch cycle ' + cycle + ' starting', 'info')

    // Phase 1: Fast free sources
    try {
      const [oskyR, usgsR, issR] = await Promise.allSettled([
        proxy('opensky'), fetch(DIRECT.USGS).then(r => r.json()), fetch(DIRECT.ISS).then(r => r.json())
      ])
      if (oskyR.status === 'fulfilled' && !isErr(oskyR.value)) {
        const parsed = parseOpenSky(oskyR.value)
        replaceEntities(parsed.filter(e => e.entity_type === 'aircraft'), 'ac_')
        replaceEntities(parsed.filter(e => e.entity_type === 'military_air'), 'mil_')
        sourceHealth.aircraft = 'live'; sourceHealth.military = 'live'
        log('Aircraft: ' + parsed.length + ' tracked', 'info')
      } else { sourceHealth.aircraft = 'error'; sourceHealth.military = 'error' }

      if (usgsR.status === 'fulfilled') { replaceEntities(parseUSGS(usgsR.value), 'eq_'); sourceHealth.seismic = 'live'; log('Seismic: ' + counts.seismic, 'info') }
      else { sourceHealth.seismic = 'error' }

      if (issR.status === 'fulfilled') { replaceEntities(parseISS(issR.value), 'iss_'); sourceHealth.iss = 'live' }
      else { sourceHealth.iss = 'error' }
    } catch (e) { log('Phase 1 error: ' + e, 'error') }

    // Phase 2: Keyed sources (proxied)
    try {
      const [firmsR, n2yoR, owmR] = await Promise.allSettled([
        proxy('firms'), proxy('n2yo'), getApi('/api/weather/global')
      ])
      if (firmsR.status === 'fulfilled' && typeof firmsR.value === 'string') { replaceEntities(parseFIRMS(firmsR.value), 'fire_'); sourceHealth.wildfires = 'live'; log('Wildfires: ' + counts.wildfires, 'info') }
      else { sourceHealth.wildfires = 'error' }

      if (n2yoR.status === 'fulfilled' && !isErr(n2yoR.value)) { replaceEntities(parseN2YO(n2yoR.value), 'sat_'); sourceHealth.satellites = 'live' }
      else { sourceHealth.satellites = 'error' }

      if (owmR.status === 'fulfilled' && !isErr(owmR.value)) { replaceEntities(parseOWM(owmR.value), 'wx_'); sourceHealth.weather = 'live' }
      else { sourceHealth.weather = 'error' }
    } catch (e) { log('Phase 2 error: ' + e, 'error') }

    // Phase 3: Slower feeds
    try {
      const [gdacsR, gfwFishR, gfwGapR, rwR] = await Promise.allSettled([
        proxy('gdacs'), proxy('gfw_fishing', datePair()), proxy('gfw_gap', datePair()),
        getApi('/api/reliefweb/disasters')
      ])
      if (gdacsR.status === 'fulfilled' && !isErr(gdacsR.value)) { replaceEntities(parseGDACS(gdacsR.value), 'gdacs_'); sourceHealth.disasters = 'live' }
      else { sourceHealth.disasters = 'error' }

      if (rwR.status === 'fulfilled' && !isErr(rwR.value)) {
        const rwEvents = parseReliefWeb(rwR.value)
        replaceEntities(rwEvents, 'rw_')
        if (sourceHealth.disasters !== 'live') sourceHealth.disasters = rwEvents.length > 0 ? 'live' : 'error'
        log('ReliefWeb: ' + rwEvents.length + ' disasters', 'info')
      }

      if (gfwFishR.status === 'fulfilled' && !isErr(gfwFishR.value)) { replaceEntities(parseGFW(gfwFishR.value, 'fish'), 'fish_'); sourceHealth.fishing = 'live' }
      else { sourceHealth.fishing = 'error' }

      if (gfwGapR.status === 'fulfilled' && !isErr(gfwGapR.value)) { replaceEntities(parseGFW(gfwGapR.value, 'dark'), 'gap_'); sourceHealth.darkships = 'live' }
      else { sourceHealth.darkships = 'error' }
    } catch (e) { log('Phase 3 error: ' + e, 'error') }

    // Phase 4: Intel
    try {
      const [conflictR, cyberR, nuclearR] = await Promise.allSettled([
        postApi('/api/intel/gdelt', { category: 'conflict' }),
        postApi('/api/intel/gdelt', { category: 'cyber' }),
        postApi('/api/intel/gdelt', { category: 'nuclear' })
      ])
      if (conflictR.status === 'fulfilled') { replaceEntities(passthrough(conflictR.value), 'gdelt_conflict_'); sourceHealth.conflict = 'live' }
      else { sourceHealth.conflict = 'error' }

      if (cyberR.status === 'fulfilled') { const evts = passthrough(cyberR.value); replaceEntities(evts, 'gdelt_cyber_') }

      if (nuclearR.status === 'fulfilled') { replaceEntities(passthrough(nuclearR.value), 'gdelt_nuclear_'); sourceHealth.nuclear = 'live' }
      else { sourceHealth.nuclear = 'error' }
    } catch (e) { log('Phase 4 error: ' + e, 'error') }

    // Phase 5: Cyber feeds
    setTimeout(async () => {
      try {
        const [kevR, otxR, urlR, tfR] = await Promise.allSettled([
          getApi('/api/cyber/cisa-kev'), getApi('/api/cyber/otx'), getApi('/api/cyber/urlhaus'), getApi('/api/cyber/threatfox')
        ])
        let cyberCount = 0
        if (kevR.status === 'fulfilled' && kevR.value?.events) { replaceEntities(kevR.value.events.map(e => ce(e)), 'kev_'); cyberCount += kevR.value.count || 0 }
        if (otxR.status === 'fulfilled' && otxR.value?.events) { replaceEntities(otxR.value.events.map(e => ce(e)), 'otx_'); cyberCount += otxR.value.count || 0 }
        if (urlR.status === 'fulfilled' && urlR.value?.events) { replaceEntities(urlR.value.events.map(e => ce(e)), 'urlhaus_'); cyberCount += urlR.value.count || 0 }
        if (tfR.status === 'fulfilled' && tfR.value?.events) { replaceEntities(tfR.value.events.map(e => ce(e)), 'threatfox_'); cyberCount += tfR.value.count || 0 }
        sourceHealth.cyber = cyberCount > 0 ? 'live' : 'error'
        log('Cyber feeds: ' + cyberCount + ' indicators', 'info')
      } catch (e) { sourceHealth.cyber = 'error'; log('Cyber fetch error: ' + e, 'error') }
    }, 2000)

    // Phase 6: GNSS + Social
    setTimeout(async () => {
      try {
        const [gnssR, socialR] = await Promise.allSettled([getApi('/api/gnss/anomalies'), getApi('/api/social/reddit')])
        if (gnssR.status === 'fulfilled' && gnssR.value?.events) {
          replaceEntities(gnssR.value.events.map(e => ce(e)), 'gnss_')
          sourceHealth.gnss = 'live'
          log('GNSS: ' + (gnssR.value.zones || 0) + ' zones, ' + (gnssR.value.news || 0) + ' news', 'info')
        } else { sourceHealth.gnss = 'error' }

        if (socialR.status === 'fulfilled' && socialR.value?.events) {
          replaceEntities(socialR.value.events.map(e => ce(e)), 'reddit_')
          sourceHealth.social = 'live'
          log('Social: ' + socialR.value.total + ' posts, ' + socialR.value.geolocated + ' geolocated', 'info')
        } else { sourceHealth.social = 'error' }
      } catch (e) { log('Phase 6 error: ' + e, 'error') }
    }, 4000)

    fetching = false
    refreshMap()
    log('Cycle ' + cycle + ' complete \u2014 ' + entities.length + ' entities', 'info')
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CELESTRAK TLE FETCH
  // ═══════════════════════════════════════════════════════════════════════════
  const TLE_URLS = {
    stations: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle',
    debris_fengyun: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=1999-025&FORMAT=tle',
    military: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=military&FORMAT=tle',
  }

  async function fetchCelesTrak() {
    if (!window.satellite) { log('satellite.js not loaded — skipping TLE propagation', 'info'); return }
    try {
      const [stR, debR] = await Promise.allSettled([
        fetch(TLE_URLS.stations).then(r => r.ok ? r.text() : ''),
        fetch(TLE_URLS.debris_fengyun).then(r => r.ok ? r.text() : ''),
      ])
      let satCount = 0
      if (stR.status === 'fulfilled' && stR.value) {
        const parsed = parseCelesTrakTLE(stR.value, 'satellite')
        replaceEntities(parsed, 'tle_'); satCount += parsed.length
      }
      if (debR.status === 'fulfilled' && debR.value) {
        const parsed = parseCelesTrakTLE(debR.value, 'debris')
        replaceEntities(parsed, 'deb_'); satCount += parsed.length
        sourceHealth.debris = 'live'
      }
      if (satCount > 0) log('CelesTrak SGP4: ' + satCount + ' objects propagated', 'info')
    } catch (e) { log('CelesTrak error: ' + e, 'error') }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SATELLITE IMAGERY ENGINE — NASA GIBS + EOX Sentinel-2
  // ═══════════════════════════════════════════════════════════════════════════
  let showSatPanel = false
  let satDate = ''
  let activeSatLayer = null
  let satTileLayer = null
  let satLabelLayer = null

  const SAT_PRODUCTS = {
    modis_terra: { label: 'MODIS Terra', sub: 'True Color', layer: 'MODIS_Terra_CorrectedReflectance_TrueColor', matrixSet: 'GoogleMapsCompatible_Level9', format: 'jpg', maxZoom: 9, daily: true, desc: '250 m/px daily' },
    modis_aqua: { label: 'MODIS Aqua', sub: 'True Color', layer: 'MODIS_Aqua_CorrectedReflectance_TrueColor', matrixSet: 'GoogleMapsCompatible_Level9', format: 'jpg', maxZoom: 9, daily: true, desc: '250 m/px afternoon pass' },
    viirs_snpp: { label: 'VIIRS SNPP', sub: 'True Color', layer: 'VIIRS_SNPP_CorrectedReflectance_TrueColor', matrixSet: 'GoogleMapsCompatible_Level9', format: 'jpg', maxZoom: 9, daily: true, desc: '250 m/px daily' },
    viirs_night: { label: 'VIIRS Night', sub: 'Day/Night Band', layer: 'VIIRS_SNPP_DayNightBand_AtSensor_M15', matrixSet: 'GoogleMapsCompatible_Level8', format: 'png', maxZoom: 8, daily: false, desc: 'Monthly composite' },
    sentinel2: { label: 'Sentinel-2', sub: 'Cloudless 2024', tileUrl: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857_512/default/GoogleMapsCompatible_Level15/{z}/{y}/{x}.jpg', maxZoom: 15, daily: false, desc: '10 m/px annual mosaic' },
  }

  function initSatDate() {
    const d = new Date(Date.now() - 86400000)
    satDate = d.toISOString().split('T')[0]
  }
  initSatDate()

  function buildGIBSUrl(key) {
    const p = SAT_PRODUCTS[key]
    if (!p || p.tileUrl) return null
    return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${p.layer}/default/${satDate}/${p.matrixSet}/{z}/{y}/{x}.${p.format}`
  }

  function applySatelliteLayer(key) {
    if (!map) return
    if (satTileLayer) { map.removeLayer(satTileLayer); satTileLayer = null }
    if (satLabelLayer) { map.removeLayer(satLabelLayer); satLabelLayer = null }
    if (key === 'none' || !key) { activeSatLayer = null; renderUI(); return }
    const p = SAT_PRODUCTS[key]
    if (!p) return
    const url = p.tileUrl || buildGIBSUrl(key)
    if (!url) return
    activeSatLayer = key
    satTileLayer = L.tileLayer(url, { maxZoom: p.maxZoom || 9, opacity: 0.92, attribution: '' })
    satTileLayer.addTo(map)
    satTileLayer.setZIndex(50)
    // Dark labels over imagery
    satLabelLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png', { subdomains: 'abcd', maxZoom: 18, opacity: 0.7 })
    satLabelLayer.addTo(map)
    satLabelLayer.setZIndex(51)
    log('Satellite: ' + p.label + (p.daily ? ' (' + satDate + ')' : ''), 'info')
    renderUI()
  }

  function changeSatDate(newDate) {
    if (newDate && /^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
      satDate = newDate
      if (activeSatLayer) applySatelliteLayer(activeSatLayer)
    }
  }

  function datePair() {
    const end = new Date().toISOString().split('T')[0]
    const start = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
    return { startDate: start, endDate: end }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UI RENDERING
  // ═══════════════════════════════════════════════════════════════════════════
  function renderUI() {
    refreshCounts()
    const total = Object.values(counts).reduce((a, b) => a + b, 0)
    const threatBoard = entities.map(e => ({ entity: e, ...scoreThreat(e) })).filter(t => t.score >= 10).sort((a, b) => b.score - a.score).slice(0, 40)
    const critCount = threatBoard.filter(t => t.level === 'CRITICAL').length
    const highCount = threatBoard.filter(t => t.level === 'HIGH').length
    const now = new Date(), pad = v => String(v).padStart(2, '0')
    const clock = pad(now.getUTCHours()) + ':' + pad(now.getUTCMinutes()) + ':' + pad(now.getUTCSeconds()) + 'Z'

    let h = ''

    // ── HEADER ──
    h += '<div class="hdr"><div class="hdr-left">'
    h += '<div class="hdr-dot"></div>'
    h += '<span class="hdr-title">SENTINEL</span>'
    h += '<span class="hdr-sub">GLOBAL SITUATIONAL AWARENESS</span>'
    h += `<span class="hdr-btn${showZones ? ' active' : ''}" onclick="S._toggleZones()">ZONES</span>`
    if (critCount > 0) h += `<span class="hdr-alert" onclick="S._setPanel('threat')">${critCount} CRIT</span>`
    h += '</div><div class="hdr-right">'
    h += `<span class="hdr-clock">${clock}</span>`
    h += `<span class="hdr-total">${total.toLocaleString()}</span>`
    h += `<span class="hdr-btn${activeSatLayer ? ' active' : ''}" onclick="S._toggleSat()">SAT</span>`
    h += '</div></div>'

    h += '<div class="classif">UNCLASSIFIED // OPEN SOURCE INTELLIGENCE</div>'

    // ── SATELLITE IMAGERY PANEL ──
    if (showSatPanel) {
      h += '<div class="hud-sat-panel">'
      h += '<div style="padding:8px 12px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--brd)">'
      h += '<span style="font-size:8px;letter-spacing:2px;color:var(--cyan)">SATELLITE IMAGERY</span>'
      h += '<span style="cursor:pointer;color:var(--t3);font-size:10px" onclick="S._toggleSat()">X</span></div>'
      // Date picker
      h += '<div style="padding:6px 12px;display:flex;align-items:center;gap:6px;border-bottom:1px solid var(--brd)">'
      h += '<span style="cursor:pointer;font-size:10px;color:var(--t3)" onclick="S._satDatePrev()">&#9664;</span>'
      h += `<input type="date" value="${satDate}" onchange="S._satDateChange(this.value)" style="flex:1;background:var(--bg1);border:1px solid var(--brd);color:var(--t1);font-family:var(--mono);font-size:9px;padding:3px 6px;border-radius:2px">`
      h += '<span style="cursor:pointer;font-size:10px;color:var(--t3)" onclick="S._satDateNext()">&#9654;</span>'
      h += '<span style="cursor:pointer;font-size:7px;color:var(--cyan);letter-spacing:1px" onclick="S._satDateYesterday()">YESTERDAY</span>'
      h += '</div>'
      h += '<div style="padding:4px 0">'
      h += `<div class="sat-row${!activeSatLayer ? ' sat-active' : ''}" onclick="S._applySat('none')"><span style="font-size:8px;color:var(--t2)">DEFAULT MAP (Off)</span></div>`
      Object.entries(SAT_PRODUCTS).forEach(([key, p]) => {
        h += `<div class="sat-row${activeSatLayer === key ? ' sat-active' : ''}" onclick="S._applySat('${key}')">`
        h += `<div style="font-size:8px;color:var(--t1)">${p.label} <span style="color:var(--t3);font-size:7px">${p.sub}</span></div>`
        h += `<div style="font-size:6.5px;color:var(--t3);margin-top:1px">${p.desc} <span style="color:${p.daily ? 'var(--green)' : 'var(--cyan)'};letter-spacing:1px">${p.daily ? 'DAILY' : 'STATIC'}</span></div>`
        h += '</div>'
      })
      h += '</div>'
      h += '<div style="padding:6px 12px;font-size:6.5px;color:var(--t3);border-top:1px solid var(--brd)">'
      h += '<a href="https://gibs.earthdata.nasa.gov/" target="_blank" style="color:var(--t3);text-decoration:none">NASA GIBS</a>'
      h += ' \u00B7 <a href="https://worldview.earthdata.nasa.gov/" target="_blank" style="color:var(--t3);text-decoration:none">Worldview</a>'
      h += ' \u00B7 <a href="https://s2maps.eu/" target="_blank" style="color:var(--t3);text-decoration:none">EOX S2</a>'
      h += ' \u00B7 Press S to toggle</div>'
      h += '</div>'
    }

    // ── SATELLITE ACTIVE INDICATOR ──
    if (activeSatLayer) {
      const p = SAT_PRODUCTS[activeSatLayer]
      h += '<div class="hud-sat-indicator" onclick="S._toggleSat()">'
      h += `<span style="font-size:7px;color:var(--cyan);letter-spacing:1px">\uD83D\uDEF0 ${p?.label || ''}</span>`
      if (p?.daily) h += `<span style="font-size:7px;color:var(--t3)">${satDate}</span>`
      h += '<span style="font-size:7px;color:var(--red);cursor:pointer" onclick="event.stopPropagation();S._applySat(\'none\')">X OFF</span>'
      h += '</div>'
    }

    // ── SEARCH ──
    h += '<div class="search-wrap">'
    h += `<input class="search-input" type="text" placeholder="Search entities, tags, regions..." value="${searchQuery}" oninput="S._search(this.value)" onfocus="S._searchFocus()" onblur="setTimeout(()=>S._searchBlur(),200)">`
    if (searchOpen && searchResults.length > 0) {
      h += '<div class="search-results">'
      searchResults.forEach((e, i) => {
        const col = LAYERS[typeToLayer(e.entity_type)]?.color || '#fff'
        h += `<div class="search-item" onclick="S._searchSelect(${i})"><span class="dot" style="background:${col}"></span><span class="search-title">${e.title.slice(0, 60)}</span><span class="search-src">${e.source}</span></div>`
      })
      h += '</div>'
    }
    h += '</div>'

    // ── LEFT PANEL (domain tabs + panel tabs) ──
    var mob = isMobile()
    var panelHtml = ''
    var DOMS = ['ALL','AIR','SEA','SPACE','WEATHER','CONFLICT','CYBER','GNSS','SOCIAL']
    panelHtml += "<div class=\"dom-tabs\">"
    DOMS.forEach(function(d,i){ panelHtml += "<div class=\"dom-tab" + (activeDomain===d?" active":"") + "\" onclick=\"S._setDomIdx(" + i + ")\">" + d + "</div>" })
    panelHtml += "</div><div class=\"tabs\">"
    var PANELS = [["layers","LAYERS"],["threat","THREAT " + critCount],["sources","SOURCES"]]
    PANELS.forEach(function(it,i){ panelHtml += "<div class=\"tab" + (panel===it[0]?" active":"") + "\" onclick=\"S._setPanelIdx(" + i + ")\">" + it[1] + "</div>" })
    panelHtml += "</div><div class=\"lp-body\">"
    if(mob){
      if(drawerOpen){ h += "<div class=\"drawer-overlay\" onclick=\"S._closeDrawer()\"></div><div class=\"drawer\">" + panelHtml }
      else { h += "<div class=\"mob-btn-open\" onclick=\"S._openDrawer()\">&#9776; LAYERS</div>" }
    } else {
      h += '<div class="lp">' + panelHtml
    }

    if (panel === 'layers') {
      let currentDomain = ''
      Object.entries(LAYERS).forEach(([k, cfg]) => {
        if (cfg.domain !== currentDomain) { currentDomain = cfg.domain; h += `<div class="domain-hdr">${currentDomain}</div>` }
        const on = layerState[k], st = sourceHealth[k]
        const dotCol = st === 'live' ? '#00ff88' : st === 'error' ? '#ff3355' : '#ffaa00'
        h += `<div class="layer-row${on ? '' : ' off'}" onclick="S._toggle('${k}')">`
        h += `<span class="dot" style="background:${on ? cfg.color : '#0a1520'}"></span>`
        h += `<span class="layer-label">${cfg.icon} ${cfg.label}</span>`
        h += `<span class="layer-count" style="color:${cfg.color}">${counts[k] || 0}</span>`
        h += `<span class="dot-sm" style="background:${dotCol}"></span>`
        h += `<span class="layer-status">${st === 'live' ? 'LIVE' : st === 'error' ? 'ERR' : 'LOAD'}</span>`
        h += '</div>'
      })
    }

    if (panel === 'threat') {
      h += '<div class="threat-summary">'
      h += `<div class="threat-stat"><span class="threat-num" style="color:#ff0033">${critCount}</span><span class="threat-lbl">CRIT</span></div>`
      h += `<div class="threat-stat"><span class="threat-num" style="color:#ff7700">${highCount}</span><span class="threat-lbl">HIGH</span></div>`
      const gi = Math.min(100, Math.round(critCount * 12 + highCount * 5))
      h += `<div class="threat-bar"><div class="threat-fill" style="width:${gi}%;background:${gi >= 75 ? '#ff0033' : gi >= 50 ? '#ff7700' : '#ffcc00'}"></div></div>`
      h += '</div>'
      threatBoard.forEach(t => {
        h += `<div class="threat-item${t.level === 'CRITICAL' ? ' t-crit' : t.level === 'HIGH' ? ' t-high' : ''}" onclick="S._flyTo('${t.entity.id}')">`
        h += `<span class="threat-name">${t.entity.title.slice(0, 50)}</span>`
        h += `<span class="threat-score" style="color:${t.col}">${t.score}</span>`
        if (t.reasons[0]) h += `<div class="threat-reason">${t.reasons[0]}</div>`
        h += '</div>'
      })
    }

    if (panel === 'sources') {
      h += '<div class="domain-hdr">SOURCE HEALTH</div>'
      Object.entries(LAYERS).forEach(([k, cfg]) => {
        const st = sourceHealth[k]
        h += `<div class="src-row"><span class="layer-label">${cfg.label}</span><span class="src-badge ${st}">${st.toUpperCase()}</span><span class="src-detail">${cfg.src}</span></div>`
      })
      if(sourceHealthData.length > 0){
        h += '<div class="domain-hdr" style="margin-top:6px">BACKEND METRICS</div>'
        sourceHealthData.forEach(function(s){
          var stCls = s.status==="live" ? "live" : s.status==="error" ? "error" : "loading"
          var latency = s.latency_ms ? (" " + s.latency_ms + "ms") : ""
          h += '<div class="src-row"><span class="layer-label">' + (s.name||s.key) + '</span><span class="src-badge ' + stCls + '">' + (s.status||'').toUpperCase() + latency + '</span></div>'
        })
      }
      h += '<div class="domain-hdr" style="margin-top:8px">TIMELINE</div>'
      timeline.slice(0, 20).forEach(t => {
        h += `<div class="log-row"><span class="log-time">${t.time.slice(11, 19)}</span><span class="log-msg">${t.msg}</span></div>`
      })
    }

    h += '</div></div>'  // close lp-body + (lp or drawer)

    // u2500u2500 INSPECTOR u2500u2500
    if (selected) {
      const e = selected, t = scoreThreat(e)
      const isInf = e.provenance === 'geocoded-inferred'
      const expKey = e.id
      const isExp = cardExpanded[expKey]
      h += '<div class="rp" data-eid="' + e.id + '">'
      h += '<div class="rp-header">'
      h += '<span class="rp-title">' + e.title.slice(0,80) + '</span>'
      h += '<span class="rp-close" onclick="S._closeInspector()">X</span>'
      h += '</div>'
      h += '<div class="rp-chips">'
      h += '<span class="badge" style="background:' + t.col + '22;color:' + t.col + '">' + t.level + '</span>'
      h += sevChip(e.severity)
      h += confChip(e.confidence, e.provenance)
      h += freshChip(e.timestamp)
      if (isInf) h += '<span class="badge inferred">INF</span>'
      h += '</div>'
      h += '<div class="rp-summary">'
      h += '<span class="rp-key">' + e.source + '</span>'
      h += '<span class="badge">' + e.entity_type.toUpperCase().replace('_',' ') + '</span>'
      if (e.lat != null) h += '<span class="rp-coord">' + e.lat.toFixed(3) + ',' + e.lon.toFixed(3) + (isInf ? ' ~' : '') + '</span>'
      h += '</div>'
      h += '<div class="rp-expand" data-eid="' + expKey + '" onclick="S._toggleCard(this.dataset.eid)">' + (isExp ? 'COLLAPSE' : 'DETAILS') + '</div>'
      if (isExp) {
        h += '<div class="rp-details">'
        h += '<div class="rp-field"><span class="rp-key">SOURCE</span><span class="rp-val">' + e.source + '</span></div>'
        if (e.source_url) h += '<div class="rp-field"><span class="rp-key">URL</span><a href="' + e.source_url + '" target="_blank" class="rp-link">' + e.source_url.slice(0,55) + '</a></div>'
        h += '<div class="rp-field"><span class="rp-key">TIME</span><span class="rp-val">' + e.timestamp + '</span></div>'
        if (e.lat != null) h += '<div class="rp-field"><span class="rp-key">POS</span><span class="rp-val">' + e.lat.toFixed(4) + ', ' + e.lon.toFixed(4) + (isInf ? ' (inferred)' : '') + '</span></div>'
        if (e.altitude != null) h += '<div class="rp-field"><span class="rp-key">ALT</span><span class="rp-val">' + e.altitude.toLocaleString() + ' ft</span></div>'
        if (e.velocity != null) h += '<div class="rp-field"><span class="rp-key">VEL</span><span class="rp-val">' + e.velocity + ' kts</span></div>'
        if (e.region) h += '<div class="rp-field"><span class="rp-key">REGION</span><span class="rp-val">' + e.region + '</span></div>'
        if (e.description) h += '<div class="rp-field"><span class="rp-key">DESC</span><span class="rp-val">' + e.description.slice(0,200) + '</span></div>'
        if (e.tags && e.tags.length > 0) h += '<div class="rp-field"><span class="rp-key">TAGS</span><span class="rp-val">' + e.tags.join(', ') + '</span></div>'
        if (e.entity_type.startsWith('cyber_')) {
          h += '<div class="rp-card cyber-card"><div class="card-header">CYBER INTEL</div>'
          if (e.metadata && e.metadata.cve_id) h += '<div class="rp-field"><span class="rp-key">CVE</span><span class="rp-val">' + e.metadata.cve_id + '</span></div>'
          if (e.metadata && e.metadata.vendor) h += '<div class="rp-field"><span class="rp-key">VENDOR</span><span class="rp-val">' + e.metadata.vendor + '</span></div>'
          if (e.metadata && e.metadata.product) h += '<div class="rp-field"><span class="rp-key">PRODUCT</span><span class="rp-val">' + e.metadata.product + '</span></div>'
          if (e.metadata && e.metadata.malware) h += '<div class="rp-field"><span class="rp-key">MALWARE</span><span class="rp-val">' + e.metadata.malware + '</span></div>'
          if (e.metadata && e.metadata.ioc_value) h += '<div class="rp-field"><span class="rp-key">IOC</span><span class="rp-val mono">' + e.metadata.ioc_value + '</span></div>'
          if (e.metadata && e.metadata.adversary) h += '<div class="rp-field"><span class="rp-key">ADVERSARY</span><span class="rp-val">' + e.metadata.adversary + '</span></div>'
          h += '</div>'
        }
        if (e.entity_type.startsWith('gnss_')) {
          h += '<div class="rp-card gnss-card"><div class="card-header">GNSS ANOMALY</div>'
          if (e.metadata && e.metadata.type) h += '<div class="rp-field"><span class="rp-key">TYPE</span><span class="rp-val">' + e.metadata.type + '</span></div>'
          if (e.metadata && e.metadata.radius_km) h += '<div class="rp-field"><span class="rp-key">RADIUS</span><span class="rp-val">' + e.metadata.radius_km + ' km</span></div>'
          if (e.metadata && e.metadata.affected_systems) h += '<div class="rp-field"><span class="rp-key">AFFECTED</span><span class="rp-val">' + e.metadata.affected_systems + '</span></div>'
          h += '</div>'
        }
        if (e.entity_type === 'social_post') {
          h += '<div class="rp-card social-card"><div class="card-header">SOCIAL INTEL</div>'
          if (e.metadata && e.metadata.subreddit) h += '<div class="rp-field"><span class="rp-key">SUB</span><span class="rp-val">r/' + e.metadata.subreddit + '</span></div>'
          h += '<div class="rp-field"><span class="rp-key">SCORE</span><span class="rp-val">' + (e.metadata && e.metadata.score || 0) + ' | ' + (e.metadata && e.metadata.num_comments || 0) + ' cmt</span></div>'
          if (e.metadata && e.metadata.geolocation_method) h += '<div class="rp-field"><span class="rp-key">GEO</span><span class="rp-val">' + e.metadata.geolocation_method + (e.metadata.matched_location ? ' (' + e.metadata.matched_location + ')' : '') + '</span></div>'
          if (e.source_url) h += '<div class="rp-field"><a href="' + e.source_url + '" target="_blank" class="rp-link">View &#8594;</a></div>'
          h += '</div>'
        }
        if (e.metadata && Object.keys(e.metadata).length > 0) {
          h += '<div class="rp-meta-toggle" onclick="S._metaToggle(this)">RAW METADATA &#9660;</div>'
          h += '<div class="rp-meta" style="display:none">'
          Object.entries(e.metadata).forEach(function([k,v]) {
            if (v != null && v !== '') h += '<div class="rp-field"><span class="rp-key">' + k + '</span><span class="rp-val mono">' + (typeof v === 'object' ? JSON.stringify(v) : String(v).slice(0,200)) + '</span></div>'
          })
          h += '</div>'
        }
        h += '</div>'
      }
      h += '</div>'
    }

    // ── STATS RING ──
    // ── TIMELINE SCRUBBER ──
    h += renderTimeline()
    h += '<div class="stats-ring">'
    const statItems = [
      ['AIR', (counts.aircraft || 0) + (counts.military || 0), '#00ccff'],
      ['SEA', (counts.fishing || 0) + (counts.darkships || 0) + (counts.ships || 0), '#00ff88'],
      ['ORB', (counts.satellites || 0) + (counts.debris || 0), '#ffcc00'],
      ['WX', (counts.seismic || 0) + (counts.wildfires || 0) + (counts.weather || 0), '#4477ff'],
      ['INT', (counts.conflict || 0) + (counts.disasters || 0) + (counts.nuclear || 0), '#ff2200'],
      ['CYB', counts.cyber || 0, '#66ffcc'],
      ['GPS', counts.gnss || 0, '#ff6633'],
      ['SOC', counts.social || 0, '#ff44aa'],
    ]
    statItems.forEach(([l, c, col]) => {
      h += `<div class="stat"><span class="stat-lbl" style="color:${col}88">${l}</span><span class="stat-val" style="color:${col}">${c}</span></div>`
    })
    h += `<div class="stat total"><span class="stat-val">${total.toLocaleString()}</span></div>`
    h += '</div>'

    // ── MOBILE BAR ──
    h += '<div class="mob-bar">'
    ;[['layers', 'LAYERS'], ['threat', 'THREAT'], ['sources', 'LOGS']].forEach(([id, l]) => {
      h += `<div class="mob-tab${panel === id ? ' active' : ''}" onclick="S._setPanel('${id}')">${l}</div>`
    })
    h += '</div>'

    document.getElementById('hud').innerHTML = h

    // Remove loading screen on first render
    const loadEl = document.getElementById('loading')
    if (loadEl) loadEl.style.display = 'none'
  }
  // ═══════════════════════════════════════════════════════════════════════════
  // TIMELINE / REPLAY ENGINE
  // ═══════════════════════════════════════════════════════════════════════════
  function tlWindowStart() { return tlEnabled ? tlCursor - tlWindow : 0 }
  function tlVisibleEntities() {
    if (!tlEnabled) return entities
    var cutoff = tlCursor
    return entities.filter(function(e) {
      if (!e.timestamp) return true
      var t = new Date(e.timestamp).getTime()
      return !isNaN(t) && t <= cutoff
    })
  }
  function tlPlay() {
    if (tlPlayTimer) clearInterval(tlPlayTimer)
    tlPlaying = true
    tlPlayTimer = setInterval(function() {
      tlCursor += 300000 * tlSpeed
      if (tlCursor >= Date.now()) { tlCursor = Date.now(); tlPause() }
      refreshMap(); renderUI()
    }, 400)
  }
  function tlPause() {
    if (tlPlayTimer) { clearInterval(tlPlayTimer); tlPlayTimer = null }
    tlPlaying = false
  }
  function tlReset() { tlPause(); tlCursor = Date.now() - tlWindow; refreshMap(); renderUI() }
  function tlJumpNow() { tlPause(); tlCursor = Date.now(); refreshMap(); renderUI() }
  function tlToggle() { tlEnabled = !tlEnabled; if (!tlEnabled) { tlPause(); refreshMap() } renderUI() }
  function tlCycleSpeed() { tlSpeed = tlSpeed >= 8 ? 1 : tlSpeed * 2; renderUI() }
  function tlCycleWindow() {
    var wins = [3600000, 21600000, 43200000, 86400000, 172800000]
    var i = wins.indexOf(tlWindow); tlWindow = wins[(i + 1) % wins.length]
    tlReset()
  }
  function tlSeek(ev) {
    var rect = ev.currentTarget.getBoundingClientRect()
    var pct = (ev.clientX - rect.left) / rect.width
    tlCursor = Math.round(tlWindowStart() + pct * tlWindow)
    refreshMap(); renderUI()
  }
  function tlWinLabel() {
    return tlWindow === 3600000 ? '1H' : tlWindow === 21600000 ? '6H' : tlWindow === 43200000 ? '12H' : tlWindow === 86400000 ? '24H' : '48H'
  }
  function renderTimeline() {
    if (!tlEnabled) {
      return '<div class="tl-toggle" onclick="S._tlToggle()" title="Open replay timeline">&#128342; REPLAY</div>'
    }
    var h = ''
    var now = Date.now(), start = tlWindowStart(), range = tlWindow
    var pct = Math.max(0, Math.min(100, (tlCursor - start) / range * 100))
    function fmtT(ms) { var d = new Date(ms); return String(d.getUTCHours()).padStart(2,'0') + ':' + String(d.getUTCMinutes()).padStart(2,'0') + 'Z' }
    function fmtD(ms) { return new Date(ms).toISOString().slice(0, 10) }
    var buckets = new Array(60).fill(0)
    entities.forEach(function(e) {
      if (!e.timestamp) return
      var t = new Date(e.timestamp).getTime()
      if (isNaN(t)) return
      var i = Math.floor((t - start) / range * 60)
      if (i >= 0 && i < 60) buckets[i]++
    })
    var mx = Math.max(1, Math.max.apply(null, buckets))
    h += '<div class="tl-bar">'
    h += '<div class="tl-ctrl">'
    h += '<span class="tl-lbl" onclick="S._tlToggle()">&#128342; REPLAY</span>'
    h += '<span class="tl-btn" onclick="S._tlReset()">|&#9664;</span>'
    h += '<span class="tl-btn' + (tlPlaying ? ' active' : '') + '" onclick="S._tlPlayPause()">' + (tlPlaying ? '&#9646;&#9646;' : '&#9654;') + '</span>'
    h += '<span class="tl-btn" onclick="S._tlNow()">NOW</span>'
    h += '<span class="tl-spd" onclick="S._tlCycleSpeed()">x' + tlSpeed + '</span>'
    h += '<span class="tl-win" onclick="S._tlCycleWindow()">' + tlWinLabel() + '</span>'
    h += '</div>'
    h += '<div class="tl-track" onclick="S._tlSeek(event)">'
    h += '<div class="tl-hist">'
    buckets.forEach(function(b) { var hp = Math.round(b / mx * 100); h += '<div class="tl-hbar" style="height:' + hp + '%"></div>' })
    h += '</div>'
    h += '<div class="tl-cursor" style="left:' + pct.toFixed(2) + '%"></div>'
    h += '</div>'
    h += '<div class="tl-labels"><span>' + fmtD(start) + ' ' + fmtT(start) + '</span><span class="tl-now">' + fmtD(tlCursor) + ' ' + fmtT(tlCursor) + '</span><span>' + fmtT(now) + '</span></div>'
    h += '</div>'
    return h
  }


  // ═══════════════════════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS — freshness, chips, domain, mobile
  // ═══════════════════════════════════════════════════════════════════════════
  function isMobile() { return window.innerWidth < 768 }

  function freshness(ts) {
    if (!ts) return { label: "NO DATE", cls: "fr-old" }
    const age = Date.now() - new Date(ts).getTime()
    if (age < 300000)  return { label: "LIVE",    cls: "fr-live" }
    if (age < 3600000) return { label: "< 1H",    cls: "fr-recent" }
    if (age < 86400000) return { label: "< 24H",  cls: "fr-stale" }
    return { label: "OLD",  cls: "fr-old" }
  }

  function confChip(n, prov) {
    const cls = n >= 80 ? "cc-high" : n >= 50 ? "cc-med" : "cc-low"
    const inferred = prov === "geocoded-inferred" ? " INFERRED" : ""
    return "<span class=\"chip " + cls + "\">" + n + "%" + inferred + "</span>"
  }

  function sevChip(s) {
    const col = s === "critical" ? "chip-crit" : s === "high" ? "chip-high" : s === "medium" ? "chip-med" : s === "low" ? "chip-low" : "chip-info"
    return s !== "info" ? "<span class=\"chip " + col + "\">" + s.toUpperCase() + "</span>" : ""
  }

  function freshChip(ts) {
    const f = freshness(ts)
    return "<span class=\"chip " + f.cls + "\">" + f.label + "</span>"
  }

  function domainLayerKeys(dom) {
    return Object.entries(LAYERS).filter(function(kv){ return kv[1].domain === dom }).map(function(kv){ return kv[0] })
  }

  function setActiveDomain(dom) {
    activeDomain = dom
    refreshMap()
    renderUI()
  }

  function openDrawer(target) {
    drawerOpen = true
    drawerTarget = target || "layers"
    renderUI()
  }

  function closeDrawer() {
    drawerOpen = false
    renderUI()
  }

  function toggleCardExpand(id) {
    cardExpanded[id] = !cardExpanded[id]
    renderUI()
  }

  function scheduledRefreshMap() {
    if (renderScheduled) return
    renderScheduled = true
    requestAnimationFrame(function() {
      renderScheduled = false
      refreshMap()
    })
  }

  async function fetchSourceHealth() {
    try {
      const data = await getApi("/api/sources/health")
      if (data && data.sources) { sourceHealthData = data.sources; renderUI() }
    } catch(e) { /* non-critical */ }
  }

  // KEYBOARD
  // ═══════════════════════════════════════════════════════════════════════════
  function initKeyboard() {
    document.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT') return
      const k = e.key.toLowerCase()
      if (k === 'escape') { selected = null; searchOpen = false; searchQuery = ''; searchResults = []; renderUI() }
      else if (k === '1') { panel = 'layers'; renderUI() }
      else if (k === '2') { panel = 'threat'; renderUI() }
      else if (k === '3') { panel = 'sources'; renderUI() }
      else if (k === 'z') { toggleZones() }
      else if (k === 's') { showSatPanel = !showSatPanel; renderUI() }
      else if (k === 'r') { fetchAll() }
      else if (k === 't') { tlToggle() }
      else if (k === '/' || k === 'f') { e.preventDefault(); const inp = document.querySelector('.search-input'); if (inp) inp.focus() }
    })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GLOBAL HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════
  window.S = {
    _toggle: toggleLayer,
    _toggleZones: toggleZones,
    _setPanel: p => { panel = p; renderUI() },
    _flyTo: id => { const e = entities.find(x => x.id === id); if (e) flyTo(e) },
    _closeInspector: () => { selected = null; renderUI() },
    _search: q => { doSearch(q); renderUI() },
    _searchFocus: () => { searchOpen = true; renderUI() },
    _searchBlur: () => { searchOpen = false; renderUI() },
    _searchSelect: i => { if (searchResults[i]) { flyTo(searchResults[i]); searchOpen = false; searchQuery = ''; searchResults = []; renderUI() } },
    // Satellite imagery handlers
    _toggleSat: () => { showSatPanel = !showSatPanel; renderUI() },
    _applySat: key => { applySatelliteLayer(key) },
    _satDatePrev: () => { const d = new Date(satDate); d.setDate(d.getDate() - 1); changeSatDate(d.toISOString().split('T')[0]); renderUI() },
    _satDateNext: () => { const d = new Date(satDate); d.setDate(d.getDate() + 1); changeSatDate(d.toISOString().split('T')[0]); renderUI() },
    _satDateChange: v => { changeSatDate(v); renderUI() },
    _satDateYesterday: () => { initSatDate(); if (activeSatLayer) applySatelliteLayer(activeSatLayer); renderUI() },
    // Timeline scrubber handlers
    _tlToggle: () => { tlToggle() },
    _tlPlayPause: () => { tlPlaying ? tlPause() : tlPlay() },
    _tlReset: () => { tlReset() },
    _tlNow: () => { tlJumpNow() },
    _tlCycleSpeed: () => { tlCycleSpeed() },
    _tlCycleWindow: () => { tlCycleWindow() },
    _tlSeek: ev => { tlSeek(ev) },
    _setDomIdx: function(i){ setActiveDomain(["ALL","AIR","SEA","SPACE","WEATHER","CONFLICT","CYBER","GNSS","SOCIAL"][i]) },
    _setPanelIdx: function(i){ panel=["layers","threat","sources"][i]; renderUI() },
    _setDomain: function(d){ setActiveDomain(d) },
    _openDrawer: function(){ openDrawer("layers") },
    _closeDrawer: function(){ closeDrawer() },
    _toggleCard: function(id){ toggleCardExpand(id) },
    _metaToggle: function(el){ var s = el.nextElementSibling; if(s) s.style.display = s.style.display === 'none' ? 'block' : 'none' },
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BOOT
  // ═══════════════════════════════════════════════════════════════════════════
  function boot() {
    console.log('%c SENTINEL OS v6.1 ', 'background:#00ff88;color:#020a12;font-weight:bold;font-size:14px;padding:4px 8px;border-radius:3px')
    console.log('Global Situational Awareness Platform — 20+ live OSINT layers')
    initMap()
    initKeyboard()
    renderUI()
    log('SENTINEL OS v6.2 initialized', 'info')
    fetchAll()
    fetchSourceHealth()
    setInterval(fetchSourceHealth, 120000)
    // CelesTrak TLE propagation (delayed — non-critical)
    setTimeout(fetchCelesTrak, 3000)
    // Periodic refresh
    setInterval(fetchAll, 60000)
    setInterval(fetchCelesTrak, 180000) // Refresh TLEs every 3 min
    setInterval(() => { const issE = entities.find(e => e.id === 'iss_live'); if (issE) { fetch(DIRECT.ISS).then(r => r.json()).then(d => { if (d?.latitude != null) { replaceEntities(parseISS(d), 'iss_') } }).catch(() => {}) } }, 5000)
    setInterval(renderUI, 3000)
  }

  boot()
})()
