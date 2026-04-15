/**
 * SENTINEL-X v9.0 — Multi-Domain Situational Awareness & Decision-Support Platform
 *
 * Complete command center UI with:
 *   - Multi-panel layout: top bar, left nav, central map, right detail panel, bottom telemetry
 *   - View system: Global Watch, Alerts, Cases, Intel Graph, Analytics, Admin
 *   - Auth: login, JWT session, RBAC-aware UI
 *   - Alert platform: priority cards, acknowledge, assign, comment, suppress
 *   - Case management: create, attach entities, notes, timeline, status workflow
 *   - Knowledge graph: visual node-edge explorer
 *   - Analytics: trend charts, threat timeline, domain distribution
 *   - Map: heatmaps, heading arrows, trails, range rings, AOI polygons, geofences
 *   - All v8.5 data sources preserved
 */
;(function () {
  'use strict'

  // ═══════════════════════════════════════════════════════════════
  // FETCH HELPERS
  // ═══════════════════════════════════════════════════════════════
  var authToken = localStorage.getItem('stx_token') || ''

  function authHeaders() {
    var h = { 'Content-Type': 'application/json' }
    if (authToken) h['Authorization'] = 'Bearer ' + authToken
    return h
  }

  async function api(path, opts) {
    try {
      var r = await fetch(path, { ...opts, headers: { ...authHeaders(), ...(opts?.headers || {}) } })
      var ct = r.headers.get('content-type') || ''
      if (ct.includes('text/plain') || ct.includes('text/csv')) return await r.text()
      return await r.json()
    } catch (e) { return { _upstream_error: true, message: String(e), events: [] } }
  }
  function proxy(target, params) { return api('/api/proxy', { method: 'POST', body: JSON.stringify({ target: target, params: params }) }) }
  function postApi(path, body) { return api(path, { method: 'POST', body: JSON.stringify(body) }) }
  function getApi(path) { return api(path) }
  function putApi(path, body) { return api(path, { method: 'PUT', body: JSON.stringify(body) }) }
  function isErr(v) { return v && typeof v === 'object' && v._upstream_error === true }

  // ═══════════════════════════════════════════════════════════════
  // CONSTANTS
  // ═══════════════════════════════════════════════════════════════
  var DIRECT = { USGS: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson', ISS: 'https://api.wheretheiss.at/v1/satellites/25544' }

  var LAYERS = {
    aircraft:     { label: 'AIRCRAFT',     icon: '\u2708',       color: '#00ccff', domain: 'AIR',      src: 'OpenSky ADS-B' },
    military:     { label: 'MIL AIR',      icon: '\u2708',       color: '#ff3355', domain: 'AIR',      src: 'ADS-B Exchange + OpenSky' },
    sigmets:      { label: 'SIGMETS',      icon: '\u26A0',       color: '#ff9900', domain: 'AIR',      src: 'AVWX SIGMET' },
    ships:        { label: 'MARITIME AIS', icon: '\u2693',       color: '#00ff88', domain: 'SEA',      src: 'AISStream.io' },
    darkships:    { label: 'DARK FLEET',   icon: '\u2753',       color: '#9933ff', domain: 'SEA',      src: 'GFW Gap Events' },
    fishing:      { label: 'FISHING',      icon: '\uD83D\uDC1F', color: '#33ffcc', domain: 'SEA',      src: 'GFW Events' },
    iss:          { label: 'ISS',          icon: '\uD83D\uDE80', color: '#ff6600', domain: 'SPACE',    src: 'wheretheiss.at + SGP4' },
    satellites:   { label: 'SATELLITES',   icon: '\u2605',       color: '#ffcc00', domain: 'SPACE',    src: 'N2YO + CelesTrak + Space-Track' },
    conjunctions: { label: 'CDM',          icon: '\u26A1',       color: '#ff00ff', domain: 'SPACE',    src: 'Space-Track CDM' },
    seismic:      { label: 'SEISMIC',      icon: '!',            color: '#ffee00', domain: 'GEO',      src: 'USGS Earthquake API' },
    wildfires:    { label: 'WILDFIRES',    icon: '\uD83D\uDD25', color: '#ff5500', domain: 'GEO',      src: 'NASA FIRMS' },
    weather:      { label: 'WEATHER',      icon: '\uD83C\uDF00', color: '#4477ff', domain: 'GEO',      src: 'OpenWeatherMap' },
    eonet:        { label: 'NATURAL',      icon: '\uD83C\uDF0B', color: '#ff7733', domain: 'GEO',      src: 'NASA EONET v3' },
    conflict:     { label: 'CONFLICT',     icon: '\u2694',       color: '#ff2200', domain: 'INTEL',    src: 'GDELT + ACLED' },
    disasters:    { label: 'DISASTERS',    icon: '\u26A0',       color: '#ff8c00', domain: 'INTEL',    src: 'GDACS + ReliefWeb' },
    nuclear:      { label: 'NUCLEAR',      icon: '\u2622',       color: '#ff00ff', domain: 'INTEL',    src: 'GDELT Nuclear' },
    cyber:        { label: 'CYBER',        icon: '\uD83D\uDD12', color: '#66ffcc', domain: 'CYBER',    src: 'CISA + OTX + URLhaus + Shodan' },
    gnss:         { label: 'GNSS',         icon: '\uD83D\uDCE1', color: '#ff6633', domain: 'SIGINT',   src: 'Curated + GDELT' },
    social:       { label: 'SOCIAL',       icon: '\uD83D\uDCF1', color: '#ff44aa', domain: 'SOCIAL',   src: 'Reddit + Mastodon' },
  }

  var VIEWS = {
    watch:     { label: 'GLOBAL WATCH', icon: '\uD83C\uDF0D', desc: 'Primary situational awareness' },
    alerts:    { label: 'ALERTS',       icon: '\u26A0',       desc: 'Alert management & triage' },
    cases:     { label: 'CASES',        icon: '\uD83D\uDCC1', desc: 'Investigation management' },
    graph:     { label: 'INTEL GRAPH',  icon: '\uD83D\uDD17', desc: 'Knowledge graph explorer' },
    analytics: { label: 'ANALYTICS',    icon: '\uD83D\uDCCA', desc: 'Dashboards & trends' },
    admin:     { label: 'ADMIN',        icon: '\u2699',       desc: 'System administration' },
  }

  var DOMAIN_LIST = ['ALL', 'AIR', 'SEA', 'SPACE', 'GEO', 'INTEL', 'CYBER', 'SIGINT', 'SOCIAL']
  var DOMAIN_COLORS = { AIR: '#00ccff', SEA: '#00ff88', SPACE: '#ffcc00', GEO: '#4477ff', INTEL: '#ff2200', CYBER: '#66ffcc', SIGINT: '#ff6633', SOCIAL: '#ff44aa' }

  var THREAT_ZONES = [
    { name:'Ukraine/Russia',lat:48.5,lon:37.0,r:400,base:55,type:'conflict' },
    { name:'Gaza',lat:31.4,lon:34.5,r:120,base:70,type:'conflict' },
    { name:'Iran',lat:32.4,lon:53.7,r:500,base:65,type:'flashpoint' },
    { name:'Red Sea/Houthi',lat:14.5,lon:43.5,r:350,base:60,type:'chokepoint' },
    { name:'Hormuz',lat:26.5,lon:56.3,r:180,base:50,type:'chokepoint' },
    { name:'Taiwan Strait',lat:24.5,lon:120.0,r:250,base:55,type:'flashpoint' },
    { name:'South China Sea',lat:13.5,lon:115.0,r:500,base:45,type:'flashpoint' },
    { name:'Korean DMZ',lat:38.0,lon:127.5,r:200,base:50,type:'flashpoint' },
    { name:'Sudan',lat:15.5,lon:32.5,r:350,base:50,type:'conflict' },
    { name:'Sahel',lat:14.0,lon:2.0,r:600,base:40,type:'conflict' },
    { name:'Black Sea',lat:43.5,lon:34.5,r:400,base:45,type:'flashpoint' },
  ]

  var SQUAWK_DB = { '7500':{ label:'HIJACK',sev:'critical' },'7600':{ label:'COMMS FAIL',sev:'high' },'7700':{ label:'EMERGENCY',sev:'critical' },'7777':{ label:'MIL INTERCEPT',sev:'high' } }
  var MIL_RE = /^(RCH|USAF|REACH|DUKE|NATO|JAKE|VIPER|GHOST|BRONC|BLADE|EVAC|KNIFE|EAGLE|COBRA|REAPER|FURY|IRON|WOLF|HAWK|RAPTOR|TITAN|NAVY)/i

  // ═══════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════
  var state = {
    // Auth
    user: null, loggedIn: false, loginError: '',
    // View system
    currentView: 'watch', navCollapsed: false,
    // Map
    map: null, layerGroups: {}, zoneCircles: [], zoneLabels: [], gnssCircles: [], sigmetPolygons: null, heatLayer: null,
    entities: [], counts: {}, dedupeIndex: {},
    layerState: {}, sourceHealth: {}, sourceMetrics: {}, sourceFreshness: {},
    circuitStatus: {}, cacheStatus: {},
    selected: null, activeDomain: 'ALL', showZones: true,
    searchQuery: '', searchResults: [], searchOpen: false,
    // Right panel
    rightTab: 'inspector', // inspector | alerts | details
    // Alerts
    alerts: [], alertFilter: { priority: '', status: '', domain: '' }, alertStats: {},
    // Cases
    cases: [], caseDetail: null,
    // Graph
    graphNodes: [], graphEdges: [], graphSelected: null,
    // Analytics
    analyticsData: null, trendsData: null,
    // Workspaces
    workspaces: [], activeWorkspace: null,
    // Geofences
    geofences: [], geofenceCircles: [],
    // Timeline
    timeline: [], cycle: 0, lastFetchTime: 0, connectionOk: true, nextRefreshAt: 0,
    // Satellite imagery
    showSatPanel: false, satDate: '', activeSatLayer: null, satTileLayer: null, satLabelLayer: null,
    // Replay
    scrubberEnabled: false, replayMode: 'live', replayPlaying: false, replaySpeed: 1, replayInterval: null, replayWindowHours: 24, replayCursorMs: 0, replayWindowStartMs: 0,
    // Viewport
    viewportBounds: null, isMobile: window.innerWidth < 768, isTablet: window.innerWidth >= 768 && window.innerWidth < 1024,
    markerCap: window.innerWidth < 768 ? 150 : 400, renderThrottleMs: window.innerWidth < 768 ? 400 : 80,
    lastRenderTime: 0, renderPending: false, fetching: false,
  }

  Object.keys(LAYERS).forEach(function (k) { state.layerState[k] = true; state.sourceHealth[k] = 'loading'; state.counts[k] = 0 })
  ;['ships', 'conjunctions'].forEach(function (k) { state.layerState[k] = false })

  // ═══════════════════════════════════════════════════════════════
  // AUTH
  // ═══════════════════════════════════════════════════════════════
  async function checkAuth() {
    if (!authToken) return
    try {
      var data = await getApi('/api/auth/me')
      if (data && !data.error) { state.user = data; state.loggedIn = true }
      else { authToken = ''; localStorage.removeItem('stx_token') }
    } catch { authToken = ''; localStorage.removeItem('stx_token') }
  }

  async function doLogin(username, password) {
    state.loginError = ''
    var data = await postApi('/api/auth/login', { username: username, password: password })
    if (data.token) {
      authToken = data.token; localStorage.setItem('stx_token', authToken)
      state.user = data.user; state.loggedIn = true; state.loginError = ''
    } else { state.loginError = data.error || 'Login failed' }
    render()
  }

  async function doRegister(username, password, email, displayName) {
    var data = await postApi('/api/auth/register', { username: username, password: password, email: email, display_name: displayName })
    if (data.token) {
      authToken = data.token; localStorage.setItem('stx_token', authToken)
      state.user = data.user; state.loggedIn = true
    } else { state.loginError = data.error || 'Registration failed' }
    render()
  }

  function doLogout() {
    authToken = ''; localStorage.removeItem('stx_token')
    state.user = null; state.loggedIn = false
    render()
  }

  // ═══════════════════════════════════════════════════════════════
  // DEDUP & SCORING (inherited from v8.5 — compact)
  // ═══════════════════════════════════════════════════════════════
  function fingerprint(e) { var p = [e.entity_type || '']; if (e.lat != null && e.lon != null) { var pr = e.confidence < 50 ? 1 : 10; p.push(Math.round(e.lat * pr) / pr); p.push(Math.round(e.lon * pr) / pr) }; p.push((e.title || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().slice(0, 50)); return p.join('|') }
  function deduplicateEntities(n) { var u = []; n.forEach(function (e) { var fp = fingerprint(e); if (state.dedupeIndex[fp]) { var eid = state.dedupeIndex[fp]; var ex = state.entities.find(function (x) { return x.id === eid }); if (ex) { if (e.confidence > ex.confidence) ex.confidence = e.confidence; var sr = { critical: 0, high: 1, medium: 2, low: 3, info: 4 }; if ((sr[e.severity] || 4) < (sr[ex.severity] || 4)) ex.severity = e.severity; if (e.timestamp > (ex.timestamp || '')) ex.timestamp = e.timestamp; ex.correlations = (ex.correlations || []).concat([e.id]).slice(0, 15) } } else { state.dedupeIndex[fp] = e.id; u.push(e) } }); return u }
  function clearDedupePrefix(p) { Object.keys(state.dedupeIndex).forEach(function (k) { if (state.dedupeIndex[k].startsWith(p)) delete state.dedupeIndex[k] }) }

  function haversine(a, b, c, d) { var R = 6371, x = (c - a) * Math.PI / 180, y = (d - b) * Math.PI / 180; var z = Math.sin(x / 2) ** 2 + Math.cos(a * Math.PI / 180) * Math.cos(c * Math.PI / 180) * Math.sin(y / 2) ** 2; return R * 2 * Math.atan2(Math.sqrt(z), Math.sqrt(1 - z)) }

  function scoreThreat(e) {
    var s = 0, reasons = []
    if (e.entity_type === 'aircraft' && e.metadata?.squawk && SQUAWK_DB[e.metadata.squawk]) { s += 70; reasons.push('SQUAWK ' + e.metadata.squawk) }
    if (e.entity_type === 'military_air') { s += 12; reasons.push('Military') }
    if (e.entity_type === 'dark_vessel') { s += 28; reasons.push('AIS gap') }
    if (e.entity_type === 'seismic') { var m = e.metadata?.magnitude || 0; if (m >= 7) { s += 75; reasons.push('M' + m) } else if (m >= 5) { s += 35; reasons.push('M' + m) } }
    if (e.entity_type === 'wildfire') { var f = e.metadata?.frp || 0; if (f >= 200) { s += 35; reasons.push('FRP ' + f) } }
    if (e.entity_type?.startsWith('conflict')) { s += 22; reasons.push('Conflict') }
    if (e.entity_type?.startsWith('nuclear')) { s += 35; reasons.push('Nuclear') }
    if (e.entity_type?.startsWith('cyber')) { s += 15; reasons.push('Cyber') }
    if (e.entity_type?.startsWith('gnss')) { s += 20; reasons.push('GNSS') }
    if (e.entity_type === 'sigmet') { s += 25; reasons.push('SIGMET') }
    if (e.entity_type === 'conjunction') { var cp = e.metadata?.collision_probability || 0; s += cp > 1e-3 ? 80 : cp > 1e-5 ? 45 : 15; reasons.push('CDM') }
    if (e.confidence < 40) s = Math.round(s * 0.7)
    if (e.lat != null && e.lon != null) { for (var i = 0; i < THREAT_ZONES.length; i++) { var z = THREAT_ZONES[i], d = haversine(e.lat, e.lon, z.lat, z.lon); if (d < z.r) { var bn = Math.round(z.base * (1 - d / z.r)); s += bn; if (bn >= 8) reasons.push(z.name); break } } }
    s = Math.min(100, Math.round(s))
    return { score: s, level: s >= 75 ? 'CRITICAL' : s >= 50 ? 'HIGH' : s >= 28 ? 'MEDIUM' : s >= 10 ? 'LOW' : 'MINIMAL', col: s >= 75 ? '#ff0033' : s >= 50 ? '#ff7700' : s >= 28 ? '#ffcc00' : s >= 10 ? '#44aaff' : '#2a4060', reasons: reasons }
  }

  function freshness(ts) { if (!ts) return { label: '?', cls: 'f-old' }; var a = Date.now() - new Date(ts).getTime(); if (a < 0) a = 0; if (a < 3600000) return { label: Math.max(1, Math.round(a / 60000)) + 'm', cls: 'f-live' }; if (a < 86400000) return { label: Math.round(a / 3600000) + 'h', cls: 'f-stale' }; return { label: Math.round(a / 86400000) + 'd', cls: 'f-old' } }

  // ═══════════════════════════════════════════════════════════════
  // PARSERS (from v8.5 — compact)
  // ═══════════════════════════════════════════════════════════════
  function ce(p) { return Object.assign({ id: '', entity_type: '', source: '', source_url: '', title: '', description: '', lat: null, lon: null, altitude: null, velocity: null, heading: null, timestamp: new Date().toISOString(), observed_at: new Date().toISOString(), confidence: 50, severity: 'info', risk_score: 0, region: '', tags: [], correlations: [], metadata: {}, raw_payload_hash: '', provenance: 'direct-api' }, p) }

  function parseOpenSky(d) { if (!d?.states) return []; return d.states.filter(function (s) { return s[6] != null && s[5] != null && s[8] === false }).slice(0, state.markerCap).map(function (s, i) { var cs = (s[1] || '').trim(), isMil = MIL_RE.test(cs); var sq = s[14] ? String(s[14]).padStart(4, '0') : null; var isEmg = sq && SQUAWK_DB[sq]; return ce({ id: (isMil ? 'mil_' : 'ac_') + i, entity_type: isMil ? 'military_air' : 'aircraft', source: 'OpenSky', title: cs || ('ICAO:' + s[0]), lat: s[6], lon: s[5], altitude: s[7] != null ? Math.round(s[7] * 3.28084) : null, velocity: s[9] != null ? Math.round(s[9] * 1.944) : null, heading: s[10] != null ? Math.round(s[10]) : null, confidence: 95, severity: isEmg ? SQUAWK_DB[sq].sev : isMil ? 'medium' : 'info', tags: [isMil ? 'military' : 'civilian', sq ? 'squawk-' + sq : ''].filter(Boolean), metadata: { icao24: s[0], callsign: cs, origin_country: s[2], squawk: sq, vert_rate: s[11] } }) }) }
  function parseUSGS(d) { if (!d?.features) return []; return d.features.filter(function (f) { return f.properties.mag >= 1.5 }).slice(0, 200).map(function (f, i) { var p = f.properties, c = f.geometry.coordinates, m = p.mag != null ? parseFloat(p.mag.toFixed(1)) : 0; return ce({ id: 'eq_' + i, entity_type: 'seismic', source: 'USGS', source_url: p.url || '', title: 'M' + m + ' — ' + (p.place || '').slice(0, 60), lat: c[1], lon: c[0], timestamp: p.time ? new Date(p.time).toISOString() : '', confidence: 95, severity: m >= 7 ? 'critical' : m >= 5 ? 'high' : m >= 3 ? 'medium' : 'low', tags: ['earthquake', m >= 5 ? 'significant' : ''].filter(Boolean), metadata: { magnitude: m, depth_km: c[2], place: p.place, tsunami: p.tsunami } }) }) }
  function parseISS(d) { if (!d || d.latitude == null) return []; return [ce({ id: 'iss_live', entity_type: 'iss', source: 'wheretheiss.at', title: 'ISS (ZARYA)', lat: d.latitude, lon: d.longitude, altitude: d.altitude ? Math.round(d.altitude) : 408, velocity: d.velocity ? Math.round(d.velocity) : 7660, confidence: 98, severity: 'info', tags: ['space-station'] })] }
  function parseFIRMS(csv) { if (!csv || typeof csv !== 'string') return []; var lines = csv.trim().split('\n'); if (lines.length < 2) return []; var hdr = lines[0].split(','), li = hdr.indexOf('latitude'), lo = hdr.indexOf('longitude'), fr = hdr.indexOf('frp'), cf = hdr.indexOf('confidence'); if (li < 0 || lo < 0) return []; return lines.slice(1, 150).map(function (row, i) { var c = row.split(','), lat = parseFloat(c[li]), lon = parseFloat(c[lo]); if (isNaN(lat) || isNaN(lon)) return null; var frp = parseFloat(c[fr] || '0'), conf = parseInt(c[cf]) || 50; if (conf < 30) return null; return ce({ id: 'fire_' + i, entity_type: 'wildfire', source: 'NASA FIRMS', title: 'VIIRS FRP ' + frp.toFixed(0), lat: lat, lon: lon, confidence: conf, severity: frp >= 200 ? 'high' : frp >= 50 ? 'medium' : 'low', tags: ['wildfire'], metadata: { frp: frp } }) }).filter(Boolean) }
  function parseOWM(d) { if (!d?.events) return []; return d.events.map(function (s, i) { return ce({ id: 'wx_' + i, entity_type: 'weather', source: 'OWM', title: (s.name || s._city || '') + ' — ' + (s.weather?.[0]?.description || '').toUpperCase(), lat: s.coord?.lat, lon: s.coord?.lon, confidence: 90, metadata: { temp_c: s.main?.temp, wind_speed: s.wind?.speed, pressure: s.main?.pressure, humidity: s.main?.humidity } }) }) }
  function parseN2YO(d) { if (!d?.above) return []; return d.above.slice(0, state.markerCap).map(function (s, i) { return ce({ id: 'sat_' + i, entity_type: 'satellite', source: 'N2YO', title: s.satname?.trim() || 'NORAD:' + s.satid, lat: s.satlat, lon: s.satlng, altitude: s.satalt ? Math.round(s.satalt) : null, confidence: 90, tags: ['satellite'], metadata: { norad_id: s.satid } }) }) }
  function parseGFW(d, type) { var entries = Array.isArray(d) ? d : (d?.entries || []); return entries.slice(0, 60).map(function (ev, i) { var pos = ev.position || {}, lat = pos.lat, lon = pos.lon; if (lat == null || lon == null) return null; var v = ev.vessel || {}, name = v.name || 'MMSI:' + (v.ssvid || i); return ce({ id: (type === 'dark' ? 'gap_' : 'fish_') + i, entity_type: type === 'dark' ? 'dark_vessel' : 'fishing_vessel', source: 'GFW', title: (type === 'dark' ? 'DARK — ' : '') + name, lat: lat, lon: lon, confidence: 80, severity: type === 'dark' ? 'medium' : 'low', tags: [type === 'dark' ? 'ais-gap' : 'fishing', v.flag || ''].filter(Boolean), metadata: { mmsi: v.ssvid, flag: v.flag, gear_type: v.gear_type || '' } }) }).filter(Boolean) }
  function parseGDACS(d) { return (d?.features || []).map(function (f, i) { var p = f.properties || {}, c = f.geometry?.coordinates || []; if (!c[1] || !c[0]) return null; var al = (p.alertlevel || '').toLowerCase(); return ce({ id: 'gdacs_' + i, entity_type: 'disaster', source: 'GDACS', title: (p.eventtype || '').toUpperCase() + ' — ' + (p.eventname || p.country || ''), lat: c[1], lon: c[0], confidence: 90, severity: al === 'red' ? 'critical' : al === 'orange' ? 'high' : 'medium', tags: ['disaster', p.eventtype || ''], metadata: { alert_level: p.alertlevel, country: p.country } }) }).filter(Boolean) }
  function passthrough(d) { return (d?.events || []).map(function (e) { return ce(e) }) }

  // ═══════════════════════════════════════════════════════════════
  // ENTITY MANAGEMENT
  // ═══════════════════════════════════════════════════════════════
  function typeToLayer(et) { var m = { aircraft:'aircraft', military_air:'military', iss:'iss', satellite:'satellites', seismic:'seismic', wildfire:'wildfires', weather:'weather', fishing_vessel:'fishing', dark_vessel:'darkships', ship:'ships', conflict_intel:'conflict', disaster:'disasters', nuclear_intel:'nuclear', cyber_vulnerability:'cyber', cyber_threat_intel:'cyber', cyber_malware_url:'cyber', cyber_ioc:'cyber', cyber_intel:'cyber', cyber_host:'cyber', gnss_jamming:'gnss', gnss_spoofing:'gnss', gnss_news:'gnss', social_post:'social', conjunction:'conjunctions', sigmet:'sigmets', natural_event:'eonet' }; return m[et] || 'conflict' }
  function replaceEntities(n, prefix) { clearDedupePrefix(prefix); for (var i = state.entities.length - 1; i >= 0; i--) { if (state.entities[i].id.startsWith(prefix)) state.entities.splice(i, 1) }; var dd = deduplicateEntities(n); state.entities.push.apply(state.entities, dd); refreshMap() }
  function refreshCounts() { Object.keys(LAYERS).forEach(function (k) { state.counts[k] = 0 }); state.entities.forEach(function (e) { var l = typeToLayer(e.entity_type); if (state.counts[l] !== undefined) state.counts[l]++ }) }

  // ═══════════════════════════════════════════════════════════════
  // MAP
  // ═══════════════════════════════════════════════════════════════
  function markerIcon(color, size, severity, heading) {
    var r = size / 2, glow = !state.isMobile && (severity === 'critical' || severity === 'high')
    var svg = '<svg width="' + size + '" height="' + size + '" xmlns="http://www.w3.org/2000/svg">'
    if (glow) svg += '<circle cx="' + r + '" cy="' + r + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="0.6" opacity="0.4"/>'
    svg += '<circle cx="' + r + '" cy="' + r + '" r="' + (r - 1) + '" fill="' + color + '" opacity="0.8"/>'
    // Heading indicator arrow
    if (heading != null && !isNaN(heading)) {
      var rad = (heading - 90) * Math.PI / 180, ax = r + Math.cos(rad) * (r - 1), ay = r + Math.sin(rad) * (r - 1)
      svg += '<line x1="' + r + '" y1="' + r + '" x2="' + ax.toFixed(1) + '" y2="' + ay.toFixed(1) + '" stroke="#fff" stroke-width="1.2" opacity="0.9"/>'
    }
    svg += '<circle cx="' + r + '" cy="' + r + '" r="' + (size * 0.16) + '" fill="#e0f0ff" opacity="0.9"/></svg>'
    return L.divIcon({ html: '<div class="sm' + (glow ? ' sm-glow' : '') + '">' + svg + '</div>', className: '', iconSize: [size, size], iconAnchor: [r, r] })
  }

  function isInViewport(lat, lon) { if (!state.viewportBounds) return true; var b = state.viewportBounds, p = 5; return lat >= b.south - p && lat <= b.north + p && lon >= b.west - p && lon <= b.east + p }

  function refreshMap() {
    if (!state.map) return
    var now = Date.now()
    if (now - state.lastRenderTime < state.renderThrottleMs) { if (!state.renderPending) { state.renderPending = true; setTimeout(function () { state.renderPending = false; refreshMap() }, state.renderThrottleMs) }; return }
    state.lastRenderTime = now
    if (state.map.getBounds) { var b = state.map.getBounds(); state.viewportBounds = { north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() } }
    refreshCounts()
    Object.values(state.layerGroups).forEach(function (g) { g.clearLayers() })
    var rendered = 0, cap = state.markerCap * 2
    var sorted = state.entities.slice().sort(function (a, b) { var o = { critical: 0, high: 1, medium: 2, low: 3, info: 4 }; return (o[a.severity] || 4) - (o[b.severity] || 4) })
    sorted.forEach(function (e) {
      if (e.lat == null || e.lon == null || rendered >= cap) return
      var lk = typeToLayer(e.entity_type), cfg = LAYERS[lk]
      if (!cfg || !state.layerGroups[lk]) return
      if (state.isMobile && !isInViewport(e.lat, e.lon)) return
      var sz = state.isMobile ? 8 : (e.severity === 'critical' ? 14 : e.severity === 'high' ? 11 : 9)
      var icon = markerIcon(cfg.color, sz, e.severity, e.heading)
      var m = L.marker([e.lat, e.lon], { icon: icon })
      m.on('click', function () { state.selected = e; state.rightTab = 'inspector'; render() })
      if (!state.isMobile) m.bindTooltip('<b>' + esc(e.title) + '</b><br><span style="opacity:.7">' + esc(e.source) + '</span>', { className: 'sentinel-tooltip', direction: 'top', offset: [0, -6] })
      state.layerGroups[lk].addLayer(m); rendered++
    })
    render()
  }

  function initMap() {
    if (!window.L || state.map) return
    state.map = L.map('map', { center: [25, 30], zoom: 3, zoomControl: false, attributionControl: false, minZoom: 2, maxZoom: 18, worldCopyJump: true, preferCanvas: true })
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18 }).addTo(state.map)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png', { subdomains: 'abcd', maxZoom: 18, opacity: 0.7 }).addTo(state.map)
    L.control.zoom({ position: 'bottomright' }).addTo(state.map)

    // Right-click: intel overview
    state.map.on('contextmenu', function (ev) {
      var lat = ev.latlng.lat, lon = ev.latlng.lng
      getApi('/api/intel/overview?lat=' + lat.toFixed(4) + '&lon=' + lon.toFixed(4) + '&radius=250').then(function (d) {
        if (!isErr(d)) { state.selected = { id: 'intel_overview', entity_type: 'intel_overview', title: 'Intel Overview: ' + lat.toFixed(2) + ', ' + lon.toFixed(2), source: 'Multi-domain', lat: lat, lon: lon, metadata: d, confidence: 100, severity: 'info', tags: ['overview'], provenance: 'direct-api', timestamp: new Date().toISOString() }; state.rightTab = 'inspector'; render() }
      })
    })

    // Double-click: nearest METAR
    state.map.on('dblclick', function (ev) {
      getApi('/api/avwx/near?lat=' + ev.latlng.lat.toFixed(4) + '&lon=' + ev.latlng.lng.toFixed(4) + '&limit=3').then(function (d) {
        if (!isErr(d) && d.metars?.length > 0) { var m = d.metars[0], st = d.stations?.[0] || {}; L.popup({ className: 'metar-popup' }).setLatLng(ev.latlng).setContent('<div style="font-family:JetBrains Mono;font-size:10px;max-width:280px"><b>' + esc(st.icao || '???') + '</b> ' + esc(st.name || '') + '<br>' + esc(m.raw || '') + '</div>').openOn(state.map) }
      })
    })

    // Threat zones
    var ztc = { conflict: '#ff2200', chokepoint: '#ff8800', flashpoint: '#ffcc00' }
    THREAT_ZONES.forEach(function (z) {
      var col = ztc[z.type] || '#ff4400'
      state.zoneCircles.push(L.circle([z.lat, z.lon], { radius: z.r * 1000, color: col, weight: 0.6, opacity: 0.3, fillColor: col, fillOpacity: 0.02, dashArray: '5 8', interactive: false }).addTo(state.map))
      state.zoneLabels.push(L.marker([z.lat, z.lon], { icon: L.divIcon({ html: '<div style="color:' + col + ';font-size:7px;font-family:JetBrains Mono;white-space:nowrap;opacity:0.5;letter-spacing:1.5px;text-transform:uppercase;pointer-events:none">' + z.name + '</div>', className: '', iconAnchor: [0, 0] }), interactive: false, zIndexOffset: -1000 }).addTo(state.map))
    })

    state.sigmetPolygons = L.layerGroup().addTo(state.map)

    // Layer groups
    var CLUSTERED = { aircraft: 1, satellites: 1, seismic: 1, eonet: 1 }
    Object.keys(LAYERS).forEach(function (k) {
      if (CLUSTERED[k] && L.MarkerClusterGroup) {
        state.layerGroups[k] = L.markerClusterGroup({ maxClusterRadius: state.isMobile ? 60 : 45, showCoverageOnHover: false, animate: !state.isMobile, iconCreateFunction: function (c) { var n = c.getChildCount(), col = LAYERS[k].color, sz = n > 100 ? 30 : n > 30 ? 24 : 20; return L.divIcon({ html: '<div style="width:' + sz + 'px;height:' + sz + 'px;border-radius:50%;background:' + col + '18;border:1px solid ' + col + '55;display:flex;align-items:center;justify-content:center;font-family:JetBrains Mono;color:' + col + ';font-size:9px;font-weight:600">' + n + '</div>', className: '', iconSize: [sz, sz] }) } })
      } else { state.layerGroups[k] = L.layerGroup() }
      if (state.layerState[k]) state.layerGroups[k].addTo(state.map)
    })
  }

  function toggleLayer(k) { state.layerState[k] = !state.layerState[k]; if (state.layerState[k]) { if (state.map && state.layerGroups[k]) state.layerGroups[k].addTo(state.map) } else { if (state.map && state.layerGroups[k]) state.map.removeLayer(state.layerGroups[k]) }; render() }
  function flyTo(e) { if (e?.lat != null && state.map) { state.map.flyTo([e.lat, e.lon], 8, { duration: 1 }); state.selected = e; state.rightTab = 'inspector'; render() } }

  // ═══════════════════════════════════════════════════════════════
  // RENDERING — Multi-panel command center
  // ═══════════════════════════════════════════════════════════════
  function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }
  function log(msg, sev) { state.timeline.unshift({ msg: msg, sev: sev || 'info', time: new Date().toISOString() }); if (state.timeline.length > 100) state.timeline.length = 100 }

  function render() {
    refreshCounts()
    var total = Object.values(state.counts).reduce(function (a, b) { return a + b }, 0)
    var now = new Date(), pad = function (v) { return String(v).padStart(2, '0') }
    var clock = pad(now.getUTCHours()) + ':' + pad(now.getUTCMinutes()) + ':' + pad(now.getUTCSeconds()) + 'Z'

    // Login screen if not logged in
    if (!state.loggedIn) { renderLogin(); return }

    // ── TOP BAR ──
    var critAlerts = state.alerts.filter(function (a) { return a.priority === 'P1_CRITICAL' && a.status !== 'RESOLVED' }).length
    var openAlerts = state.alerts.filter(function (a) { return a.status !== 'RESOLVED' && a.status !== 'SUPPRESSED' }).length
    var tb = '<div class="tb-left">'
    tb += '<div class="tb-logo" onclick="S._setView(\'watch\')">SENTINEL<span class="tb-x">X</span></div>'
    tb += '<div class="tb-sep"></div>'
    tb += '<div class="tb-view">' + (VIEWS[state.currentView]?.label || 'WATCH') + '</div>'
    tb += '</div><div class="tb-center">'
    tb += '<input class="tb-search" type="text" placeholder="Search callsign, MMSI, CVE, entity..." value="' + esc(state.searchQuery) + '" oninput="S._search(this.value)" onfocus="S._searchFocus()">'
    if (state.searchOpen && state.searchResults.length > 0) {
      tb += '<div class="search-drop">'; state.searchResults.forEach(function (r, i) { tb += '<div class="search-item" onclick="S._searchSelect(' + i + ')"><span class="si-type">' + esc(r.type) + '</span><span class="si-title">' + esc(r.title).slice(0, 60) + '</span><span class="si-sub">' + esc(r.subtitle) + '</span></div>' }); tb += '</div>'
    }
    tb += '</div><div class="tb-right">'
    if (critAlerts > 0) tb += '<div class="tb-alert-badge" onclick="S._setView(\'alerts\')">' + critAlerts + ' CRIT</div>'
    if (openAlerts > 0) tb += '<div class="tb-alert-count" onclick="S._setView(\'alerts\')">' + openAlerts + ' alerts</div>'
    tb += '<div class="tb-conn ' + (state.connectionOk ? 'ok' : 'err') + '"></div>'
    tb += '<div class="tb-clock">' + clock + '</div>'
    tb += '<div class="tb-user" onclick="S._toggleUserMenu()">' + esc(state.user?.display_name || 'User') + ' <span class="tb-role">' + esc(state.user?.role || '') + '</span></div>'
    tb += '</div>'
    var topBar = document.getElementById('top-bar')
    if (topBar) topBar.innerHTML = tb

    // ── LEFT NAV ──
    var ln = '<div class="ln-views">'
    Object.entries(VIEWS).forEach(function (entry) {
      var k = entry[0], v = entry[1]
      ln += '<div class="ln-item' + (state.currentView === k ? ' active' : '') + '" onclick="S._setView(\'' + k + '\')" title="' + v.desc + '"><span class="ln-icon">' + v.icon + '</span><span class="ln-label">' + v.label + '</span></div>'
    })
    ln += '</div><div class="ln-bottom">'
    ln += '<div class="ln-item" onclick="S._logout()" title="Sign out"><span class="ln-icon">\u23FB</span><span class="ln-label">LOGOUT</span></div>'
    ln += '</div>'
    var leftNav = document.getElementById('left-nav')
    if (leftNav) leftNav.innerHTML = ln

    // ── MAP OVERLAY (only in watch view) ──
    var mo = ''
    if (state.currentView === 'watch') {
      // Domain filter tabs
      mo += '<div class="mo-domains">'
      DOMAIN_LIST.forEach(function (d) { var dc = DOMAIN_COLORS[d] || '#aaa'; mo += '<span class="mo-dom' + (state.activeDomain === d ? ' active' : '') + '" style="' + (state.activeDomain === d ? 'border-color:' + dc + ';color:' + dc : '') + '" onclick="S._setDomain(\'' + d + '\')">' + d + '</span>' })
      mo += '</div>'

      // Layer quick toggles
      mo += '<div class="mo-layers">'
      var curDom = ''
      Object.entries(LAYERS).forEach(function (entry) {
        var k = entry[0], cfg = entry[1]
        if (state.activeDomain !== 'ALL' && cfg.domain !== state.activeDomain) return
        if (cfg.domain !== curDom) { curDom = cfg.domain }
        var on = state.layerState[k], cnt = state.counts[k] || 0
        mo += '<div class="mo-layer' + (on ? '' : ' off') + '" onclick="S._toggle(\'' + k + '\')">'
        mo += '<span class="dot" style="background:' + (on ? cfg.color : '#0a1520') + '"></span>'
        mo += '<span class="ml-name">' + cfg.icon + ' ' + cfg.label + '</span>'
        mo += '<span class="ml-cnt" style="color:' + cfg.color + '">' + cnt + '</span></div>'
      })
      mo += '</div>'

      // Stats bar
      mo += '<div class="mo-stats">'
      ;[['AIR', (state.counts.aircraft || 0) + (state.counts.military || 0) + (state.counts.sigmets || 0), '#00ccff'],
        ['SEA', (state.counts.fishing || 0) + (state.counts.darkships || 0) + (state.counts.ships || 0), '#00ff88'],
        ['ORB', (state.counts.satellites || 0) + (state.counts.conjunctions || 0), '#ffcc00'],
        ['GEO', (state.counts.seismic || 0) + (state.counts.wildfires || 0) + (state.counts.weather || 0) + (state.counts.eonet || 0), '#4477ff'],
        ['INT', (state.counts.conflict || 0) + (state.counts.disasters || 0) + (state.counts.nuclear || 0), '#ff2200'],
        ['CYB', state.counts.cyber || 0, '#66ffcc']
      ].forEach(function (s) { mo += '<div class="ms-item"><span class="ms-lbl" style="color:' + s[2] + '">' + s[0] + '</span><span class="ms-val" style="color:' + s[2] + '">' + s[1] + '</span></div>' })
      mo += '<div class="ms-item ms-total"><span class="ms-val">' + total.toLocaleString() + '</span></div></div>'
    }
    var mapOverlay = document.getElementById('map-overlay')
    if (mapOverlay) mapOverlay.innerHTML = mo
    // Show/hide map depending on view
    var mapContainer = document.getElementById('map-container')
    if (mapContainer) mapContainer.style.display = (state.currentView === 'watch' || state.currentView === 'alerts') ? 'block' : (state.currentView === 'analytics' || state.currentView === 'graph' || state.currentView === 'cases' || state.currentView === 'admin') ? 'none' : 'block'

    // ── RIGHT PANEL ──
    var rp = ''
    if (state.currentView === 'watch') {
      rp = renderWatchRightPanel()
    } else if (state.currentView === 'alerts') {
      rp = renderAlertsView()
    } else if (state.currentView === 'cases') {
      rp = renderCasesView()
    } else if (state.currentView === 'graph') {
      rp = renderGraphView()
    } else if (state.currentView === 'analytics') {
      rp = renderAnalyticsView()
    } else if (state.currentView === 'admin') {
      rp = renderAdminView()
    }
    var rightPanel = document.getElementById('right-panel')
    if (rightPanel) {
      rightPanel.innerHTML = rp
      rightPanel.className = (state.currentView !== 'watch' && state.currentView !== 'alerts') ? 'rp-full' : ''
    }

    // ── BOTTOM STRIP ──
    var bs = '<div class="bs-left">'
    bs += '<span class="bs-item">v9.0.0</span>'
    bs += '<span class="bs-item">' + state.entities.length + ' entities</span>'
    bs += '<span class="bs-item">Cycle ' + state.cycle + '</span>'
    bs += '<span class="bs-item">' + Object.keys(state.alerts || {}).length + ' alerts</span>'
    bs += '</div><div class="bs-right">'
    bs += '<span class="bs-item">UNCLASSIFIED // OSINT</span>'
    var secToRefresh = Math.max(0, Math.round((state.nextRefreshAt - Date.now()) / 1000))
    if (state.cycle > 0) bs += '<span class="bs-item">Refresh in ' + secToRefresh + 's</span>'
    bs += '</div>'
    var bottomStrip = document.getElementById('bottom-strip')
    if (bottomStrip) bottomStrip.innerHTML = bs

    // Hide loading
    var loadEl = document.getElementById('loading'); if (loadEl) loadEl.style.display = 'none'
  }

  // ── WATCH RIGHT PANEL ──
  function renderWatchRightPanel() {
    var h = '<div class="rp-tabs">'
    ;[['inspector', 'INSPECT'], ['threat', 'THREATS'], ['sources', 'HEALTH']].forEach(function (t) { h += '<span class="rp-tab' + (state.rightTab === t[0] ? ' active' : '') + '" onclick="S._setRightTab(\'' + t[0] + '\')">' + t[1] + '</span>' })
    h += '</div><div class="rp-body">'

    if (state.rightTab === 'inspector' && state.selected) {
      var e = state.selected, t = scoreThreat(e), fr = freshness(e.timestamp)
      var lk = typeToLayer(e.entity_type), dc = LAYERS[lk]?.color || '#aaa'
      h += '<div class="ins-header" style="border-left:3px solid ' + dc + '"><div class="ins-title">' + esc(e.title).slice(0, 80) + '</div><span class="ins-close" onclick="S._closeInspector()">\u2715</span></div>'
      h += '<div class="ins-badges"><span class="badge" style="background:' + t.col + '22;color:' + t.col + '">' + t.level + ' ' + t.score + '</span>'
      h += '<span class="badge conf">' + e.confidence + '%</span>'
      h += '<span class="badge ' + fr.cls + '">' + fr.label + '</span>'
      if (e.severity !== 'info') h += '<span class="badge sev-' + e.severity + '">' + e.severity.toUpperCase() + '</span>'
      h += '</div>'
      h += '<div class="ins-meta">' + esc(e.source) + ' \u00B7 ' + esc(e.region || 'Global')
      if (e.lat != null) h += ' \u00B7 ' + e.lat.toFixed(2) + ',' + e.lon.toFixed(2)
      h += '</div>'
      if (e.description) h += '<div class="ins-desc">' + esc(e.description).slice(0, 300) + '</div>'
      // Actions
      if (e.lat != null) {
        h += '<div class="ins-actions">'
        h += '<a class="ins-btn" href="https://www.google.com/maps?q=' + e.lat + ',' + e.lon + '" target="_blank">\uD83C\uDF0D Map</a>'
        if (e.source_url) h += '<a class="ins-btn" href="' + esc(e.source_url) + '" target="_blank">\uD83D\uDD17 Source</a>'
        h += '<span class="ins-btn" onclick="navigator.clipboard.writeText(\'' + e.lat.toFixed(4) + ', ' + e.lon.toFixed(4) + '\')">Copy</span>'
        h += '<span class="ins-btn" onclick="S._createAlertFrom()">+ Alert</span>'
        h += '</div>'
      }
      // Metadata
      if (e.metadata && Object.keys(e.metadata).length > 0) {
        h += '<div class="ins-section">METADATA</div>'
        Object.entries(e.metadata).forEach(function (p) { if (p[1] != null && p[1] !== '' && !String(p[0]).startsWith('_')) h += '<div class="ins-field"><span class="ins-key">' + esc(p[0]) + '</span><span class="ins-val">' + esc(typeof p[1] === 'object' ? JSON.stringify(p[1]) : String(p[1])).slice(0, 200) + '</span></div>' })
      }
      if (t.reasons.length > 0) { h += '<div class="ins-section">THREAT FACTORS</div>'; t.reasons.forEach(function (r) { h += '<div class="ins-reason">\u2022 ' + esc(r) + '</div>' }) }
    } else if (state.rightTab === 'inspector') {
      h += '<div class="rp-empty">Click an entity on the map to inspect</div>'
    }

    if (state.rightTab === 'threat') {
      var board = state.entities.map(function (e) { return Object.assign({ entity: e }, scoreThreat(e)) }).filter(function (t) { return t.score >= 10 }).sort(function (a, b) { return b.score - a.score }).slice(0, 40)
      var critCount = board.filter(function (t) { return t.level === 'CRITICAL' }).length
      var highCount = board.filter(function (t) { return t.level === 'HIGH' }).length
      var gi = Math.min(100, critCount * 12 + highCount * 5)
      h += '<div class="threat-hdr"><div class="th-stat"><span class="th-num" style="color:#ff0033">' + critCount + '</span><span class="th-lbl">CRIT</span></div><div class="th-stat"><span class="th-num" style="color:#ff7700">' + highCount + '</span><span class="th-lbl">HIGH</span></div>'
      h += '<div class="th-bar"><div class="th-fill" style="width:' + gi + '%;background:' + (gi >= 75 ? '#ff0033' : gi >= 50 ? '#ff7700' : '#ffcc00') + '"></div></div></div>'
      board.forEach(function (t) { var fr = freshness(t.entity.timestamp); h += '<div class="thr-item" onclick="S._flyTo(\'' + t.entity.id + '\')"><div class="thr-top"><span class="thr-name">' + esc(t.entity.title).slice(0, 50) + '</span><span class="thr-score" style="color:' + t.col + '">' + t.score + '</span></div><div class="thr-meta">' + (t.reasons[0] ? '<span class="thr-reason">' + esc(t.reasons[0]) + '</span>' : '') + '<span class="badge ' + fr.cls + '">' + fr.label + '</span></div></div>' })
    }

    if (state.rightTab === 'sources') {
      h += '<div class="ins-section">SOURCE HEALTH</div>'
      Object.entries(LAYERS).forEach(function (entry) {
        var k = entry[0], cfg = entry[1], st = state.sourceHealth[k]
        var dot = st === 'live' ? '#00ff88' : st === 'error' ? '#ff3355' : '#ffaa00'
        h += '<div class="src-row"><span class="dot" style="background:' + dot + '"></span><span class="src-name">' + cfg.label + '</span><span class="src-status">' + (st || 'LOAD').toUpperCase() + '</span><span class="src-detail">' + cfg.src + '</span></div>'
      })
      h += '<div class="ins-section" style="margin-top:8px">TIMELINE</div>'
      state.timeline.slice(0, 15).forEach(function (t) { h += '<div class="log-row"><span class="log-time">' + t.time.slice(11, 19) + '</span><span class="log-msg">' + esc(t.msg) + '</span></div>' })
    }

    h += '</div>'
    return h
  }

  // ── ALERTS VIEW ──
  function renderAlertsView() {
    var h = '<div class="view-header">ALERT MANAGEMENT</div>'
    h += '<div class="alert-controls">'
    h += '<select class="alert-filter" onchange="S._filterAlerts(\'priority\',this.value)"><option value="">All Priority</option><option value="P1_CRITICAL">P1 Critical</option><option value="P2_HIGH">P2 High</option><option value="P3_MEDIUM">P3 Medium</option><option value="P4_LOW">P4 Low</option></select>'
    h += '<select class="alert-filter" onchange="S._filterAlerts(\'status\',this.value)"><option value="">All Status</option><option value="NEW">New</option><option value="ACKNOWLEDGED">Acknowledged</option><option value="IN_PROGRESS">In Progress</option><option value="RESOLVED">Resolved</option></select>'
    h += '<button class="btn-primary" onclick="S._createAlert()">+ NEW ALERT</button>'
    h += '</div>'
    h += '<div class="alert-list">'
    if (state.alerts.length === 0) { h += '<div class="rp-empty">Loading alerts...</div>' }
    state.alerts.forEach(function (a) {
      var pCol = a.priority === 'P1_CRITICAL' ? '#ff0033' : a.priority === 'P2_HIGH' ? '#ff7700' : a.priority === 'P3_MEDIUM' ? '#ffcc00' : '#44aaff'
      var fr = freshness(a.created_at)
      h += '<div class="alert-card" style="border-left:3px solid ' + pCol + '">'
      h += '<div class="ac-top"><span class="ac-priority" style="color:' + pCol + '">' + a.priority.replace('_', ' ') + '</span><span class="ac-status badge">' + a.status + '</span></div>'
      h += '<div class="ac-title">' + esc(a.title) + '</div>'
      h += '<div class="ac-meta"><span>' + esc(a.domain) + '</span><span>' + esc(a.source) + '</span><span class="badge ' + fr.cls + '">' + fr.label + '</span></div>'
      h += '<div class="ac-actions">'
      if (a.status === 'NEW') h += '<span class="ins-btn" onclick="S._ackAlert(\'' + a.id + '\')">ACK</span>'
      if (a.status !== 'RESOLVED') h += '<span class="ins-btn" onclick="S._resolveAlert(\'' + a.id + '\')">RESOLVE</span>'
      h += '<span class="ins-btn" onclick="S._viewAlert(\'' + a.id + '\')">DETAIL</span>'
      h += '</div></div>'
    })
    h += '</div>'
    return h
  }

  // ── CASES VIEW ──
  function renderCasesView() {
    var h = '<div class="view-header">CASE MANAGEMENT</div>'
    h += '<div class="alert-controls"><button class="btn-primary" onclick="S._createCase()">+ NEW CASE</button></div>'
    h += '<div class="alert-list">'
    if (state.cases.length === 0) { h += '<div class="rp-empty">Loading cases...</div>' }
    state.cases.forEach(function (cs) {
      h += '<div class="case-card">'
      h += '<div class="cc-top"><span class="cc-id">' + cs.id + '</span><span class="badge">' + cs.status + '</span><span class="badge">' + cs.priority.replace('_', ' ') + '</span></div>'
      h += '<div class="cc-title">' + esc(cs.title) + '</div>'
      h += '<div class="cc-desc">' + esc(cs.description).slice(0, 120) + '</div>'
      h += '<div class="cc-meta">'
      if (cs.tags.length > 0) cs.tags.slice(0, 5).forEach(function (t) { h += '<span class="cc-tag">' + esc(t) + '</span>' })
      h += '<span class="cc-date">' + freshness(cs.created_at).label + '</span>'
      h += '</div></div>'
    })
    h += '</div>'
    return h
  }

  // ── GRAPH VIEW ──
  function renderGraphView() {
    var h = '<div class="view-header">KNOWLEDGE GRAPH</div>'
    h += '<div class="graph-container">'
    h += '<div class="graph-nodes">'
    h += '<div class="ins-section">ENTITIES (' + state.graphNodes.length + ')</div>'
    state.graphNodes.forEach(function (n) {
      var tc = { person: '#ff44aa', organization: '#ff9900', vessel: '#00ff88', aircraft: '#00ccff', facility: '#ffcc00', event: '#ff2200', ip_address: '#66ffcc', domain: '#9966ff' }
      h += '<div class="gn-item" style="border-left:2px solid ' + (tc[n.type] || '#444') + '"><div class="gn-label">' + esc(n.label) + '</div><div class="gn-type">' + n.type + ' \u00B7 ' + n.confidence + '%</div><div class="gn-desc">' + esc(n.description).slice(0, 80) + '</div>'
      if (n.tags.length > 0) { h += '<div class="gn-tags">'; n.tags.slice(0, 5).forEach(function (t) { h += '<span class="cc-tag">' + esc(t) + '</span>' }); h += '</div>' }
      h += '</div>'
    })
    h += '</div><div class="graph-edges">'
    h += '<div class="ins-section">RELATIONSHIPS (' + state.graphEdges.length + ')</div>'
    state.graphEdges.forEach(function (e) {
      var fromNode = state.graphNodes.find(function (n) { return n.id === e.from }) || { label: e.from }
      var toNode = state.graphNodes.find(function (n) { return n.id === e.to }) || { label: e.to }
      h += '<div class="ge-item"><span class="ge-from">' + esc(fromNode.label) + '</span><span class="ge-type">\u2192 ' + e.type + ' \u2192</span><span class="ge-to">' + esc(toNode.label) + '</span><span class="ge-conf">' + e.confidence + '%</span></div>'
    })
    h += '</div></div>'
    return h
  }

  // ── ANALYTICS VIEW ──
  function renderAnalyticsView() {
    var h = '<div class="view-header">ANALYTICS DASHBOARD</div>'
    if (!state.analyticsData) { h += '<div class="rp-empty">Loading analytics...</div>'; return h }
    var a = state.analyticsData
    h += '<div class="analytics-grid">'
    // Threat index card
    var tiCol = a.threat.index >= 80 ? '#ff0033' : a.threat.index >= 60 ? '#ff7700' : a.threat.index >= 40 ? '#ffcc00' : '#00ff88'
    h += '<div class="an-card an-threat"><div class="an-card-title">THREAT INDEX</div><div class="an-big" style="color:' + tiCol + '">' + a.threat.index + '</div><div class="an-sub" style="color:' + tiCol + '">' + a.threat.level + '</div></div>'
    // Alert stats
    h += '<div class="an-card"><div class="an-card-title">ALERTS</div><div class="an-row"><span>Total</span><span>' + a.alerts.total + '</span></div><div class="an-row"><span>Open</span><span style="color:#ff7700">' + a.alerts.open + '</span></div><div class="an-row"><span>Resolved</span><span style="color:#00ff88">' + a.alerts.resolved + '</span></div></div>'
    // Case stats
    h += '<div class="an-card"><div class="an-card-title">CASES</div><div class="an-row"><span>Total</span><span>' + a.cases.total + '</span></div><div class="an-row"><span>Open</span><span style="color:#ff7700">' + a.cases.open + '</span></div></div>'
    // Platform
    h += '<div class="an-card"><div class="an-card-title">PLATFORM</div><div class="an-row"><span>Users</span><span>' + a.users.total + '</span></div><div class="an-row"><span>Sources</span><span>' + a.sources.total + '</span></div><div class="an-row"><span>Graph Nodes</span><span>' + a.graph.nodes + '</span></div><div class="an-row"><span>Workspaces</span><span>' + a.workspaces.total + '</span></div></div>'
    // Priority distribution
    h += '<div class="an-card an-wide"><div class="an-card-title">ALERTS BY PRIORITY</div>'
    Object.entries(a.alerts.by_priority || {}).forEach(function (p) {
      var pCol = p[0].includes('CRITICAL') ? '#ff0033' : p[0].includes('HIGH') ? '#ff7700' : p[0].includes('MEDIUM') ? '#ffcc00' : '#44aaff'
      var pct = a.alerts.total > 0 ? Math.round(p[1] / a.alerts.total * 100) : 0
      h += '<div class="an-bar-row"><span class="an-bar-label">' + p[0].replace('_', ' ') + '</span><div class="an-bar"><div class="an-bar-fill" style="width:' + pct + '%;background:' + pCol + '"></div></div><span class="an-bar-val">' + p[1] + '</span></div>'
    })
    h += '</div>'
    // Domain distribution
    h += '<div class="an-card an-wide"><div class="an-card-title">ALERTS BY DOMAIN</div>'
    Object.entries(a.alerts.by_domain || {}).forEach(function (d) {
      var dc = DOMAIN_COLORS[d[0].toUpperCase()] || '#aaa'
      var pct = a.alerts.total > 0 ? Math.round(d[1] / a.alerts.total * 100) : 0
      h += '<div class="an-bar-row"><span class="an-bar-label">' + d[0] + '</span><div class="an-bar"><div class="an-bar-fill" style="width:' + pct + '%;background:' + dc + '"></div></div><span class="an-bar-val">' + d[1] + '</span></div>'
    })
    h += '</div>'
    h += '</div>'
    return h
  }

  // ── ADMIN VIEW ──
  function renderAdminView() {
    var h = '<div class="view-header">ADMIN CONSOLE</div>'
    h += '<div class="admin-grid">'
    h += '<div class="an-card"><div class="an-card-title">USERS</div><div class="an-big">' + Object.keys(usersStore || {}).length + '</div><div class="an-sub">Registered accounts</div></div>'
    h += '<div class="an-card"><div class="an-card-title">GEOFENCES</div><div class="an-big">' + state.geofences.length + '</div><div class="an-sub">Active monitoring zones</div></div>'
    h += '<div class="an-card"><div class="an-card-title">WORKSPACES</div><div class="an-big">' + state.workspaces.length + '</div><div class="an-sub">Shared environments</div></div>'
    h += '<div class="an-card an-wide"><div class="an-card-title">SYSTEM STATUS</div>'
    h += '<div class="an-row"><span>Platform Version</span><span>v9.0.0</span></div>'
    h += '<div class="an-row"><span>Runtime</span><span>Cloudflare Workers (Edge)</span></div>'
    h += '<div class="an-row"><span>Framework</span><span>Hono v4</span></div>'
    h += '<div class="an-row"><span>Data Sources</span><span>25+</span></div>'
    h += '<div class="an-row"><span>Domains</span><span>19</span></div>'
    h += '</div>'
    // Workspaces list
    h += '<div class="an-card an-wide"><div class="an-card-title">WORKSPACES</div>'
    state.workspaces.forEach(function (ws) {
      h += '<div class="an-row"><span>' + esc(ws.name) + '</span><span>' + esc(ws.description).slice(0, 40) + '</span></div>'
    })
    h += '</div>'
    // Geofences
    h += '<div class="an-card an-wide"><div class="an-card-title">GEOFENCES</div>'
    state.geofences.forEach(function (gf) {
      h += '<div class="an-row"><span>' + esc(gf.name) + '</span><span>' + (gf.radius_km || '?') + ' km</span><span>' + gf.violation_count + ' violations</span></div>'
    })
    h += '</div>'
    h += '</div>'
    return h
  }

  // ── LOGIN SCREEN ──
  function renderLogin() {
    var h = '<div class="login-overlay">'
    h += '<div class="login-box">'
    h += '<div class="login-logo">SENTINEL<span class="tb-x">X</span></div>'
    h += '<div class="login-sub">Multi-Domain Situational Awareness Platform</div>'
    if (state.loginError) h += '<div class="login-error">' + esc(state.loginError) + '</div>'
    h += '<input id="login-user" class="login-input" type="text" placeholder="Username" value="admin">'
    h += '<input id="login-pass" class="login-input" type="password" placeholder="Password" value="admin">'
    h += '<button class="login-btn" onclick="S._doLogin()">SIGN IN</button>'
    h += '<div class="login-hint">Demo: admin/admin, analyst/analyst, operator/operator</div>'
    h += '</div></div>'
    document.getElementById('top-bar').innerHTML = ''
    document.getElementById('left-nav').innerHTML = ''
    document.getElementById('right-panel').innerHTML = ''
    document.getElementById('bottom-strip').innerHTML = ''
    document.getElementById('map-overlay').innerHTML = ''
    document.getElementById('modal-layer').innerHTML = h
    var loadEl = document.getElementById('loading'); if (loadEl) loadEl.style.display = 'none'
  }

  // ═══════════════════════════════════════════════════════════════
  // DATA FETCHING
  // ═══════════════════════════════════════════════════════════════
  function datePair() { var end = new Date().toISOString().split('T')[0], start = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]; return { startDate: start, endDate: end } }

  async function fetchAll() {
    if (state.fetching) return; state.fetching = true; state.cycle++; state.lastFetchTime = Date.now(); state.nextRefreshAt = Date.now() + 60000
    log('Fetch cycle ' + state.cycle, 'info')

    // Phase 1: Fast free
    try {
      var p1 = await Promise.allSettled([proxy('opensky'), fetch(DIRECT.USGS).then(function (r) { return r.json() }), fetch(DIRECT.ISS).then(function (r) { return r.json() })])
      if (p1[0].status === 'fulfilled' && !isErr(p1[0].value)) { var pa = parseOpenSky(p1[0].value); replaceEntities(pa.filter(function (e) { return e.entity_type === 'aircraft' }), 'ac_'); replaceEntities(pa.filter(function (e) { return e.entity_type === 'military_air' }), 'mil_'); state.sourceHealth.aircraft = 'live'; state.sourceHealth.military = 'live' } else { state.sourceHealth.aircraft = 'error'; state.sourceHealth.military = 'error' }
      if (p1[1].status === 'fulfilled') { replaceEntities(parseUSGS(p1[1].value), 'eq_'); state.sourceHealth.seismic = 'live' } else { state.sourceHealth.seismic = 'error' }
      if (p1[2].status === 'fulfilled') { replaceEntities(parseISS(p1[2].value), 'iss_'); state.sourceHealth.iss = 'live' }
    } catch (e) { log('P1 err: ' + e, 'error') }

    // Phase 2: Keyed + SIGMET/EONET
    try {
      var p2 = await Promise.allSettled([proxy('firms'), proxy('n2yo'), getApi('/api/weather/global'), getApi('/api/avwx/sigmets'), getApi('/api/eonet/events?days=30&limit=50')])
      if (p2[0].status === 'fulfilled' && typeof p2[0].value === 'string') { replaceEntities(parseFIRMS(p2[0].value), 'fire_'); state.sourceHealth.wildfires = 'live' }
      if (p2[1].status === 'fulfilled' && !isErr(p2[1].value)) { replaceEntities(parseN2YO(p2[1].value), 'sat_'); state.sourceHealth.satellites = 'live' }
      if (p2[2].status === 'fulfilled' && !isErr(p2[2].value)) { replaceEntities(parseOWM(p2[2].value), 'wx_'); state.sourceHealth.weather = 'live' }
      if (p2[3].status === 'fulfilled' && !isErr(p2[3].value)) { replaceEntities(passthrough(p2[3].value), 'sigmet_'); state.sourceHealth.sigmets = 'live' }
      if (p2[4].status === 'fulfilled' && !isErr(p2[4].value)) { replaceEntities(passthrough(p2[4].value), 'eonet_'); state.sourceHealth.eonet = 'live' }
    } catch (e) { log('P2 err: ' + e, 'error') }

    // Phase 3: Slower feeds
    setTimeout(async function () {
      try {
        var p3 = await Promise.allSettled([proxy('gdacs'), proxy('gfw_fishing', datePair()), proxy('gfw_gap', datePair()), getApi('/api/reliefweb/disasters')])
        if (p3[0].status === 'fulfilled' && !isErr(p3[0].value)) { replaceEntities(parseGDACS(p3[0].value), 'gdacs_'); state.sourceHealth.disasters = 'live' }
        if (p3[1].status === 'fulfilled' && !isErr(p3[1].value)) { replaceEntities(parseGFW(p3[1].value, 'fish'), 'fish_'); state.sourceHealth.fishing = 'live' }
        if (p3[2].status === 'fulfilled' && !isErr(p3[2].value)) { replaceEntities(parseGFW(p3[2].value, 'dark'), 'gap_'); state.sourceHealth.darkships = 'live' }
      } catch (e) { log('P3 err: ' + e, 'error') }
    }, state.isMobile ? 1000 : 0)

    // Phase 4: Intel
    setTimeout(async function () {
      try {
        var p4 = await Promise.allSettled([postApi('/api/intel/gdelt', { category: 'conflict' }), postApi('/api/intel/gdelt', { category: 'cyber' }), postApi('/api/intel/gdelt', { category: 'nuclear' })])
        if (p4[0].status === 'fulfilled') { replaceEntities(passthrough(p4[0].value), 'gdelt_conflict_'); state.sourceHealth.conflict = 'live' }
        if (p4[1].status === 'fulfilled') { replaceEntities(passthrough(p4[1].value), 'gdelt_cyber_') }
        if (p4[2].status === 'fulfilled') { replaceEntities(passthrough(p4[2].value), 'gdelt_nuclear_'); state.sourceHealth.nuclear = 'live' }
      } catch (e) { log('P4 err: ' + e, 'error') }
    }, state.isMobile ? 1500 : 0)

    // Phase 5: Cyber + Space-Track
    setTimeout(async function () {
      try {
        var p5 = await Promise.allSettled([getApi('/api/cyber/cisa-kev'), getApi('/api/cyber/otx'), getApi('/api/spacetrack/gp'), getApi('/api/spacetrack/cdm')])
        if (p5[0].status === 'fulfilled' && p5[0].value?.events) { replaceEntities(p5[0].value.events.map(ce), 'kev_'); state.sourceHealth.cyber = 'live' }
        if (p5[1].status === 'fulfilled' && p5[1].value?.events) { replaceEntities(p5[1].value.events.map(ce), 'otx_') }
        if (p5[2].status === 'fulfilled' && p5[2].value?.events) { replaceEntities(p5[2].value.events.map(ce), 'stgp_') }
        if (p5[3].status === 'fulfilled' && p5[3].value?.events) { replaceEntities(p5[3].value.events.map(ce), 'cdm_'); state.sourceHealth.conjunctions = 'live' }
      } catch (e) { log('P5 err: ' + e, 'error') }
    }, state.isMobile ? 3000 : 2000)

    // Phase 6: GNSS + Social
    setTimeout(async function () {
      try {
        var p6 = await Promise.allSettled([getApi('/api/gnss/anomalies'), getApi('/api/social/reddit')])
        if (p6[0].status === 'fulfilled' && p6[0].value?.events) { replaceEntities(p6[0].value.events.map(ce), 'gnss_'); state.sourceHealth.gnss = 'live' }
        if (p6[1].status === 'fulfilled' && p6[1].value?.events) { replaceEntities(p6[1].value.events.map(ce), 'reddit_'); state.sourceHealth.social = 'live' }
      } catch (e) { log('P6 err: ' + e, 'error') }
    }, state.isMobile ? 5000 : 4000)

    state.connectionOk = true; state.fetching = false; refreshMap()
    log('Cycle ' + state.cycle + ' — ' + state.entities.length + ' entities', 'info')
  }

  // Platform data fetch (alerts, cases, graph, analytics, etc.)
  async function fetchPlatformData() {
    try {
      var results = await Promise.allSettled([getApi('/api/alerts'), getApi('/api/cases'), getApi('/api/graph/full'), getApi('/api/analytics/overview'), getApi('/api/workspaces'), getApi('/api/geofences')])
      if (results[0].status === 'fulfilled' && results[0].value?.alerts) state.alerts = results[0].value.alerts
      if (results[1].status === 'fulfilled' && results[1].value?.cases) state.cases = results[1].value.cases
      if (results[2].status === 'fulfilled' && results[2].value?.nodes) { state.graphNodes = results[2].value.nodes; state.graphEdges = results[2].value.edges }
      if (results[3].status === 'fulfilled' && !isErr(results[3].value)) state.analyticsData = results[3].value
      if (results[4].status === 'fulfilled' && results[4].value?.workspaces) state.workspaces = results[4].value.workspaces
      if (results[5].status === 'fulfilled' && results[5].value?.geofences) state.geofences = results[5].value.geofences
    } catch (e) { log('Platform fetch err: ' + e, 'error') }
    render()
  }

  // ═══════════════════════════════════════════════════════════════
  // GLOBAL HANDLERS
  // ═══════════════════════════════════════════════════════════════
  var usersStore = {} // client-side ref for admin
  window.S = {
    _toggle: toggleLayer,
    _setView: function (v) { state.currentView = v; render(); if (v === 'analytics' || v === 'graph' || v === 'cases' || v === 'admin') fetchPlatformData() },
    _setDomain: function (d) { state.activeDomain = d; render() },
    _setRightTab: function (t) { state.rightTab = t; render() },
    _flyTo: function (id) { var e = state.entities.find(function (x) { return x.id === id }); if (e) flyTo(e) },
    _closeInspector: function () { state.selected = null; render() },
    _search: function (q) {
      state.searchQuery = q; if (!q || q.length < 2) { state.searchResults = []; render(); return }
      getApi('/api/search?q=' + encodeURIComponent(q)).then(function (d) { if (d?.results) state.searchResults = d.results; render() })
    },
    _searchFocus: function () { state.searchOpen = true; render() },
    _searchSelect: function (i) {
      var r = state.searchResults[i]; if (!r) return
      state.searchOpen = false; state.searchQuery = ''
      if (r.type === 'alert') { state.currentView = 'alerts'; fetchPlatformData() }
      else if (r.type === 'case') { state.currentView = 'cases'; fetchPlatformData() }
      else { var e = state.entities.find(function (x) { return x.id === r.id }); if (e) flyTo(e) }
      render()
    },
    _doLogin: function () { var u = document.getElementById('login-user')?.value, p = document.getElementById('login-pass')?.value; doLogin(u, p) },
    _logout: doLogout,
    _toggleUserMenu: function () { /* future */ },
    _createAlertFrom: function () {
      if (!state.selected) return
      var e = state.selected
      postApi('/api/alerts', { title: e.title, description: e.description || '', domain: typeToLayer(e.entity_type), source: e.source, lat: e.lat, lon: e.lon, entity_ids: [e.id], tags: e.tags || [], priority: e.severity === 'critical' ? 'P1_CRITICAL' : e.severity === 'high' ? 'P2_HIGH' : 'P3_MEDIUM' }).then(function () { fetchPlatformData() })
    },
    _createAlert: function () { postApi('/api/alerts', { title: 'New Manual Alert', priority: 'P3_MEDIUM' }).then(function () { fetchPlatformData() }) },
    _ackAlert: function (id) { putApi('/api/alerts/' + id, { status: 'ACKNOWLEDGED' }).then(function () { fetchPlatformData() }) },
    _resolveAlert: function (id) { putApi('/api/alerts/' + id, { status: 'RESOLVED' }).then(function () { fetchPlatformData() }) },
    _viewAlert: function (id) { /* future detail view */ },
    _filterAlerts: function (key, val) { state.alertFilter[key] = val; var q = '/api/alerts?limit=50'; if (state.alertFilter.priority) q += '&priority=' + state.alertFilter.priority; if (state.alertFilter.status) q += '&status=' + state.alertFilter.status; getApi(q).then(function (d) { if (d?.alerts) { state.alerts = d.alerts; render() } }) },
    _createCase: function () { postApi('/api/cases', { title: 'New Investigation' }).then(function () { fetchPlatformData() }) },
    _state: state,
  }

  // Keyboard
  document.addEventListener('keydown', function (ev) {
    if (ev.target.tagName === 'INPUT' || ev.target.tagName === 'SELECT' || ev.target.tagName === 'TEXTAREA') return
    var k = ev.key.toLowerCase()
    if (k === 'escape') { state.selected = null; state.searchOpen = false; state.searchQuery = ''; state.searchResults = []; render() }
    else if (k === '1') { state.currentView = 'watch'; render() }
    else if (k === '2') { state.currentView = 'alerts'; render(); fetchPlatformData() }
    else if (k === '3') { state.currentView = 'cases'; render(); fetchPlatformData() }
    else if (k === '4') { state.currentView = 'graph'; render(); fetchPlatformData() }
    else if (k === '5') { state.currentView = 'analytics'; render(); fetchPlatformData() }
    else if (k === 'r') fetchAll()
    else if (k === '/' || k === 'f') { ev.preventDefault(); var inp = document.querySelector('.tb-search'); if (inp) inp.focus() }
  })

  // ═══════════════════════════════════════════════════════════════
  // BOOT
  // ═══════════════════════════════════════════════════════════════
  async function boot() {
    console.log('%c SENTINEL-X v9.0 ', 'background:#00ff88;color:#020a12;font-weight:bold;font-size:16px;padding:6px 12px;border-radius:4px')
    console.log('Multi-Domain Situational Awareness & Decision-Support Platform')

    await checkAuth()
    render()

    if (state.loggedIn) {
      initMap()
      fetchAll()
      fetchPlatformData()
      setInterval(fetchAll, 60000)
      setInterval(fetchPlatformData, 30000)
      setInterval(function () { fetch(DIRECT.ISS).then(function (r) { return r.json() }).then(function (d) { if (d?.latitude != null) replaceEntities(parseISS(d), 'iss_') }).catch(function () {}) }, 5000)
      setInterval(function () { if (state.lastFetchTime > 0 && (Date.now() - state.lastFetchTime) > 120000) state.connectionOk = false; render() }, 5000)
    }
  }

  boot()
})()
