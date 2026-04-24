import { internalQuery } from "./_generated/server";

/** Internal queries used by the Threat Scoring Engine */

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

export const getRecentConflicts = internalQuery({
	args: {},
	handler: async (ctx) => {
		return await ctx.db.query("conflictEvents").collect();
	},
});

export const getRecentSeismic = internalQuery({
	args: {},
	handler: async (ctx) => {
		const cutoff = Date.now() - TWENTY_FOUR_HOURS;
		return (await ctx.db.query("seismicEvents").withIndex("by_timestamp").order("desc").take(200))
			.filter((e) => e.timestamp > cutoff);
	},
});

export const getRecentFires = internalQuery({
	args: {},
	handler: async (ctx) => {
		return await ctx.db.query("fires").collect();
	},
});

export const getRecentGdelt = internalQuery({
	args: {},
	handler: async (ctx) => {
		return await ctx.db.query("gdeltEvents").collect();
	},
});

export const getRecentCyber = internalQuery({
	args: {},
	handler: async (ctx) => {
		return await ctx.db.query("cyberThreats").collect();
	},
});
