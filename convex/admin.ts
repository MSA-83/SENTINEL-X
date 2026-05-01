import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// ==================== USER PROFILES ====================

export const listUsers = query({
	args: {},
	handler: async (ctx) => {
		return await ctx.db.query("userProfiles").collect();
	},
});

export const getUserProfile = query({
	args: { userId: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("userProfiles")
			.withIndex("by_userId", (q) => q.eq("userId", args.userId))
			.first();
	},
});

export const createUserProfile = mutation({
	args: {
		userId: v.string(),
		displayName: v.string(),
		role: v.string(),
		department: v.optional(v.string()),
		clearanceLevel: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		// Check if profile already exists
		const existing = await ctx.db
			.query("userProfiles")
			.withIndex("by_userId", (q) => q.eq("userId", args.userId))
			.first();
		if (existing) return existing._id;
		return await ctx.db.insert("userProfiles", {
			userId: args.userId,
			displayName: args.displayName,
			role: args.role,
			department: args.department,
			clearanceLevel: args.clearanceLevel,
			isActive: true,
			createdAt: Date.now(),
		});
	},
});

export const updateUserRole = mutation({
	args: {
		userId: v.string(),
		role: v.string(),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("userProfiles")
			.withIndex("by_userId", (q) => q.eq("userId", args.userId))
			.first();
		if (!existing) return;
		await ctx.db.patch(existing._id, { role: args.role });
	},
});

export const toggleUserActive = mutation({
	args: { userId: v.string() },
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("userProfiles")
			.withIndex("by_userId", (q) => q.eq("userId", args.userId))
			.first();
		if (!existing) return;
		await ctx.db.patch(existing._id, { isActive: !existing.isActive });
	},
});

// ==================== AUDIT LOG ====================

export const listAuditLog = query({
	args: {},
	handler: async (ctx) => {
		return await ctx.db.query("auditLog").order("desc").take(200);
	},
});

export const addAuditEntry = mutation({
	args: {
		action: v.string(),
		actor: v.string(),
		resource: v.string(),
		resourceId: v.optional(v.string()),
		details: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		await ctx.db.insert("auditLog", {
			action: args.action,
			actor: args.actor,
			resource: args.resource,
			resourceId: args.resourceId,
			details: args.details,
			timestamp: Date.now(),
		});
	},
});

// ==================== SYSTEM HEALTH ====================

export const getSystemHealth = query({
	args: {},
	handler: async (ctx) => {
		const sources = await ctx.db.query("dataSourceStatus").collect();
		const aircraft = await ctx.db.query("aircraft").collect();
		const vessels = await ctx.db.query("vessels").collect();
		const fires = await ctx.db.query("fires").collect();
		const conflicts = await ctx.db.query("conflictEvents").collect();
		const seismic = await ctx.db.query("seismicEvents").collect();
		const cyber = await ctx.db.query("cyberThreats").collect();
		const disasters = await ctx.db.query("disasters").collect();
		const alerts = await ctx.db.query("systemAlerts").collect();
		const cases = await ctx.db.query("cases").collect();
		const kgNodes = await ctx.db.query("kgNodes").collect();

		const now = Date.now();
		const onlineCount = sources.filter((s) => s.status === "online" || s.status === "ok").length;
		const degradedCount = sources.filter((s) => s.status === "degraded").length;
		const offlineCount = sources.filter((s) => s.status === "offline" || s.status === "error").length;

		return {
			sources: { total: sources.length, online: onlineCount, degraded: degradedCount, offline: offlineCount },
			entities: {
				aircraft: aircraft.length,
				vessels: vessels.length,
				fires: fires.length,
				conflicts: conflicts.length,
				seismic: seismic.length,
				cyber: cyber.length,
				disasters: disasters.length,
			},
			alerts: {
				total: alerts.length,
				unacknowledged: alerts.filter((a) => !a.acknowledged).length,
				critical: alerts.filter((a) => a.severity === "critical").length,
			},
			cases: { total: cases.length, open: cases.filter((c) => c.status === "open").length },
			kgNodes: kgNodes.length,
			uptime: now,
		};
	},
});

