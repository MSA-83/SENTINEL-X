/**
 * Manual trigger to fetch all data sources at once.
 * Used on first load / seed to populate all tables immediately.
 */
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

export const triggerAllFetches = internalAction({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		// Phase 1: Free sources (no API key needed)
		await Promise.allSettled([
			ctx.runAction(internal.integrations.iss.fetchISSPosition),
			ctx.runAction(internal.integrations.usgs.fetchEarthquakes),
			ctx.runAction(internal.integrations.gdacs.fetchDisasters),
			ctx.runAction(internal.integrations.gdelt.fetchGDELTEvents),
			ctx.runAction(internal.integrations.reddit.fetchRedditOSINT),
			ctx.runAction(internal.integrations.cyberfeeds.fetchCISAKEV),
			ctx.runAction(internal.integrations.cyberfeeds.fetchURLhaus),
			ctx.runAction(internal.integrations.cyberfeeds.fetchThreatFox),
			ctx.runAction(internal.integrations.celestrak.fetchCelesTrak),
		]);

		// Phase 2: Keyed sources
		await Promise.allSettled([
			ctx.runAction(internal.integrations.firms.fetchFires),
			ctx.runAction(internal.integrations.openweather.fetchWeather),
			ctx.runAction(internal.integrations.newsapi.fetchNews),
			ctx.runAction(internal.integrations.n2yo.fetchSatellites),
			ctx.runAction(internal.integrations.shodan.fetchCyberThreats),
			ctx.runAction(internal.integrations.gfw.fetchVessels),
			ctx.runAction(internal.integrations.adsb.fetchAircraft),
		]);

		// Phase 3: Compute threat scores after all data loaded
		await ctx.runAction(internal.integrations.threatEngine.computeThreatScores);

		return null;
	},
});
