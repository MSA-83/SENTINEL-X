export function normalizeADSB(data:any[]) {
  return data.map(d => ({
    id: d.id,
    type: 'aircraft',
    position: [d.lon, d.lat],
    altitude: d.altitude || 0
  }))
}

export function normalizeAIS(data:any[]) {
  return data.map(d => ({
    id: d.id,
    type: 'vessel',
    position: [d.lon, d.lat],
    speed: d.speed || 0
  }))
}
