/**
 * Copernicus Dataspace — Sentinel satellite imagery catalog search
 * https://dataspace.copernicus.eu/
 */
import { internalAction, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

export const fetchSentinelScenes = internalAction({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		const clientId = process.env.COPERNICUS_CLIENT_ID;
		const clientSecret = process.env.COPERNICUS_CLIENT_SECRET;
		if (!clientId || !clientSecret) {
			await ctx.runMutation(internal.integrations.helpers.updateSourceStatus, {
				sourceId: "copernicus", name: "Copernicus Sentinel", status: "error", recordCount: 0,
				errorMessage: "Missing Copernicus credentials",
			});
			return null;
		}

		try {
			// Get OAuth2 token
			const tokenResp = await fetch("https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token", {
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: `grant_type=client_credentials&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`,
			});

			if (!tokenResp.ok) {
				await ctx.runMutation(internal.integrations.helpers.updateSourceStatus, {
					sourceId: "copernicus", name: "Copernicus Sentinel", status: "error", recordCount: 0,
					errorMessage: `Token request failed: ${tokenResp.status}`,
				});
				return null;
			}

			const tokenData = await tokenResp.json();
			const token = tokenData.access_token;

			// Search for recent Sentinel-2 scenes in Eastern Mediterranean
			const now = new Date();
			const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
			// Eastern Med bbox: 25,30,40,42
			const searchUrl = `https://catalogue.dataspace.copernicus.eu/odata/v1/Products?$filter=Collection/Name eq 'SENTINEL-2' and ContentDate/Start ge ${weekAgo.toISOString()} and OData.CSC.Intersects(area=geography'SRID=4326;POLYGON((25 30,40 30,40 42,25 42,25 30))')&$top=5&$orderby=ContentDate/Start desc`;

			const searchResp = await fetch(searchUrl, {
				headers: { "Authorization": `Bearer ${token}` },
			});

			let count = 0;
			const scenes: Array<{
				sceneId: string;
				satellite: string;
				acquisitionDate: string;
				cloudCover: number;
				centerLat: number;
				centerLon: number;
			}> = [];

			if (searchResp.ok) {
				const searchData = await searchResp.json();
				const results = searchData.value ?? [];
				count = results.length;

				for (const result of results) {
					scenes.push({
						sceneId: result.Id || result.Name || `cop-${count}`,
						satellite: "Sentinel-2",
						acquisitionDate: result.ContentDate?.Start || now.toISOString(),
						cloudCover: result.CloudCover ?? 0,
						centerLat: 36,
						centerLon: 33,
					});
				}
			}

			if (scenes.length > 0) {
				await ctx.runMutation(internal.integrations.copernicus.storeSentinelScenes, { scenes });
			}

			await ctx.runMutation(internal.integrations.helpers.updateSourceStatus, {
				sourceId: "copernicus",
				name: "Copernicus Sentinel",
				status: count > 0 ? "online" : "degraded",
				recordCount: count,
			});
		} catch (e) {
			await ctx.runMutation(internal.integrations.helpers.updateSourceStatus, {
				sourceId: "copernicus", name: "Copernicus Sentinel", status: "error", recordCount: 0,
				errorMessage: String(e),
			});
		}
		return null;
	},
});

export const storeSentinelScenes = internalMutation({
	args: {
		scenes: v.array(v.object({
			sceneId: v.string(),
			satellite: v.string(),
			acquisitionDate: v.string(),
			cloudCover: v.number(),
			centerLat: v.number(),
			centerLon: v.number(),
		})),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const now = Date.now();
		for (const scene of args.scenes) {
			const existing = await ctx.db
				.query("satelliteScenes")
				.withIndex("by_sceneId", (q) => q.eq("sceneId", scene.sceneId))
				.first();
			if (existing) continue;

			await ctx.db.insert("satelliteScenes", {
				sceneId: scene.sceneId,
				satellite: scene.satellite,
				acquisitionDate: scene.acquisitionDate,
				cloudCover: scene.cloudCover,
				bbox: { minLon: 25, minLat: 30, maxLon: 40, maxLat: 42 },
				centerLat: scene.centerLat,
				centerLon: scene.centerLon,
				resolution: 10,
				processingLevel: "L2A",
				status: "available",
				timestamp: now,
			});
		}
		return null;
	},
});
