/**
 * NASA FIRMS — Active Fire / Thermal Anomaly Detection
 * Polls VIIRS SNPP NRT data for global fire hotspots.
 * https://firms.modaps.eosdis.nasa.gov/api/
 */
import { internalAction, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

interface FIRMSRecord {
	latitude: number;
	longitude: number;
	brightness: number;
	confidence: string;
	frp: number;
	satellite: string;
	acq_date: string;
	daynight: string;
}

export const fetchFires = internalAction({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		const apiKey = process.env.NASA_FIRMS_KEY;
		if (!apiKey) {
			await ctx.runMutation(internal.integrations.helpers.updateSourceStatus, {
				sourceId: "firms", name: "NASA FIRMS", status: "error", recordCount: 0,
				errorMessage: "Missing NASA_FIRMS_KEY",
			});
			return null;
		}

		try {
			// Fetch last 24h of VIIRS SNPP NRT fire data (limited area for perf)
			// World data can be huge so we focus on hotspot regions
			const regions = [
				{ name: "MENA", area: "-10,0,65,55" },
				{ name: "Africa", area: "-20,-35,55,20" },
				{ name: "Europe", area: "-15,35,45,72" },
			];

			const allFires: FIRMSRecord[] = [];

			for (const region of regions) {
				const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${apiKey}/VIIRS_SNPP_NRT/${region.area}/1`;
				const resp = await fetch(url);
				if (!resp.ok) continue;

				const text = await resp.text();
				const lines = text.trim().split("\n");
				if (lines.length < 2) continue;

				const headers = lines[0].split(",");
				const latIdx = headers.indexOf("latitude");
				const lonIdx = headers.indexOf("longitude");
				const brightIdx = headers.indexOf("bright_ti4");
				const confIdx = headers.indexOf("confidence");
				const frpIdx = headers.indexOf("frp");
				const satIdx = headers.indexOf("satellite");
				const dateIdx = headers.indexOf("acq_date");
				const dnIdx = headers.indexOf("daynight");

				for (let i = 1; i < Math.min(lines.length, 500); i++) {
					const cols = lines[i].split(",");
					if (cols.length < headers.length) continue;
					allFires.push({
						latitude: Number.parseFloat(cols[latIdx]),
						longitude: Number.parseFloat(cols[lonIdx]),
						brightness: Number.parseFloat(cols[brightIdx]) || 300,
						confidence: cols[confIdx] || "nominal",
						frp: Number.parseFloat(cols[frpIdx]) || 0,
						satellite: cols[satIdx] || "VIIRS",
						acq_date: cols[dateIdx] || new Date().toISOString().slice(0, 10),
						daynight: cols[dnIdx] || "D",
					});
				}
			}

			await ctx.runMutation(internal.integrations.firms.storeFires, { fires: allFires });
			await ctx.runMutation(internal.integrations.helpers.updateSourceStatus, {
				sourceId: "firms", name: "NASA FIRMS", status: "online", recordCount: allFires.length,
			});
			await ctx.runMutation(internal.integrations.helpers.upsertStat, { key: "fireHotspots", value: allFires.length });
		} catch (e) {
			await ctx.runMutation(internal.integrations.helpers.updateSourceStatus, {
				sourceId: "firms", name: "NASA FIRMS", status: "error", recordCount: 0,
				errorMessage: String(e),
			});
		}
		return null;
	},
});

export const storeFires = internalMutation({
	args: {
		fires: v.array(v.object({
			latitude: v.number(),
			longitude: v.number(),
			brightness: v.number(),
			confidence: v.string(),
			frp: v.number(),
			satellite: v.string(),
			acq_date: v.string(),
			daynight: v.string(),
		})),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		// Clear old fire data
		const old = await ctx.db.query("fires").collect();
		for (const f of old) {
			await ctx.db.delete(f._id);
		}

		const now = Date.now();
		for (const fire of args.fires) {
			await ctx.db.insert("fires", {
				sourceId: `firms-${fire.latitude.toFixed(4)}-${fire.longitude.toFixed(4)}-${fire.acq_date}`,
				latitude: fire.latitude,
				longitude: fire.longitude,
				brightness: fire.brightness,
				confidence: fire.confidence,
				frp: fire.frp,
				satellite: fire.satellite,
				acqDate: fire.acq_date,
				dayNight: fire.daynight,
				timestamp: now,
			});
		}
		return null;
	},
});
