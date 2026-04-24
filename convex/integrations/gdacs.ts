"use node";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

/** Fetch GDACS disaster events — FREE, no API key */
export const fetchDisasters = internalAction({
	args: {},
	handler: async (ctx) => {
		const url = "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?alertlevel=green;orange;red&eventlist=EQ;TC;FL;VO;TS;DR;WF&limit=60";
		try {
			const res = await fetch(url, {
				headers: { Accept: "application/json" },
				signal: AbortSignal.timeout(20000),
			});
			if (!res.ok) throw new Error(`GDACS ${res.status}`);
			const data = await res.json();

			const features = data.features || [];
			const events = features.slice(0, 60).map((f: any, i: number) => {
				const p = f.properties || {};
				const coords = f.geometry?.coordinates || [0, 0];
				const alertLevel = (p.alertlevel || "green").toLowerCase();
				const severity = alertLevel === "red" ? "critical" : alertLevel === "orange" ? "high" : "medium";
				return {
					eventId: `gdacs_${p.eventid || i}`,
					title: p.name || p.eventname || `Event ${i}`,
					eventType: p.eventtype || "UNKNOWN",
					latitude: coords[1] || 0,
					longitude: coords[0] || 0,
					severity,
					alertLevel,
					country: p.country || "Unknown",
					description: p.description || p.htmldescription || "",
					source: "gdacs",
					url: typeof p.url === "string" ? p.url : (typeof p.link === "string" ? p.link : (p.url?.details || p.url?.detail || p.url?.href || (typeof p.url === "object" ? JSON.stringify(p.url) : String(p.url || "")))),
					fromDate: p.fromdate || new Date().toISOString(),
					timestamp: Date.now(),
				};
			});

			for (const ev of events) {
				const existing = await ctx.runQuery(internal.entitiesInternal.findDisasterByEventId, { eventId: ev.eventId });
				if (existing) {
					await ctx.runMutation(internal.entitiesInternal.updateDisaster, { id: existing._id, ...ev });
				} else {
					await ctx.runMutation(internal.entitiesInternal.insertDisaster, ev);
				}
			}

			await ctx.runMutation(internal.entitiesInternal.upsertSourceStatus, {
				sourceId: "gdacs",
				name: "GDACS Disasters",
				status: "live",
				lastFetch: Date.now(),
				recordCount: events.length,
			});

			return { success: true, count: events.length };
		} catch (e: any) {
			await ctx.runMutation(internal.entitiesInternal.upsertSourceStatus, {
				sourceId: "gdacs",
				name: "GDACS Disasters",
				status: "error",
				lastFetch: Date.now(),
				recordCount: 0,
				errorMessage: e.message,
			});
			return { success: false, error: e.message };
		}
	},
});
