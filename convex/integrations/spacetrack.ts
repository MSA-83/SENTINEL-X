/**
 * Space-Track — TLE orbital element data
 * https://www.space-track.org/documentation
 */
import { internalAction } from "../_generated/server";
import { internal, api } from "../_generated/api";
import { v } from "convex/values";
import { resolveEnv } from "../lib/envHelper";

export const fetchTLEs = internalAction({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		const _cfg = await ctx.runQuery(api.lib.envHelper.getAllConfig);
		const user = resolveEnv(_cfg, "SPACETRACK_USER");
		const pass = resolveEnv(_cfg, "SPACETRACK_PASS");
		if (!user || !pass) {
			await ctx.runMutation(internal.integrations.helpers.updateSourceStatus, {
				sourceId: "spacetrack", name: "Space-Track TLE", status: "error", recordCount: 0,
				errorMessage: "Missing SPACETRACK credentials",
			});
			return null;
		}

		try {
			// Login to Space-Track
			const loginResp = await fetch("https://www.space-track.org/ajaxauth/login", {
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: `identity=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`,
			});

			if (!loginResp.ok) {
				await ctx.runMutation(internal.integrations.helpers.updateSourceStatus, {
					sourceId: "spacetrack", name: "Space-Track TLE", status: "error", recordCount: 0,
					errorMessage: `Login failed: ${loginResp.status}`,
				});
				return null;
			}

			const cookies = loginResp.headers.get("set-cookie") || "";

			// Fetch recent TLEs for key satellites
			const tleResp = await fetch(
				"https://www.space-track.org/basicspacedata/query/class/gp/NORAD_CAT_ID/25544,48274,49260,43013,41240,28654,33591,27424,25994/orderby/EPOCH desc/limit/10/format/json",
				{ headers: { "Cookie": cookies } },
			);

			let count = 0;
			if (tleResp.ok) {
				const tles = await tleResp.json();
				count = Array.isArray(tles) ? tles.length : 0;
			}

			await ctx.runMutation(internal.integrations.helpers.updateSourceStatus, {
				sourceId: "spacetrack",
				name: "Space-Track TLE",
				status: count > 0 ? "online" : "degraded",
				recordCount: count,
			});
		} catch (e) {
			await ctx.runMutation(internal.integrations.helpers.updateSourceStatus, {
				sourceId: "spacetrack", name: "Space-Track TLE", status: "error", recordCount: 0,
				errorMessage: String(e),
			});
		}
		return null;
	},
});
