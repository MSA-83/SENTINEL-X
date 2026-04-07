type Entity = {
  id: string
  type: string
  position: [number, number]
  altitude?: number
  speed?: number
  lastUpdated: number
}

export class FusionEngine {
  private state: Map<string, Entity> = new Map()

  ingest(entities: Entity[]) {
    const now = Date.now()

    for (const e of entities) {
      const existing = this.state.get(e.id)

      if (!existing) {
        this.state.set(e.id, { ...e, lastUpdated: now })
        continue
      }

      // merge strategy (simple but extensible)
      this.state.set(e.id, {
        ...existing,
        ...e,
        lastUpdated: now
      })
    }
  }

  getSnapshot() {
    return Array.from(this.state.values())
  }

  prune(ttl = 60000) {
    const now = Date.now()
    for (const [id, entity] of this.state.entries()) {
      if (now - entity.lastUpdated > ttl) {
        this.state.delete(id)
      }
    }
  }
}
