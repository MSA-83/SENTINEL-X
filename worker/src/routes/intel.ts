import { Hono } from 'hono'

const intel = new Hono()

// Simulated OSINT feeds (replace with real APIs later)
intel.get('/adsb', async (c) => {
  return c.json({
    source: 'ADS-B',
    data: [
      { id: 'FLIGHT-1', lat: 52.37, lon: 4.89, altitude: 32000 },
      { id: 'FLIGHT-2', lat: 48.85, lon: 2.35, altitude: 28000 }
    ]
  })
})

intel.get('/ais', async (c) => {
  return c.json({
    source: 'AIS',
    data: [
      { id: 'VESSEL-1', lat: 51.9, lon: 4.4, speed: 12 },
      { id: 'VESSEL-2', lat: 40.7, lon: -74.0, speed: 18 }
    ]
  })
})

intel.get('/events', async (c) => {
  return c.json({
    source: 'GDELT',
    events: [
      { id: 'EVT-1', type: 'conflict', location: 'EU', severity: 3 },
      { id: 'EVT-2', type: 'protest', location: 'US', severity: 2 }
    ]
  })
})

export default intel
