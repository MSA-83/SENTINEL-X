/**
 * SENTINEL OS v8.5 — Global Situational Awareness Client
 *
 * v8.5 Delta (all 25 tasks):
 *   1.  Wire new v8.4 backend endpoints (SIGMET, EONET, METAR, Shodan geo/host/exploit, Intel Overview)
 *   2.  SIGMET polygon rendering on Leaflet map
 *   3.  EONET event markers with category-specific icons
 *   4.  Shodan geo-pins on map (cyber layer)
 *   5.  Intel Overview panel — right-click any location for multi-domain intelligence
 *   6.  Circuit breaker status in metrics/sources UI
 *   7.  Coordinate METAR on map click — nearest station weather popup
 *   8.  Source-health cache-hit indicators in panels
 *   9.  Entity parser hardening (squawk, mag filter, FRP thresh, vessel type)
 *  10.  Deduplication & fingerprint enforcement
 *  11.  Correlation engine — link related events cross-source
 *  12.  Threat-scoring v2 (severity + proximity + confidence + history)
 *  13.  Domain tab UI — horizontal filter tabs
 *  14.  Mobile drawer panels
 *  15.  Confidence/freshness chips on markers/cards
 *  16.  Timeline replay controls (play/pause/speed scrubber)
 *  17.  Viewport-based layer culling
 *  18.  Performance throttles for mobile
 *  19.  Request-ID tracing (backend — X-Request-ID header)
 *  20.  Copernicus imagery tile layer
 *  21.  Cesium 3D globe mode toggle (stub ready)
 *  22.  Space-Track CDM visualization
 *  23.  GNSS anomaly zone circle overlays
 *  24.  Social media feed panel (Reddit/Mastodon)
 *  25.  README update (separate)
 */
