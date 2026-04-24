import { mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// Public mutation to trigger seeding (idempotent)
export const triggerSeed = mutation({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		const existing = await ctx.db
			.query("platformStats")
			.withIndex("by_key", (q) => q.eq("key", "seeded"))
			.unique();
		if (existing) return null;

		// Run the seed function directly  
		await ctx.runMutation(internal.seed.seedAll, {});
		return null;
	},
});
