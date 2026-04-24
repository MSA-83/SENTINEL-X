import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ==================== AIRCRAFT ====================

export const listAircraft = query({
	args: {},
	handler: async (ctx) => {
		return await ctx.db.query("aircraft").collect();
	},
});

export const getJammingAircraft = query({
	args: {},
	handler: async (ctx) => {
		return await ctx.db
			.query("aircraft")
			.withIndex("by_jamming", (q) => q.eq("jammingFlag", true))
			.collect();
	},
});

export const updateAircraftPosition = mutation({
	args: {
		id: v.id("aircraft"),
		longitude: v.number(),
		latitude: v.number(),
		baroAltitude: v.number(),
		heading: v.number(),
		velocity: v.number(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await ctx.db.patch(args.id, {
			longitude: args.longitude,
			latitude: args.latitude,
			baroAltitude: args.baroAltitude,
			heading: args.heading,
			velocity: args.velocity,
			lastUpdate: Date.now(),
		});
		return null;
	},
});

// ==================== CONFLICT EVENTS ====================

export const listConflictEvents = query({
	args: {},
	handler: async (ctx) => {
		return await ctx.db.query("conflictEvents").collect();
	},
});

export const getConflictsBySeverity = query({
	args: { severity: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("conflictEvents")
			.withIndex("by_severity", (q) => q.eq("severity", args.severity))
			.collect();
	},
});

// ==================== JAMMING ALERTS ====================

export const listJammingAlerts = query({
	args: {},
	handler: async (ctx) => {
		return await ctx.db.query("jammingAlerts").collect();
	},
});

export const getActiveJammingAlerts = query({
	args: {},
	handler: async (ctx) => {
		return await ctx.db
			.query("jammingAlerts")
			.withIndex("by_status", (q) => q.eq("status", "active"))
			.collect();
	},
});

// ==================== SATELLITE SCENES ====================

export const listSatelliteScenes = query({
	args: {},
	handler: async (ctx) => {
		return await ctx.db.query("satelliteScenes").collect();
	},
});

// ==================== SYSTEM ALERTS ====================

export const listSystemAlerts = query({
	args: {},
	handler: async (ctx) => {
		return await ctx.db.query("systemAlerts").collect();
	},
});

export const acknowledgeAlert = mutation({
	args: { id: v.id("systemAlerts") },
	returns: v.null(),
	handler: async (ctx, args) => {
		await ctx.db.patch(args.id, { acknowledged: true });
		return null;
	},
});

// ==================== PLATFORM STATS ====================

export const getStats = query({
	args: {},
	handler: async (ctx) => {
		return await ctx.db.query("platformStats").collect();
	},
});

// ==================== SIMULATE UPDATES ====================

export const simulateAircraftMovement = mutation({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		const aircraft = await ctx.db.query("aircraft").collect();
		const now = Date.now();

		for (const ac of aircraft) {
			const headingRad = (ac.heading * Math.PI) / 180;
			const speedDeg = (ac.velocity / 111320) * 5;
			const newLat = ac.latitude + Math.cos(headingRad) * speedDeg + (Math.random() - 0.5) * 0.002;
			const newLon = ac.longitude + Math.sin(headingRad) * speedDeg + (Math.random() - 0.5) * 0.002;
			const newHeading = ac.heading + (Math.random() - 0.5) * 3;
			const newAlt = ac.baroAltitude + (Math.random() - 0.5) * 50;

			await ctx.db.patch(ac._id, {
				latitude: newLat,
				longitude: newLon,
				heading: ((newHeading % 360) + 360) % 360,
				baroAltitude: Math.max(0, newAlt),
				lastUpdate: now,
			});
		}
		return null;
	},
});

// ==================== NEW: LIVE DATA QUERIES ====================

/** Fires — NASA FIRMS thermal anomalies */
export const listFires = query({
	args: {},
	handler: async (ctx) => {
		return await ctx.db.query("fires").collect();
	},
});

/** Vessels — AIS / GFW maritime tracking */
export const listVessels = query({
	args: {},
	handler: async (ctx) => {
		return await ctx.db.query("vessels").collect();
	},
});

/** News Items — Geo-tagged OSINT feed */
export const listNewsItems = query({
	args: {},
	handler: async (ctx) => {
		return await ctx.db.query("newsItems").order("desc").take(40);
	},
});

/** Cyber Threats — Shodan + Abuse.ch */
export const listCyberThreats = query({
	args: {},
	handler: async (ctx) => {
		return await ctx.db.query("cyberThreats").collect();
	},
});

/** Weather Data — OpenWeatherMap AOI snapshots */
export const listWeatherData = query({
	args: {},
	handler: async (ctx) => {
		return await ctx.db.query("weatherData").collect();
	},
});

/** Satellite Positions — N2YO orbital tracking */
export const listSatellitePositions = query({
	args: {},
	handler: async (ctx) => {
		return await ctx.db.query("satellitePositions").collect();
	},
});

/** Data Source Health — All integration statuses */
export const listDataSourceStatus = query({
	args: {},
	handler: async (ctx) => {
		return await ctx.db.query("dataSourceStatus").collect();
	},
});

// ==================== PHASE 3: NEW SOURCES ====================

/** Seismic Events — USGS earthquakes */
export const listSeismicEvents = query({
	args: {},
	handler: async (ctx) => {
		return await ctx.db.query("seismicEvents").withIndex("by_timestamp").order("desc").take(200);
	},
});

/** Disasters — GDACS + ReliefWeb */
export const listDisasters = query({
	args: {},
	handler: async (ctx) => {
		return await ctx.db.query("disasters").withIndex("by_timestamp").order("desc").take(60);
	},
});

