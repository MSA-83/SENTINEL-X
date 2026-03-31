const DOMAIN_CONFIG = {
  air: { label: 'Air', color: '#00d4ff' },
  sea: { label: 'Sea', color: '#00ff88' },
  space: { label: 'Space', color: '#ffd166' },
  weather: { label: 'Weather', color: '#4dabf7' },
  conflict: { label: 'Conflict', color: '#ff6b6b' },
  cyber: { label: 'Cyber', color: '#9d4edd' },
  gnss: { label: 'GNSS', color: '#f77f00' },
  social: { label: 'Social', color: '#f72585' }
}

const state = {
  map: null,
  layers: {},
  timeline: [],
  filteredTime: Date.now(),
  selected: null,
  replay: false,
  replayTimer: null
}

function el(tag, className, html) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (html != null) node.innerHTML = html
  return node
}

function ensureDeps() {
  if (!window.L) throw new Error('Leaflet failed to load before sentinel.js')
  if (!window.L.markerClusterGroup) throw new Error('Leaflet MarkerCluster failed to load before sentinel.js')
}

function buildHud() {
  const app = document.getElementById('app')
  app.innerHTML = ''

  const shell = el('div', 'sx-shell')
  shell.innerHTML = `
    <header class="sx-header">
      <h1>SENTINEL-X</h1>
      <div class="sx-chip">Analyst HUD</div>
    </header>
    <aside class="sx-left" id="sx-left"></aside>
    <main class="sx-map" id="sx-map"></main>
    <aside class="sx-right" id="sx-right"></aside>
    <footer class="sx-footer">
      <label>Replay window: <input type="range" id="time-slider" min="0" max="100" value="100"></label>
      <button id="replay-btn">Replay</button>
      <span id="freshness">No data yet</span>
    </footer>
  `
  app.appendChild(shell)

  const left = document.getElementById('sx-left')
  left.appendChild(el('h3', '', 'Domains'))
  Object.keys(DOMAIN_CONFIG).forEach((domain) => {
    const row = el('label', 'sx-toggle', `<input type="checkbox" data-domain="${domain}" checked> ${DOMAIN_CONFIG[domain].label}`)
    left.appendChild(row)
  })

  const right = document.getElementById('sx-right')
  right.innerHTML = '<h3>Source Inspector</h3><div id="inspector">Click an entity.</div><h3>Cards</h3><div id="cards"></div>'
}

function initMap() {
  state.map = L.map('sx-map', { preferCanvas: true }).setView([24, 0], 2)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(state.map)

  for (const domain of Object.keys(DOMAIN_CONFIG)) {
    state.layers[domain] = L.markerClusterGroup({
      disableClusteringAtZoom: 8,
      spiderfyOnMaxZoom: true,
      chunkedLoading: true
    })
    state.map.addLayer(state.layers[domain])
  }
}

function renderInspector(evt) {
  const target = document.getElementById('inspector')
  target.innerHTML = `
    <div><strong>${evt.title}</strong></div>
    <div>Source: ${evt.source}</div>
    <div>Provenance: ${evt.provenance.geolocation} (${evt.provenance.ingestion})</div>
    <div>Timestamp: ${new Date(evt.timestamp).toLocaleString()}</div>
    <div>Confidence: <span class="sx-chip">${Math.round(evt.confidence * 100)}%</span></div>
    <div>Severity: <span class="sx-sev sev-${evt.severity}">${evt.severity}</span></div>
    <div>Correlations: ${(evt.correlations || []).join(', ') || 'None'}</div>
    <div><a href="${evt.source_url}" target="_blank" rel="noreferrer">Original URL</a></div>
  `
}

function markerStyle(evt, domain) {
  const opacity = Math.max(0.25, evt.confidence)
  const inferred = evt.provenance?.geolocation === 'inferred'
  const color = DOMAIN_CONFIG[domain].color
  return L.divIcon({
    className: 'sx-marker-wrap',
    html: `<div class="sx-marker" style="background:${color};opacity:${opacity}">${inferred ? '?' : ''}</div>`,
    iconSize: [14, 14]
  })
}

