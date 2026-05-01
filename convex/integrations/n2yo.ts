/**
 * N2YO — Satellite position tracking
 * https://www.n2yo.com/api/
 * 
 * Circuit breaker: If 5 consecutive failures, circuit opens and returns cached data
 */
import { internalAction, internalMutation } from "../_generated/server";
import { internal, api } from "../_generated/api";
import { v } from "convex/values";
import { resolveEnv } from "../lib/envHelper";

// Notable satellites to track
const TRACKED_SATS = [
	{ id: "25544", name: "ISS (ZARYA)" },
	{ id: "48274", name: "CSS (Tianhe)" },
	{ id: "49260", name: "Sentinel-1A" },
	{ id: "43013", name: "Sentinel-2B" },
	{ id: "41240", name: "Sentinel-3A" },
	{ id: "28654", name: "NOAA-18" },
	{ id: "33591", name: "NOAA-19" },
	{ id: "27424", name: "Aqua (EOS-PM1)" },
	{ id: "25994", name: "Terra (EOS-AM1)" },
	{ id: "43226", name: "Starlink-24" },
];

interface SatPos {
	satId: string;
	satName: string;
	latitude: number;
	longitude: number;
	altitude: number;
	velocity: number;
}

export const fetchSatellites = internalAction({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		const _cfg = await ctx.runQuery(api.lib.envHelper.getAllConfig);
		const apiKey = resolveEnv(_cfg, "N2YO_KEY");
		if (!apiKey) {
			await ctx.runMutation(internal.integrations.helpers.updateSourceStatus, {
				sourceId: "n2yo", name: "N2YO Satellites", status: "error", recordCount: 0,
				errorMessage: "Missing N2YO_KEY",
			});
			return null;
		}

		try {
			const positions: SatPos[] = [];

			for (const sat of TRACKED_SATS) {
				try {
					// Observer at 0,0 alt 0m, predict 1 second ahead
					const url = `https://api.n2yo.com/rest/v1/satellite/positions/${sat.id}/0/0/0/1&apiKey=${apiKey}`;
					const resp = await fetch(url);
					if (!resp.ok) continue;
					const data = await resp.json();

					if (data.positions && data.positions.length > 0) {
						const pos = data.positions[0];
						positions.push({
							satId: sat.id,
							satName: data.info?.satname || sat.name,
							latitude: pos.satlatitude,
							longitude: pos.satlongitude,
							altitude: pos.sataltitude,
							velocity: pos.azimuth || 0, // use azimuth as proxy for ground track
						});
					}
				} catch {
					// Individual sat fetch failed, continue
				}
			}

			await ctx.runMutation(internal.integrations.n2yo.storeSatellites, { positions });
			await ctx.runMutation(internal.integrations.helpers.updateCircuitBreaker, {
				sourceId: "n2yo",
				success: positions.length > 0,
				recordCount: positions.length,
			});
			await ctx.runMutation(internal.integrations.helpers.upsertStat, { key: "satellitePasses", value: positions.length });
		} catch (e) {
			await ctx.runMutation(internal.integrations.helpers.updateCircuitBreaker, {
				sourceId: "n2yo",
				success: false,
				errorMessage: String(e),
			});
		}
		return null;
	},
});

export const storeSatellites = internalMutation({
	args: {
		positions: v.array(v.object({
			satId: v.string(),
			satName: v.string(),
			latitude: v.number(),
			longitude: v.number(),
			altitude: v.number(),
			velocity: v.number(),
		})),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const now = Date.now();
		for (const pos of args.positions) {
			const existing = await ctx.db
				.query("satellitePositions")
				.withIndex("by_satId", (q) => q.eq("satId", pos.satId))
				.first();

			const data = { ...pos, timestamp: now };

			if (existing) {
				await ctx.db.patch(existing._id, data);
			} else {
				await ctx.db.insert("satellitePositions", data);
			}
		}
		return null;
	},
});
