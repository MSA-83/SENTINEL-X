import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ==================== CASE QUERIES ====================

export const list = query({
	args: {},
	handler: async (ctx) => {
		return await ctx.db.query("cases").order("desc").collect();
	},
});

export const getById = query({
	args: { caseId: v.string() },
	handler: async (ctx, args) => {
		const results = await ctx.db
			.query("cases")
			.withIndex("by_caseId", (q) => q.eq("caseId", args.caseId))
			.first();
		return results;
	},
});

export const getByStatus = query({
	args: { status: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("cases")
			.withIndex("by_status", (q) => q.eq("status", args.status))
			.collect();
	},
});

export const getNotes = query({
	args: { caseId: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("caseNotes")
			.withIndex("by_caseId", (q) => q.eq("caseId", args.caseId))
			.collect();
	},
});

export const getEvidence = query({
	args: { caseId: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("caseEvidence")
			.withIndex("by_caseId", (q) => q.eq("caseId", args.caseId))
			.collect();
	},
});

export const getStats = query({
	args: {},
	handler: async (ctx) => {
		const all = await ctx.db.query("cases").collect();
		const open = all.filter((c) => c.status === "open").length;
		const investigating = all.filter((c) => c.status === "investigating").length;
		const escalated = all.filter((c) => c.status === "escalated").length;
		const resolved = all.filter((c) => c.status === "resolved").length;
		const closed = all.filter((c) => c.status === "closed").length;
		const critical = all.filter((c) => c.priority === "critical").length;
		const high = all.filter((c) => c.priority === "high").length;
		return { total: all.length, open, investigating, escalated, resolved, closed, critical, high };
	},
});

// ==================== CASE MUTATIONS ====================

export const create = mutation({
	args: {
		title: v.string(),
		description: v.string(),
		priority: v.string(),
		domain: v.string(),
		tags: v.array(v.string()),
		assignee: v.optional(v.string()),
		latitude: v.optional(v.number()),
		longitude: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const caseId = `CASE-${Date.now().toString(36).toUpperCase()}`;
		const now = Date.now();
		await ctx.db.insert("cases", {
			caseId,
			title: args.title,
			description: args.description,
			status: "open",
			priority: args.priority,
			domain: args.domain,
			tags: args.tags,
			assignee: args.assignee,
			createdBy: "analyst",
			linkedEntities: [],
			linkedAlerts: [],
			latitude: args.latitude,
			longitude: args.longitude,
			createdAt: now,
			updatedAt: now,
		});
		// Add creation note
		await ctx.db.insert("caseNotes", {
			caseId,
			author: "System",
			content: `Case created: ${args.title}`,
			type: "status_change",
			timestamp: now,
		});
		return caseId;
	},
});

export const updateStatus = mutation({
	args: {
		caseId: v.string(),
		status: v.string(),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("cases")
			.withIndex("by_caseId", (q) => q.eq("caseId", args.caseId))
			.first();
		if (!existing) return;
		const now = Date.now();
		await ctx.db.patch(existing._id, {
			status: args.status,
			updatedAt: now,
			...(args.status === "resolved" ? { resolvedAt: now } : {}),
		});
		await ctx.db.insert("caseNotes", {
			caseId: args.caseId,
			author: "Analyst",
			content: `Status changed to ${args.status}`,
			type: "status_change",
			timestamp: now,
		});
	},
});

export const addNote = mutation({
	args: {
		caseId: v.string(),
		content: v.string(),
		type: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		await ctx.db.insert("caseNotes", {
			caseId: args.caseId,
			author: "Analyst",
			content: args.content,
			type: args.type ?? "note",
			timestamp: Date.now(),
		});
		// Update case timestamp
		const existing = await ctx.db
			.query("cases")
			.withIndex("by_caseId", (q) => q.eq("caseId", args.caseId))
			.first();
		if (existing) {
			await ctx.db.patch(existing._id, { updatedAt: Date.now() });
		}
	},
});

export const addEvidence = mutation({
	args: {
		caseId: v.string(),
		title: v.string(),
		type: v.string(),
		content: v.string(),
	},
	handler: async (ctx, args) => {
		await ctx.db.insert("caseEvidence", {
			caseId: args.caseId,
			title: args.title,
			type: args.type,
			content: args.content,
			addedBy: "Analyst",
			timestamp: Date.now(),
		});
	},
});

export const linkEntity = mutation({
	args: {
		caseId: v.string(),
		entityId: v.string(),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("cases")
			.withIndex("by_caseId", (q) => q.eq("caseId", args.caseId))
			.first();
		if (!existing) return;
		if (!existing.linkedEntities.includes(args.entityId)) {
			await ctx.db.patch(existing._id, {
				linkedEntities: [...existing.linkedEntities, args.entityId],
				updatedAt: Date.now(),
			});
		}
	},
});

export const linkAlert = mutation({
	args: {
		caseId: v.string(),
		alertId: v.string(),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("cases")
			.withIndex("by_caseId", (q) => q.eq("caseId", args.caseId))
			.first();
		if (!existing) return;
		if (!existing.linkedAlerts.includes(args.alertId)) {
			await ctx.db.patch(existing._id, {
				linkedAlerts: [...existing.linkedAlerts, args.alertId],
				updatedAt: Date.now(),
			});
		}
	},
});

export const remove = mutation({
	args: { caseId: v.string() },
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("cases")
			.withIndex("by_caseId", (q) => q.eq("caseId", args.caseId))
			.first();
		if (existing) {
			await ctx.db.delete(existing._id);
		}
		// Delete notes
		const notes = await ctx.db
			.query("caseNotes")
			.withIndex("by_caseId", (q) => q.eq("caseId", args.caseId))
			.collect();
		for (const n of notes) await ctx.db.delete(n._id);
		// Delete evidence
		const evidence = await ctx.db
			.query("caseEvidence")
			.withIndex("by_caseId", (q) => q.eq("caseId", args.caseId))
			.collect();
		for (const e of evidence) await ctx.db.delete(e._id);
	},
});
