import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";

const MAX_CONSECUTIVE_FAILURES = 5;
const RECOVERY_TIMEOUT_MS = 30000;

const CIRCUIT_CLOSED = "closed";
const CIRCUIT_OPEN = "open";
const CIRCUIT_HALF_OPEN = "half-open";

function computeCircuitState(failures: number, lastFailureAt: number, recoveryTimeout: number): string {
	if (failures >= MAX_CONSECUTIVE_FAILURES) {
		return CIRCUIT_OPEN;
	}
	if (lastFailureAt > 0 && Date.now() - lastFailureAt > recoveryTimeout) {
		return CIRCUIT_HALF_OPEN;
	}
	return CIRCUIT_CLOSED;
}

/**
 * Shared mutation to update data source health status.
 */
export const updateSourceStatus = internalMutation({
	args: {
		sourceId: v.string(),
		name: v.string(),
		status: v.string(),
		recordCount: v.number(),
		errorMessage: v.optional(v.string()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("dataSourceStatus")
			.withIndex("by_sourceId", (q) => q.eq("sourceId", args.sourceId))
			.first();

		const data = {
			sourceId: args.sourceId,
			name: args.name,
			status: args.status,
			lastFetch: Date.now(),
			recordCount: args.recordCount,
			errorMessage: args.errorMessage,
		};

		if (existing) {
			await ctx.db.patch(existing._id, data);
		} else {
			await ctx.db.insert("dataSourceStatus", data);
		}
		return null;
	},
});

/**
 * Shared mutation to update a single platform stat by key.
 */
export const upsertStat = internalMutation({
	args: { key: v.string(), value: v.number() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("platformStats")
			.withIndex("by_key", (q) => q.eq("key", args.key))
			.first();
		if (existing) {
			await ctx.db.patch(existing._id, { value: args.value, updatedAt: Date.now() });
		} else {
			await ctx.db.insert("platformStats", { key: args.key, value: args.value, updatedAt: Date.now() });
		}
		return null;
	},
});

export const updateCircuitBreaker = internalMutation({
	args: {
		sourceId: v.string(),
		success: v.boolean(),
		recordCount: v.optional(v.number()),
		errorMessage: v.optional(v.string()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("dataSourceStatus")
			.withIndex("by_sourceId", (q) => q.eq("sourceId", args.sourceId))
			.first();

		const now = Date.now();
		const currentFailures = existing?.consecutiveFailures ?? 0;
		const currentLastFailure = existing?.lastFailureAt ?? 0;
		const recoveryTimeout = existing?.recoveryTimeout ?? RECOVERY_TIMEOUT_MS;

		let newFailures = currentFailures;
		let circuitState = existing?.circuitState ?? CIRCUIT_CLOSED;
		let lastFailureAt = currentLastFailure;
		let status = "healthy";

		if (args.success) {
			newFailures = 0;
			lastFailureAt = 0;
			circuitState = CIRCUIT_CLOSED;
			status = "healthy";
		} else {
			newFailures = currentFailures + 1;
			lastFailureAt = now;
			circuitState = computeCircuitState(newFailures, lastFailureAt, recoveryTimeout);
			status = circuitState === CIRCUIT_OPEN ? "degraded" : "degraded";
		}

		const data = {
			sourceId: args.sourceId,
			name: existing?.name ?? args.sourceId,
			status,
			lastFetch: args.success ? now : (existing?.lastFetch ?? now),
			recordCount: args.recordCount ?? existing?.recordCount ?? 0,
			consecutiveFailures: newFailures,
			circuitState,
			lastFailureAt,
			recoveryTimeout,
			errorMessage: args.errorMessage,
		};

		if (existing) {
			await ctx.db.patch(existing._id, data);
		} else {
			await ctx.db.insert("dataSourceStatus", data);
		}
		return null;
	},
});

export const getCircuitState = internalQuery({
	args: { sourceId: v.string() },
	returns: v.object({
		circuitState: v.string(),
		consecutiveFailures: v.number(),
		lastFetch: v.number(),
		lastFailureAt: v.number(),
	}),
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("dataSourceStatus")
			.withIndex("by_sourceId", (q) => q.eq("sourceId", args.sourceId))
			.first();

		if (!existing) {
			return {
				circuitState: CIRCUIT_CLOSED,
				consecutiveFailures: 0,
				lastFetch: 0,
				lastFailureAt: 0,
			};
		}

		return {
			circuitState: existing.circuitState ?? CIRCUIT_CLOSED,
			consecutiveFailures: existing.consecutiveFailures ?? 0,
			lastFetch: existing.lastFetch,
			lastFailureAt: existing.lastFailureAt ?? 0,
		};
	},
});
