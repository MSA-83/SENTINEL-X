"use node";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

const SUBREDDITS = ["CombatFootage", "CredibleDefense", "UkrainianConflict", "osint", "geopolitics"];

/** Geo-inference from post title keywords */
function inferGeo(title: string): { lat: number; lon: number } | null {
	const geoMap: Record<string, [number, number]> = {
		ukraine: [48.4, 35.0], kyiv: [50.45, 30.52], kherson: [46.63, 32.62], bakhmut: [48.60, 38.00],
		odessa: [46.48, 30.73], gaza: [31.5, 34.47], israel: [31.8, 35.2], lebanon: [33.9, 35.5],
		syria: [34.8, 38.0], iran: [32.4, 53.7], iraq: [33.3, 44.4], taiwan: [25.0, 121.5],
		china: [35.9, 104.2], korea: [37.5, 127.0], russia: [55.75, 37.62], moscow: [55.75, 37.62],
		crimea: [44.9, 34.1], donbas: [48.0, 37.8], kursk: [51.73, 36.19], sudan: [15.5, 32.5],
		yemen: [15.4, 44.2], somalia: [2.05, 45.32], libya: [32.9, 13.18], niger: [13.5, 2.1],
		mali: [12.6, -8.0], sahel: [14.0, 2.0], kashmir: [34.0, 74.5], afghanistan: [33.9, 67.7],
		myanmar: [19.8, 96.2], ethiopia: [9.0, 38.7], "red sea": [14.5, 43.5], houthi: [14.5, 43.5],
	};
	const lower = title.toLowerCase();
	for (const [kw, coords] of Object.entries(geoMap)) {
		if (lower.includes(kw)) return { lat: coords[0], lon: coords[1] };
	}
	return null;
}

export const fetchRedditOSINT = internalAction({
	args: {},
	handler: async (ctx) => {
		let totalPosts = 0;
		try {
			for (const sub of SUBREDDITS) {
				try {
					const res = await fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=12`, {
						headers: { "User-Agent": "SENTINEL-X/1.0 (OSINT aggregator)" },
						signal: AbortSignal.timeout(10000),
					});
					if (!res.ok) continue;
					const data = await res.json();
					const posts = (data?.data?.children || []).slice(0, 12);

					for (const post of posts) {
						const d = post.data;
						if (!d || d.stickied) continue;
						const geo = inferGeo(d.title || "");
						const item = {
							postId: `reddit_${d.id}`,
							subreddit: sub,
							title: (d.title || "").slice(0, 300),
							url: d.url || "",
							author: d.author || "[deleted]",
							score: d.score || 0,
							numComments: d.num_comments || 0,
							permalink: `https://reddit.com${d.permalink || ""}`,
							thumbnail: d.thumbnail && d.thumbnail.startsWith("http") ? d.thumbnail : undefined,
							latitude: geo?.lat,
							longitude: geo?.lon,
							provenance: geo ? "geocoded-inferred" : "no-location",
							confidence: geo ? 30 : 0,
							timestamp: (d.created_utc || Date.now() / 1000) * 1000,
						};

						const existing = await ctx.runQuery(internal.entitiesInternal.findSocialByPostId, { postId: item.postId });
						if (existing) {
							await ctx.runMutation(internal.entitiesInternal.updateSocial, { id: existing._id, ...item });
						} else {
							await ctx.runMutation(internal.entitiesInternal.insertSocial, item);
						}
						totalPosts++;
					}
				} catch {
					/* skip individual subreddit errors */
				}
			}

			await ctx.runMutation(internal.entitiesInternal.upsertSourceStatus, {
				sourceId: "reddit",
				name: "Reddit OSINT",
				status: totalPosts > 0 ? "live" : "error",
				lastFetch: Date.now(),
				recordCount: totalPosts,
			});
			return { success: true, count: totalPosts };
		} catch (e: any) {
			await ctx.runMutation(internal.entitiesInternal.upsertSourceStatus, {
				sourceId: "reddit",
				name: "Reddit OSINT",
				status: "error",
				lastFetch: Date.now(),
				recordCount: 0,
				errorMessage: e.message,
			});
			return { success: false, error: e.message };
		}
	},
});
