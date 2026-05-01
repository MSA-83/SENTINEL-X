/**
 * NewsAPI — OSINT geopolitical news feed
 * https://newsapi.org/docs/endpoints/everything
 * 
 * Circuit breaker: If 5 consecutive failures, circuit opens and returns cached data
 */
import { internalAction, internalMutation } from "../_generated/server";
import { internal, api } from "../_generated/api";
import { v } from "convex/values";
import { resolveEnv } from "../lib/envHelper";

// Geo-tagged keywords mapped to approximate coordinates
const KEYWORD_GEO: Record<string, { lat: number; lon: number }> = {
	"ukraine": { lat: 48.38, lon: 31.17 },
	"russia": { lat: 55.75, lon: 37.62 },
	"gaza": { lat: 31.5, lon: 34.47 },
	"israel": { lat: 31.77, lon: 35.22 },
	"china": { lat: 39.91, lon: 116.39 },
	"taiwan": { lat: 25.03, lon: 121.57 },
	"iran": { lat: 35.69, lon: 51.39 },
	"north korea": { lat: 39.02, lon: 125.75 },
	"sudan": { lat: 15.59, lon: 32.53 },
	"syria": { lat: 33.51, lon: 36.29 },
	"yemen": { lat: 15.37, lon: 44.21 },
	"houthi": { lat: 15.37, lon: 44.21 },
	"nato": { lat: 50.88, lon: 4.38 },
	"south china sea": { lat: 11.0, lon: 114.0 },
	"black sea": { lat: 43.0, lon: 34.0 },
	"gps jamming": { lat: 35.0, lon: 33.0 },
	"gnss": { lat: 35.0, lon: 33.0 },
};

interface NewsEntry {
	title: string;
	description: string;
	url: string;
	sourceName: string;
	publishedAt: string;
	category: string;
	latitude: number | undefined;
	longitude: number | undefined;
	imageUrl: string | undefined;
}

export const fetchNews = internalAction({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		const _cfg = await ctx.runQuery(api.lib.envHelper.getAllConfig);
		const apiKey = resolveEnv(_cfg, "NEWSAPI_KEY");
		if (!apiKey) {
			await ctx.runMutation(internal.integrations.helpers.updateSourceStatus, {
				sourceId: "newsapi", name: "NewsAPI", status: "error", recordCount: 0,
				errorMessage: "Missing NEWSAPI_KEY",
			});
			return null;
		}

		try {
			const queries = [
				{ q: "military OR defense OR conflict OR war", category: "conflict" },
				{ q: "GPS jamming OR GNSS spoofing OR navigation interference", category: "gnss" },
				{ q: "cyber attack OR ransomware OR infrastructure hack", category: "cyber" },
				{ q: "missile OR drone strike OR airstrike", category: "kinetic" },
			];

			const allNews: NewsEntry[] = [];

			for (const query of queries) {
				const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query.q)}&language=en&sortBy=publishedAt&pageSize=10&apiKey=${apiKey}`;
				const resp = await fetch(url);
				if (!resp.ok) continue;
				const data = await resp.json();

				for (const article of (data.articles ?? [])) {
					// Try to geo-tag based on content keywords
					let lat: number | undefined;
					let lon: number | undefined;
					const text = `${article.title || ""} ${article.description || ""}`.toLowerCase();
					for (const [keyword, coords] of Object.entries(KEYWORD_GEO)) {
						if (text.includes(keyword)) {
							lat = coords.lat + (Math.random() - 0.5) * 2;
							lon = coords.lon + (Math.random() - 0.5) * 2;
							break;
						}
					}

					allNews.push({
						title: article.title || "Untitled",
						description: (article.description || "").slice(0, 500),
						url: article.url || "",
						sourceName: article.source?.name || "Unknown",
						publishedAt: article.publishedAt || new Date().toISOString(),
						category: query.category,
						latitude: lat,
						longitude: lon,
						imageUrl: article.urlToImage || undefined,
					});
				}
			}

			await ctx.runMutation(internal.integrations.newsapi.storeNews, { items: allNews });
			await ctx.runMutation(internal.integrations.helpers.updateCircuitBreaker, {
				sourceId: "newsapi",
				success: allNews.length > 0,
				recordCount: allNews.length,
			});
		} catch (e) {
			await ctx.runMutation(internal.integrations.helpers.updateCircuitBreaker, {
				sourceId: "newsapi",
				success: false,
				errorMessage: String(e),
			});
		}
		return null;
	},
});

export const storeNews = internalMutation({
	args: {
		items: v.array(v.object({
			title: v.string(),
			description: v.string(),
			url: v.string(),
			sourceName: v.string(),
			publishedAt: v.string(),
			category: v.string(),
			latitude: v.optional(v.number()),
			longitude: v.optional(v.number()),
			imageUrl: v.optional(v.string()),
		})),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		// Clear old news
		const old = await ctx.db.query("newsItems").collect();
		for (const n of old) {
			await ctx.db.delete(n._id);
		}

		const now = Date.now();
		for (const item of args.items) {
			await ctx.db.insert("newsItems", {
				...item,
				timestamp: now,
			});
		}
		return null;
	},
});