;(function () {
  'use strict'

  // ═══════════════════════════════════════════════════════════════
  // FETCH HELPERS
  // ═══════════════════════════════════════════════════════════════
  async function api(path, opts) {
    try {
      var r = await fetch(path, {
        ...opts,
        headers: { 'Content-Type': 'application/json', ...(opts?.headers || {}) },
      })
      var ct = r.headers.get('content-type') || ''
      if (ct.includes('text/plain') || ct.includes('text/csv')) return await r.text()
      return await r.json()
    } catch (e) {
      return { _upstream_error: true, message: String(e), events: [] }
    }
  }
  function proxy(target, params) { return api('/api/proxy', { method: 'POST', body: JSON.stringify({ target: target, params: params }) }) }
  function postApi(path, body) { return api(path, { method: 'POST', body: JSON.stringify(body) }) }
  function getApi(path) { return api(path) }
  function isErr(v) { return v && typeof v === 'object' && v._upstream_error === true }

  // ═══════════════════════════════════════════════════════════════
  // CONSTANTS
  // ═══════════════════════════════════════════════════════════════
  var DIRECT = {
    USGS: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson',
    ISS: 'https://api.wheretheiss.at/v1/satellites/25544',
  }

  var LAYERS = {
    aircraft:     { label: 'AIRCRAFT',     icon: '\u2708',       color: '#00ccff', domain: 'AIR',      src: 'OpenSky ADS-B' },
    military:     { label: 'MIL AIR',      icon: '\u2708',       color: '#ff3355', domain: 'AIR',      src: 'ADS-B Exchange + OpenSky' },
    sigmets:      { label: 'SIGMETS',      icon: '\u26A0',       color: '#ff9900', domain: 'AIR',      src: 'AVWX SIGMET' },
    ships:        { label: 'MARITIME AIS', icon: '\u2693',       color: '#00ff88', domain: 'SEA',      src: 'AISStream.io' },
    darkships:    { label: 'DARK FLEET',   icon: '\u2753',       color: '#9933ff', domain: 'SEA',      src: 'GFW Gap Events' },
    fishing:      { label: 'FISHING',      icon: '\uD83D\uDC1F', color: '#33ffcc', domain: 'SEA',      src: 'GFW Events' },
    iss:          { label: 'ISS',          icon: '\uD83D\uDE80', color: '#ff6600', domain: 'SPACE',    src: 'wheretheiss.at + SGP4' },
    satellites:   { label: 'SATELLITES',   icon: '\u2605',       color: '#ffcc00', domain: 'SPACE',    src: 'N2YO + CelesTrak + Space-Track' },
    debris:       { label: 'DEBRIS',       icon: '\u2715',       color: '#cc2255', domain: 'SPACE',    src: 'CelesTrak SGP4' },
    conjunctions: { label: 'CONJUNCTIONS', icon: '\u26A1',       color: '#ff00ff', domain: 'SPACE',    src: 'Space-Track CDM' },
    seismic:      { label: 'SEISMIC',      icon: '!',            color: '#ffee00', domain: 'WEATHER',  src: 'USGS Earthquake API' },
    wildfires:    { label: 'WILDFIRES',    icon: '\uD83D\uDD25', color: '#ff5500', domain: 'WEATHER',  src: 'NASA FIRMS' },
    weather:      { label: 'WEATHER',      icon: '\uD83C\uDF00', color: '#4477ff', domain: 'WEATHER',  src: 'OpenWeatherMap' },
    eonet:        { label: 'NATURAL',      icon: '\uD83C\uDF0B', color: '#ff7733', domain: 'WEATHER',  src: 'NASA EONET v3' },
    conflict:     { label: 'CONFLICT',     icon: '\u2694',       color: '#ff2200', domain: 'CONFLICT', src: 'GDELT + NewsAPI + ACLED' },
    disasters:    { label: 'DISASTERS',    icon: '\u26A0',       color: '#ff8c00', domain: 'CONFLICT', src: 'GDACS + ReliefWeb' },
    nuclear:      { label: 'NUCLEAR',      icon: '\u2622',       color: '#ff00ff', domain: 'CONFLICT', src: 'GDELT Nuclear' },
    cyber:        { label: 'CYBER',        icon: '\uD83D\uDD12', color: '#66ffcc', domain: 'CYBER',    src: 'CISA + OTX + URLhaus + ThreatFox + Shodan' },
    gnss:         { label: 'GNSS',         icon: '\uD83D\uDCE1', color: '#ff6633', domain: 'GNSS',     src: 'Curated + GDELT' },
    social:       { label: 'SOCIAL',       icon: '\uD83D\uDCF1', color: '#ff44aa', domain: 'SOCIAL',   src: 'Reddit + Mastodon OSINT' },
  }

  var DOMAIN_LIST = ['ALL', 'AIR', 'SEA', 'SPACE', 'WEATHER', 'CONFLICT', 'CYBER', 'GNSS', 'SOCIAL']
  var DOMAIN_COLORS = { AIR: '#00ccff', SEA: '#00ff88', SPACE: '#ffcc00', WEATHER: '#4477ff', CONFLICT: '#ff2200', CYBER: '#66ffcc', GNSS: '#ff6633', SOCIAL: '#ff44aa' }

  var THREAT_ZONES = [
    { name:'Ukraine/Russia Front', lat:48.5, lon:37.0, r:400, base:55, type:'conflict' },
    { name:'Gaza Strip', lat:31.4, lon:34.5, r:120, base:70, type:'conflict' },
    { name:'Iran Theater', lat:32.4, lon:53.7, r:500, base:65, type:'flashpoint' },
    { name:'Red Sea/Houthi', lat:14.5, lon:43.5, r:350, base:60, type:'chokepoint' },
    { name:'Strait of Hormuz', lat:26.5, lon:56.3, r:180, base:50, type:'chokepoint' },
    { name:'Taiwan Strait', lat:24.5, lon:120.0, r:250, base:55, type:'flashpoint' },
    { name:'South China Sea', lat:13.5, lon:115.0, r:500, base:45, type:'flashpoint' },
    { name:'Korean Peninsula', lat:38.0, lon:127.5, r:200, base:50, type:'flashpoint' },
    { name:'Sudan Civil War', lat:15.5, lon:32.5, r:350, base:50, type:'conflict' },
    { name:'Black Sea', lat:43.5, lon:34.5, r:400, base:45, type:'flashpoint' },
    { name:'Sahel Insurgency', lat:14.0, lon:2.0, r:600, base:40, type:'conflict' },
    { name:'Kashmir LOC', lat:34.0, lon:74.5, r:200, base:45, type:'flashpoint' },
  ]

  var SQUAWK_DB = { '7500': { label: 'HIJACK', sev: 'critical' }, '7600': { label: 'COMMS FAIL', sev: 'high' }, '7700': { label: 'EMERGENCY', sev: 'critical' }, '7777': { label: 'MIL INTERCEPT', sev: 'high' }, '7400': { label: 'UAV LOST LINK', sev: 'high' } }
  var MIL_RE = /^(RCH|USAF|REACH|DUKE|NATO|JAKE|VIPER|GHOST|BRONC|BLADE|EVAC|KNIFE|EAGLE|COBRA|REAPER|FURY|IRON|WOLF|HAWK|RAPTOR|TITAN|NAVY|SKULL|DEMON|PYTHON)/i
  var REPLAY_MODES = [ { key: 'live', label: 'LIVE', hours: 0 }, { key: '1h', label: '1 HOUR', hours: 1 }, { key: '24h', label: '24 HOURS', hours: 24 }, { key: '72h', label: '72 HOURS', hours: 72 } ]

  // EONET category icons
  var EONET_ICONS = { severeStorms: '\u26C8', wildfires: '\uD83D\uDD25', volcanoes: '\uD83C\uDF0B', earthquakes: '\uD83C\uDF0D', floods: '\uD83C\uDF0A', seaLakeIce: '\u2744', drought: '\u2600', landslides: '\u26F0', snow: '\u2744', dustHaze: '\uD83C\uDF2B', tempExtremes: '\uD83C\uDF21' }

  // ═══════════════════════════════════════════════════════════════
  // UNIFIED STATE OBJECT
  // ═══════════════════════════════════════════════════════════════
  var state = {
    map: null, layerGroups: {}, zoneCircles: [], zoneLabels: [], gnssCircles: [],
    sigmetPolygons: null, // L.layerGroup for SIGMET polygons
    entities: [], counts: {}, dedupeIndex: {},
    layerState: {}, sourceHealth: {}, sourceMetrics: {}, sourceFreshness: {},
    circuitStatus: {}, // circuit breaker state from /api/circuits
    cacheStatus: {},    // cache state from /api/cache/status
    selected: null, inspectorExpanded: false, inspectorCardStates: {},
    panel: 'layers', activeDomain: 'ALL',
    searchQuery: '', searchResults: [], searchOpen: false,
    showZones: true, timeline: [], cycle: 0,
    lastFetchTime: 0, connectionOk: true, nextRefreshAt: 0,
    drawerOpen: false, drawerSide: 'left',
    // Intel overview
    intelOverlay: null, // {lat, lon, data} from right-click
    intelLoading: false,
    // METAR popup
    metarPopup: null,
    // Satellite imagery
    showSatPanel: false, satDate: '', activeSatLayer: null, satTileLayer: null, satLabelLayer: null,
    // Timeline replay
    scrubberEnabled: false, replayMode: 'live', replayPlaying: false, replaySpeed: 1,
    replayInterval: null, replayWindowHours: 24, replayCursorMs: 0, replayWindowStartMs: 0,
    viewportBounds: null,
    // Mobile
    isMobile: window.innerWidth < 768, isTablet: window.innerWidth >= 768 && window.innerWidth < 1024,
    markerCap: window.innerWidth < 768 ? 200 : 500,
    renderThrottleMs: window.innerWidth < 768 ? 500 : 100,
    lastRenderTime: 0, renderPending: false, fetching: false,
  }

  Object.keys(LAYERS).forEach(function (k) { state.layerState[k] = true; state.sourceHealth[k] = 'loading'; state.counts[k] = 0 })
  ;['ships', 'debris', 'conjunctions'].forEach(function (k) { state.layerState[k] = false })

  // ═══════════════════════════════════════════════════════════════
  // RESPONSIVE DETECTION
  // ═══════════════════════════════════════════════════════════════
  function updateViewportState() {
    var w = window.innerWidth
    state.isMobile = w < 768; state.isTablet = w >= 768 && w < 1024
    state.markerCap = state.isMobile ? 200 : 500
    state.renderThrottleMs = state.isMobile ? 500 : 100
  }
  var resizeTimer = null
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(function () { updateViewportState(); if (!state.isMobile && state.drawerOpen) state.drawerOpen = false; renderUI() }, 150)
  })

  function updateViewportBounds() {
    if (!state.map) return
    var b = state.map.getBounds()
    state.viewportBounds = { north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() }
  }

  // ═══════════════════════════════════════════════════════════════
  // DEDUPLICATION & CORRELATION (Task 10, 11)
  // ═══════════════════════════════════════════════════════════════
  function fingerprint(e) {
    var parts = [e.entity_type || '']
    if (e.lat != null && e.lon != null) {
      var precision = (e.provenance === 'geocoded-inferred' || e.confidence < 50) ? 1 : 10
      parts.push(Math.round(e.lat * precision) / precision)
      parts.push(Math.round(e.lon * precision) / precision)
    }
    var normTitle = (e.title || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim().slice(0, 50)
    parts.push(normTitle)
    return parts.join('|')
  }

  function deduplicateEntities(newEntities) {
    var unique = []
    newEntities.forEach(function (e) {
      var fp = fingerprint(e)
      if (state.dedupeIndex[fp]) {
        var existingId = state.dedupeIndex[fp]
        var existing = state.entities.find(function (x) { return x.id === existingId })
        if (existing) {
          if (e.confidence > existing.confidence) { existing.confidence = e.confidence; existing.provenance = e.provenance }
          var sevRank = { critical: 0, high: 1, medium: 2, low: 3, info: 4 }
          if ((sevRank[e.severity] || 4) < (sevRank[existing.severity] || 4)) existing.severity = e.severity
          if (e.timestamp && (!existing.timestamp || e.timestamp > existing.timestamp)) { existing.timestamp = e.timestamp; existing.observed_at = e.observed_at || e.timestamp }
          existing.correlations = (existing.correlations || []).concat([e.id]).slice(0, 15)
          if (e.source !== existing.source) {
            existing.metadata._correlated_sources = existing.metadata._correlated_sources || []
            if (existing.metadata._correlated_sources.indexOf(e.source) < 0) existing.metadata._correlated_sources.push(e.source)
          }
          if (e.tags) e.tags.forEach(function (t) { if (t && existing.tags.indexOf(t) < 0) existing.tags.push(t) })
        }
      } else { state.dedupeIndex[fp] = e.id; unique.push(e) }
    })
    return unique
  }

  function clearDedupePrefix(prefix) {
    Object.keys(state.dedupeIndex).forEach(function (k) { if (state.dedupeIndex[k].startsWith(prefix)) delete state.dedupeIndex[k] })
  }

  // ═══════════════════════════════════════════════════════════════
  // THREAT SCORING v2 (Task 12 — enhanced)
  // ═══════════════════════════════════════════════════════════════
  function haversine(a, b, c, d) {
    var R = 6371, x = (c - a) * Math.PI / 180, y = (d - b) * Math.PI / 180
    var z = Math.sin(x / 2) ** 2 + Math.cos(a * Math.PI / 180) * Math.cos(c * Math.PI / 180) * Math.sin(y / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(z), Math.sqrt(1 - z))
  }

  function scoreThreat(e) {
    var s = 0, reasons = []
    if (e.entity_type === 'aircraft' && e.metadata?.squawk && SQUAWK_DB[e.metadata.squawk]) { s += 70; reasons.push('SQUAWK ' + e.metadata.squawk) }
    if (e.entity_type === 'military_air') { s += 12; reasons.push('Military asset') }
    if (e.entity_type === 'dark_vessel') { s += 28; reasons.push('AIS gap') }
    if (e.entity_type === 'seismic') { var m = e.metadata?.magnitude || 0; if (m >= 7) { s += 75; reasons.push('M' + m) } else if (m >= 5) { s += 35; reasons.push('M' + m) } else if (m >= 3) { s += 10; reasons.push('M' + m) } }
    if (e.entity_type === 'wildfire') { var f = e.metadata?.frp || 0; if (f >= 200) { s += 35; reasons.push('FRP ' + f) } else if (f >= 50) { s += 15; reasons.push('FRP ' + f) } }
    if (e.entity_type?.startsWith('conflict')) { s += 22; reasons.push('Conflict intel') }
    if (e.entity_type?.startsWith('nuclear')) { s += 35; reasons.push('Nuclear intel') }
    if (e.entity_type?.startsWith('cyber')) { s += 15; reasons.push('Cyber threat') }
    if (e.entity_type?.startsWith('gnss')) { s += 20; reasons.push('GNSS anomaly') }
    if (e.entity_type === 'sigmet') { var hz = e.metadata?.hazard || ''; s += (hz === 'VA' || hz === 'TC' ? 50 : 25); reasons.push('SIGMET ' + hz) }
    if (e.entity_type === 'natural_event') { s += 18; reasons.push('Natural hazard') }
    if (e.entity_type === 'cyber_host') { var vn = (e.metadata?.vulns || []).length; s += Math.min(40, 10 + vn * 5); reasons.push(vn + ' CVEs') }
    if (e.entity_type === 'conjunction') { var cp = e.metadata?.collision_probability || 0; if (cp > 1e-3) { s += 80; reasons.push('HIGH collision prob') } else if (cp > 1e-5) { s += 45; reasons.push('Conjunction alert') } else { s += 15; reasons.push('CDM') } }
    if (e.entity_type === 'disaster') { s += (e.severity === 'critical' ? 40 : 15); reasons.push('Disaster') }
    // Confidence weighting: low-confidence events get a slight penalty
    if (e.confidence < 40) s = Math.round(s * 0.7)
    // Freshness weighting: stale events get a slight penalty
    if (e.timestamp) { var ageH = (Date.now() - new Date(e.timestamp).getTime()) / 3600000; if (ageH > 48) s = Math.round(s * 0.85) }
    // Proximity to threat zones
    if (e.lat != null && e.lon != null) {
      for (var i = 0; i < THREAT_ZONES.length; i++) {
        var z = THREAT_ZONES[i], d = haversine(e.lat, e.lon, z.lat, z.lon)
        if (d < z.r) { var bonus = Math.round(z.base * (1 - d / z.r)); s += bonus; if (bonus >= 8) reasons.push(z.name + ' +' + bonus); break }
      }
    }
    s = Math.min(100, Math.round(s))
    var level = s >= 75 ? 'CRITICAL' : s >= 50 ? 'HIGH' : s >= 28 ? 'MEDIUM' : s >= 10 ? 'LOW' : 'MINIMAL'
    var col = s >= 75 ? '#ff0033' : s >= 50 ? '#ff7700' : s >= 28 ? '#ffcc00' : s >= 10 ? '#44aaff' : '#2a4060'
    return { score: s, level: level, col: col, reasons: reasons }
  }

  // ═══════════════════════════════════════════════════════════════
  // FRESHNESS & CONFIDENCE HELPERS (Task 15)
  // ═══════════════════════════════════════════════════════════════
  function freshness(ts) {
    if (!ts) return { label: 'UNKNOWN', cls: 'fresh-old', ageMs: Infinity }
    var age = Date.now() - new Date(ts).getTime(); if (age < 0) age = 0
    if (age < 60000) return { label: '<1m', cls: 'fresh-live', ageMs: age }
    if (age < 3600000) return { label: Math.round(age / 60000) + 'm', cls: 'fresh-live', ageMs: age }
    if (age < 86400000) return { label: Math.round(age / 3600000) + 'h', cls: 'fresh-stale', ageMs: age }
    return { label: Math.round(age / 86400000) + 'd', cls: 'fresh-old', ageMs: age }
  }
  function confClass(c) { return c >= 80 ? 'conf-high' : c >= 50 ? 'conf-med' : 'conf-low' }
  function confLabel(c) { return c >= 80 ? 'HIGH' : c >= 50 ? 'MED' : 'LOW' }

  // ═══════════════════════════════════════════════════════════════
  // PARSERS (Task 9 — hardened)
  // ═══════════════════════════════════════════════════════════════
  function ce(partial) {
    return Object.assign({ id: '', entity_type: '', source: '', source_url: '', title: '', description: '', lat: null, lon: null, altitude: null, velocity: null, heading: null, timestamp: new Date().toISOString(), observed_at: new Date().toISOString(), confidence: 50, severity: 'info', risk_score: 0, region: '', tags: [], correlations: [], metadata: {}, raw_payload_hash: '', provenance: 'direct-api' }, partial)
  }

  // OpenSky — hardened squawk detection + military callsign
  function parseOpenSky(data) {
    if (!data?.states) return []
    return data.states.filter(function (s) { return s[6] != null && s[5] != null && s[8] === false })
      .slice(0, state.markerCap).map(function (s, i) {
        var cs = (s[1] || '').trim(), isMil = MIL_RE.test(cs)
        var sq = s[14] ? String(s[14]).padStart(4, '0') : null
        var isEmg = sq && SQUAWK_DB[sq]
        var sev = isEmg ? SQUAWK_DB[sq].sev : isMil ? 'medium' : 'info'
        return ce({
          id: (isMil ? 'mil_' : 'ac_') + i, entity_type: isMil ? 'military_air' : 'aircraft',
          source: 'OpenSky Network', source_url: 'https://opensky-network.org/',
          title: cs || ('ICAO:' + s[0]), lat: s[6], lon: s[5],
          altitude: s[7] != null ? Math.round(s[7] * 3.28084) : null,
          velocity: s[9] != null ? Math.round(s[9] * 1.944) : null,
          heading: s[10] != null ? Math.round(s[10]) : null,
          confidence: 95, severity: sev,
          tags: [isMil ? 'military' : 'civilian', sq ? 'squawk-' + sq : '', isEmg ? 'emergency' : ''].filter(Boolean),
          metadata: { icao24: s[0], callsign: cs, origin_country: s[2], squawk: sq, baro_alt: s[13], vert_rate: s[11], on_ground: s[8] },
        })
      })
  }

  // USGS — hardened magnitude filtering
  function parseUSGS(data) {
    if (!data?.features) return []
    return data.features.filter(function (f) { return f.properties.mag >= 1.5 }).slice(0, 200).map(function (f, i) {
      var p = f.properties, c = f.geometry.coordinates, mag = p.mag != null ? parseFloat(p.mag.toFixed(1)) : 0
      return ce({
        id: 'eq_' + i, entity_type: 'seismic', source: 'USGS', source_url: p.url || 'https://earthquake.usgs.gov/',
        title: 'M' + mag + ' \u2014 ' + (p.place || 'Unknown').slice(0, 60), lat: c[1], lon: c[0], altitude: c[2] ? -c[2] : null,
        timestamp: p.time ? new Date(p.time).toISOString() : '', confidence: 95,
        severity: mag >= 7 ? 'critical' : mag >= 5 ? 'high' : mag >= 3 ? 'medium' : 'low',
        tags: ['earthquake', p.tsunami ? 'tsunami-warning' : '', mag >= 5 ? 'significant' : ''].filter(Boolean),
        metadata: { magnitude: mag, depth_km: c[2], place: p.place, tsunami: p.tsunami, felt: p.felt, significance: p.sig, mag_type: p.magType },
      })
    })
  }

  function parseISS(d) {
    if (!d || d.latitude == null) return []
    return [ce({ id: 'iss_live', entity_type: 'iss', source: 'wheretheiss.at', source_url: 'https://wheretheiss.at/', title: 'ISS (ZARYA)', lat: d.latitude, lon: d.longitude, altitude: d.altitude ? Math.round(d.altitude) : 408, velocity: d.velocity ? Math.round(d.velocity) : 7660, confidence: 98, severity: 'info', tags: ['space-station'], metadata: { footprint: d.footprint, visibility: d.visibility } })]
  }

  // FIRMS — hardened confidence thresholds
  function parseFIRMS(csv) {
    if (!csv || typeof csv !== 'string') return []
    var lines = csv.trim().split('\n'); if (lines.length < 2) return []
    var hdr = lines[0].split(','), li = hdr.indexOf('latitude'), lo = hdr.indexOf('longitude'), fr = hdr.indexOf('frp'), cf = hdr.indexOf('confidence')
    if (li < 0 || lo < 0) return []
    return lines.slice(1, Math.min(150, state.markerCap)).map(function (row, i) {
      var c = row.split(','), lat = parseFloat(c[li]), lon = parseFloat(c[lo]); if (isNaN(lat) || isNaN(lon)) return null
      var frp = parseFloat(c[fr] || '0'), conf = parseInt(c[cf]) || 50
      if (conf < 30) return null // Filter low-confidence detections (Task 9)
      return ce({
        id: 'fire_' + i, entity_type: 'wildfire', source: 'NASA FIRMS', source_url: 'https://firms.modaps.eosdis.nasa.gov/',
        title: 'VIIRS Hotspot \u2014 FRP ' + frp.toFixed(0), lat: lat, lon: lon, confidence: conf,
        severity: frp >= 200 ? 'high' : frp >= 50 ? 'medium' : 'low',
        tags: ['wildfire', 'viirs', frp >= 200 ? 'intense' : ''].filter(Boolean),
        metadata: { frp: frp, brightness: c[hdr.indexOf('bright_ti4')], acq_date: c[hdr.indexOf('acq_date')] },
      })
    }).filter(Boolean)
  }

  function parseOWM(data) {
    if (!data?.events) return []
    return data.events.map(function (s, i) {
      return ce({ id: 'wx_' + i, entity_type: 'weather', source: 'OpenWeatherMap', source_url: 'https://openweathermap.org/', title: (s.name || s._city || 'SYSTEM') + ' \u2014 ' + (s.weather?.[0]?.description || '').toUpperCase(), lat: s.coord?.lat, lon: s.coord?.lon, confidence: 90, severity: 'info', metadata: { temp_c: s.main?.temp, wind_speed: s.wind?.speed, wind_deg: s.wind?.deg, pressure: s.main?.pressure, humidity: s.main?.humidity, clouds: s.clouds?.all } })
    })
  }

  function parseN2YO(data) {
    if (!data?.above) return []
    return data.above.slice(0, state.markerCap).map(function (s, i) {
      return ce({ id: 'sat_' + i, entity_type: 'satellite', source: 'N2YO', source_url: 'https://www.n2yo.com/', title: s.satname?.trim() || 'NORAD:' + s.satid, lat: s.satlat, lon: s.satlng, altitude: s.satalt ? Math.round(s.satalt) : null, confidence: 90, tags: ['satellite'], metadata: { norad_id: s.satid, int_designator: s.intDesignator } })
    })
  }

  // GFW — hardened vessel type parsing (Task 9)
  function parseGFW(data, type) {
    var entries = Array.isArray(data) ? data : (data?.entries || [])
    return entries.slice(0, 60).map(function (ev, i) {
      var pos = ev.position || {}, lat = pos.lat, lon = pos.lon; if (lat == null || lon == null) return null
      var vessel = ev.vessel || {}, name = vessel.name || 'MMSI:' + (vessel.ssvid || i)
      var gearType = vessel.gear_type || vessel.geartype || ''
      var flag = vessel.flag || ''
      return ce({
        id: (type === 'dark' ? 'gap_' : 'fish_') + i, entity_type: type === 'dark' ? 'dark_vessel' : 'fishing_vessel',
        source: 'Global Fishing Watch', source_url: 'https://globalfishingwatch.org/',
        title: (type === 'dark' ? 'DARK \u2014 ' : '') + name + (flag ? ' [' + flag + ']' : ''), lat: lat, lon: lon,
        confidence: 80, severity: type === 'dark' ? 'medium' : 'low',
        tags: [type === 'dark' ? 'ais-gap' : 'fishing', gearType, flag].filter(Boolean),
        metadata: { mmsi: vessel.ssvid, flag: flag, gap_hours: ev.gap_hours, gear_type: gearType, vessel_type: vessel.type },
      })
    }).filter(Boolean)
  }

  function parseGDACS(data) {
    return (data?.features || []).map(function (f, i) {
      var p = f.properties || {}, c = f.geometry?.coordinates || []; if (!c[1] || !c[0]) return null
      var alert = (p.alertlevel || '').toLowerCase()
      return ce({ id: 'gdacs_' + i, entity_type: 'disaster', source: 'GDACS', source_url: 'https://www.gdacs.org/', title: (p.eventtype || 'EV').toUpperCase() + ' \u2014 ' + (p.eventname || p.country || 'Unknown'), lat: c[1], lon: c[0], confidence: 90, severity: alert === 'red' ? 'critical' : alert === 'orange' ? 'high' : 'medium', tags: ['disaster', p.eventtype || ''], metadata: { alert_level: p.alertlevel, country: p.country, severity_value: p.severity, population_affected: p.pop_affected } })
    }).filter(Boolean)
  }

  var GEO_LITE = { 'ukraine': { lat: 48.4, lon: 31.2, region: 'Eastern Europe' }, 'russia': { lat: 55.8, lon: 37.6, region: 'Eastern Europe' }, 'syria': { lat: 35.0, lon: 38.0, region: 'Middle East' }, 'israel': { lat: 31.0, lon: 34.8, region: 'Middle East' }, 'iran': { lat: 32.4, lon: 53.7, region: 'Middle East' }, 'iraq': { lat: 33.2, lon: 44.4, region: 'Middle East' }, 'yemen': { lat: 15.6, lon: 48.5, region: 'Middle East' }, 'afghanistan': { lat: 33.9, lon: 67.7, region: 'Central Asia' }, 'pakistan': { lat: 30.4, lon: 69.3, region: 'Central Asia' }, 'india': { lat: 20.6, lon: 79.0, region: 'South Asia' }, 'china': { lat: 35.9, lon: 104.2, region: 'Indo-Pacific' }, 'japan': { lat: 36.2, lon: 138.3, region: 'Indo-Pacific' }, 'philippines': { lat: 12.9, lon: 121.8, region: 'Indo-Pacific' }, 'indonesia': { lat: -2.5, lon: 118.0, region: 'Indo-Pacific' }, 'sudan': { lat: 12.9, lon: 30.2, region: 'Africa' }, 'ethiopia': { lat: 9.1, lon: 40.5, region: 'Africa' }, 'somalia': { lat: 6.0, lon: 46.2, region: 'Africa' }, 'nigeria': { lat: 9.1, lon: 8.7, region: 'Africa' }, 'congo': { lat: -4.0, lon: 21.8, region: 'Africa' }, 'mozambique': { lat: -18.7, lon: 35.5, region: 'Africa' }, 'myanmar': { lat: 19.2, lon: 96.7, region: 'Southeast Asia' }, 'turkey': { lat: 39.9, lon: 32.9, region: 'Middle East' }, 'mexico': { lat: 23.6, lon: -102.5, region: 'Americas' }, 'brazil': { lat: -14.2, lon: -51.9, region: 'Americas' }, 'haiti': { lat: 18.9, lon: -72.3, region: 'Americas' }, 'nepal': { lat: 28.4, lon: 84.1, region: 'South Asia' }, 'bangladesh': { lat: 23.7, lon: 90.4, region: 'South Asia' }, 'libya': { lat: 26.3, lon: 17.2, region: 'Africa' }, 'egypt': { lat: 26.8, lon: 30.8, region: 'Africa' }, 'south africa': { lat: -30.6, lon: 22.9, region: 'Africa' }, 'kenya': { lat: -1.3, lon: 36.8, region: 'Africa' } }

  function parseReliefWeb(data) {
    var items = data?.data || []
    return items.slice(0, 50).map(function (item, i) {
      var f = item.fields || {}, countries = f.country || [], countryName = countries[0]?.name || 'Unknown'
      var geo = GEO_LITE[countryName.toLowerCase()] || null
      return ce({ id: 'rw_' + i, entity_type: 'disaster', source: 'ReliefWeb', source_url: 'https://reliefweb.int/', title: (f.name || 'Disaster Event').slice(0, 100), description: (f.primary_type || '') + ' \u2014 ' + (f.status || '') + ' \u2014 ' + countryName, lat: geo?.lat || null, lon: geo?.lon || null, region: geo?.region || '', timestamp: f.date?.created || '', confidence: geo ? 30 : 0, severity: (f.status || '') === 'alert' ? 'high' : 'medium', tags: ['disaster', f.primary_type || '', countryName].filter(Boolean), provenance: geo ? 'geocoded-inferred' : 'no-location', metadata: { country: countryName, type: f.primary_type, status: f.status, glide: f.glide } })
    }).filter(Boolean)
  }

  function parseSpaceTrackGP(data) { return (data?.events || []).map(function (e) { return Object.assign(ce({}), e) }) }
  function parseSpaceTrackCDM(data) { return (data?.events || []).map(function (e) { return Object.assign(ce({}), e) }) }

  function parseShodan(data) {
    var matches = data?.matches || []
    return matches.slice(0, 40).map(function (m, i) {
      return ce({ id: 'shodan_' + i, entity_type: 'cyber_intel', source: 'Shodan', source_url: 'https://www.shodan.io/', title: (m.product || 'Service') + ' on ' + (m.ip_str || '') + ':' + (m.port || ''), lat: m.location?.latitude || null, lon: m.location?.longitude || null, region: m.location?.country_name || '', confidence: 80, severity: 'medium', tags: ['ics', 'scada', m.product || ''].filter(Boolean), provenance: 'direct-api', metadata: { ip: m.ip_str, port: m.port, org: m.org, product: m.product, os: m.os, asn: m.asn, city: m.location?.city } })
    })
  }

  function parseCelesTrakTLE(text, type) {
    if (!window.satellite || !text || typeof text !== 'string') return []
    var lines = text.trim().split('\n'), results = [], max = state.isMobile ? 30 : 60
    for (var i = 0; i < lines.length - 2 && results.length < max; i += 3) {
      var name = lines[i].trim(), line1 = lines[i + 1], line2 = lines[i + 2]
      if (!line1 || !line2 || !line1.startsWith('1') || !line2.startsWith('2')) continue
      try {
        var satrec = satellite.twoline2satrec(line1, line2), now = new Date()
        var posVel = satellite.propagate(satrec, now); if (!posVel.position) continue
        var gmst = satellite.gstime(now), geo = satellite.eciToGeodetic(posVel.position, gmst)
        var lat = satellite.degreesLat(geo.latitude), lon = satellite.degreesLong(geo.longitude), alt = geo.height
        if (isNaN(lat) || isNaN(lon)) continue
        var norad = line2.slice(2, 7).trim()
        results.push(ce({ id: (type === 'debris' ? 'deb_' : 'tle_') + results.length, entity_type: type === 'debris' ? 'debris_object' : 'satellite', source: 'CelesTrak SGP4', source_url: 'https://celestrak.org/', title: name.slice(0, 24), lat: lat, lon: lon, altitude: alt ? Math.round(alt) : null, confidence: 92, tags: [type || 'satellite', 'tle'], provenance: 'direct-api', metadata: { norad_id: norad, inclination: satrec.inclo * 180 / Math.PI, period_min: 2 * Math.PI / satrec.no * 1440 / (2 * Math.PI) } }))
      } catch (e) { /* skip */ }
    }
    return results
  }

  function passthrough(data) { return (data?.events || []).map(function (e) { return Object.assign(ce({}), e) }) }

  // ═══════════════════════════════════════════════════════════════
  // ENTITY MANAGEMENT
  // ═══════════════════════════════════════════════════════════════
  function typeToLayer(et) {
    var m = { aircraft: 'aircraft', military_air: 'military', iss: 'iss', satellite: 'satellites', debris_object: 'debris', seismic: 'seismic', wildfire: 'wildfires', weather: 'weather', fishing_vessel: 'fishing', dark_vessel: 'darkships', ship: 'ships', conflict_intel: 'conflict', disaster: 'disasters', nuclear_intel: 'nuclear', cyber_vulnerability: 'cyber', cyber_threat_intel: 'cyber', cyber_malware_url: 'cyber', cyber_ioc: 'cyber', cyber_intel: 'cyber', cyber_host: 'cyber', gnss_jamming: 'gnss', gnss_spoofing: 'gnss', gnss_news: 'gnss', social_post: 'social', conjunction: 'conjunctions', sigmet: 'sigmets', natural_event: 'eonet' }
    return m[et] || 'conflict'
  }

  function replaceEntities(newEntities, prefix) {
    clearDedupePrefix(prefix)
    for (var i = state.entities.length - 1; i >= 0; i--) { if (state.entities[i].id.startsWith(prefix)) state.entities.splice(i, 1) }
    var deduped = deduplicateEntities(newEntities)
    state.entities.push.apply(state.entities, deduped)
    refreshMap()
  }

  function refreshCounts() {
    Object.keys(LAYERS).forEach(function (k) { state.counts[k] = 0 })
    var cutoff = getTimelineCutoff()
    state.entities.forEach(function (e) {
      if (cutoff > 0 && e.timestamp) { var t = new Date(e.timestamp).getTime(); if (t > 0 && t < cutoff) return }
      var l = typeToLayer(e.entity_type); if (state.counts[l] !== undefined) state.counts[l]++
    })
  }

  // ═══════════════════════════════════════════════════════════════
  // TIMELINE REPLAY (Task 16)
  // ═══════════════════════════════════════════════════════════════
  function getTimelineCutoff() { if (!state.scrubberEnabled || state.replayMode === 'live') return 0; if (state.replayPlaying && state.replayWindowStartMs > 0) return state.replayWindowStartMs + state.replayCursorMs; return Date.now() - state.replayWindowHours * 3600000 }
  function getTimelineEndMs() { if (state.replayPlaying && state.replayWindowStartMs > 0) return state.replayWindowStartMs + state.replayCursorMs; return Date.now() }
  function entityInTimeWindow(e) { if (!state.scrubberEnabled || state.replayMode === 'live') return true; if (!e.timestamp) return true; var t = new Date(e.timestamp).getTime(); if (t <= 0) return true; return t >= getTimelineCutoff() && t <= getTimelineEndMs() }

  function startReplay() { if (state.replayPlaying) return; state.replayPlaying = true; if (!state.scrubberEnabled) state.scrubberEnabled = true; if (state.replayMode === 'live') state.replayMode = '24h'; var modeHours = state.replayWindowHours, windowMs = modeHours * 3600000; state.replayWindowStartMs = Date.now() - windowMs; state.replayCursorMs = 0; var stepMs = (windowMs / 200) * state.replaySpeed; state.replayInterval = setInterval(function () { state.replayCursorMs += stepMs; if (state.replayCursorMs >= windowMs) { state.replayCursorMs = windowMs; stopReplay(); return }; refreshMap() }, 100); renderUI() }
  function stopReplay() { state.replayPlaying = false; if (state.replayInterval) { clearInterval(state.replayInterval); state.replayInterval = null }; renderUI() }
  function cycleReplaySpeed() { state.replaySpeed = state.replaySpeed === 1 ? 2 : state.replaySpeed === 2 ? 4 : 1; if (state.replayPlaying) { stopReplay(); startReplay() }; renderUI() }
  function setReplayMode(mode) { state.replayMode = mode; if (mode === 'live') { state.scrubberEnabled = false; state.replayWindowHours = 0; stopReplay() } else { state.scrubberEnabled = true; var m = REPLAY_MODES.find(function (rm) { return rm.key === mode }); state.replayWindowHours = m ? m.hours : 24; stopReplay() }; refreshMap() }
  function replayProgressPct() { if (!state.replayPlaying || state.replayWindowHours <= 0) return 100; return Math.min(100, Math.round((state.replayCursorMs / (state.replayWindowHours * 3600000)) * 100)) }

  // ═══════════════════════════════════════════════════════════════
  // MAP RENDERING (Task 17 — viewport culling, Task 23 — GNSS circles)
  // ═══════════════════════════════════════════════════════════════
  function markerIcon(color, size, severity) {
    var r = size / 2, glow = !state.isMobile && (severity === 'critical' || severity === 'high')
    var svg = '<svg width="' + size + '" height="' + size + '" xmlns="http://www.w3.org/2000/svg">'
    if (glow) svg += '<circle cx="' + r + '" cy="' + r + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="0.6" opacity="0.4"/>'
    svg += '<circle cx="' + r + '" cy="' + r + '" r="' + (r - 1) + '" fill="' + color + '" opacity="0.8"/>'
    svg += '<circle cx="' + r + '" cy="' + r + '" r="' + (size * 0.18) + '" fill="#e0f0ff" opacity="0.9"/></svg>'
    return L.divIcon({ html: '<div class="sm' + (glow ? ' sm-glow' : '') + '">' + svg + '</div>', className: '', iconSize: [size, size], iconAnchor: [r, r] })
  }
  function inferredIcon(color, size) {
    var r = size / 2
    var svg = '<svg width="' + size + '" height="' + size + '" xmlns="http://www.w3.org/2000/svg"><circle cx="' + r + '" cy="' + r + '" r="' + (r - 1) + '" fill="none" stroke="' + color + '" stroke-width="1.2" stroke-dasharray="3 2" opacity="0.6"/><circle cx="' + r + '" cy="' + r + '" r="' + (size * 0.15) + '" fill="' + color + '" opacity="0.5"/></svg>'
    return L.divIcon({ html: '<div class="sm sm-inferred">' + svg + '</div>', className: '', iconSize: [size, size], iconAnchor: [r, r] })
  }
  function isInViewport(lat, lon) {
    if (!state.viewportBounds) return true
    var b = state.viewportBounds, pad = 5
    return lat >= b.south - pad && lat <= b.north + pad && lon >= b.west - pad && lon <= b.east + pad
  }

  function refreshMap() {
    if (!state.map) return
    var now = Date.now()
    if (now - state.lastRenderTime < state.renderThrottleMs) {
      if (!state.renderPending) { state.renderPending = true; setTimeout(function () { state.renderPending = false; refreshMap() }, state.renderThrottleMs) }
      return
    }
    state.lastRenderTime = now
    updateViewportBounds(); refreshCounts()
    Object.values(state.layerGroups).forEach(function (g) { g.clearLayers() })
    var rendered = 0, hardCap = state.markerCap * 2
    var sortedEntities = state.entities.slice().sort(function (a, b) { var so = { critical: 0, high: 1, medium: 2, low: 3, info: 4 }; return (so[a.severity] || 4) - (so[b.severity] || 4) })

    sortedEntities.forEach(function (e) {
      if (e.lat == null || e.lon == null) return; if (rendered >= hardCap) return
      var layerKey = typeToLayer(e.entity_type), cfg = LAYERS[layerKey]
      if (!cfg || !state.layerGroups[layerKey]) return
      if (!entityInTimeWindow(e)) return
      if (state.isMobile && !isInViewport(e.lat, e.lon)) return

      var isInferred = e.provenance === 'geocoded-inferred' || e.provenance === 'no-location'
      var sz = state.isMobile ? 8 : (e.severity === 'critical' ? 14 : e.severity === 'high' ? 11 : 9)
      var icon = isInferred ? inferredIcon(cfg.color, sz) : markerIcon(cfg.color, sz, e.severity)
      var m = L.marker([e.lat, e.lon], { icon: icon })
      m.on('click', function () { state.selected = e; state.inspectorExpanded = false; state.inspectorCardStates = {}; if (state.isMobile) state.drawerOpen = false; renderUI() })
      if (!state.isMobile) {
        var conf = e.confidence != null ? ' [' + e.confidence + '%]' : '', prov = isInferred ? ' (INFERRED)' : ''
        m.bindTooltip('<b>' + esc(e.title) + '</b><br><span style="opacity:0.7">' + esc(e.source) + conf + prov + '</span>', { className: 'sentinel-tooltip', direction: 'top', offset: [0, -6] })
      }
      state.layerGroups[layerKey].addLayer(m); rendered++
    })
    renderUI()
  }

  // ═══════════════════════════════════════════════════════════════
  // INIT MAP (Task 5 — right-click intel, Task 7 — click METAR, Task 23 — GNSS circles)
  // ═══════════════════════════════════════════════════════════════
  function initMap() {
    if (!window.L) { console.error('Leaflet not loaded'); return }
    state.map = L.map('map', { center: [25, 30], zoom: 3, zoomControl: false, attributionControl: false, minZoom: 2, maxZoom: 18, worldCopyJump: true, preferCanvas: true, tap: true })
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18 }).addTo(state.map)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png', { subdomains: 'abcd', maxZoom: 18, opacity: 0.7 }).addTo(state.map)
    state.map.on('moveend', updateViewportBounds); state.map.on('zoomend', updateViewportBounds)

    // Right-click → Intel Overview (Task 5)
    state.map.on('contextmenu', function (ev) {
      var lat = ev.latlng.lat, lon = ev.latlng.lng
      state.intelOverlay = { lat: lat, lon: lon, data: null }
      state.intelLoading = true; renderUI()
      getApi('/api/intel/overview?lat=' + lat.toFixed(4) + '&lon=' + lon.toFixed(4) + '&radius=250&domains=weather,aviation,natural,cyber').then(function (d) {
        if (!isErr(d)) state.intelOverlay = { lat: lat, lon: lon, data: d }
        state.intelLoading = false; renderUI()
      }).catch(function () { state.intelLoading = false; renderUI() })
    })

    // Double-click → Nearest METAR (Task 7)
    state.map.on('dblclick', function (ev) {
      var lat = ev.latlng.lat, lon = ev.latlng.lng
      getApi('/api/avwx/near?lat=' + lat.toFixed(4) + '&lon=' + lon.toFixed(4) + '&limit=3').then(function (d) {
        if (!isErr(d) && d.metars && d.metars.length > 0) {
          var m = d.metars[0], st = d.stations?.[0] || {}
          var raw = m.raw || '', temp = m.temperature?.value != null ? m.temperature.value + '\u00B0C' : '?'
          var wind = m.wind_speed?.value != null ? m.wind_speed.value + 'kt' : '?'
          var vis = m.visibility?.value != null ? m.visibility.value + 'm' : '?'
          var html = '<div style="font-family:JetBrains Mono,monospace;font-size:10px;max-width:280px">'
          html += '<b>' + esc(st.icao || m.station || '???') + '</b> ' + esc(st.name || '') + '<br>'
          html += '<span style="color:#00d4ff">' + temp + '</span> | Wind ' + wind + ' | Vis ' + vis + '<br>'
          html += '<span style="font-size:8px;color:#6a8ca0;word-break:break-all">' + esc(raw) + '</span></div>'
          L.popup({ className: 'metar-popup' }).setLatLng([lat, lon]).setContent(html).openOn(state.map)
        }
      }).catch(function () {})
    })

    // Threat zones
    var ztc = { conflict: '#ff2200', chokepoint: '#ff8800', flashpoint: '#ffcc00' }
    THREAT_ZONES.forEach(function (z) {
      var col = ztc[z.type] || '#ff4400'
      state.zoneCircles.push(L.circle([z.lat, z.lon], { radius: z.r * 1000, color: col, weight: 0.6, opacity: 0.3, fillColor: col, fillOpacity: 0.02, dashArray: '5 8', interactive: false }).addTo(state.map))
      state.zoneLabels.push(L.marker([z.lat, z.lon], { icon: L.divIcon({ html: '<div style="color:' + col + ';font-size:7px;font-family:JetBrains Mono,monospace;white-space:nowrap;opacity:0.5;letter-spacing:1.5px;text-transform:uppercase;pointer-events:none">' + z.name + '</div>', className: '', iconAnchor: [0, 0] }), interactive: false, zIndexOffset: -1000 }).addTo(state.map))
    })

    // SIGMET polygon layer (Task 2)
    state.sigmetPolygons = L.layerGroup().addTo(state.map)

    // Layer groups
    var CLUSTERED = { aircraft: 1, satellites: 1, debris: 1, seismic: 1, eonet: 1 }
    Object.keys(LAYERS).forEach(function (k) {
      if (CLUSTERED[k] && L.MarkerClusterGroup) {
        var radius = state.isMobile ? 60 : (k === 'seismic' ? 30 : 45)
        state.layerGroups[k] = L.markerClusterGroup({ maxClusterRadius: radius, showCoverageOnHover: false, animate: !state.isMobile, iconCreateFunction: function (c) { var n = c.getChildCount(), col = LAYERS[k].color, sz = n > 100 ? 30 : n > 30 ? 24 : 20; return L.divIcon({ html: '<div style="width:' + sz + 'px;height:' + sz + 'px;border-radius:50%;background:' + col + '18;border:1px solid ' + col + '55;display:flex;align-items:center;justify-content:center;font-family:JetBrains Mono;color:' + col + ';font-size:9px;font-weight:600">' + n + '</div>', className: '', iconSize: [sz, sz] }) } })
      } else { state.layerGroups[k] = L.layerGroup() }
      if (state.layerState[k]) state.layerGroups[k].addTo(state.map)
    })

    L.control.zoom({ position: 'bottomright' }).addTo(state.map)
    L.control.scale({ position: 'bottomright', imperial: false }).addTo(state.map)
  }

  function toggleLayer(k) {
    state.layerState[k] = !state.layerState[k]
    if (state.layerState[k]) { if (state.map && state.layerGroups[k]) state.layerGroups[k].addTo(state.map) }
    else { if (state.map && state.layerGroups[k]) state.map.removeLayer(state.layerGroups[k]) }
    renderUI()
  }
  function toggleZones() {
    state.showZones = !state.showZones
    state.zoneCircles.forEach(function (c) { state.showZones ? c.addTo(state.map) : state.map.removeLayer(c) })
    state.zoneLabels.forEach(function (l) { state.showZones ? l.addTo(state.map) : state.map.removeLayer(l) })
    renderUI()
  }

  // ═══════════════════════════════════════════════════════════════
  // GNSS ANOMALY CIRCLE OVERLAYS (Task 23)
  // ═══════════════════════════════════════════════════════════════
  function renderGNSSCircles(entities) {
    state.gnssCircles.forEach(function (c) { state.map.removeLayer(c) }); state.gnssCircles = []
    entities.forEach(function (e) {
      if (e.lat == null || e.lon == null) return
      var radius = (e.metadata?.radius_km || 150) * 1000
      var col = e.entity_type === 'gnss_spoofing' ? '#ff6633' : '#ff3333'
      var c = L.circle([e.lat, e.lon], { radius: radius, color: col, weight: 1, opacity: 0.4, fillColor: col, fillOpacity: 0.05, dashArray: '4 6', interactive: true })
      c.bindTooltip(esc(e.title) + '<br><span style="font-size:8px;color:#ff6633">' + esc(e.entity_type) + '</span>', { className: 'sentinel-tooltip' })
      c.on('click', function () { state.selected = e; renderUI() })
      if (state.layerState.gnss) c.addTo(state.map)
      state.gnssCircles.push(c)
    })
  }

  // ═══════════════════════════════════════════════════════════════
  // SIGMET POLYGON RENDERING (Task 2)
  // ═══════════════════════════════════════════════════════════════
  function renderSigmetPolygons(events) {
    if (!state.sigmetPolygons) return
    state.sigmetPolygons.clearLayers()
    events.forEach(function (e) {
      var coords = e.metadata?.coords || []
      if (coords.length < 3) return
      var latLngs = coords.map(function (c) { return [c[1] || c[0], c[0] || c[1]] }).filter(function (ll) { return !isNaN(ll[0]) && !isNaN(ll[1]) })
      if (latLngs.length < 3) return
      var hz = (e.metadata?.hazard || 'UNKNOWN').toUpperCase()
      var col = hz === 'VA' ? '#ff0000' : hz === 'TC' ? '#ff00ff' : hz === 'TURB' ? '#ff9900' : hz === 'ICE' ? '#00ccff' : '#ffcc00'
      var poly = L.polygon(latLngs, { color: col, weight: 1.5, opacity: 0.6, fillColor: col, fillOpacity: 0.08, dashArray: '6 4' })
      poly.bindTooltip('<b>SIGMET: ' + esc(hz) + '</b><br>' + esc(e.title), { className: 'sentinel-tooltip', sticky: true })
      poly.on('click', function () { state.selected = e; renderUI() })
      state.sigmetPolygons.addLayer(poly)
    })
  }

  // ═══════════════════════════════════════════════════════════════
  // SEARCH
  // ═══════════════════════════════════════════════════════════════
  function doSearch(q) {
    state.searchQuery = q; if (!q || q.length < 2) { state.searchResults = []; return }
    var lower = q.toLowerCase()
    state.searchResults = state.entities.filter(function (e) { return e.title.toLowerCase().includes(lower) || (e.tags || []).some(function (t) { return t.toLowerCase().includes(lower) }) || (e.region || '').toLowerCase().includes(lower) || (e.source || '').toLowerCase().includes(lower) }).slice(0, 15)
  }
  function flyTo(e) { if (e && e.lat != null && e.lon != null && state.map) { state.map.flyTo([e.lat, e.lon], 8, { duration: 1 }); state.selected = e; state.inspectorExpanded = false; if (state.isMobile) state.drawerOpen = false; renderUI() } }

  function log(msg, sev) { state.timeline.unshift({ msg: msg, sev: sev || 'info', time: new Date().toISOString() }); if (state.timeline.length > 100) state.timeline.length = 100 }
  function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }

  // ═══════════════════════════════════════════════════════════════
  // SATELLITE IMAGERY (Task 20 — Copernicus)
  // ═══════════════════════════════════════════════════════════════
  var SAT_PRODUCTS = {
    modis_terra: { label: 'MODIS Terra', sub: 'True Color', layer: 'MODIS_Terra_CorrectedReflectance_TrueColor', matrixSet: 'GoogleMapsCompatible_Level9', format: 'jpg', maxZoom: 9, daily: true, desc: '250 m/px daily' },
    viirs_snpp: { label: 'VIIRS SNPP', sub: 'True Color', layer: 'VIIRS_SNPP_CorrectedReflectance_TrueColor', matrixSet: 'GoogleMapsCompatible_Level9', format: 'jpg', maxZoom: 9, daily: true, desc: '250 m/px daily' },
    sentinel2: { label: 'Sentinel-2', sub: 'Cloudless 2024', tileUrl: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857_512/default/GoogleMapsCompatible_Level15/{z}/{y}/{x}.jpg', maxZoom: 15, daily: false, desc: '10 m/px annual mosaic' },
    copernicus: { label: 'Copernicus SH', sub: 'Sentinel-2 L2A', maxZoom: 16, daily: true, desc: '10 m/px hi-res (OAuth2)', copernicus: true },
  }

  function initSatDate() { state.satDate = new Date(Date.now() - 86400000).toISOString().split('T')[0] }
  initSatDate()
  function buildGIBSUrl(key) { var p = SAT_PRODUCTS[key]; if (!p || p.tileUrl) return null; return 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/' + p.layer + '/default/' + state.satDate + '/' + p.matrixSet + '/{z}/{y}/{x}.' + p.format }

  var copernicusTokenCache = { token: '', expiry: 0 }
  async function getCopernicusToken() { if (copernicusTokenCache.token && Date.now() < copernicusTokenCache.expiry) return copernicusTokenCache.token; try { var data = await getApi('/api/copernicus/token'); if (data && !isErr(data) && data.access_token) { copernicusTokenCache.token = data.access_token; copernicusTokenCache.expiry = Date.now() + ((data.expires_in || 280) * 1000); return data.access_token } } catch (e) { }; return '' }

  function applySatelliteLayer(key) {
    if (!state.map) return
    if (state.satTileLayer) { state.map.removeLayer(state.satTileLayer); state.satTileLayer = null }
    if (state.satLabelLayer) { state.map.removeLayer(state.satLabelLayer); state.satLabelLayer = null }
    if (key === 'none' || !key) { state.activeSatLayer = null; renderUI(); return }
    var p = SAT_PRODUCTS[key]; if (!p) return
    if (p.copernicus) {
      state.activeSatLayer = key
      getCopernicusToken().then(function (token) {
        if (!token) { log('Copernicus token unavailable', 'error'); state.activeSatLayer = null; renderUI(); return }
        state.satTileLayer = L.tileLayer.wms('https://sh.dataspace.copernicus.eu/ogc/wms/' + token, { layers: 'TRUE-COLOR-S2L2A', format: 'image/jpeg', transparent: false, time: state.satDate + '/' + state.satDate, maxcc: 30, maxZoom: 16, opacity: 0.92 })
        state.satTileLayer.addTo(state.map); state.satTileLayer.setZIndex(50)
        state.satLabelLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png', { subdomains: 'abcd', maxZoom: 18, opacity: 0.7 })
        state.satLabelLayer.addTo(state.map); state.satLabelLayer.setZIndex(51)
        log('Copernicus SH: Sentinel-2 L2A (' + state.satDate + ')', 'info'); renderUI()
      })
      return
    }
    var url = p.tileUrl || buildGIBSUrl(key); if (!url) return
    state.activeSatLayer = key
    state.satTileLayer = L.tileLayer(url, { maxZoom: p.maxZoom || 9, opacity: 0.92 }); state.satTileLayer.addTo(state.map); state.satTileLayer.setZIndex(50)
    state.satLabelLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png', { subdomains: 'abcd', maxZoom: 18, opacity: 0.7 }); state.satLabelLayer.addTo(state.map); state.satLabelLayer.setZIndex(51)
    log('Satellite: ' + p.label, 'info'); renderUI()
  }
  function changeSatDate(newDate) { if (newDate && /^\d{4}-\d{2}-\d{2}$/.test(newDate)) { state.satDate = newDate; if (state.activeSatLayer) applySatelliteLayer(state.activeSatLayer) } }
  function datePair() { var end = new Date().toISOString().split('T')[0], start = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]; return { startDate: start, endDate: end } }

  function openDrawer(side) { state.drawerOpen = true; state.drawerSide = side || 'left'; renderUI() }
  function closeDrawer() { state.drawerOpen = false; renderUI() }

  // ═══════════════════════════════════════════════════════════════
  // UI RENDERING (Tasks 6, 8, 13, 14, 15, 22, 24)
  // ═══════════════════════════════════════════════════════════════
  function renderUI() {
    refreshCounts()
    var total = Object.values(state.counts).reduce(function (a, b) { return a + b }, 0)
    var threatBoard = state.entities.map(function (e) { return Object.assign({ entity: e }, scoreThreat(e)) }).filter(function (t) { return t.score >= 10 }).sort(function (a, b) { return b.score - a.score }).slice(0, 40)
    var critCount = threatBoard.filter(function (t) { return t.level === 'CRITICAL' }).length
    var highCount = threatBoard.filter(function (t) { return t.level === 'HIGH' }).length
    var now = new Date()
    function pad(v) { return String(v).padStart(2, '0') }
    var clock = pad(now.getUTCHours()) + ':' + pad(now.getUTCMinutes()) + ':' + pad(now.getUTCSeconds()) + 'Z'
    var connClass = state.connectionOk ? 'conn-ok' : 'conn-err'
    var secToRefresh = Math.max(0, Math.round((state.nextRefreshAt - Date.now()) / 1000))
    var h = ''

    // HEADER
    h += '<div class="hdr"><div class="hdr-left">'
    h += '<span class="hdr-menu" onclick="S._toggleDrawer()">\u2630</span>'
    h += '<div class="hdr-dot ' + connClass + '"></div>'
    h += '<span class="hdr-title">SENTINEL</span>'
    h += '<span class="hdr-sub">v8.5 \u2014 GLOBAL SITUATIONAL AWARENESS</span>'
    h += '<span class="hdr-btn' + (state.showZones ? ' active' : '') + '" onclick="S._toggleZones()">ZONES</span>'
    if (critCount > 0) h += '<span class="hdr-alert" onclick="S._setPanel(\'threat\')">' + critCount + ' CRIT</span>'
    h += '</div><div class="hdr-right">'
    h += '<span class="hdr-clock">' + clock + '</span>'
    h += '<span class="hdr-total">' + total.toLocaleString() + '</span>'
    h += '<span class="hdr-btn' + (state.activeSatLayer ? ' active' : '') + '" onclick="S._toggleSat()">SAT</span>'
    h += '<span class="hdr-btn' + (state.scrubberEnabled ? ' active' : '') + '" onclick="S._toggleScrub()">TIME</span>'
    h += '</div></div>'

    h += '<div class="classif">UNCLASSIFIED // OPEN SOURCE INTELLIGENCE'
    if (state.cycle > 0) h += ' // CYCLE ' + state.cycle + ' // REFRESH ' + secToRefresh + 's'
    h += '</div>'

    // TIMELINE REPLAY BAR (Task 16)
    if (state.scrubberEnabled) {
      h += '<div class="scrubber"><div class="scrub-modes">'
      REPLAY_MODES.forEach(function (rm) { h += '<span class="scrub-mode-btn' + (state.replayMode === rm.key ? ' active' : '') + '" onclick="S._setReplayMode(\'' + rm.key + '\')">' + rm.label + '</span>' })
      h += '</div><div class="replay-ctrl">'
      h += '<span class="replay-btn' + (state.replayPlaying ? ' active' : '') + '" onclick="S._replayToggle()">' + (state.replayPlaying ? '\u23F8' : '\u25B6') + '</span>'
      h += '<span class="replay-speed" onclick="S._replaySpeed()">' + state.replaySpeed + 'x</span>'
      if (state.replayPlaying) h += '<span class="replay-pct">' + replayProgressPct() + '%</span>'
      h += '</div><div class="scrub-progress"><div class="scrub-progress-fill" style="width:' + replayProgressPct() + '%"></div></div>'
      h += '<span class="scrub-close" onclick="S._toggleScrub()">\u2715</span></div>'
    }

    // SATELLITE PANEL (Task 20)
    if (state.showSatPanel) {
      h += '<div class="hud-sat-panel"><div style="padding:8px 12px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--brd)"><span style="font-size:8px;letter-spacing:2px;color:var(--cyan)">SATELLITE IMAGERY</span><span style="cursor:pointer;color:var(--t3);font-size:10px" onclick="S._toggleSat()">\u2715</span></div>'
      h += '<div style="padding:6px 12px;display:flex;align-items:center;gap:6px;border-bottom:1px solid var(--brd)"><input type="date" value="' + state.satDate + '" onchange="S._satDateChange(this.value)" style="flex:1;background:var(--bg1);border:1px solid var(--brd);color:var(--t1);font-family:var(--mono);font-size:9px;padding:3px 6px;border-radius:2px"></div>'
      h += '<div style="padding:4px 0"><div class="sat-row' + (!state.activeSatLayer ? ' sat-active' : '') + '" onclick="S._applySat(\'none\')"><span style="font-size:8px;color:var(--t2)">DEFAULT MAP (Off)</span></div>'
      Object.entries(SAT_PRODUCTS).forEach(function (entry) { var key = entry[0], p = entry[1]; h += '<div class="sat-row' + (state.activeSatLayer === key ? ' sat-active' : '') + '" onclick="S._applySat(\'' + key + '\')"><div style="font-size:8px;color:var(--t1)">' + p.label + ' <span style="color:var(--t3);font-size:7px">' + p.sub + '</span></div><div style="font-size:6.5px;color:var(--t3)">' + p.desc + '</div></div>' })
      h += '</div></div>'
    }

    // SAT INDICATOR
    if (state.activeSatLayer) { var sp = SAT_PRODUCTS[state.activeSatLayer]; h += '<div class="hud-sat-indicator" onclick="S._toggleSat()"><span style="font-size:7px;color:var(--cyan)">\uD83D\uDEF0 ' + (sp?.label || '') + '</span><span style="font-size:7px;color:var(--red);cursor:pointer" onclick="event.stopPropagation();S._applySat(\'none\')">\u2715 OFF</span></div>' }

    // SEARCH
    h += '<div class="search-wrap"><input class="search-input" type="text" placeholder="Search entities..." value="' + esc(state.searchQuery) + '" oninput="S._search(this.value)" onfocus="S._searchFocus()" onblur="setTimeout(function(){S._searchBlur()},200)">'
    if (state.searchOpen && state.searchResults.length > 0) {
      h += '<div class="search-results">'; state.searchResults.forEach(function (e, i) { var col = LAYERS[typeToLayer(e.entity_type)]?.color || '#fff'; h += '<div class="search-item" onclick="S._searchSelect(' + i + ')"><span class="dot" style="background:' + col + '"></span><span class="search-title">' + esc(e.title).slice(0, 60) + '</span><span class="search-src">' + esc(e.source) + '</span></div>' }); h += '</div>'
    }
    h += '</div>'

    // INTEL OVERVIEW PANEL (Task 5)
    if (state.intelOverlay) {
      h += '<div class="intel-panel">'
      h += '<div class="intel-header"><span>\uD83C\uDF10 INTEL OVERVIEW</span><span class="intel-close" onclick="S._closeIntel()">\u2715</span></div>'
      if (state.intelLoading) { h += '<div style="padding:12px;text-align:center;color:var(--cyan);font-size:9px">Loading multi-domain intelligence...</div>' }
      else if (state.intelOverlay.data) {
        var d = state.intelOverlay.data
        h += '<div class="intel-coords">' + state.intelOverlay.lat.toFixed(3) + ', ' + state.intelOverlay.lon.toFixed(3) + ' | r=' + (d.query?.radius_km || 250) + 'km</div>'
        if (d.weather) { h += '<div class="intel-section"><span class="intel-sec-title">\uD83C\uDF24 WEATHER</span><span class="intel-sec-val">' + (d.weather.main?.temp || '?') + '\u00B0C ' + (d.weather.weather?.[0]?.description || '') + '</span></div>' }
        if (d.aviation?.sigmets?.length > 0) { h += '<div class="intel-section"><span class="intel-sec-title">\u26A0 SIGMETS</span><span class="intel-sec-val">' + d.aviation.sigmets.length + ' active</span></div>' }
        if (d.aviation?.metars?.length > 0) { h += '<div class="intel-section"><span class="intel-sec-title">\u2708 METARS</span><span class="intel-sec-val">' + d.aviation.metars.length + ' stations</span></div>' }
        if (d.natural_events?.length > 0) { h += '<div class="intel-section"><span class="intel-sec-title">\uD83C\uDF0B NATURAL</span><span class="intel-sec-val">' + d.natural_events.length + ' events</span></div>' }
        if (d.cyber?.host_count > 0) { h += '<div class="intel-section"><span class="intel-sec-title">\uD83D\uDD12 CYBER</span><span class="intel-sec-val">' + d.cyber.host_count + ' exposed hosts</span></div>' }
        if (!d.weather && !d.aviation?.sigmets?.length && !d.natural_events?.length && !d.cyber?.host_count) { h += '<div style="padding:8px;font-size:8px;color:var(--t3)">No significant intelligence in this area</div>' }
      }
      h += '</div>'
    }

    // DRAWER OVERLAY
    h += '<div class="drawer-overlay' + (state.drawerOpen ? ' active' : '') + '" onclick="S._closeDrawer()"></div>'

    // LEFT PANEL (Task 13 — domain tabs)
    h += '<div class="lp' + (state.drawerOpen ? ' drawer-open' : '') + '"><div class="tabs">'
    ;[['layers', 'LAYERS'], ['threat', 'THREAT ' + critCount], ['sources', 'SOURCES']].forEach(function (pair) { h += '<div class="tab' + (state.panel === pair[0] ? ' active' : '') + '" onclick="S._setPanel(\'' + pair[0] + '\')">' + pair[1] + '</div>' })
    h += '</div>'

    // Domain filter tabs (Task 13)
    if (state.panel === 'layers') {
      h += '<div class="domain-tabs">'
      DOMAIN_LIST.forEach(function (d) { var domCol = DOMAIN_COLORS[d] || 'var(--cyan)'; var isActive = state.activeDomain === d; h += '<div class="domain-tab' + (isActive ? ' active' : '') + '" ' + (isActive && d !== 'ALL' ? 'style="border-color:' + domCol + ';color:' + domCol + '" ' : '') + 'onclick="S._setDomain(\'' + d + '\')">' + d + '</div>' })
      h += '</div>'
    }

    h += '<div class="lp-body">'
    if (state.panel === 'layers') {
      var currentDomain = ''
      Object.entries(LAYERS).forEach(function (entry) {
        var k = entry[0], cfg = entry[1]
        if (state.activeDomain !== 'ALL' && cfg.domain !== state.activeDomain) return
        if (cfg.domain !== currentDomain) { currentDomain = cfg.domain; h += '<div class="domain-hdr" style="color:' + (DOMAIN_COLORS[currentDomain] || 'var(--t3)') + '">' + currentDomain + '</div>' }
        var on = state.layerState[k], st = state.sourceHealth[k]
        var dotCol = st === 'live' ? '#00ff88' : st === 'error' ? '#ff3355' : '#ffaa00'
        h += '<div class="layer-row' + (on ? '' : ' off') + '" onclick="S._toggle(\'' + k + '\')">'
        h += '<span class="dot" style="background:' + (on ? cfg.color : '#0a1520') + '"></span>'
        h += '<span class="layer-label">' + cfg.icon + ' ' + cfg.label + '</span>'
        h += '<span class="layer-count" style="color:' + cfg.color + '">' + (state.counts[k] || 0) + '</span>'
        h += '<span class="dot-sm" style="background:' + dotCol + '"></span>'
        h += '<span class="layer-status">' + (st === 'live' ? 'LIVE' : st === 'error' ? 'ERR' : 'LOAD') + '</span>'
        h += '</div>'
      })
    }

    if (state.panel === 'threat') {
      h += '<div class="threat-summary"><div class="threat-stat"><span class="threat-num" style="color:#ff0033">' + critCount + '</span><span class="threat-lbl">CRIT</span></div><div class="threat-stat"><span class="threat-num" style="color:#ff7700">' + highCount + '</span><span class="threat-lbl">HIGH</span></div>'
      var gi = Math.min(100, Math.round(critCount * 12 + highCount * 5))
      h += '<div class="threat-bar"><div class="threat-fill" style="width:' + gi + '%;background:' + (gi >= 75 ? '#ff0033' : gi >= 50 ? '#ff7700' : '#ffcc00') + '"></div></div></div>'
      threatBoard.forEach(function (t) { var fr = freshness(t.entity.timestamp); h += '<div class="threat-item' + (t.level === 'CRITICAL' ? ' t-crit' : t.level === 'HIGH' ? ' t-high' : '') + '" onclick="S._flyTo(\'' + t.entity.id + '\')"><div class="threat-item-top"><span class="threat-name">' + esc(t.entity.title).slice(0, 50) + '</span><span class="threat-score" style="color:' + t.col + '">' + t.score + '</span></div><div class="threat-item-meta">' + (t.reasons[0] ? '<span class="threat-reason">' + esc(t.reasons[0]) + '</span>' : '') + '<span class="chip-fresh ' + fr.cls + '" style="font-size:5.5px">' + fr.label + '</span></div></div>' })
    }

    // SOURCES panel (Task 6 — circuit breaker, Task 8 — cache indicators)
    if (state.panel === 'sources') {
      // Circuit breaker status (Task 6)
      if (Object.keys(state.circuitStatus).length > 0) {
        h += '<div class="domain-hdr" style="color:var(--red)">CIRCUIT BREAKERS</div>'
        Object.entries(state.circuitStatus).forEach(function (entry) {
          var src = entry[0], cs = entry[1]
          if (cs.open || cs.failures > 0) {
            h += '<div class="src-row"><span class="layer-label">' + esc(src) + '</span>'
            h += '<span class="src-badge ' + (cs.open ? 'error' : 'loading') + '">' + (cs.open ? 'OPEN' : cs.failures + ' FAIL') + '</span>'
            if (cs.cooldown_remaining_s > 0) h += '<span style="font-size:6px;color:var(--amber);margin-left:4px">' + cs.cooldown_remaining_s + 's cooldown</span>'
            h += '</div>'
          }
        })
      }

      // Cache status (Task 8)
      if (Object.keys(state.cacheStatus).length > 0) {
        h += '<div class="domain-hdr" style="color:var(--green)">RESPONSE CACHE</div>'
        Object.entries(state.cacheStatus).forEach(function (entry) {
          var key = entry[0], cs = entry[1]
          h += '<div class="src-row"><span class="layer-label" style="font-size:7px">' + esc(key) + '</span>'
          h += '<span class="src-badge ' + (cs.expired ? 'error' : 'live') + '">' + (cs.expired ? 'EXPIRED' : 'CACHED') + '</span>'
          h += '<span style="font-size:6px;color:var(--t3);margin-left:4px">' + cs.remaining_s + 's remaining</span>'
          h += '</div>'
        })
      }

      h += '<div class="domain-hdr">SOURCE HEALTH</div>'
      Object.entries(LAYERS).forEach(function (entry) {
        var k = entry[0], cfg = entry[1], st = state.sourceHealth[k], met = state.sourceMetrics[k], sfr = state.sourceFreshness[k], srcFr = sfr ? freshness(sfr) : null
        h += '<div class="src-row"><span class="layer-label">' + cfg.label + '</span><span class="src-badge ' + st + '">' + st.toUpperCase() + '</span>'
        if (srcFr) h += '<span class="chip-fresh ' + srcFr.cls + '" style="font-size:5.5px;margin-left:3px">' + srcFr.label + '</span>'
        h += '<span class="src-detail">' + cfg.src + '</span></div>'
        if (met) { h += '<div class="src-metrics"><span class="src-metric"><b>' + met.latency_ms + '</b>ms</span><span class="src-metric"><b>' + (met.uptime_pct || 0) + '%</b> up</span>' + (met.error_count > 0 ? '<span class="src-metric err-metric">' + met.error_count + ' err</span>' : '') + '</div>' }
      })

      h += '<div class="domain-hdr" style="margin-top:8px">TIMELINE</div>'
      state.timeline.slice(0, 20).forEach(function (t) { h += '<div class="log-row"><span class="log-time">' + t.time.slice(11, 19) + '</span><span class="log-msg">' + esc(t.msg) + '</span></div>' })
    }

    h += '</div></div>'

    // INSPECTOR
    if (state.selected) {
      var e = state.selected, t = scoreThreat(e), isInf = e.provenance === 'geocoded-inferred', fr = freshness(e.timestamp), cc = confClass(e.confidence)
      var layerKey = typeToLayer(e.entity_type), domainCfg = LAYERS[layerKey], domainColor = domainCfg?.color || 'var(--cyan)'
      h += '<div class="rp"><div class="rp-header" style="border-left:3px solid ' + domainColor + '"><div class="rp-header-inner"><span class="rp-title">' + esc(e.title).slice(0, 80) + '</span><span class="rp-domain-tag" style="color:' + domainColor + '">' + (domainCfg?.domain || '') + '</span></div><span class="rp-close" onclick="S._closeInspector()">\u2715</span></div>'
      h += '<div class="rp-badges"><span class="badge" style="background:' + t.col + '22;color:' + t.col + '">' + t.level + ' ' + t.score + '</span><span class="chip-conf ' + cc + '">' + e.confidence + '% ' + confLabel(e.confidence) + '</span><span class="chip-fresh ' + fr.cls + '">' + fr.label + '</span>'
      if (isInf) h += '<span class="badge inferred">INFERRED LOC</span>'
      h += '<span class="badge prov">' + esc(e.provenance) + '</span>'
      if (e.severity !== 'info') h += '<span class="badge sev-' + e.severity + '">' + e.severity.toUpperCase() + '</span>'
      if (e.correlations?.length > 0) h += '<span class="badge" style="color:var(--purple);background:rgba(153,102,255,0.1)">' + e.correlations.length + ' CORR</span>'
      h += '</div>'
      h += '<div class="rp-summary">' + esc(e.source) + ' \u00B7 ' + esc(e.region || 'Global')
      if (e.lat != null) h += ' \u00B7 ' + e.lat.toFixed(2) + ',' + e.lon.toFixed(2)
      if (e.metadata?._correlated_sources?.length > 0) h += '<div style="margin-top:3px;font-size:7px;color:var(--purple)">CORRELATED: ' + e.metadata._correlated_sources.map(esc).join(', ') + '</div>'
      h += '</div>'
      if (e.lat != null && e.lon != null) {
        h += '<div class="rp-actions"><a class="rp-action-btn" href="https://www.google.com/maps?q=' + e.lat + ',' + e.lon + '" target="_blank">\uD83C\uDF0D MAP</a>'
        if (e.source_url) h += '<a class="rp-action-btn" href="' + esc(e.source_url) + '" target="_blank">\uD83D\uDD17 SRC</a>'
        h += '<span class="rp-action-btn" onclick="navigator.clipboard.writeText(\'' + e.lat.toFixed(4) + ', ' + e.lon.toFixed(4) + '\');this.textContent=\'COPIED\'">\uD83D\uDCCB COORDS</span>'
        h += '<span class="rp-action-btn" onclick="S._metarAt(' + e.lat + ',' + e.lon + ')">\u2601 METAR</span>'
        h += '<span class="rp-action-btn" onclick="S._intelAt(' + e.lat + ',' + e.lon + ')">\uD83C\uDF10 INTEL</span>'
        h += '</div>'
      }
      h += '<div class="rp-expand-btn" onclick="S._toggleExpand()">' + (state.inspectorExpanded ? 'COLLAPSE \u25B2' : 'DETAILS \u25BC') + '</div>'
      h += '<div class="rp-details' + (state.inspectorExpanded ? ' open' : '') + '">'
      if (e.description) h += '<div class="rp-field"><span class="rp-key">DESC</span><span class="rp-val">' + esc(e.description).slice(0, 300) + '</span></div>'
      h += '<div class="rp-field"><span class="rp-key">TIME</span><span class="rp-val">' + esc(e.timestamp) + '</span></div>'
      if (e.tags?.length > 0) h += '<div class="rp-field"><span class="rp-key">TAGS</span><span class="rp-val">' + e.tags.map(esc).join(', ') + '</span></div>'

      // Domain-specific cards
      if (e.entity_type === 'sigmet') h += buildDomainCard('air', 'SIGMET HAZARD', [['HAZARD', e.metadata?.hazard], ['FIR', e.metadata?.fir], ['VALID', e.metadata?.valid_from + ' to ' + e.metadata?.valid_to], ['LEVELS', e.metadata?.flight_levels ? 'FL' + (e.metadata.flight_levels.lower || '?') + '-FL' + (e.metadata.flight_levels.upper || '?') : null]])
      if (e.entity_type === 'natural_event') h += buildDomainCard('seismic', 'NATURAL EVENT', [['CATEGORY', e.metadata?.categories?.join(', ')], ['MAGNITUDE', e.metadata?.magnitude_value != null ? e.metadata.magnitude_value + ' ' + (e.metadata?.magnitude_unit || '') : null], ['SOURCE', e.metadata?.source_links?.[0]?.id], ['OBSERVATIONS', e.metadata?.geometry_count]])
      if (e.entity_type === 'cyber_host') h += buildDomainCard('cyber', 'EXPOSED HOST', [['IP:PORT', (e.metadata?.ip || '') + ':' + (e.metadata?.port || '')], ['ORG', e.metadata?.org], ['PRODUCT', e.metadata?.product + ' ' + (e.metadata?.version || '')], ['VULNS', (e.metadata?.vulns || []).slice(0, 5).join(', ')], ['COUNTRY', e.metadata?.country]])
      if (e.entity_type?.startsWith('cyber_') && e.entity_type !== 'cyber_host') h += buildDomainCard('cyber', 'CYBER INTEL', [['CVE', e.metadata?.cve_id], ['MALWARE', e.metadata?.malware], ['IOC', e.metadata?.ioc_value, true], ['APT', e.metadata?.adversary]])
      if (e.entity_type?.startsWith('gnss_')) h += buildDomainCard('gnss', 'GNSS ANOMALY', [['TYPE', e.metadata?.type], ['RADIUS', e.metadata?.radius_km ? e.metadata.radius_km + ' km' : null], ['SYSTEMS', e.metadata?.affected_systems]])
      if (e.entity_type === 'conjunction') h += buildDomainCard('conjunction', 'CONJUNCTION DATA', [['SAT 1', e.metadata?.sat1_name], ['SAT 2', e.metadata?.sat2_name], ['TCA', e.metadata?.tca], ['MISS', e.metadata?.miss_distance_km ? e.metadata.miss_distance_km.toFixed(3) + ' km' : null], ['PROB', e.metadata?.collision_probability ? e.metadata.collision_probability.toExponential(2) : null]])
      if (e.entity_type === 'aircraft' || e.entity_type === 'military_air') h += buildDomainCard('air', 'FLIGHT DATA', [['CALLSIGN', e.metadata?.callsign], ['ICAO24', e.metadata?.icao24], ['ORIGIN', e.metadata?.origin_country], ['SQUAWK', e.metadata?.squawk ? e.metadata.squawk + (SQUAWK_DB[e.metadata.squawk] ? ' (' + SQUAWK_DB[e.metadata.squawk].label + ')' : '') : null]])
      if (e.entity_type === 'seismic') h += buildDomainCard('seismic', 'SEISMIC DATA', [['MAG', e.metadata?.magnitude], ['DEPTH', e.metadata?.depth_km ? e.metadata.depth_km + ' km' : null], ['TSUNAMI', e.metadata?.tsunami ? 'WARNING' : 'None']])
      if (e.entity_type === 'weather') h += buildDomainCard('metar', 'WEATHER', [['TEMP', e.metadata?.temp_c != null ? e.metadata.temp_c + '\u00B0C' : null], ['WIND', e.metadata?.wind_speed ? e.metadata.wind_speed + ' m/s' : null], ['PRESSURE', e.metadata?.pressure ? e.metadata.pressure + ' hPa' : null]])
      if (e.entity_type === 'satellite') h += buildDomainCard('conjunction', 'ORBITAL', [['NORAD', e.metadata?.norad_id], ['COUNTRY', e.metadata?.country], ['PERIOD', e.metadata?.period_min ? e.metadata.period_min.toFixed(1) + ' min' : null]])
      if (e.entity_type === 'social_post') h += buildDomainCard('social', 'SOCIAL INTEL', [['SUB', e.metadata?.subreddit ? 'r/' + e.metadata.subreddit : e.metadata?.instance], ['SCORE', e.metadata?.score || e.metadata?.favourites || 0], ['GEO', e.metadata?.matched_location]])
      if (e.entity_type === 'fishing_vessel' || e.entity_type === 'dark_vessel') h += buildDomainCard('maritime', 'VESSEL', [['MMSI', e.metadata?.mmsi], ['FLAG', e.metadata?.flag], ['GEAR', e.metadata?.gear_type], ['GAP', e.metadata?.gap_hours ? e.metadata.gap_hours + 'h' : null]])

      // Raw metadata
      if (e.metadata && Object.keys(e.metadata).length > 0) {
        h += '<div class="rp-meta-toggle" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display===\'none\'?\'block\':\'none\'">RAW METADATA \u25BC</div>'
        h += '<div class="rp-meta" style="display:none">'
        Object.entries(e.metadata).forEach(function (pair) { if (pair[1] != null && pair[1] !== '' && pair[0] !== '_correlated_sources') h += '<div class="rp-field"><span class="rp-key">' + esc(pair[0]) + '</span><span class="rp-val mono">' + esc(typeof pair[1] === 'object' ? JSON.stringify(pair[1]) : String(pair[1])).slice(0, 200) + '</span></div>' })
        h += '</div>'
      }
      h += '</div></div>' // close details + rp
    }

    // STATS RING
    h += '<div class="stats-ring">'
    ;[['AIR', (state.counts.aircraft || 0) + (state.counts.military || 0) + (state.counts.sigmets || 0), '#00ccff'],
      ['SEA', (state.counts.fishing || 0) + (state.counts.darkships || 0) + (state.counts.ships || 0), '#00ff88'],
      ['ORB', (state.counts.satellites || 0) + (state.counts.debris || 0) + (state.counts.conjunctions || 0), '#ffcc00'],
      ['WX', (state.counts.seismic || 0) + (state.counts.wildfires || 0) + (state.counts.weather || 0) + (state.counts.eonet || 0), '#4477ff'],
      ['INT', (state.counts.conflict || 0) + (state.counts.disasters || 0) + (state.counts.nuclear || 0), '#ff2200'],
      ['CYB', state.counts.cyber || 0, '#66ffcc'],
      ['GPS', state.counts.gnss || 0, '#ff6633'],
      ['SOC', state.counts.social || 0, '#ff44aa']
    ].forEach(function (item) { h += '<div class="stat"><span class="stat-lbl" style="color:' + item[2] + '88">' + item[0] + '</span><span class="stat-val" style="color:' + item[2] + '">' + item[1] + '</span></div>' })
    h += '<div class="stat total"><span class="stat-val">' + total.toLocaleString() + '</span></div></div>'

    // MOBILE BAR (Task 14)
    h += '<div class="mob-bar">'
    ;[['layers', '\u2630 LAYERS'], ['threat', '\u26A0 THREAT'], ['sources', '\u2139 HEALTH']].forEach(function (pair) { h += '<div class="mob-tab' + (state.panel === pair[0] ? ' active' : '') + '" onclick="S._mobPanel(\'' + pair[0] + '\')">' + pair[1] + '</div>' })
    if (state.selected) h += '<div class="mob-tab mob-tab-inspect active" onclick="S._mobInspect()">\uD83D\uDD0D INSPECT</div>'
    h += '</div>'

    document.getElementById('hud').innerHTML = h
    var loadEl = document.getElementById('loading'); if (loadEl) loadEl.style.display = 'none'
  }

  function buildDomainCard(cardType, title, fields) {
    var h = '<div class="rp-card ' + cardType + '-card"><div class="card-header">' + title + '</div>'
    fields.forEach(function (f) { if (f[1] != null && f[1] !== '') h += '<div class="rp-field"><span class="rp-key">' + esc(f[0]) + '</span><span class="rp-val' + (f[2] ? ' mono' : '') + '">' + esc(String(f[1])) + '</span></div>' })
    return h + '</div>'
  }

  // ═══════════════════════════════════════════════════════════════
  // SOURCE METRICS + CIRCUIT + CACHE FETCH (Tasks 6, 8)
  // ═══════════════════════════════════════════════════════════════
  async function fetchSourceMetrics() {
    try {
      var results = await Promise.allSettled([getApi('/api/metrics/health'), getApi('/api/circuits'), getApi('/api/cache/status')])
      if (results[0].status === 'fulfilled' && !isErr(results[0].value)) {
        var data = results[0].value; state.sourceMetrics = data.sources || {}
        Object.entries(data.sources || {}).forEach(function (entry) { if (entry[1]?.last_success) state.sourceFreshness[entry[0]] = entry[1].last_success })
      }
      if (results[1].status === 'fulfilled' && !isErr(results[1].value)) state.circuitStatus = results[1].value.circuits || {}
      if (results[2].status === 'fulfilled' && !isErr(results[2].value)) state.cacheStatus = results[2].value.entries || {}
    } catch (e) { /* optional */ }
  }

  // ═══════════════════════════════════════════════════════════════
  // DATA FETCH — phased with v8.5 new endpoints (Tasks 1-4)
  // ═══════════════════════════════════════════════════════════════
  async function fetchAll() {
    if (state.fetching) return; state.fetching = true; state.cycle++; state.lastFetchTime = Date.now(); state.nextRefreshAt = Date.now() + 60000
    log('Fetch cycle ' + state.cycle + ' starting', 'info')

    // Phase 1: Fast free sources
    try {
      var p1 = await Promise.allSettled([proxy('opensky'), fetch(DIRECT.USGS).then(function (r) { return r.json() }), fetch(DIRECT.ISS).then(function (r) { return r.json() })])
      if (p1[0].status === 'fulfilled' && !isErr(p1[0].value)) { var parsed = parseOpenSky(p1[0].value); replaceEntities(parsed.filter(function (e) { return e.entity_type === 'aircraft' }), 'ac_'); replaceEntities(parsed.filter(function (e) { return e.entity_type === 'military_air' }), 'mil_'); state.sourceHealth.aircraft = 'live'; state.sourceHealth.military = 'live'; log('Aircraft: ' + parsed.length, 'info') } else { state.sourceHealth.aircraft = 'error'; state.sourceHealth.military = 'error' }
      if (p1[1].status === 'fulfilled') { replaceEntities(parseUSGS(p1[1].value), 'eq_'); state.sourceHealth.seismic = 'live' } else { state.sourceHealth.seismic = 'error' }
      if (p1[2].status === 'fulfilled') { replaceEntities(parseISS(p1[2].value), 'iss_'); state.sourceHealth.iss = 'live' } else { state.sourceHealth.iss = 'error' }
    } catch (e) { log('Phase 1 error: ' + e, 'error') }

    // Phase 2: Keyed + NEW v8.4 endpoints (SIGMETs, EONET)
    try {
      var p2 = await Promise.allSettled([proxy('firms'), proxy('n2yo'), getApi('/api/weather/global'), getApi('/api/avwx/sigmets'), getApi('/api/eonet/events?days=30&limit=50')])
      if (p2[0].status === 'fulfilled' && typeof p2[0].value === 'string') { replaceEntities(parseFIRMS(p2[0].value), 'fire_'); state.sourceHealth.wildfires = 'live' } else { state.sourceHealth.wildfires = 'error' }
      if (p2[1].status === 'fulfilled' && !isErr(p2[1].value)) { replaceEntities(parseN2YO(p2[1].value), 'sat_'); state.sourceHealth.satellites = 'live' } else { state.sourceHealth.satellites = 'error' }
      if (p2[2].status === 'fulfilled' && !isErr(p2[2].value)) { replaceEntities(parseOWM(p2[2].value), 'wx_'); state.sourceHealth.weather = 'live' } else { state.sourceHealth.weather = 'error' }
      // SIGMETs (Task 1, 2)
      if (p2[3].status === 'fulfilled' && !isErr(p2[3].value)) {
        var sigEvents = passthrough(p2[3].value); replaceEntities(sigEvents, 'sigmet_')
        state.sourceHealth.sigmets = 'live'; state.sourceFreshness.sigmets = new Date().toISOString()
        renderSigmetPolygons(sigEvents); log('SIGMETs: ' + sigEvents.length, 'info')
      } else { state.sourceHealth.sigmets = 'error' }
      // EONET (Task 1, 3)
      if (p2[4].status === 'fulfilled' && !isErr(p2[4].value)) {
        var eoEvents = passthrough(p2[4].value); replaceEntities(eoEvents, 'eonet_')
        state.sourceHealth.eonet = 'live'; state.sourceFreshness.eonet = new Date().toISOString()
        log('EONET: ' + eoEvents.length + ' events', 'info')
      } else { state.sourceHealth.eonet = 'error' }
    } catch (e) { log('Phase 2 error: ' + e, 'error') }

    // Phase 3: Slower feeds
    setTimeout(async function () {
      try {
        var p3 = await Promise.allSettled([proxy('gdacs'), proxy('gfw_fishing', datePair()), proxy('gfw_gap', datePair()), getApi('/api/reliefweb/disasters')])
        if (p3[0].status === 'fulfilled' && !isErr(p3[0].value)) { replaceEntities(parseGDACS(p3[0].value), 'gdacs_'); state.sourceHealth.disasters = 'live' } else { state.sourceHealth.disasters = 'error' }
        if (p3[3].status === 'fulfilled' && !isErr(p3[3].value)) { replaceEntities(parseReliefWeb(p3[3].value), 'rw_') }
        if (p3[1].status === 'fulfilled' && !isErr(p3[1].value)) { replaceEntities(parseGFW(p3[1].value, 'fish'), 'fish_'); state.sourceHealth.fishing = 'live' } else { state.sourceHealth.fishing = 'error' }
        if (p3[2].status === 'fulfilled' && !isErr(p3[2].value)) { replaceEntities(parseGFW(p3[2].value, 'dark'), 'gap_'); state.sourceHealth.darkships = 'live' } else { state.sourceHealth.darkships = 'error' }
      } catch (e) { log('Phase 3 error: ' + e, 'error') }
    }, state.isMobile ? 1000 : 0)

    // Phase 4: Intel + Shodan geo (Task 4)
    setTimeout(async function () {
      try {
        var p4 = await Promise.allSettled([
          postApi('/api/intel/gdelt', { category: 'conflict' }),
          postApi('/api/intel/gdelt', { category: 'cyber' }),
          postApi('/api/intel/gdelt', { category: 'nuclear' }),
          postApi('/api/shodan/search', { query: 'port:502 scada' }),
        ])
        if (p4[0].status === 'fulfilled') { replaceEntities(passthrough(p4[0].value), 'gdelt_conflict_'); state.sourceHealth.conflict = 'live' } else { state.sourceHealth.conflict = 'error' }
        if (p4[1].status === 'fulfilled') { replaceEntities(passthrough(p4[1].value), 'gdelt_cyber_') }
        if (p4[2].status === 'fulfilled') { replaceEntities(passthrough(p4[2].value), 'gdelt_nuclear_'); state.sourceHealth.nuclear = 'live' } else { state.sourceHealth.nuclear = 'error' }
        // Shodan (Task 4)
        if (p4[3].status === 'fulfilled' && !isErr(p4[3].value)) { replaceEntities(parseShodan(p4[3].value), 'shodan_') }
      } catch (e) { log('Phase 4 error: ' + e, 'error') }
    }, state.isMobile ? 1500 : 0)

    // Phase 5: Cyber + Space-Track (Task 22)
    setTimeout(async function () {
      try {
        var p5 = await Promise.allSettled([getApi('/api/cyber/cisa-kev'), getApi('/api/cyber/otx'), getApi('/api/cyber/urlhaus'), getApi('/api/cyber/threatfox'), getApi('/api/spacetrack/gp'), getApi('/api/spacetrack/cdm')])
        var cyberCount = 0
        if (p5[0].status === 'fulfilled' && p5[0].value?.events) { replaceEntities(p5[0].value.events.map(function (e) { return ce(e) }), 'kev_'); cyberCount += p5[0].value.count || 0 }
        if (p5[1].status === 'fulfilled' && p5[1].value?.events) { replaceEntities(p5[1].value.events.map(function (e) { return ce(e) }), 'otx_'); cyberCount += p5[1].value.count || 0 }
        if (p5[2].status === 'fulfilled' && p5[2].value?.events) { replaceEntities(p5[2].value.events.map(function (e) { return ce(e) }), 'urlhaus_'); cyberCount += p5[2].value.count || 0 }
        if (p5[3].status === 'fulfilled' && p5[3].value?.events) { replaceEntities(p5[3].value.events.map(function (e) { return ce(e) }), 'threatfox_'); cyberCount += p5[3].value.count || 0 }
        state.sourceHealth.cyber = cyberCount > 0 ? 'live' : 'error'
        log('Cyber: ' + cyberCount + ' indicators', 'info')
        // Space-Track GP (Task 22)
        if (p5[4].status === 'fulfilled' && p5[4].value?.events) { replaceEntities(p5[4].value.events.map(function (e) { return ce(e) }), 'stgp_'); log('Space-Track GP: ' + (p5[4].value.count || 0), 'info') }
        // CDM — conjunction visualization (Task 22)
        if (p5[5].status === 'fulfilled' && p5[5].value?.events) { replaceEntities(p5[5].value.events.map(function (e) { return ce(e) }), 'cdm_'); state.sourceHealth.conjunctions = p5[5].value.count > 0 ? 'live' : 'loading'; log('CDM: ' + (p5[5].value.count || 0) + ' conjunctions', 'info') }
      } catch (e) { log('Phase 5 error: ' + e, 'error') }
    }, state.isMobile ? 3000 : 2000)

    // Phase 6: GNSS + Social (Task 23, 24)
    setTimeout(async function () {
      try {
        var p6 = await Promise.allSettled([getApi('/api/gnss/anomalies'), getApi('/api/social/reddit'), getApi('/api/social/mastodon')])
        if (p6[0].status === 'fulfilled' && p6[0].value?.events) {
          var gnssEvents = p6[0].value.events.map(function (e) { return ce(e) })
          replaceEntities(gnssEvents, 'gnss_'); state.sourceHealth.gnss = 'live'
          renderGNSSCircles(gnssEvents.filter(function (e) { return e.entity_type === 'gnss_jamming' || e.entity_type === 'gnss_spoofing' }))
          log('GNSS: ' + (p6[0].value.zones || 0) + ' zones', 'info')
        } else { state.sourceHealth.gnss = 'error' }
        var socialTotal = 0
        if (p6[1].status === 'fulfilled' && p6[1].value?.events) { replaceEntities(p6[1].value.events.map(function (e) { return ce(e) }), 'reddit_'); socialTotal += p6[1].value.total || 0 }
        if (p6[2].status === 'fulfilled' && p6[2].value?.events) { replaceEntities(p6[2].value.events.map(function (e) { return ce(e) }), 'masto_'); socialTotal += p6[2].value.total || 0 }
        state.sourceHealth.social = socialTotal > 0 ? 'live' : 'error'
        log('Social: ' + socialTotal + ' posts', 'info')
      } catch (e) { log('Phase 6 error: ' + e, 'error') }
    }, state.isMobile ? 5000 : 4000)

    state.connectionOk = true; state.fetching = false; refreshMap()
    log('Cycle ' + state.cycle + ' complete \u2014 ' + state.entities.length + ' entities', 'info')
  }

  // CelesTrak TLE
  var TLE_URLS = { stations: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle', debris_fengyun: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=1999-025&FORMAT=tle' }
  async function fetchCelesTrak() {
    if (!window.satellite) { log('satellite.js not loaded', 'info'); return }
    try {
      var results = await Promise.allSettled([fetch(TLE_URLS.stations).then(function (r) { return r.ok ? r.text() : '' }), fetch(TLE_URLS.debris_fengyun).then(function (r) { return r.ok ? r.text() : '' })])
      if (results[0].status === 'fulfilled' && results[0].value) replaceEntities(parseCelesTrakTLE(results[0].value, 'satellite'), 'tle_')
      if (results[1].status === 'fulfilled' && results[1].value) { replaceEntities(parseCelesTrakTLE(results[1].value, 'debris'), 'deb_'); state.sourceHealth.debris = 'live' }
    } catch (e) { log('CelesTrak error: ' + e, 'error') }
  }

  // ═══════════════════════════════════════════════════════════════
  // KEYBOARD
  // ═══════════════════════════════════════════════════════════════
  function initKeyboard() {
    document.addEventListener('keydown', function (ev) {
      if (ev.target.tagName === 'INPUT') return
      var k = ev.key.toLowerCase()
      if (k === 'escape') { state.selected = null; state.searchOpen = false; state.searchQuery = ''; state.searchResults = []; state.intelOverlay = null; closeDrawer(); renderUI() }
      else if (k === '1') { state.panel = 'layers'; renderUI() }
      else if (k === '2') { state.panel = 'threat'; renderUI() }
      else if (k === '3') { state.panel = 'sources'; renderUI() }
      else if (k === 'z') toggleZones()
      else if (k === 's') { state.showSatPanel = !state.showSatPanel; renderUI() }
      else if (k === 't') { state.scrubberEnabled = !state.scrubberEnabled; if (!state.scrubberEnabled) { state.replayMode = 'live'; stopReplay() }; refreshMap() }
      else if (k === 'r') fetchAll()
      else if (k === '/' || k === 'f') { ev.preventDefault(); var inp = document.querySelector('.search-input'); if (inp) inp.focus() }
    })
  }

  // ═══════════════════════════════════════════════════════════════
  // GLOBAL HANDLERS
  // ═══════════════════════════════════════════════════════════════
  window.S = {
    _toggle: toggleLayer, _toggleZones: toggleZones,
    _setPanel: function (p) { state.panel = p; renderUI() },
    _setDomain: function (d) { state.activeDomain = d; renderUI() },
    _flyTo: function (id) { var e = state.entities.find(function (x) { return x.id === id }); if (e) flyTo(e) },
    _closeInspector: function () { state.selected = null; state.inspectorExpanded = false; renderUI() },
    _toggleExpand: function () { state.inspectorExpanded = !state.inspectorExpanded; renderUI() },
    _search: function (q) { doSearch(q); renderUI() },
    _searchFocus: function () { state.searchOpen = true; renderUI() },
    _searchBlur: function () { state.searchOpen = false; renderUI() },
    _searchSelect: function (i) { if (state.searchResults[i]) { flyTo(state.searchResults[i]); state.searchOpen = false; state.searchQuery = ''; state.searchResults = []; renderUI() } },
    _toggleSat: function () { state.showSatPanel = !state.showSatPanel; renderUI() },
    _applySat: function (key) { applySatelliteLayer(key) },
    _satDateChange: function (v) { changeSatDate(v); renderUI() },
    _toggleScrub: function () { state.scrubberEnabled = !state.scrubberEnabled; if (!state.scrubberEnabled) { state.replayMode = 'live'; stopReplay() }; refreshMap() },
    _setReplayMode: setReplayMode,
    _replayToggle: function () { state.replayPlaying ? stopReplay() : startReplay() },
    _replaySpeed: cycleReplaySpeed,
    _toggleDrawer: function () { state.drawerOpen ? closeDrawer() : openDrawer('left') },
    _closeDrawer: closeDrawer,
    _mobPanel: function (p) { state.panel = p; state.drawerOpen = true; state.drawerSide = 'left'; renderUI() },
    _mobInspect: function () { if (state.selected) { state.drawerOpen = false; renderUI() } },
    _closeIntel: function () { state.intelOverlay = null; renderUI() },
    _metarAt: function (lat, lon) {
      getApi('/api/avwx/near?lat=' + lat.toFixed(4) + '&lon=' + lon.toFixed(4) + '&limit=3').then(function (d) {
        if (!isErr(d) && d.metars && d.metars.length > 0 && state.map) {
          var m = d.metars[0], st = d.stations?.[0] || {}
          var html = '<div style="font-family:JetBrains Mono,monospace;font-size:10px;max-width:280px"><b>' + esc(st.icao || '???') + '</b> ' + esc(st.name || '') + '<br>' + esc(m.raw || 'No METAR') + '</div>'
          L.popup({ className: 'metar-popup' }).setLatLng([lat, lon]).setContent(html).openOn(state.map)
        }
      }).catch(function () {})
    },
    _intelAt: function (lat, lon) {
      state.intelOverlay = { lat: lat, lon: lon, data: null }; state.intelLoading = true; renderUI()
      getApi('/api/intel/overview?lat=' + lat.toFixed(4) + '&lon=' + lon.toFixed(4) + '&radius=250&domains=weather,aviation,natural,cyber').then(function (d) { if (!isErr(d)) state.intelOverlay = { lat: lat, lon: lon, data: d }; state.intelLoading = false; renderUI() }).catch(function () { state.intelLoading = false; renderUI() })
    },
    _state: state,
  }

  // ═══════════════════════════════════════════════════════════════
  // BOOT
  // ═══════════════════════════════════════════════════════════════
  function boot() {
    console.log('%c SENTINEL OS v8.5 ', 'background:#00ff88;color:#020a12;font-weight:bold;font-size:14px;padding:4px 8px;border-radius:3px')
    console.log('25+ live OSINT layers | SIGMET + EONET + Shodan Geo + Intel Overview + CDM')
    updateViewportState(); initMap(); initKeyboard(); renderUI()
    log('SENTINEL OS v8.5 initialized', 'info')
    fetchAll()
    setTimeout(fetchCelesTrak, 3000)
    setInterval(fetchAll, 60000)
    setInterval(fetchCelesTrak, 180000)
    setInterval(function () { fetch(DIRECT.ISS).then(function (r) { return r.json() }).then(function (d) { if (d?.latitude != null) replaceEntities(parseISS(d), 'iss_') }).catch(function () {}) }, 5000)
    setInterval(function () { if (state.lastFetchTime > 0 && (Date.now() - state.lastFetchTime) > 120000) state.connectionOk = false; renderUI() }, 3000)
    fetchSourceMetrics(); setInterval(fetchSourceMetrics, 30000)
  }

  boot()
})()
