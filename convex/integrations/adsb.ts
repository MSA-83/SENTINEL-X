/**
 * ADS-B Exchange via RapidAPI — Live aircraft tracking
 * https://rapidapi.com/adsbx/api/adsbexchange-com1
 */
import { internalAction, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

interface AircraftData {
	icao24: string;
	callsign: string;
	originCountry: string;
	latitude: number;
	longitude: number;
	baroAltitude: number;
	geoAltitude: number;
	velocity: number;
	heading: number;
	verticalRate: number;
	onGround: boolean;
	squawk: string;
}

export const fetchAircraft = internalAction({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		const rapidApiKey = process.env.RAPIDAPI_KEY;
		if (!rapidApiKey) {
			await ctx.runMutation(internal.integrations.helpers.updateSourceStatus, {
				sourceId: "adsb", name: "ADS-B Exchange", status: "error", recordCount: 0,
				errorMessage: "Missing RAPIDAPI_KEY",
			});
			return null;
		}

		try {
			const aircraft: AircraftData[] = [];

			// Fetch military/interesting areas using bounding box
			const boxes = [
				{ name: "Eastern Med", lat: 35, lon: 33, dist: 250 },
				{ name: "Black Sea", lat: 44, lon: 34, dist: 250 },
				{ name: "Persian Gulf", lat: 26, lon: 53, dist: 250 },
				{ name: "Baltic", lat: 58, lon: 22, dist: 200 },
			];

			for (const box of boxes) {
				try {
					const url = `https://adsbexchange-com1.p.rapidapi.com/v2/lat/${box.lat}/lon/${box.lon}/dist/${box.dist}/`;
					const resp = await fetch(url, {
						headers: {
							"X-RapidAPI-Key": rapidApiKey,
							"X-RapidAPI-Host": "adsbexchange-com1.p.rapidapi.com",
						},
					});

					if (!resp.ok) continue;
					const data = await resp.json();

					for (const ac of (data.ac ?? []).slice(0, 25)) {
						if (!ac.lat || !ac.lon) continue;
						aircraft.push({
							icao24: ac.hex || ac.icao || `unk-${Math.random().toString(36).slice(2, 8)}`,
							callsign: ac.flight?.trim() || ac.r || "UNKNOWN",
							originCountry: ac.r || "Unknown",
							latitude: Number(ac.lat),
							longitude: Number(ac.lon),
							baroAltitude: ac.alt_baro === "ground" ? 0 : Number(ac.alt_baro) * 0.3048 || 0,
							geoAltitude: Number(ac.alt_geom) * 0.3048 || 0,
							velocity: Number(ac.gs) * 0.514444 || 0, // kts → m/s
							heading: Number(ac.track) || 0,
							verticalRate: Number(ac.baro_rate) * 0.00508 || 0,
							onGround: ac.alt_baro === "ground",
							squawk: ac.squawk || "",
						});
					}
				} catch {
					// Individual box failed
				}
			}

			if (aircraft.length > 0) {
				await ctx.runMutation(internal.integrations.adsb.storeAircraft, { aircraft });
			}

			await ctx.runMutation(internal.integrations.helpers.updateSourceStatus, {
				sourceId: "adsb",
				name: "ADS-B Exchange",
				status: aircraft.length > 0 ? "online" : "degraded",
				recordCount: aircraft.length,
			});
			await ctx.runMutation(internal.integrations.helpers.upsertStat, { key: "liveAircraft", value: aircraft.length });
		} catch (e) {
			await ctx.runMutation(internal.integrations.helpers.updateSourceStatus, {
				sourceId: "adsb", name: "ADS-B Exchange", status: "error", recordCount: 0,
				errorMessage: String(e),
			});
		}
		return null;
	},
});

export const storeAircraft = internalMutation({
	args: {
		aircraft: v.array(v.object({
			icao24: v.string(),
			callsign: v.string(),
			originCountry: v.string(),
			latitude: v.number(),
			longitude: v.number(),
			baroAltitude: v.number(),
			geoAltitude: v.number(),
			velocity: v.number(),
			heading: v.number(),
			verticalRate: v.number(),
			onGround: v.boolean(),
			squawk: v.string(),
		})),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const now = Date.now();
		for (const ac of args.aircraft) {
			const existing = await ctx.db
				.query("aircraft")
				.withIndex("by_icao24", (q) => q.eq("icao24", ac.icao24))
				.first();

			const data = {
				...ac,
				jammingFlag: false,
				lastUpdate: now,
				source: "adsb_live" as const,
			};

			if (existing) {
				await ctx.db.patch(existing._id, data);
			} else {
				await ctx.db.insert("aircraft", data);
			}
		}
		return null;
	},
});
