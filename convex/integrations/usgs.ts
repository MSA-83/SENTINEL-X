"use node";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

/** Fetch USGS earthquake data — FREE, no API key needed */
export const fetchEarthquakes = internalAction({
	args: {},
	handler: async (ctx) => {
		const url = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson";
		try {
			const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
			if (!res.ok) throw new Error(`USGS ${res.status}`);
			const data = await res.json();

			const events = data.features.slice(0, 200).map((f: any, i: number) => {
				const p = f.properties;
				const [lon, lat, depth] = f.geometry.coordinates;
				const mag = p.mag || 0;
				const severity = mag >= 6 ? "critical" : mag >= 5 ? "high" : mag >= 4 ? "medium" : "low";
				return {
					eventId: f.id || `usgs_${i}`,
					latitude: lat,
					longitude: lon,
					depth: depth || 0,
					magnitude: mag,
					magType: p.magType || "ml",
					place: p.place || "Unknown",
					time: p.time || Date.now(),
					tsunami: p.tsunami === 1,
					severity,
					url: p.url || "",
					timestamp: Date.now(),
				};
			});

			// Upsert into DB
			for (const ev of events) {
				const existing = await ctx.runQuery(internal.entitiesInternal.findSeismicByEventId, { eventId: ev.eventId });
				if (existing) {
					await ctx.runMutation(internal.entitiesInternal.updateSeismic, { id: existing._id, ...ev });
				} else {
					await ctx.runMutation(internal.entitiesInternal.insertSeismic, ev);
				}
			}

			await ctx.runMutation(internal.entitiesInternal.upsertSourceStatus, {
				sourceId: "usgs",
				name: "USGS Earthquakes",
				status: "live",
				lastFetch: Date.now(),
				recordCount: events.length,
			});

			return { success: true, count: events.length };
		} catch (e: any) {
			await ctx.runMutation(internal.entitiesInternal.upsertSourceStatus, {
				sourceId: "usgs",
				name: "USGS Earthquakes",
				status: "error",
				lastFetch: Date.now(),
				recordCount: 0,
				errorMessage: e.message,
			});
			return { success: false, error: e.message };
		}
	},
});
