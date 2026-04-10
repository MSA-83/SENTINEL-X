export function calculateRisk(entity:any) {
  let score = 0

  if (entity.type === 'aircraft' && entity.altitude < 1000) {
    score += 3
  }

  if (entity.speed && entity.speed > 30) {
    score += 2
  }

  // proximity heuristic (placeholder)
  if (entity.position[0] > 0 && entity.position[1] > 50) {
    score += 1
  }

  return {
    ...entity,
    risk: score
  }
}