/** ISS Position — Live orbital tracking */
export const listISSPositions = query({
	args: {},
	handler: async (ctx) => {
		return await ctx.db.query("issPosition").withIndex("by_timestamp").order("desc").take(20);
	},
});

/** Social Posts — Reddit OSINT */
export const listSocialPosts = query({
	args: {},
	handler: async (ctx) => {
		return await ctx.db.query("socialPosts").withIndex("by_timestamp").order("desc").take(60);
	},
});

/** GDELT Events — Multi-domain intelligence */
export const listGdeltEvents = query({
	args: {},
	handler: async (ctx) => {
		return await ctx.db.query("gdeltEvents").withIndex("by_timestamp").order("desc").take(100);
	},
});

export const listGdeltByCategory = query({
	args: { category: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db.query("gdeltEvents")
			.withIndex("by_category", (q) => q.eq("category", args.category))
			.order("desc")
			.take(50);
	},
});

/** Cyber Intel — CISA KEV + URLhaus + ThreatFox */
export const listCyberIntel = query({
	args: {},
	handler: async (ctx) => {
		return await ctx.db.query("cyberIntel").withIndex("by_timestamp").order("desc").take(50);
	},
});

/** Threat Zones — Pre-computed fusion scores */
export const listThreatZones = query({
	args: {},
	handler: async (ctx) => {
		return await ctx.db.query("threatZones").collect();
	},
});

/** Global search across all entity types */
export const searchEntities = query({
	args: { searchTerm: v.string() },
	handler: async (ctx, args) => {
		const term = args.searchTerm.toLowerCase();
		if (term.length < 2) return [];
		const results: Array<{ type: string; id: string; title: string; subtitle: string; lat?: number; lon?: number }> = [];

		// Search aircraft
		const aircraft = await ctx.db.query("aircraft").collect();
		for (const ac of aircraft) {
			if (ac.callsign?.toLowerCase().includes(term) || ac.icao24?.toLowerCase().includes(term)) {
				results.push({ type: "aircraft", id: ac.icao24, title: `✈ ${ac.callsign}`, subtitle: `${ac.originCountry} | ICAO: ${ac.icao24}`, lat: ac.latitude, lon: ac.longitude });
			}
		}

		// Search vessels
		const vessels = await ctx.db.query("vessels").collect();
		for (const v of vessels) {
			if (v.name?.toLowerCase().includes(term) || v.mmsi?.includes(term)) {
				results.push({ type: "vessel", id: v.mmsi, title: `🚢 ${v.name}`, subtitle: `MMSI: ${v.mmsi} | ${v.flag}`, lat: v.latitude, lon: v.longitude });
			}
		}

		// Search conflicts
		const conflicts = await ctx.db.query("conflictEvents").collect();
		for (const c of conflicts) {
			if (c.location?.toLowerCase().includes(term) || c.country?.toLowerCase().includes(term)) {
				results.push({ type: "conflict", id: c.eventId, title: `⚔ ${c.eventType}`, subtitle: `${c.location}, ${c.country}`, lat: c.latitude, lon: c.longitude });
			}
		}

		// Search disasters
		const disasters = await ctx.db.query("disasters").collect();
		for (const d of disasters) {
			if (d.title?.toLowerCase().includes(term) || d.country?.toLowerCase().includes(term)) {
				results.push({ type: "disaster", id: d.eventId, title: `⚠ ${d.title}`, subtitle: `${d.eventType} | ${d.country}`, lat: d.latitude, lon: d.longitude });
			}
		}

		return results.slice(0, 20);
	},
});

// ==================== PHASE 3: NEW FROM REFERENCE REPO ====================

export const globalSearch = query({
	args: { term: v.string() },
	handler: async (ctx, { term }) => {
		if (!term || term.length < 2) return [];
		const lower = term.toLowerCase();
		const results: Array<{ id: string; type: string; title: string; lat?: number; lon?: number }> = [];

		// Search aircraft by callsign
		const aircraft = await ctx.db.query("aircraft").collect();
		for (const ac of aircraft) {
			if (ac.callsign.toLowerCase().includes(lower) || ac.icao24.toLowerCase().includes(lower)) {
				results.push({ id: ac._id, type: "aircraft", title: `${ac.callsign} (${ac.icao24})`, lat: ac.latitude, lon: ac.longitude });
			}
			if (results.length >= 20) break;
		}

		// Search conflicts
		const conflicts = await ctx.db.query("conflictEvents").collect();
		for (const c of conflicts) {
			if (c.location.toLowerCase().includes(lower) || c.country.toLowerCase().includes(lower) || c.actor1.toLowerCase().includes(lower)) {
				results.push({ id: c._id, type: "conflict", title: `${c.eventType}: ${c.location}`, lat: c.latitude, lon: c.longitude });
			}
			if (results.length >= 30) break;
		}

		// Search seismic
		const quakes = await ctx.db.query("seismicEvents").collect();
		for (const q of quakes) {
			if (q.place.toLowerCase().includes(lower)) {
				results.push({ id: q._id, type: "seismic", title: `M${q.magnitude} ${q.place}`, lat: q.latitude, lon: q.longitude });
			}
			if (results.length >= 40) break;
		}

		// Search disasters
		const disasters = await ctx.db.query("disasters").collect();
		for (const d of disasters) {
			if (d.title.toLowerCase().includes(lower) || d.country.toLowerCase().includes(lower)) {
				results.push({ id: d._id, type: "disaster", title: d.title, lat: d.latitude, lon: d.longitude });
			}
			if (results.length >= 50) break;
		}

		return results.slice(0, 20);
	},
});