export const getFeedHealth = query({
	args: {},
	returns: v.array(v.object({
		sourceId: v.string(),
		name: v.string(),
		status: v.string(),
		circuitState: v.string(),
		consecutiveFailures: v.number(),
		lastFetch: v.number(),
		lastFailureAt: v.number(),
		recordCount: v.number(),
		errorMessage: v.optional(v.string()),
	})),
	handler: async (ctx) => {
		const sources = await ctx.db.query("dataSourceStatus").collect();
		return sources.map((s) => ({
			sourceId: s.sourceId,
			name: s.name,
			status: s.status,
			circuitState: s.circuitState ?? "closed",
			consecutiveFailures: s.consecutiveFailures ?? 0,
			lastFetch: s.lastFetch,
			lastFailureAt: s.lastFailureAt ?? 0,
			recordCount: s.recordCount,
			errorMessage: s.errorMessage,
		}));
	},
});

export const resetCircuitBreaker = internalMutation({
	args: { sourceId: v.string() },
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("dataSourceStatus")
			.withIndex("by_sourceId", (q) => q.eq("sourceId", args.sourceId))
			.first();
		if (existing) {
			await ctx.db.patch(existing._id, {
				circuitState: "closed",
				consecutiveFailures: 0,
				lastFailureAt: 0,
				status: "healthy",
			});
		}
	},
});

// ==================== WORKSPACES ====================

export const listWorkspaces = query({
	args: {},
	handler: async (ctx) => {
		return await ctx.db.query("workspaces").collect();
	},
});

export const getWorkspace = query({
	args: { workspaceId: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("workspaces")
			.withIndex("by_workspaceId", (q) => q.eq("workspaceId", args.workspaceId))
			.first();
	},
});

export const createWorkspace = mutation({
	args: {
		name: v.string(),
		description: v.string(),
		type: v.string(),
		layers: v.array(v.string()),
	},
	handler: async (ctx, args) => {
		const workspaceId = `WS-${Date.now().toString(36).toUpperCase()}`;
		const now = Date.now();
		await ctx.db.insert("workspaces", {
			workspaceId,
			name: args.name,
			description: args.description,
			type: args.type,
			status: "active",
			ownerId: "analyst",
			members: ["analyst"],
			layers: args.layers,
			createdAt: now,
			updatedAt: now,
		});
		return workspaceId;
	},
});

export const updateWorkspace = mutation({
	args: {
		workspaceId: v.string(),
		name: v.optional(v.string()),
		description: v.optional(v.string()),
		status: v.optional(v.string()),
		layers: v.optional(v.array(v.string())),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("workspaces")
			.withIndex("by_workspaceId", (q) => q.eq("workspaceId", args.workspaceId))
			.first();
		if (!existing) return;
		const updates: Record<string, unknown> = { updatedAt: Date.now() };
		if (args.name !== undefined) updates.name = args.name;
		if (args.description !== undefined) updates.description = args.description;
		if (args.status !== undefined) updates.status = args.status;
		if (args.layers !== undefined) updates.layers = args.layers;
		await ctx.db.patch(existing._id, updates);
	},
});

export const deleteWorkspace = mutation({
	args: { workspaceId: v.string() },
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("workspaces")
			.withIndex("by_workspaceId", (q) => q.eq("workspaceId", args.workspaceId))
			.first();
		if (existing) await ctx.db.delete(existing._id);
	},
});

// ==================== COPILOT ====================

export const getCopilotSession = query({
	args: { sessionId: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("copilotSessions")
			.withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
			.first();
	},
});

export const listCopilotSessions = query({
	args: {},
	handler: async (ctx) => {
		return await ctx.db.query("copilotSessions").order("desc").take(20);
	},
});

export const saveCopilotSession = mutation({
	args: {
		sessionId: v.string(),
		messages: v.string(),
		context: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("copilotSessions")
			.withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
			.first();
		const now = Date.now();
		if (existing) {
			await ctx.db.patch(existing._id, { messages: args.messages, context: args.context, updatedAt: now });
		} else {
			await ctx.db.insert("copilotSessions", {
				sessionId: args.sessionId,
				userId: "analyst",
				messages: args.messages,
				context: args.context,
				createdAt: now,
				updatedAt: now,
			});
		}
	},
});
