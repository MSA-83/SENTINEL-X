"use node";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

/**
 * Threat Scoring Engine — Ported from SENTINEL OS v8.3
 * Computes threat scores (0-100) for 12 global hotspot zones
 * using weighted signals from conflict, seismic, fire, cyber, GDELT data
 */

/** 12 Global Threat Zones — key geopolitical and natural hazard hotspots */
const THREAT_ZONES = [
	{ name: "Eastern Ukraine", lat: 48.5, lon: 37.5, radius: 400, baseScore: 65, type: "conflict" },
	{ name: "Gaza Strip", lat: 31.5, lon: 34.47, radius: 100, baseScore: 70, type: "conflict" },
	{ name: "Taiwan Strait", lat: 24.0, lon: 118.5, radius: 500, baseScore: 45, type: "geopolitical" },
	{ name: "Strait of Hormuz", lat: 26.6, lon: 56.3, radius: 200, baseScore: 40, type: "maritime" },
	{ name: "Bab el-Mandeb", lat: 12.6, lon: 43.3, radius: 250, baseScore: 50, type: "maritime" },
	{ name: "South China Sea", lat: 11.0, lon: 114.0, radius: 600, baseScore: 35, type: "geopolitical" },
	{ name: "Korean Peninsula", lat: 38.0, lon: 127.5, radius: 300, baseScore: 40, type: "nuclear" },
	{ name: "Eastern Mediterranean", lat: 35.0, lon: 33.0, radius: 400, baseScore: 45, type: "gnss" },
	{ name: "Sahel Region", lat: 14.0, lon: 2.0, radius: 800, baseScore: 35, type: "conflict" },
	{ name: "Horn of Africa", lat: 8.0, lon: 45.0, radius: 500, baseScore: 40, type: "conflict" },
	{ name: "Black Sea", lat: 43.5, lon: 34.0, radius: 350, baseScore: 50, type: "maritime" },
	{ name: "Ring of Fire Pacific", lat: 0, lon: 140.0, radius: 2000, baseScore: 20, type: "seismic" },
];

/** Haversine distance in km */
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
	const R = 6371;
	const dLat = (lat2 - lat1) * Math.PI / 180;
	const dLon = (lon2 - lon1) * Math.PI / 180;
	const a = Math.sin(dLat / 2) ** 2 +
		Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
	return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const computeThreatScores = internalAction({
	args: {},
	handler: async (ctx) => {
		// Fetch all current data for scoring
		const [conflicts, seismic, fires, gdelt, cyber] = await Promise.all([
			ctx.runQuery(internal.threatQueries.getRecentConflicts),
			ctx.runQuery(internal.threatQueries.getRecentSeismic),
			ctx.runQuery(internal.threatQueries.getRecentFires),
			ctx.runQuery(internal.threatQueries.getRecentGdelt),
			ctx.runQuery(internal.threatQueries.getRecentCyber),
		]);

		for (const zone of THREAT_ZONES) {
			let score = zone.baseScore;
			let activeEvents = 0;

			// Conflict events — highest weight
			for (const c of conflicts) {
				const dist = haversine(zone.lat, zone.lon, c.latitude, c.longitude);
				if (dist < zone.radius) {
					const sev = c.severity === "critical" ? 8 : c.severity === "high" ? 5 : c.severity === "medium" ? 3 : 1;
					score += sev * Math.max(0, 1 - dist / zone.radius);
					activeEvents++;
				}
			}

			// Seismic events — high weight for seismic zones
			for (const s of seismic) {
				const dist = haversine(zone.lat, zone.lon, s.latitude, s.longitude);
				if (dist < zone.radius) {
					const magBonus = Math.max(0, s.magnitude - 3) * 3;
					score += magBonus * Math.max(0, 1 - dist / zone.radius);
					if (s.magnitude >= 4) activeEvents++;
				}
			}

			// Fire events — lower weight
			let fireCount = 0;
			for (const f of fires) {
				const dist = haversine(zone.lat, zone.lon, f.latitude, f.longitude);
				if (dist < zone.radius) fireCount++;
			}
			if (fireCount > 10) score += Math.min(10, fireCount / 5);

			// GDELT intelligence — medium weight
			for (const g of gdelt) {
				const dist = haversine(zone.lat, zone.lon, g.latitude, g.longitude);
				if (dist < zone.radius) {
					const catBonus = g.category === "nuclear" ? 6 : g.category === "conflict" ? 4 : g.category === "cyber" ? 3 : 2;
					score += catBonus * Math.max(0, 1 - dist / zone.radius);
					activeEvents++;
				}
			}

			// Cyber threats — lower weight
			for (const t of cyber) {
				const dist = haversine(zone.lat, zone.lon, t.latitude, t.longitude);
				if (dist < zone.radius) {
					score += (t.severity === "critical" ? 4 : 2) * Math.max(0, 1 - dist / zone.radius);
					activeEvents++;
				}
			}

			// Clamp to 0-100
			score = Math.min(100, Math.max(0, Math.round(score)));

			await ctx.runMutation(internal.entitiesInternal.upsertThreatZone, {
				name: zone.name,
				latitude: zone.lat,
				longitude: zone.lon,
				radius: zone.radius,
				baseScore: zone.baseScore,
				currentScore: score,
				type: zone.type,
				activeEvents,
				lastUpdated: Date.now(),
			});
		}

		return { success: true, zones: THREAT_ZONES.length };
	},
});
