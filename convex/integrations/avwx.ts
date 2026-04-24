/**
 * AVWX — Aviation weather (METARs) for nearby airfields
 * https://avwx.rest/documentation
 */
import { internalAction } from "../_generated/server";
import { internal, api } from "../_generated/api";
import { v } from "convex/values";
import { resolveEnv } from "../lib/envHelper";

// Key military/commercial airports in AOIs
const STATIONS = [
	"UKBB", // Boryspil (Kyiv)
	"LLBG", // Ben Gurion (Tel Aviv)
	"LTBA", // Ataturk (Istanbul)
	"OERK", // King Khalid (Riyadh)
	"OIIE", // IKA (Tehran)
	"UMMS", // Minsk
	"EYVI", // Vilnius
	"EPWA", // Warsaw
	"LCLK", // Larnaca (Cyprus)
];

export const fetchAviationWeather = internalAction({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		const _cfg = await ctx.runQuery(api.lib.envHelper.getAllConfig);
		const token = resolveEnv(_cfg, "AVWX_TOKEN");
		if (!token) {
			await ctx.runMutation(internal.integrations.helpers.updateSourceStatus, {
				sourceId: "avwx", name: "AVWX Aviation Wx", status: "error", recordCount: 0,
				errorMessage: "Missing AVWX_TOKEN",
			});
			return null;
		}

		let count = 0;
		try {
			for (const station of STATIONS) {
				try {
					const url = `https://avwx.rest/api/metar/${station}?options=info&airport=true&reporting=true&format=json&onfail=cache`;
					const resp = await fetch(url, {
						headers: { "Authorization": `Token ${token}` },
					});
					if (!resp.ok) continue;
					// METAR data received — we could parse and store but for now
					// just track the source as online
					count++;
				} catch {
					// Individual station failed
				}
			}

			await ctx.runMutation(internal.integrations.helpers.updateSourceStatus, {
				sourceId: "avwx",
				name: "AVWX Aviation Wx",
				status: count > 0 ? "online" : "degraded",
				recordCount: count,
			});
		} catch (e) {
			await ctx.runMutation(internal.integrations.helpers.updateSourceStatus, {
				sourceId: "avwx", name: "AVWX Aviation Wx", status: "error", recordCount: 0,
				errorMessage: String(e),
			});
		}
		return null;
	},
});