function renderCards(events) {
  const cards = document.getElementById('cards')
  cards.innerHTML = ''
  events.filter((e) => e.entity_type === 'cyber' || e.entity_type === 'gnss').slice(0, 20).forEach((evt) => {
    const card = el('div', `sx-card ${evt.entity_type}`,
      `<strong>${evt.entity_type.toUpperCase()}</strong><div>${evt.title}</div><small>${evt.source}</small>`)
    cards.appendChild(card)
  })
}

function flattenFusion(resp) {
  const out = []
  for (const group of resp.data || []) {
    for (const evt of group.events || []) {
      if (!evt._upstream_error) out.push({ ...evt, _domain: group.domain })
    }
  }
  return out
}

async function loadFusion() {
  const b = state.map.getBounds()
  const payload = { north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() }
  const resp = await fetch('/api/fusion/viewport', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then((r) => r.json())

  Object.values(state.layers).forEach((layer) => layer.clearLayers())
  const events = flattenFusion(resp)
  state.timeline = events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

  const activeWindow = state.filteredTime
  const filtered = state.timeline.filter((e) => new Date(e.timestamp).getTime() <= activeWindow)

  filtered.forEach((evt) => {
    if (evt.lat == null || evt.lon == null) return
    const marker = L.marker([evt.lat, evt.lon], { icon: markerStyle(evt, evt._domain) })
    marker.on('click', () => renderInspector(evt))
    marker.bindTooltip(`${evt.title}${evt.provenance.geolocation === 'inferred' ? ' (inferred)' : ''}`)
    state.layers[evt._domain]?.addLayer(marker)
  })

  renderCards(filtered)
  document.getElementById('freshness').textContent = `Updated ${new Date(resp.generated_at).toLocaleTimeString()} | ${filtered.length} visible entities`
}

function bindControls() {
  document.querySelectorAll('[data-domain]').forEach((cb) => {
    cb.addEventListener('change', (e) => {
      const domain = e.target.getAttribute('data-domain')
      if (e.target.checked) state.map.addLayer(state.layers[domain])
      else state.map.removeLayer(state.layers[domain])
    })
  })

  const slider = document.getElementById('time-slider')
  slider.addEventListener('input', () => {
    if (!state.timeline.length) return
    const min = new Date(state.timeline[0].timestamp).getTime()
    const max = new Date(state.timeline[state.timeline.length - 1].timestamp).getTime()
    const pct = Number(slider.value) / 100
    state.filteredTime = min + (max - min) * pct
    loadFusion()
  })

  document.getElementById('replay-btn').addEventListener('click', () => {
    state.replay = !state.replay
    document.getElementById('replay-btn').textContent = state.replay ? 'Stop Replay' : 'Replay'
    if (!state.timeline.length) return
    if (!state.replay) {
      clearInterval(state.replayTimer)
      state.replayTimer = null
      return
    }
    let step = 0
    clearInterval(state.replayTimer)
    state.replayTimer = setInterval(() => {
      const pct = Math.min(100, step)
      document.getElementById('time-slider').value = String(pct)
      document.getElementById('time-slider').dispatchEvent(new Event('input'))
      step += 10
      if (pct >= 100) {
        state.replay = false
        document.getElementById('replay-btn').textContent = 'Replay'
        clearInterval(state.replayTimer)
      }
    }, 600)
  })

  state.map.on('moveend', () => loadFusion())
}

async function boot() {
  try {
    ensureDeps()
    buildHud()
    initMap()
    bindControls()
    state.filteredTime = Date.now()
    await loadFusion()
    setInterval(loadFusion, 60000)
  } catch (err) {
    document.getElementById('app').innerHTML = `<pre class="sx-boot-error">Boot failure: ${String(err)}</pre>`
  }
}

window.addEventListener('DOMContentLoaded', boot)
