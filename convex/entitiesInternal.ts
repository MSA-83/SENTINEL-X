import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// ==================== SEISMIC ====================
export const findSeismicByEventId = internalQuery({
	args: { eventId: v.string() },
	handler: async (ctx, { eventId }) => {
		return await ctx.db.query("seismicEvents").withIndex("by_eventId", (q) => q.eq("eventId", eventId)).first();
	},
});
export const insertSeismic = internalMutation({
	args: { eventId: v.string(), latitude: v.number(), longitude: v.number(), depth: v.number(), magnitude: v.number(), magType: v.string(), place: v.string(), time: v.number(), tsunami: v.boolean(), severity: v.string(), url: v.string(), timestamp: v.number() },
	handler: async (ctx, args) => { await ctx.db.insert("seismicEvents", args); },
});
export const updateSeismic = internalMutation({
	args: { id: v.id("seismicEvents"), eventId: v.string(), latitude: v.number(), longitude: v.number(), depth: v.number(), magnitude: v.number(), magType: v.string(), place: v.string(), time: v.number(), tsunami: v.boolean(), severity: v.string(), url: v.string(), timestamp: v.number() },
	handler: async (ctx, { id, ...rest }) => { await ctx.db.patch(id, rest); },
});

// ==================== DISASTERS ====================
export const findDisasterByEventId = internalQuery({
	args: { eventId: v.string() },
	handler: async (ctx, { eventId }) => {
		return await ctx.db.query("disasters").withIndex("by_eventId", (q) => q.eq("eventId", eventId)).first();
	},
});
export const insertDisaster = internalMutation({
	args: { eventId: v.string(), title: v.string(), eventType: v.string(), latitude: v.number(), longitude: v.number(), severity: v.string(), alertLevel: v.string(), country: v.string(), description: v.string(), source: v.string(), url: v.optional(v.string()), fromDate: v.string(), timestamp: v.number() },
	handler: async (ctx, args) => { await ctx.db.insert("disasters", args); },
});
export const updateDisaster = internalMutation({
	args: { id: v.id("disasters"), eventId: v.string(), title: v.string(), eventType: v.string(), latitude: v.number(), longitude: v.number(), severity: v.string(), alertLevel: v.string(), country: v.string(), description: v.string(), source: v.string(), url: v.optional(v.string()), fromDate: v.string(), timestamp: v.number() },
	handler: async (ctx, { id, ...rest }) => { await ctx.db.patch(id, rest); },
});

// ==================== SOCIAL POSTS ====================
export const findSocialByPostId = internalQuery({
	args: { postId: v.string() },
	handler: async (ctx, { postId }) => {
		return await ctx.db.query("socialPosts").withIndex("by_postId", (q) => q.eq("postId", postId)).first();
	},
});
export const insertSocial = internalMutation({
	args: { postId: v.string(), subreddit: v.string(), title: v.string(), url: v.string(), author: v.string(), score: v.number(), numComments: v.number(), permalink: v.string(), thumbnail: v.optional(v.string()), latitude: v.optional(v.number()), longitude: v.optional(v.number()), provenance: v.string(), confidence: v.number(), timestamp: v.number() },
	handler: async (ctx, args) => { await ctx.db.insert("socialPosts", args); },
});
export const updateSocial = internalMutation({
	args: { id: v.id("socialPosts"), postId: v.string(), subreddit: v.string(), title: v.string(), url: v.string(), author: v.string(), score: v.number(), numComments: v.number(), permalink: v.string(), thumbnail: v.optional(v.string()), latitude: v.optional(v.number()), longitude: v.optional(v.number()), provenance: v.string(), confidence: v.number(), timestamp: v.number() },
	handler: async (ctx, { id, ...rest }) => { await ctx.db.patch(id, rest); },
});

// ==================== CYBER INTEL ====================
export const findCyberIntelById = internalQuery({
	args: { intelId: v.string() },
	handler: async (ctx, { intelId }) => {
		return await ctx.db.query("cyberIntel").withIndex("by_intelId", (q) => q.eq("intelId", intelId)).first();
	},
});
export const insertCyberIntel = internalMutation({
	args: { intelId: v.string(), type: v.string(), title: v.string(), description: v.string(), severity: v.string(), source: v.string(), sourceUrl: v.optional(v.string()), indicator: v.optional(v.string()), tags: v.optional(v.array(v.string())), timestamp: v.number() },
	handler: async (ctx, args) => { await ctx.db.insert("cyberIntel", args); },
});

