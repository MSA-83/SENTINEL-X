import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// This runs automatically when the app starts. It seeds demo data.
export const seedOnInit = internalMutation({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		// Check if already seeded
		const existing = await ctx.db
			.query("platformStats")
			.withIndex("by_key", (q) => q.eq("key", "seeded"))
			.unique();
		if (existing) return null;

		// Run the seed function
		await ctx.runMutation(internal.seed.seedAll, {});
		return null;
	},
});
