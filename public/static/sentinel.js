/**
 * SENTINEL OS v7.0 — Global Situational Awareness Client
 *
 * Architecture:
 *   - Waits for Leaflet before initializing (loaded by HTML shell dependency loader)
 *   - All API calls go through backend BFF (/api/*) — no secrets in browser
 *   - Every entity uses canonical event schema with provenance + confidence + raw_payload_hash
 *   - Inferred locations explicitly marked and visually down-weighted
 *   - Domain-organized layer groups with graceful failure per source
 *   - Inspector panel shows full provenance, confidence, severity, source URL, hash
 *   - Time scrubber for temporal filtering
 *   - Connection health heartbeat
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
    social:     { label: 'SOCIAL',         icon: '\uD83D\uDCF1', color: '#ff44aa', domain: 'SOCIAL', src: 'Reddit + Mastodon OSINT' },
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
  const entities = []
  const layerGroups = {}
  const layerState = {}
  const sourceHealth = {}
  const counts = {}
  let selected = null
  let searchQuery = ''
  let searchResults = []
  let searchOpen = false
  let panel = 'layers'
  let showZones = true
  let cycle = 0
  let timeline = []
  const zoneCircles = []
  const zoneLabels = []

  // Connection health
  let lastFetchTime = 0
  let connectionOk = true
  let nextRefreshAt = 0

  // Time scrubber
  let scrubberEnabled = false
  let scrubberHours = 24  // show last N hours

  Object.keys(LAYERS).forEach(k => { layerState[k] = true; sourceHealth[k] = 'loading'; counts[k] = 0 })
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
  // FRESHNESS HELPER
  // ═══════════════════════════════════════════════════════════════════════════
  function freshness(ts) {
    if (!ts) return { label: 'UNKNOWN', cls: 'fresh-old' }
    const age = Date.now() - new Date(ts).getTime()
    if (age < 3600000) return { label: Math.round(age / 60000) + 'm AGO', cls: 'fresh-live' }
    if (age < 86400000) return { label: Math.round(age / 3600000) + 'h AGO', cls: 'fresh-stale' }
    return { label: Math.round(age / 86400000) + 'd AGO', cls: 'fresh-old' }
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
      correlations: [], metadata: {}, raw_payload_hash: '', provenance: 'direct-api'
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
      const geo = GEO_LITE[countryName.toLowerCase()] || null
      return ce({
        id: 'rw_' + i, entity_type: 'disaster', source: 'ReliefWeb',
        source_url: 'https://reliefweb.int/', title: (f.name || 'Disaster Event').slice(0, 100),
        description: (f.primary_type || '') + ' \u2014 ' + (f.status || '') + ' \u2014 ' + countryName,
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
      title: (m.product || 'Service') + ' on ' + (m.ip_str || '') + ':' + (m.port || ''),
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
    'libya': { lat: 26.3, lon: 17.2, region: 'Africa' },
    'egypt': { lat: 26.8, lon: 30.8, region: 'Africa' },
    'south africa': { lat: -30.6, lon: 22.9, region: 'Africa' },
    'kenya': { lat: -1.3, lon: 36.8, region: 'Africa' },
  }

  // CelesTrak TLE -> SGP4 propagation (if satellite.js loaded)
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
  function passthrough(data) {
    if (!data?.events) return []
    return data.events.map(function(e) { return Object.assign(ce({}), e) })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ENTITY MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════
  function typeToLayer(et) {
    var m = {
      aircraft: 'aircraft', military_air: 'military', iss: 'iss', satellite: 'satellites', debris_object: 'debris',
      seismic: 'seismic', wildfire: 'wildfires', weather: 'weather',
      fishing_vessel: 'fishing', dark_vessel: 'darkships', ship: 'ships',
      conflict_intel: 'conflict', disaster: 'disasters', nuclear_intel: 'nuclear',
      cyber_vulnerability: 'cyber', cyber_threat_intel: 'cyber', cyber_malware_url: 'cyber', cyber_ioc: 'cyber', cyber_intel: 'cyber',
      gnss_jamming: 'gnss', gnss_spoofing: 'gnss', gnss_news: 'gnss',
      social_post: 'social',
    }
    return m[et] || 'conflict'
  }

  function replaceEntities(newEntities, prefix) {
    for (var i = entities.length - 1; i >= 0; i--) {
      if (entities[i].id.startsWith(prefix)) entities.splice(i, 1)
    }
    entities.push.apply(entities, newEntities)
    refreshMap()
  }

  function refreshCounts() {
    Object.keys(LAYERS).forEach(function(k) { counts[k] = 0 })
    var cutoff = scrubberEnabled ? Date.now() - scrubberHours * 3600000 : 0
    entities.forEach(function(e) {
      if (scrubberEnabled && e.timestamp) {
        var t = new Date(e.timestamp).getTime()
        if (t > 0 && t < cutoff) return
      }
      var l = typeToLayer(e.entity_type)
      if (counts[l] !== undefined) counts[l]++
    })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAP RENDERING
  // ═══════════════════════════════════════════════════════════════════════════
  function markerIcon(color, size, severity) {
    var r = size / 2, glow = severity === 'critical' || severity === 'high'
    var svg = '<svg width="' + size + '" height="' + size + '" xmlns="http://www.w3.org/2000/svg">' + (glow ? '<circle cx="' + r + '" cy="' + r + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="0.6" opacity="0.4"/>' : '') + '<circle cx="' + r + '" cy="' + r + '" r="' + (r - 1) + '" fill="' + color + '" opacity="0.8"/><circle cx="' + r + '" cy="' + r + '" r="' + (size * 0.18) + '" fill="#e0f0ff" opacity="0.9"/></svg>'
    return L.divIcon({ html: '<div class="sm' + (glow ? ' sm-glow' : '') + '">' + svg + '</div>', className: '', iconSize: [size, size], iconAnchor: [r, r] })
  }

  function inferredIcon(color, size) {
    var r = size / 2
    var svg = '<svg width="' + size + '" height="' + size + '" xmlns="http://www.w3.org/2000/svg"><circle cx="' + r + '" cy="' + r + '" r="' + (r - 1) + '" fill="none" stroke="' + color + '" stroke-width="1.2" stroke-dasharray="3 2" opacity="0.6"/><circle cx="' + r + '" cy="' + r + '" r="' + (size * 0.15) + '" fill="' + color + '" opacity="0.5"/></svg>'
    return L.divIcon({ html: '<div class="sm sm-inferred">' + svg + '</div>', className: '', iconSize: [size, size], iconAnchor: [r, r] })
  }

  function refreshMap() {
    if (!map) return
    refreshCounts()
    Object.values(layerGroups).forEach(function(g) { g.clearLayers() })

    var cutoff = scrubberEnabled ? Date.now() - scrubberHours * 3600000 : 0

    entities.forEach(function(e) {
      if (e.lat == null || e.lon == null) return
      var layerKey = typeToLayer(e.entity_type)
      var cfg = LAYERS[layerKey]
      if (!cfg || !layerGroups[layerKey]) return

      // Time filter
      if (scrubberEnabled && e.timestamp) {
        var t = new Date(e.timestamp).getTime()
        if (t > 0 && t < cutoff) return
      }

      var isInferred = e.provenance === 'geocoded-inferred' || e.provenance === 'no-location'
      var sz = e.severity === 'critical' ? 14 : e.severity === 'high' ? 11 : 9
      var icon = isInferred ? inferredIcon(cfg.color, sz) : markerIcon(cfg.color, sz, e.severity)

      var m = L.marker([e.lat, e.lon], { icon: icon })
      m.on('click', function() { selected = e; renderUI() })

      var conf = e.confidence != null ? ' [' + e.confidence + '%]' : ''
      var prov = isInferred ? ' (INFERRED)' : ''
      m.bindTooltip('<b>' + e.title + '</b><br><span style="opacity:0.7">' + e.source + conf + prov + '</span>', { className: 'sentinel-tooltip', direction: 'top', offset: [0, -6] })

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

    var ztc = { conflict: '#ff2200', chokepoint: '#ff8800', flashpoint: '#ffcc00' }
    THREAT_ZONES.forEach(function(z) {
      var col = ztc[z.type] || '#ff4400'
      var outer = L.circle([z.lat, z.lon], { radius: z.r * 1000, color: col, weight: 0.6, opacity: 0.3, fillColor: col, fillOpacity: 0.02, dashArray: '5 8', interactive: false }).addTo(map)
      var label = L.marker([z.lat, z.lon], { icon: L.divIcon({ html: '<div style="color:' + col + ';font-size:7px;font-family:\'JetBrains Mono\',monospace;white-space:nowrap;opacity:0.5;letter-spacing:1.5px;text-transform:uppercase;pointer-events:none">' + z.name + '</div>', className: '', iconAnchor: [0, 0] }), interactive: false, zIndexOffset: -1000 }).addTo(map)
      zoneCircles.push(outer)
      zoneLabels.push(label)
    })

    var CLUSTERED = { aircraft: 1, satellites: 1, debris: 1, seismic: 1 }
    Object.keys(LAYERS).forEach(function(k) {
      if (CLUSTERED[k] && L.MarkerClusterGroup) {
        var mcg = L.markerClusterGroup({ maxClusterRadius: k === 'seismic' ? 30 : 45, showCoverageOnHover: false, iconCreateFunction: function(c) {
          var n = c.getChildCount(), col = LAYERS[k].color, sz = n > 100 ? 30 : n > 30 ? 24 : 20
          return L.divIcon({ html: '<div style="width:' + sz + 'px;height:' + sz + 'px;border-radius:50%;background:' + col + '18;border:1px solid ' + col + '55;display:flex;align-items:center;justify-content:center;font-family:\'JetBrains Mono\';color:' + col + ';font-size:9px;font-weight:600">' + n + '</div>', className: '', iconSize: [sz, sz] })
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
    zoneCircles.forEach(function(c) { if (showZones) c.addTo(map); else map.removeLayer(c) })
    zoneLabels.forEach(function(l) { if (showZones) l.addTo(map); else map.removeLayer(l) })
    renderUI()
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SEARCH
  // ═══════════════════════════════════════════════════════════════════════════
  function doSearch(q) {
    searchQuery = q
    if (!q || q.length < 2) { searchResults = []; return }
    var lower = q.toLowerCase()
    searchResults = entities.filter(function(e) {
      return e.title.toLowerCase().includes(lower) ||
        (e.tags || []).some(function(t) { return t.toLowerCase().includes(lower) }) ||
        (e.region || '').toLowerCase().includes(lower) ||
        (e.source || '').toLowerCase().includes(lower)
    }).slice(0, 15)
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
    timeline.unshift({ msg: msg, sev: sev || 'info', time: new Date().toISOString() })
    if (timeline.length > 100) timeline.length = 100
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SATELLITE IMAGERY ENGINE — NASA GIBS + EOX Sentinel-2
  // ═══════════════════════════════════════════════════════════════════════════
  var showSatPanel = false
  var satDate = ''
  var activeSatLayer = null
  var satTileLayer = null
  var satLabelLayer = null

  var SAT_PRODUCTS = {
    modis_terra: { label: 'MODIS Terra', sub: 'True Color', layer: 'MODIS_Terra_CorrectedReflectance_TrueColor', matrixSet: 'GoogleMapsCompatible_Level9', format: 'jpg', maxZoom: 9, daily: true, desc: '250 m/px daily' },
    modis_aqua: { label: 'MODIS Aqua', sub: 'True Color', layer: 'MODIS_Aqua_CorrectedReflectance_TrueColor', matrixSet: 'GoogleMapsCompatible_Level9', format: 'jpg', maxZoom: 9, daily: true, desc: '250 m/px afternoon pass' },
    viirs_snpp: { label: 'VIIRS SNPP', sub: 'True Color', layer: 'VIIRS_SNPP_CorrectedReflectance_TrueColor', matrixSet: 'GoogleMapsCompatible_Level9', format: 'jpg', maxZoom: 9, daily: true, desc: '250 m/px daily' },
    viirs_night: { label: 'VIIRS Night', sub: 'Day/Night Band', layer: 'VIIRS_SNPP_DayNightBand_AtSensor_M15', matrixSet: 'GoogleMapsCompatible_Level8', format: 'png', maxZoom: 8, daily: false, desc: 'Monthly composite' },
    sentinel2: { label: 'Sentinel-2', sub: 'Cloudless 2024', tileUrl: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857_512/default/GoogleMapsCompatible_Level15/{z}/{y}/{x}.jpg', maxZoom: 15, daily: false, desc: '10 m/px annual mosaic' },
  }

  function initSatDate() { var d = new Date(Date.now() - 86400000); satDate = d.toISOString().split('T')[0] }
  initSatDate()

  function buildGIBSUrl(key) { var p = SAT_PRODUCTS[key]; if (!p || p.tileUrl) return null; return 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/' + p.layer + '/default/' + satDate + '/' + p.matrixSet + '/{z}/{y}/{x}.' + p.format }

  function applySatelliteLayer(key) {
    if (!map) return
    if (satTileLayer) { map.removeLayer(satTileLayer); satTileLayer = null }
    if (satLabelLayer) { map.removeLayer(satLabelLayer); satLabelLayer = null }
    if (key === 'none' || !key) { activeSatLayer = null; renderUI(); return }
    var p = SAT_PRODUCTS[key]; if (!p) return
    var url = p.tileUrl || buildGIBSUrl(key); if (!url) return
    activeSatLayer = key
    satTileLayer = L.tileLayer(url, { maxZoom: p.maxZoom || 9, opacity: 0.92, attribution: '' })
    satTileLayer.addTo(map); satTileLayer.setZIndex(50)
    satLabelLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png', { subdomains: 'abcd', maxZoom: 18, opacity: 0.7 })
    satLabelLayer.addTo(map); satLabelLayer.setZIndex(51)
    log('Satellite: ' + p.label + (p.daily ? ' (' + satDate + ')' : ''), 'info')
    renderUI()
  }

  function changeSatDate(newDate) { if (newDate && /^\d{4}-\d{2}-\d{2}$/.test(newDate)) { satDate = newDate; if (activeSatLayer) applySatelliteLayer(activeSatLayer) } }

  function datePair() {
    var end = new Date().toISOString().split('T')[0]
    var start = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
    return { startDate: start, endDate: end }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HTML ESCAPE HELPER
  // ═══════════════════════════════════════════════════════════════════════════
  function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

  // ═══════════════════════════════════════════════════════════════════════════
  // UI RENDERING
  // ═══════════════════════════════════════════════════════════════════════════
  function renderUI() {
    refreshCounts()
    var total = Object.values(counts).reduce(function(a, b) { return a + b }, 0)
    var threatBoard = entities.map(function(e) { return Object.assign({ entity: e }, scoreThreat(e)) }).filter(function(t) { return t.score >= 10 }).sort(function(a, b) { return b.score - a.score }).slice(0, 40)
    var critCount = threatBoard.filter(function(t) { return t.level === 'CRITICAL' }).length
    var highCount = threatBoard.filter(function(t) { return t.level === 'HIGH' }).length
    var now = new Date()
    function pad(v) { return String(v).padStart(2, '0') }
    var clock = pad(now.getUTCHours()) + ':' + pad(now.getUTCMinutes()) + ':' + pad(now.getUTCSeconds()) + 'Z'

    // Connection health
    var connClass = connectionOk ? 'conn-ok' : 'conn-err'
    var secToRefresh = Math.max(0, Math.round((nextRefreshAt - Date.now()) / 1000))

    var h = ''

    // -- HEADER --
    h += '<div class="hdr"><div class="hdr-left">'
    h += '<div class="hdr-dot ' + connClass + '"></div>'
    h += '<span class="hdr-title">SENTINEL</span>'
    h += '<span class="hdr-sub">GLOBAL SITUATIONAL AWARENESS</span>'
    h += '<span class="hdr-btn' + (showZones ? ' active' : '') + '" onclick="S._toggleZones()">ZONES</span>'
    if (critCount > 0) h += '<span class="hdr-alert" onclick="S._setPanel(\'threat\')">' + critCount + ' CRIT</span>'
    h += '</div><div class="hdr-right">'
    h += '<span class="hdr-clock">' + clock + '</span>'
    h += '<span class="hdr-total">' + total.toLocaleString() + '</span>'
    h += '<span class="hdr-btn' + (activeSatLayer ? ' active' : '') + '" onclick="S._toggleSat()">SAT</span>'
    h += '<span class="hdr-btn' + (scrubberEnabled ? ' active' : '') + '" onclick="S._toggleScrub()">TIME</span>'
    h += '</div></div>'

    h += '<div class="classif">UNCLASSIFIED // OPEN SOURCE INTELLIGENCE'
    if (cycle > 0) h += ' // CYCLE ' + cycle + ' // REFRESH ' + secToRefresh + 's'
    h += '</div>'

    // -- TIME SCRUBBER --
    if (scrubberEnabled) {
      h += '<div class="scrubber">'
      h += '<span class="scrub-label">TIME FILTER</span>'
      h += '<input type="range" class="scrub-range" min="1" max="72" value="' + scrubberHours + '" oninput="S._scrubChange(this.value)">'
      h += '<span class="scrub-val">LAST ' + scrubberHours + 'h</span>'
      h += '<span class="scrub-close" onclick="S._toggleScrub()">X</span>'
      h += '</div>'
    }

    // -- SATELLITE IMAGERY PANEL --
    if (showSatPanel) {
      h += '<div class="hud-sat-panel">'
      h += '<div style="padding:8px 12px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--brd)">'
      h += '<span style="font-size:8px;letter-spacing:2px;color:var(--cyan)">SATELLITE IMAGERY</span>'
      h += '<span style="cursor:pointer;color:var(--t3);font-size:10px" onclick="S._toggleSat()">X</span></div>'
      h += '<div style="padding:6px 12px;display:flex;align-items:center;gap:6px;border-bottom:1px solid var(--brd)">'
      h += '<span style="cursor:pointer;font-size:10px;color:var(--t3)" onclick="S._satDatePrev()">&#9664;</span>'
      h += '<input type="date" value="' + satDate + '" onchange="S._satDateChange(this.value)" style="flex:1;background:var(--bg1);border:1px solid var(--brd);color:var(--t1);font-family:var(--mono);font-size:9px;padding:3px 6px;border-radius:2px">'
      h += '<span style="cursor:pointer;font-size:10px;color:var(--t3)" onclick="S._satDateNext()">&#9654;</span>'
      h += '<span style="cursor:pointer;font-size:7px;color:var(--cyan);letter-spacing:1px" onclick="S._satDateYesterday()">YESTERDAY</span>'
      h += '</div>'
      h += '<div style="padding:4px 0">'
      h += '<div class="sat-row' + (!activeSatLayer ? ' sat-active' : '') + '" onclick="S._applySat(\'none\')"><span style="font-size:8px;color:var(--t2)">DEFAULT MAP (Off)</span></div>'
      Object.entries(SAT_PRODUCTS).forEach(function(entry) {
        var key = entry[0], p = entry[1]
        h += '<div class="sat-row' + (activeSatLayer === key ? ' sat-active' : '') + '" onclick="S._applySat(\'' + key + '\')">'
        h += '<div style="font-size:8px;color:var(--t1)">' + p.label + ' <span style="color:var(--t3);font-size:7px">' + p.sub + '</span></div>'
        h += '<div style="font-size:6.5px;color:var(--t3);margin-top:1px">' + p.desc + ' <span style="color:' + (p.daily ? 'var(--green)' : 'var(--cyan)') + ';letter-spacing:1px">' + (p.daily ? 'DAILY' : 'STATIC') + '</span></div>'
        h += '</div>'
      })
      h += '</div>'
      h += '<div style="padding:6px 12px;font-size:6.5px;color:var(--t3);border-top:1px solid var(--brd)">'
      h += '<a href="https://gibs.earthdata.nasa.gov/" target="_blank" style="color:var(--t3);text-decoration:none">NASA GIBS</a>'
      h += ' \u00B7 <a href="https://worldview.earthdata.nasa.gov/" target="_blank" style="color:var(--t3);text-decoration:none">Worldview</a>'
      h += ' \u00B7 <a href="https://s2maps.eu/" target="_blank" style="color:var(--t3);text-decoration:none">EOX S2</a>'
      h += ' \u00B7 Press S to toggle</div></div>'
    }

    // -- SAT INDICATOR --
    if (activeSatLayer) {
      var p = SAT_PRODUCTS[activeSatLayer]
      h += '<div class="hud-sat-indicator" onclick="S._toggleSat()">'
      h += '<span style="font-size:7px;color:var(--cyan);letter-spacing:1px">\uD83D\uDEF0 ' + (p?.label || '') + '</span>'
      if (p?.daily) h += '<span style="font-size:7px;color:var(--t3)">' + satDate + '</span>'
      h += '<span style="font-size:7px;color:var(--red);cursor:pointer" onclick="event.stopPropagation();S._applySat(\'none\')">X OFF</span>'
      h += '</div>'
    }

    // -- SEARCH --
    h += '<div class="search-wrap">'
    h += '<input class="search-input" type="text" placeholder="Search entities, tags, regions..." value="' + esc(searchQuery) + '" oninput="S._search(this.value)" onfocus="S._searchFocus()" onblur="setTimeout(function(){S._searchBlur()},200)">'
    if (searchOpen && searchResults.length > 0) {
      h += '<div class="search-results">'
      searchResults.forEach(function(e, i) {
        var col = LAYERS[typeToLayer(e.entity_type)]?.color || '#fff'
        h += '<div class="search-item" onclick="S._searchSelect(' + i + ')"><span class="dot" style="background:' + col + '"></span><span class="search-title">' + esc(e.title).slice(0, 60) + '</span><span class="search-src">' + esc(e.source) + '</span></div>'
      })
      h += '</div>'
    }
    h += '</div>'

    // -- LEFT PANEL --
    h += '<div class="lp"><div class="tabs">'
    ;[['layers', 'LAYERS'], ['threat', 'THREAT ' + critCount], ['sources', 'SOURCES']].forEach(function(pair) {
      h += '<div class="tab' + (panel === pair[0] ? ' active' : '') + '" onclick="S._setPanel(\'' + pair[0] + '\')">' + pair[1] + '</div>'
    })
    h += '</div><div class="lp-body">'

    if (panel === 'layers') {
      var currentDomain = ''
      Object.entries(LAYERS).forEach(function(entry) {
        var k = entry[0], cfg = entry[1]
        if (cfg.domain !== currentDomain) { currentDomain = cfg.domain; h += '<div class="domain-hdr">' + currentDomain + '</div>' }
        var on = layerState[k], st = sourceHealth[k]
        var dotCol = st === 'live' ? '#00ff88' : st === 'error' ? '#ff3355' : '#ffaa00'
        h += '<div class="layer-row' + (on ? '' : ' off') + '" onclick="S._toggle(\'' + k + '\')">'
        h += '<span class="dot" style="background:' + (on ? cfg.color : '#0a1520') + '"></span>'
        h += '<span class="layer-label">' + cfg.icon + ' ' + cfg.label + '</span>'
        h += '<span class="layer-count" style="color:' + cfg.color + '">' + (counts[k] || 0) + '</span>'
        h += '<span class="dot-sm" style="background:' + dotCol + '"></span>'
        h += '<span class="layer-status">' + (st === 'live' ? 'LIVE' : st === 'error' ? 'ERR' : 'LOAD') + '</span>'
        h += '</div>'
      })
    }

    if (panel === 'threat') {
      h += '<div class="threat-summary">'
      h += '<div class="threat-stat"><span class="threat-num" style="color:#ff0033">' + critCount + '</span><span class="threat-lbl">CRIT</span></div>'
      h += '<div class="threat-stat"><span class="threat-num" style="color:#ff7700">' + highCount + '</span><span class="threat-lbl">HIGH</span></div>'
      var gi = Math.min(100, Math.round(critCount * 12 + highCount * 5))
      h += '<div class="threat-bar"><div class="threat-fill" style="width:' + gi + '%;background:' + (gi >= 75 ? '#ff0033' : gi >= 50 ? '#ff7700' : '#ffcc00') + '"></div></div>'
      h += '</div>'
      threatBoard.forEach(function(t) {
        h += '<div class="threat-item' + (t.level === 'CRITICAL' ? ' t-crit' : t.level === 'HIGH' ? ' t-high' : '') + '" onclick="S._flyTo(\'' + t.entity.id + '\')">'
        h += '<span class="threat-name">' + esc(t.entity.title).slice(0, 50) + '</span>'
        h += '<span class="threat-score" style="color:' + t.col + '">' + t.score + '</span>'
        if (t.reasons[0]) h += '<div class="threat-reason">' + esc(t.reasons[0]) + '</div>'
        h += '</div>'
      })
    }

    if (panel === 'sources') {
      h += '<div class="domain-hdr">SOURCE HEALTH</div>'
      Object.entries(LAYERS).forEach(function(entry) {
        var k = entry[0], cfg = entry[1], st = sourceHealth[k]
        h += '<div class="src-row"><span class="layer-label">' + cfg.label + '</span><span class="src-badge ' + st + '">' + st.toUpperCase() + '</span><span class="src-detail">' + cfg.src + '</span></div>'
      })
      h += '<div class="domain-hdr" style="margin-top:8px">TIMELINE</div>'
      timeline.slice(0, 20).forEach(function(t) {
        h += '<div class="log-row"><span class="log-time">' + t.time.slice(11, 19) + '</span><span class="log-msg">' + esc(t.msg) + '</span></div>'
      })
    }

    h += '</div></div>'

    // -- INSPECTOR --
    if (selected) {
      var e = selected, t = scoreThreat(e)
      var isInf = e.provenance === 'geocoded-inferred'
      var fr = freshness(e.timestamp)
      h += '<div class="rp"><div class="rp-header">'
      h += '<span class="rp-title">' + esc(e.title).slice(0, 80) + '</span>'
      h += '<span class="rp-close" onclick="S._closeInspector()">X</span></div>'

      h += '<div class="rp-badges">'
      h += '<span class="badge" style="background:' + t.col + '22;color:' + t.col + '">' + t.level + ' ' + t.score + '</span>'
      h += '<span class="badge conf">' + e.confidence + '% CONF</span>'
      h += '<span class="badge ' + fr.cls + '">' + fr.label + '</span>'
      if (isInf) h += '<span class="badge inferred">INFERRED LOC</span>'
      h += '<span class="badge prov">' + esc(e.provenance) + '</span>'
      if (e.severity !== 'info') h += '<span class="badge sev-' + e.severity + '">' + e.severity.toUpperCase() + '</span>'
      h += '</div>'

      h += '<div class="rp-field"><span class="rp-key">SOURCE</span><span class="rp-val">' + esc(e.source) + '</span></div>'
      if (e.source_url) h += '<div class="rp-field"><span class="rp-key">URL</span><a href="' + esc(e.source_url) + '" target="_blank" class="rp-link">' + esc(e.source_url).slice(0, 60) + '</a></div>'
      h += '<div class="rp-field"><span class="rp-key">TIMESTAMP</span><span class="rp-val">' + esc(e.timestamp) + '</span></div>'
      if (e.lat != null) h += '<div class="rp-field"><span class="rp-key">POSITION</span><span class="rp-val">' + e.lat.toFixed(4) + ', ' + e.lon.toFixed(4) + (isInf ? ' (inferred)' : '') + '</span></div>'
      if (e.altitude != null) h += '<div class="rp-field"><span class="rp-key">ALTITUDE</span><span class="rp-val">' + e.altitude.toLocaleString() + ' ft</span></div>'
      if (e.velocity != null) h += '<div class="rp-field"><span class="rp-key">VELOCITY</span><span class="rp-val">' + e.velocity + ' kts</span></div>'
      if (e.region) h += '<div class="rp-field"><span class="rp-key">REGION</span><span class="rp-val">' + esc(e.region) + '</span></div>'
      if (e.description) h += '<div class="rp-field"><span class="rp-key">DESC</span><span class="rp-val">' + esc(e.description).slice(0, 200) + '</span></div>'
      if (e.tags?.length > 0) h += '<div class="rp-field"><span class="rp-key">TAGS</span><span class="rp-val">' + e.tags.map(esc).join(', ') + '</span></div>'
      if (e.raw_payload_hash) h += '<div class="rp-field"><span class="rp-key">HASH</span><span class="rp-val mono">' + esc(e.raw_payload_hash) + '</span></div>'

      // Cyber card
      if (e.entity_type.startsWith('cyber_')) {
        h += '<div class="rp-card cyber-card"><div class="card-header">CYBER INTELLIGENCE</div>'
        if (e.metadata?.cve_id) h += '<div class="rp-field"><span class="rp-key">CVE</span><span class="rp-val">' + esc(e.metadata.cve_id) + '</span></div>'
        if (e.metadata?.vendor) h += '<div class="rp-field"><span class="rp-key">VENDOR</span><span class="rp-val">' + esc(e.metadata.vendor) + '</span></div>'
        if (e.metadata?.product) h += '<div class="rp-field"><span class="rp-key">PRODUCT</span><span class="rp-val">' + esc(e.metadata.product) + '</span></div>'
        if (e.metadata?.malware) h += '<div class="rp-field"><span class="rp-key">MALWARE</span><span class="rp-val">' + esc(e.metadata.malware) + '</span></div>'
        if (e.metadata?.ioc_value) h += '<div class="rp-field"><span class="rp-key">IOC</span><span class="rp-val mono">' + esc(e.metadata.ioc_value) + '</span></div>'
        if (e.metadata?.known_ransomware) h += '<div class="rp-field"><span class="rp-key">RANSOMWARE</span><span class="rp-val">' + esc(e.metadata.known_ransomware) + '</span></div>'
        if (e.metadata?.adversary) h += '<div class="rp-field"><span class="rp-key">ADVERSARY</span><span class="rp-val">' + esc(e.metadata.adversary) + '</span></div>'
        h += '</div>'
      }

      // GNSS card
      if (e.entity_type.startsWith('gnss_')) {
        h += '<div class="rp-card gnss-card"><div class="card-header">GNSS ANOMALY</div>'
        if (e.metadata?.type) h += '<div class="rp-field"><span class="rp-key">TYPE</span><span class="rp-val">' + esc(e.metadata.type) + '</span></div>'
        if (e.metadata?.radius_km) h += '<div class="rp-field"><span class="rp-key">RADIUS</span><span class="rp-val">' + e.metadata.radius_km + ' km</span></div>'
        if (e.metadata?.affected_systems) h += '<div class="rp-field"><span class="rp-key">AFFECTED</span><span class="rp-val">' + esc(e.metadata.affected_systems) + '</span></div>'
        h += '</div>'
      }

      // Social card
      if (e.entity_type === 'social_post') {
        h += '<div class="rp-card social-card"><div class="card-header">SOCIAL INTELLIGENCE</div>'
        if (e.metadata?.subreddit) h += '<div class="rp-field"><span class="rp-key">SUB</span><span class="rp-val">r/' + esc(e.metadata.subreddit) + '</span></div>'
        if (e.metadata?.instance) h += '<div class="rp-field"><span class="rp-key">INSTANCE</span><span class="rp-val">' + esc(e.metadata.instance) + '</span></div>'
        h += '<div class="rp-field"><span class="rp-key">SCORE</span><span class="rp-val">' + (e.metadata?.score || e.metadata?.favourites || 0) + ' | ' + (e.metadata?.num_comments || e.metadata?.reblogs || 0) + ' interactions</span></div>'
        if (e.metadata?.media_url) h += '<div class="rp-field"><span class="rp-key">MEDIA</span><a href="' + esc(e.metadata.media_url) + '" target="_blank" class="rp-link">' + esc(e.metadata.media_type || 'media') + ': ' + esc(e.metadata.media_url).slice(0, 50) + '</a></div>'
        if (e.metadata?.geolocation_method) h += '<div class="rp-field"><span class="rp-key">GEO METHOD</span><span class="rp-val">' + esc(e.metadata.geolocation_method) + (e.metadata?.matched_location ? ' (' + esc(e.metadata.matched_location) + ')' : '') + '</span></div>'
        if (e.source_url) h += '<div class="rp-field"><a href="' + esc(e.source_url) + '" target="_blank" class="rp-link">View Source \u2192</a></div>'
        h += '</div>'
      }

      // Raw metadata
      if (e.metadata && Object.keys(e.metadata).length > 0) {
        h += '<div class="rp-meta-toggle" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display===\'none\'?\'block\':\'none\'">RAW METADATA \u25BC</div>'
        h += '<div class="rp-meta" style="display:none">'
        Object.entries(e.metadata).forEach(function(pair) {
          var k = pair[0], v = pair[1]
          if (v != null && v !== '') h += '<div class="rp-field"><span class="rp-key">' + esc(k) + '</span><span class="rp-val mono">' + esc(typeof v === 'object' ? JSON.stringify(v) : String(v)).slice(0, 200) + '</span></div>'
        })
        h += '</div>'
      }

      h += '</div>'
    }

    // -- STATS RING --
    h += '<div class="stats-ring">'
    var statItems = [
      ['AIR', (counts.aircraft || 0) + (counts.military || 0), '#00ccff'],
      ['SEA', (counts.fishing || 0) + (counts.darkships || 0) + (counts.ships || 0), '#00ff88'],
      ['ORB', (counts.satellites || 0) + (counts.debris || 0), '#ffcc00'],
      ['WX', (counts.seismic || 0) + (counts.wildfires || 0) + (counts.weather || 0), '#4477ff'],
      ['INT', (counts.conflict || 0) + (counts.disasters || 0) + (counts.nuclear || 0), '#ff2200'],
      ['CYB', counts.cyber || 0, '#66ffcc'],
      ['GPS', counts.gnss || 0, '#ff6633'],
      ['SOC', counts.social || 0, '#ff44aa'],
    ]
    statItems.forEach(function(item) {
      h += '<div class="stat"><span class="stat-lbl" style="color:' + item[2] + '88">' + item[0] + '</span><span class="stat-val" style="color:' + item[2] + '">' + item[1] + '</span></div>'
    })
    h += '<div class="stat total"><span class="stat-val">' + total.toLocaleString() + '</span></div>'
    h += '</div>'

    // -- MOBILE BAR --
    h += '<div class="mob-bar">'
    ;[['layers', 'LAYERS'], ['threat', 'THREAT'], ['sources', 'LOGS']].forEach(function(pair) {
      h += '<div class="mob-tab' + (panel === pair[0] ? ' active' : '') + '" onclick="S._setPanel(\'' + pair[0] + '\')">' + pair[1] + '</div>'
    })
    h += '</div>'

    document.getElementById('hud').innerHTML = h

    var loadEl = document.getElementById('loading')
    if (loadEl) loadEl.style.display = 'none'
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DATA FETCH — phased loading
  // ═══════════════════════════════════════════════════════════════════════════
  var fetching = false

  async function fetchAll() {
    if (fetching) return
    fetching = true; cycle++
    lastFetchTime = Date.now()
    nextRefreshAt = Date.now() + 60000
    log('Fetch cycle ' + cycle + ' starting', 'info')

    // Phase 1: Fast free sources
    try {
      var p1 = await Promise.allSettled([
        proxy('opensky'), fetch(DIRECT.USGS).then(function(r) { return r.json() }), fetch(DIRECT.ISS).then(function(r) { return r.json() })
      ])
      if (p1[0].status === 'fulfilled' && !isErr(p1[0].value)) {
        var parsed = parseOpenSky(p1[0].value)
        replaceEntities(parsed.filter(function(e) { return e.entity_type === 'aircraft' }), 'ac_')
        replaceEntities(parsed.filter(function(e) { return e.entity_type === 'military_air' }), 'mil_')
        sourceHealth.aircraft = 'live'; sourceHealth.military = 'live'
        log('Aircraft: ' + parsed.length + ' tracked', 'info')
      } else { sourceHealth.aircraft = 'error'; sourceHealth.military = 'error' }

      if (p1[1].status === 'fulfilled') { replaceEntities(parseUSGS(p1[1].value), 'eq_'); sourceHealth.seismic = 'live'; log('Seismic: ' + counts.seismic, 'info') }
      else { sourceHealth.seismic = 'error' }

      if (p1[2].status === 'fulfilled') { replaceEntities(parseISS(p1[2].value), 'iss_'); sourceHealth.iss = 'live' }
      else { sourceHealth.iss = 'error' }
    } catch (e) { log('Phase 1 error: ' + e, 'error') }

    // Phase 2: Keyed sources (proxied)
    try {
      var p2 = await Promise.allSettled([
        proxy('firms'), proxy('n2yo'), getApi('/api/weather/global')
      ])
      if (p2[0].status === 'fulfilled' && typeof p2[0].value === 'string') { replaceEntities(parseFIRMS(p2[0].value), 'fire_'); sourceHealth.wildfires = 'live'; log('Wildfires: ' + counts.wildfires, 'info') }
      else { sourceHealth.wildfires = 'error' }

      if (p2[1].status === 'fulfilled' && !isErr(p2[1].value)) { replaceEntities(parseN2YO(p2[1].value), 'sat_'); sourceHealth.satellites = 'live' }
      else { sourceHealth.satellites = 'error' }

      if (p2[2].status === 'fulfilled' && !isErr(p2[2].value)) { replaceEntities(parseOWM(p2[2].value), 'wx_'); sourceHealth.weather = 'live' }
      else { sourceHealth.weather = 'error' }
    } catch (e) { log('Phase 2 error: ' + e, 'error') }

    // Phase 3: Slower feeds
    try {
      var p3 = await Promise.allSettled([
        proxy('gdacs'), proxy('gfw_fishing', datePair()), proxy('gfw_gap', datePair()),
        getApi('/api/reliefweb/disasters')
      ])
      if (p3[0].status === 'fulfilled' && !isErr(p3[0].value)) { replaceEntities(parseGDACS(p3[0].value), 'gdacs_'); sourceHealth.disasters = 'live' }
      else { sourceHealth.disasters = 'error' }

      if (p3[3].status === 'fulfilled' && !isErr(p3[3].value)) {
        var rwEvents = parseReliefWeb(p3[3].value)
        replaceEntities(rwEvents, 'rw_')
        if (sourceHealth.disasters !== 'live') sourceHealth.disasters = rwEvents.length > 0 ? 'live' : 'error'
        log('ReliefWeb: ' + rwEvents.length + ' disasters', 'info')
      }

      if (p3[1].status === 'fulfilled' && !isErr(p3[1].value)) { replaceEntities(parseGFW(p3[1].value, 'fish'), 'fish_'); sourceHealth.fishing = 'live' }
      else { sourceHealth.fishing = 'error' }

      if (p3[2].status === 'fulfilled' && !isErr(p3[2].value)) { replaceEntities(parseGFW(p3[2].value, 'dark'), 'gap_'); sourceHealth.darkships = 'live' }
      else { sourceHealth.darkships = 'error' }
    } catch (e) { log('Phase 3 error: ' + e, 'error') }

    // Phase 4: Intel
    try {
      var p4 = await Promise.allSettled([
        postApi('/api/intel/gdelt', { category: 'conflict' }),
        postApi('/api/intel/gdelt', { category: 'cyber' }),
        postApi('/api/intel/gdelt', { category: 'nuclear' })
      ])
      if (p4[0].status === 'fulfilled') { replaceEntities(passthrough(p4[0].value), 'gdelt_conflict_'); sourceHealth.conflict = 'live' }
      else { sourceHealth.conflict = 'error' }
      if (p4[1].status === 'fulfilled') { replaceEntities(passthrough(p4[1].value), 'gdelt_cyber_') }
      if (p4[2].status === 'fulfilled') { replaceEntities(passthrough(p4[2].value), 'gdelt_nuclear_'); sourceHealth.nuclear = 'live' }
      else { sourceHealth.nuclear = 'error' }
    } catch (e) { log('Phase 4 error: ' + e, 'error') }

    // Phase 5: Cyber feeds (delayed)
    setTimeout(async function() {
      try {
        var p5 = await Promise.allSettled([
          getApi('/api/cyber/cisa-kev'), getApi('/api/cyber/otx'), getApi('/api/cyber/urlhaus'), getApi('/api/cyber/threatfox')
        ])
        var cyberCount = 0
        if (p5[0].status === 'fulfilled' && p5[0].value?.events) { replaceEntities(p5[0].value.events.map(function(e) { return ce(e) }), 'kev_'); cyberCount += p5[0].value.count || 0 }
        if (p5[1].status === 'fulfilled' && p5[1].value?.events) { replaceEntities(p5[1].value.events.map(function(e) { return ce(e) }), 'otx_'); cyberCount += p5[1].value.count || 0 }
        if (p5[2].status === 'fulfilled' && p5[2].value?.events) { replaceEntities(p5[2].value.events.map(function(e) { return ce(e) }), 'urlhaus_'); cyberCount += p5[2].value.count || 0 }
        if (p5[3].status === 'fulfilled' && p5[3].value?.events) { replaceEntities(p5[3].value.events.map(function(e) { return ce(e) }), 'threatfox_'); cyberCount += p5[3].value.count || 0 }
        sourceHealth.cyber = cyberCount > 0 ? 'live' : 'error'
        log('Cyber feeds: ' + cyberCount + ' indicators', 'info')
      } catch (e) { sourceHealth.cyber = 'error'; log('Cyber fetch error: ' + e, 'error') }
    }, 2000)

    // Phase 6: GNSS + Social (including Mastodon)
    setTimeout(async function() {
      try {
        var p6 = await Promise.allSettled([
          getApi('/api/gnss/anomalies'),
          getApi('/api/social/reddit'),
          getApi('/api/social/mastodon')
        ])
        if (p6[0].status === 'fulfilled' && p6[0].value?.events) {
          replaceEntities(p6[0].value.events.map(function(e) { return ce(e) }), 'gnss_')
          sourceHealth.gnss = 'live'
          log('GNSS: ' + (p6[0].value.zones || 0) + ' zones, ' + (p6[0].value.news || 0) + ' news', 'info')
        } else { sourceHealth.gnss = 'error' }

        var socialTotal = 0
        if (p6[1].status === 'fulfilled' && p6[1].value?.events) {
          replaceEntities(p6[1].value.events.map(function(e) { return ce(e) }), 'reddit_')
          socialTotal += p6[1].value.total || 0
          log('Reddit: ' + p6[1].value.total + ' posts, ' + p6[1].value.geolocated + ' geolocated', 'info')
        }
        if (p6[2].status === 'fulfilled' && p6[2].value?.events) {
          replaceEntities(p6[2].value.events.map(function(e) { return ce(e) }), 'masto_')
          socialTotal += p6[2].value.total || 0
          log('Mastodon: ' + p6[2].value.total + ' posts', 'info')
        }
        sourceHealth.social = socialTotal > 0 ? 'live' : 'error'
      } catch (e) { log('Phase 6 error: ' + e, 'error') }
    }, 4000)

    connectionOk = true
    fetching = false
    refreshMap()
    log('Cycle ' + cycle + ' complete \u2014 ' + entities.length + ' entities', 'info')
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CELESTRAK TLE FETCH
  // ═══════════════════════════════════════════════════════════════════════════
  var TLE_URLS = {
    stations: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle',
    debris_fengyun: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=1999-025&FORMAT=tle',
  }

  async function fetchCelesTrak() {
    if (!window.satellite) { log('satellite.js not loaded \u2014 skipping TLE propagation', 'info'); return }
    try {
      var results = await Promise.allSettled([
        fetch(TLE_URLS.stations).then(function(r) { return r.ok ? r.text() : '' }),
        fetch(TLE_URLS.debris_fengyun).then(function(r) { return r.ok ? r.text() : '' }),
      ])
      var satCount = 0
      if (results[0].status === 'fulfilled' && results[0].value) {
        var parsed = parseCelesTrakTLE(results[0].value, 'satellite')
        replaceEntities(parsed, 'tle_'); satCount += parsed.length
      }
      if (results[1].status === 'fulfilled' && results[1].value) {
        var parsed2 = parseCelesTrakTLE(results[1].value, 'debris')
        replaceEntities(parsed2, 'deb_'); satCount += parsed2.length
        sourceHealth.debris = 'live'
      }
      if (satCount > 0) log('CelesTrak SGP4: ' + satCount + ' objects propagated', 'info')
    } catch (e) { log('CelesTrak error: ' + e, 'error') }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // KEYBOARD
  // ═══════════════════════════════════════════════════════════════════════════
  function initKeyboard() {
    document.addEventListener('keydown', function(e) {
      if (e.target.tagName === 'INPUT') return
      var k = e.key.toLowerCase()
      if (k === 'escape') { selected = null; searchOpen = false; searchQuery = ''; searchResults = []; renderUI() }
      else if (k === '1') { panel = 'layers'; renderUI() }
      else if (k === '2') { panel = 'threat'; renderUI() }
      else if (k === '3') { panel = 'sources'; renderUI() }
      else if (k === 'z') { toggleZones() }
      else if (k === 's') { showSatPanel = !showSatPanel; renderUI() }
      else if (k === 't') { scrubberEnabled = !scrubberEnabled; refreshMap() }
      else if (k === 'r') { fetchAll() }
      else if (k === '/' || k === 'f') { e.preventDefault(); var inp = document.querySelector('.search-input'); if (inp) inp.focus() }
    })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GLOBAL HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════
  window.S = {
    _toggle: toggleLayer,
    _toggleZones: toggleZones,
    _setPanel: function(p) { panel = p; renderUI() },
    _flyTo: function(id) { var e = entities.find(function(x) { return x.id === id }); if (e) flyTo(e) },
    _closeInspector: function() { selected = null; renderUI() },
    _search: function(q) { doSearch(q); renderUI() },
    _searchFocus: function() { searchOpen = true; renderUI() },
    _searchBlur: function() { searchOpen = false; renderUI() },
    _searchSelect: function(i) { if (searchResults[i]) { flyTo(searchResults[i]); searchOpen = false; searchQuery = ''; searchResults = []; renderUI() } },
    _toggleSat: function() { showSatPanel = !showSatPanel; renderUI() },
    _applySat: function(key) { applySatelliteLayer(key) },
    _satDatePrev: function() { var d = new Date(satDate); d.setDate(d.getDate() - 1); changeSatDate(d.toISOString().split('T')[0]); renderUI() },
    _satDateNext: function() { var d = new Date(satDate); d.setDate(d.getDate() + 1); changeSatDate(d.toISOString().split('T')[0]); renderUI() },
    _satDateChange: function(v) { changeSatDate(v); renderUI() },
    _satDateYesterday: function() { initSatDate(); if (activeSatLayer) applySatelliteLayer(activeSatLayer); renderUI() },
    _toggleScrub: function() { scrubberEnabled = !scrubberEnabled; refreshMap() },
    _scrubChange: function(v) { scrubberHours = parseInt(v) || 24; refreshMap() },
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONNECTION HEALTH MONITOR
  // ═══════════════════════════════════════════════════════════════════════════
  function checkHealth() {
    if (lastFetchTime > 0 && (Date.now() - lastFetchTime) > 120000) {
      connectionOk = false
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BOOT
  // ═══════════════════════════════════════════════════════════════════════════
  function boot() {
    console.log('%c SENTINEL OS v7.0 ', 'background:#00ff88;color:#020a12;font-weight:bold;font-size:14px;padding:4px 8px;border-radius:3px')
    console.log('Global Situational Awareness Platform \u2014 20+ live OSINT layers')
    initMap()
    initKeyboard()
    renderUI()
    log('SENTINEL OS v7.0 initialized', 'info')
    fetchAll()
    setTimeout(fetchCelesTrak, 3000)
    setInterval(fetchAll, 60000)
    setInterval(fetchCelesTrak, 180000)
    setInterval(function() {
      var issE = entities.find(function(e) { return e.id === 'iss_live' })
      if (issE) { fetch(DIRECT.ISS).then(function(r) { return r.json() }).then(function(d) { if (d?.latitude != null) { replaceEntities(parseISS(d), 'iss_') } }).catch(function() {}) }
    }, 5000)
    setInterval(function() { checkHealth(); renderUI() }, 3000)
  }

  boot()
})()
