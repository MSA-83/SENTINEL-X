"use node";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

/**
 * ISS Live Position — wheretheiss.at API (FREE, no key)
 * Updates every 30s for real-time ISS tracking
 */
export const fetchISSPosition = internalAction({
	args: {},
	handler: async (ctx) => {
		try {
			const res = await fetch("https://api.wheretheiss.at/v1/satellites/25544", {
				signal: AbortSignal.timeout(10000),
			});
			if (!res.ok) throw new Error(`ISS API ${res.status}`);
			const data = await res.json();

			await ctx.runMutation(internal.entitiesInternal.insertISSPosition, {
				latitude: data.latitude,
				longitude: data.longitude,
				altitude: data.altitude,
				velocity: data.velocity,
				visibility: data.visibility || "unknown",
				timestamp: Date.now(),
			});

			await ctx.runMutation(internal.entitiesInternal.upsertSourceStatus, {
				sourceId: "iss",
				name: "ISS Tracker",
				status: "live",
				lastFetch: Date.now(),
				recordCount: 1,
			});

			return { success: true, lat: data.latitude, lon: data.longitude };
		} catch (e: any) {
			await ctx.runMutation(internal.entitiesInternal.upsertSourceStatus, {
				sourceId: "iss",
				name: "ISS Tracker",
				status: "error",
				lastFetch: Date.now(),
				recordCount: 0,
				errorMessage: e.message,
			});
			return { success: false, error: e.message };
		}
	},
});