// ==================== GDELT ====================
export const insertGdeltEvent = internalMutation({
	args: { eventId: v.string(), title: v.string(), category: v.string(), latitude: v.number(), longitude: v.number(), sourceUrl: v.string(), sourceName: v.string(), confidence: v.number(), provenance: v.string(), severity: v.string(), timestamp: v.number() },
	handler: async (ctx, args) => { await ctx.db.insert("gdeltEvents", args); },
});
export const findGdeltByEventId = internalQuery({
	args: { eventId: v.string() },
	handler: async (ctx, { eventId }) => {
		return await ctx.db.query("gdeltEvents").withIndex("by_eventId", (q) => q.eq("eventId", eventId)).first();
	},
});
export const insertGdelt = internalMutation({
	args: { eventId: v.string(), title: v.string(), category: v.string(), latitude: v.number(), longitude: v.number(), sourceUrl: v.string(), sourceName: v.string(), confidence: v.number(), provenance: v.string(), severity: v.string(), timestamp: v.number() },
	handler: async (ctx, args) => { await ctx.db.insert("gdeltEvents", args); },
});
export const updateGdelt = internalMutation({
	args: { id: v.id("gdeltEvents"), eventId: v.string(), title: v.string(), category: v.string(), latitude: v.number(), longitude: v.number(), sourceUrl: v.string(), sourceName: v.string(), confidence: v.number(), provenance: v.string(), severity: v.string(), timestamp: v.number() },
	handler: async (ctx, { id, ...rest }) => { await ctx.db.patch(id, rest); },
});
export const pruneGdeltEvents = internalMutation({
	args: { cutoff: v.number() },
	handler: async (ctx, { cutoff }) => {
		const old = await ctx.db.query("gdeltEvents").withIndex("by_timestamp").filter((q) => q.lt(q.field("timestamp"), cutoff)).collect();
		for (const e of old) { await ctx.db.delete(e._id); }
	},
});

// ==================== ISS ====================
export const insertISSPosition = internalMutation({
	args: { latitude: v.number(), longitude: v.number(), altitude: v.number(), velocity: v.number(), visibility: v.string(), timestamp: v.number() },
	handler: async (ctx, args) => { await ctx.db.insert("issPosition", args); },
});

// ==================== THREAT ZONES ====================
export const upsertThreatZone = internalMutation({
	args: { name: v.string(), latitude: v.number(), longitude: v.number(), radius: v.number(), baseScore: v.number(), type: v.string(), currentScore: v.number(), activeEvents: v.number(), lastUpdated: v.number() },
	handler: async (ctx, args) => {
		const existing = await ctx.db.query("threatZones").withIndex("by_name", (q) => q.eq("name", args.name)).first();
		if (existing) {
			await ctx.db.patch(existing._id, args);
		} else {
			await ctx.db.insert("threatZones", args);
		}
	},
});

// ==================== SATELLITE POSITIONS (for CelesTrak upsert) ====================
export const upsertSatellitePosition = internalMutation({
	args: { satId: v.string(), satName: v.string(), latitude: v.number(), longitude: v.number(), altitude: v.number(), velocity: v.number(), timestamp: v.number() },
	handler: async (ctx, args) => {
		const existing = await ctx.db.query("satellitePositions").withIndex("by_satId", (q) => q.eq("satId", args.satId)).first();
		if (existing) {
			await ctx.db.patch(existing._id, args);
		} else {
			await ctx.db.insert("satellitePositions", args);
		}
	},
});

// ==================== DATA SOURCE STATUS (shared) ====================
export const upsertSourceStatus = internalMutation({
	args: { sourceId: v.string(), name: v.string(), status: v.string(), lastFetch: v.number(), recordCount: v.number(), errorMessage: v.optional(v.string()) },
	handler: async (ctx, args) => {
		const existing = await ctx.db.query("dataSourceStatus").withIndex("by_sourceId", (q) => q.eq("sourceId", args.sourceId)).first();
		if (existing) {
			await ctx.db.patch(existing._id, args);
		} else {
			await ctx.db.insert("dataSourceStatus", args);
		}
	},
});
