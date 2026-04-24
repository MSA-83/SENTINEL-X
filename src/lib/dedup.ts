/**
 * FNV-1a 32-bit hash — deterministic deduplication key for canonical events.
 * Matches the reference repo implementation for cross-system compatibility.
 */
export function fnv1a(data: unknown): string {
	const str = typeof data === "string" ? data : JSON.stringify(data) ?? "";
	let h = 0x811c9dc5;
	for (let i = 0; i < str.length; i++) {
		h ^= str.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * Dedup engine: maintains a seen-set of hashes and filters out duplicates.
 * Uses a sliding window to avoid memory leaks in long-running sessions.
 */
export class DedupEngine {
	private seen: Map<string, number> = new Map();
	private maxSize: number;
	private ttlMs: number;

	constructor(maxSize = 10000, ttlMs = 3600000) {
		this.maxSize = maxSize;
		this.ttlMs = ttlMs;
	}

	/**
	 * Returns true if the item is new (not a duplicate).
	 * Computes FNV-1a hash of the entity's dedup key fields.
	 */
	isNew(entity: { id?: string; source?: string; title?: string; lat?: number; lon?: number; timestamp?: number }): boolean {
		const key = fnv1a({
			id: entity.id,
			source: entity.source,
			lat: entity.lat ? Math.round(entity.lat * 1000) / 1000 : 0,
			lon: entity.lon ? Math.round(entity.lon * 1000) / 1000 : 0,
		});
		const now = Date.now();

		// Check if seen and still within TTL
		const prev = this.seen.get(key);
		if (prev !== undefined && now - prev < this.ttlMs) {
			return false;
		}

		// Add to seen set
		this.seen.set(key, now);

		// Evict oldest entries if over max size
		if (this.seen.size > this.maxSize) {
			const cutoff = now - this.ttlMs;
			for (const [k, v] of this.seen) {
				if (v < cutoff) this.seen.delete(k);
			}
			// If still too large, remove oldest quarter
			if (this.seen.size > this.maxSize) {
				const entries = [...this.seen.entries()].sort((a, b) => a[1] - b[1]);
				const toRemove = Math.floor(entries.length / 4);
				for (let i = 0; i < toRemove; i++) {
					this.seen.delete(entries[i][0]);
				}
			}
		}

		return true;
	}

	/**
	 * Get the hash for a given entity (useful for provenance tracking)
	 */
	hash(entity: Record<string, unknown>): string {
		return fnv1a(entity);
	}

	/**
	 * Current size of the dedup cache
	 */
	get size(): number {
		return this.seen.size;
	}

	/**
	 * Clear all entries
	 */
	clear(): void {
		this.seen.clear();
	}
}

// Singleton instance for the app
export const globalDedup = new DedupEngine();
