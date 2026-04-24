import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

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
