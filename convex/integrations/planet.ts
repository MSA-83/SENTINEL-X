/**
 * Planet Labs — High-res satellite imagery catalog
 * https://developers.planet.com/docs/apis/
 */
import { internalAction } from "../_generated/server";
import { internal, api } from "../_generated/api";
import { v } from "convex/values";
import { resolveEnv } from "../lib/envHelper";

export const fetchPlanetScenes = internalAction({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		const _cfg = await ctx.runQuery(api.lib.envHelper.getAllConfig);
		const apiKey = resolveEnv(_cfg, "PLANET_API_KEY");
		if (!apiKey) {
			await ctx.runMutation(internal.integrations.helpers.updateSourceStatus, {
				sourceId: "planet", name: "Planet Labs", status: "error", recordCount: 0,
				errorMessage: "Missing PLANET_API_KEY",
			});
			return null;
		}

		try {
			// Quick search for recent PlanetScope imagery
			const now = new Date();
			const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

			const filter = {
				type: "AndFilter",
				config: [
					{
						type: "GeometryFilter",
						field_name: "geometry",
						config: {
							type: "Polygon",
							coordinates: [[[30, 34], [36, 34], [36, 37], [30, 37], [30, 34]]],
						},
					},
					{
						type: "DateRangeFilter",
						field_name: "acquired",
						config: { gte: dayAgo.toISOString(), lte: now.toISOString() },
					},
				],
			};

			const resp = await fetch("https://api.planet.com/data/v1/quick-search", {
				method: "POST",
				headers: {
					"Authorization": `Basic ${btoa(apiKey + ":")}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					item_types: ["PSScene"],
					filter,
				}),
			});

			let count = 0;
			if (resp.ok) {
				const data = await resp.json();
				count = data.features?.length ?? 0;
			}

			await ctx.runMutation(internal.integrations.helpers.updateSourceStatus, {
				sourceId: "planet",
				name: "Planet Labs",
				status: count > 0 ? "online" : "degraded",
				recordCount: count,
			});
		} catch (e) {
			await ctx.runMutation(internal.integrations.helpers.updateSourceStatus, {
				sourceId: "planet", name: "Planet Labs", status: "error", recordCount: 0,
				errorMessage: String(e),
			});
		}
		return null;
	},
});
