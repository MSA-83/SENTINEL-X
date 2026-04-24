import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ==================== NODE QUERIES ====================

export const listNodes = query({
	args: {},
	handler: async (ctx) => {
		return await ctx.db.query("kgNodes").collect();
	},
});

export const getNodesByType = query({
	args: { type: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("kgNodes")
			.withIndex("by_type", (q) => q.eq("type", args.type))
			.collect();
	},
});

export const getNode = query({
	args: { nodeId: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("kgNodes")
			.withIndex("by_nodeId", (q) => q.eq("nodeId", args.nodeId))
			.first();
	},
});

export const searchNodes = query({
	args: { term: v.string() },
	handler: async (ctx, args) => {
		if (args.term.length < 2) return [];
		const lower = args.term.toLowerCase();
		const all = await ctx.db.query("kgNodes").collect();
		return all
			.filter((n) => n.label.toLowerCase().includes(lower) || n.type.toLowerCase().includes(lower))
			.slice(0, 30);
	},
});

// ==================== EDGE QUERIES ====================

export const listEdges = query({
	args: {},
	handler: async (ctx) => {
		return await ctx.db.query("kgEdges").collect();
	},
});

export const getEdgesForNode = query({
	args: { nodeId: v.string() },
	handler: async (ctx, args) => {
		const outgoing = await ctx.db
			.query("kgEdges")
			.withIndex("by_sourceNodeId", (q) => q.eq("sourceNodeId", args.nodeId))
			.collect();
		const incoming = await ctx.db
			.query("kgEdges")
			.withIndex("by_targetNodeId", (q) => q.eq("targetNodeId", args.nodeId))
			.collect();
		return [...outgoing, ...incoming];
	},
});

// ==================== GRAPH STATS ====================

export const getStats = query({
	args: {},
	handler: async (ctx) => {
		const nodes = await ctx.db.query("kgNodes").collect();
		const edges = await ctx.db.query("kgEdges").collect();
		const typeCounts: Record<string, number> = {};
		for (const n of nodes) {
			typeCounts[n.type] = (typeCounts[n.type] || 0) + 1;
		}
		const relCounts: Record<string, number> = {};
		for (const e of edges) {
			relCounts[e.relationship] = (relCounts[e.relationship] || 0) + 1;
		}
		return {
			totalNodes: nodes.length,
			totalEdges: edges.length,
			typeCounts,
			relCounts,
			avgConfidence: edges.length > 0 ? edges.reduce((s, e) => s + e.confidence, 0) / edges.length : 0,
		};
	},
});

// ==================== NODE MUTATIONS ====================

export const createNode = mutation({
	args: {
		type: v.string(),
		label: v.string(),
		properties: v.string(),
		domain: v.string(),
		latitude: v.optional(v.number()),
		longitude: v.optional(v.number()),
		riskScore: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const nodeId = `N-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
		const now = Date.now();
		await ctx.db.insert("kgNodes", {
			nodeId,
			type: args.type,
			label: args.label,
			properties: args.properties,
			domain: args.domain,
			latitude: args.latitude,
			longitude: args.longitude,
			riskScore: args.riskScore,
			createdAt: now,
			updatedAt: now,
		});
		return nodeId;
	},
});

export const updateNode = mutation({
	args: {
		nodeId: v.string(),
		label: v.optional(v.string()),
		properties: v.optional(v.string()),
		riskScore: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("kgNodes")
			.withIndex("by_nodeId", (q) => q.eq("nodeId", args.nodeId))
			.first();
		if (!existing) return;
		const updates: Record<string, unknown> = { updatedAt: Date.now() };
		if (args.label !== undefined) updates.label = args.label;
		if (args.properties !== undefined) updates.properties = args.properties;
		if (args.riskScore !== undefined) updates.riskScore = args.riskScore;
		await ctx.db.patch(existing._id, updates);
	},
});

export const deleteNode = mutation({
	args: { nodeId: v.string() },
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("kgNodes")
			.withIndex("by_nodeId", (q) => q.eq("nodeId", args.nodeId))
			.first();
		if (existing) await ctx.db.delete(existing._id);
		// Delete connected edges
		const outgoing = await ctx.db
			.query("kgEdges")
			.withIndex("by_sourceNodeId", (q) => q.eq("sourceNodeId", args.nodeId))
			.collect();
		const incoming = await ctx.db
			.query("kgEdges")
			.withIndex("by_targetNodeId", (q) => q.eq("targetNodeId", args.nodeId))
			.collect();
		for (const e of [...outgoing, ...incoming]) await ctx.db.delete(e._id);
	},
});

// ==================== EDGE MUTATIONS ====================

export const createEdge = mutation({
	args: {
		sourceNodeId: v.string(),
		targetNodeId: v.string(),
		relationship: v.string(),
		confidence: v.number(),
		properties: v.optional(v.string()),
		source: v.string(),
	},
	handler: async (ctx, args) => {
		const edgeId = `E-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
		const now = Date.now();
		await ctx.db.insert("kgEdges", {
			edgeId,
			sourceNodeId: args.sourceNodeId,
			targetNodeId: args.targetNodeId,
			relationship: args.relationship,
			confidence: args.confidence,
			properties: args.properties,
			source: args.source,
			firstSeen: now,
			lastSeen: now,
		});
		return edgeId;
	},
});

export const deleteEdge = mutation({
	args: { edgeId: v.string() },
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("kgEdges")
			.withIndex("by_edgeId", (q) => q.eq("edgeId", args.edgeId))
			.first();
		if (existing) await ctx.db.delete(existing._id);
	},
});
