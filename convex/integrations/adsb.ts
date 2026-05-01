/**
 * ADS-B Exchange via RapidAPI — Live aircraft tracking
 * https://rapidapi.com/adsbx/api/adsbexchange-com1
 * 
 * Circuit breaker: If 5 consecutive failures, circuit opens and returns cached data
 */
import { internalAction, internalMutation } from "../_generated/server";
import { internal, api } from "../_generated/api";
import { v } from "convex/values";
import { resolveEnv } from "../lib/envHelper";

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
		const _cfg = await ctx.runQuery(api.lib.envHelper.getAllConfig);
		const rapidApiKey = resolveEnv(_cfg, "RAPIDAPI_KEY");
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
						signal: AbortSignal.timeout(15000),
					});

					if (!resp.ok) {
						const errText = await resp.text().catch(() => "");
						console.log(`ADS-B ${box.name}: HTTP ${resp.status} - ${errText.slice(0, 200)}`);
						continue;
					}
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

			// Fallback to OpenSky Network (FREE, no key needed) if RapidAPI returned nothing
			if (aircraft.length === 0) {
				try {
					const osBounds = [
						{ name: "Eastern Med", lamin: 30, lomin: 28, lamax: 40, lomax: 38 },
						{ name: "Black Sea", lamin: 40, lomin: 28, lamax: 48, lomax: 42 },
						{ name: "Persian Gulf", lamin: 22, lomin: 48, lamax: 30, lomax: 58 },
						{ name: "Baltic", lamin: 54, lomin: 16, lamax: 62, lomax: 28 },
					];
					for (const b of osBounds) {
						try {
							const osUrl = `https://opensky-network.org/api/states/all?lamin=${b.lamin}&lomin=${b.lomin}&lamax=${b.lamax}&lomax=${b.lomax}`;
							const osResp = await fetch(osUrl, { signal: AbortSignal.timeout(10000) });
							if (!osResp.ok) continue;
							const osData = await osResp.json();
							for (const s of (osData.states || []).slice(0, 25)) {
								if (!s[6] || !s[5]) continue;
								aircraft.push({
									icao24: s[0] || `os-${Math.random().toString(36).slice(2,8)}`,
									callsign: (s[1] || "").trim() || "UNKNOWN",
									originCountry: s[2] || "Unknown",
									latitude: Number(s[6]),
									longitude: Number(s[5]),
									baroAltitude: Number(s[7]) || 0,
									geoAltitude: Number(s[13]) || 0,
									velocity: Number(s[9]) || 0,
									heading: Number(s[10]) || 0,
									verticalRate: Number(s[11]) || 0,
									onGround: Boolean(s[8]),
									squawk: s[14] || "",
								});
							}
						} catch { /* individual OpenSky box failed */ }
					}
				} catch { /* OpenSky fallback failed entirely */ }
			}

			if (aircraft.length > 0) {
				await ctx.runMutation(internal.integrations.adsb.storeAircraft, { aircraft });
			}

			await ctx.runMutation(internal.integrations.helpers.updateCircuitBreaker, {
				sourceId: "adsb",
				success: aircraft.length > 0,
				recordCount: aircraft.length,
			});
			await ctx.runMutation(internal.integrations.helpers.upsertStat, { key: "liveAircraft", value: aircraft.length });
		} catch (e) {
			await ctx.runMutation(internal.integrations.helpers.updateCircuitBreaker, {
				sourceId: "adsb",
				success: false,
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
			const icaoKey = ac.icao24.toUpperCase();
			const existing = await ctx.db
				.query("aircraft")
				.withIndex("by_icao24", (q) => q.eq("icao24", icaoKey))
				.first();

			const data = {
				...ac,
				icao24: icaoKey,
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
