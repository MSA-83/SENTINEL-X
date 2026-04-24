"use node";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

/**
 * GDELT — Multi-domain OSINT events (FREE, no key)
 * Fetches from GDELT DOC 2.0 API across conflict, maritime, nuclear, and cyber domains
 */

const GDELT_DOMAINS = [
	{ query: "military conflict attack strike", category: "conflict", severity: "high" },
	{ query: "maritime shipping vessel suspicious dark fleet", category: "maritime", severity: "medium" },
	{ query: "nuclear missile ballistic warhead radiation ICBM", category: "nuclear", severity: "critical" },
	{ query: "cyberattack ransomware DDoS breach exploit", category: "cyber", severity: "high" },
];

/** Map country names to approximate coords for geo-locating headlines */
const COUNTRY_GEO: Record<string, [number, number]> = {
	ukraine: [48.38, 31.17], russia: [55.75, 37.62], china: [39.91, 116.39],
	iran: [35.69, 51.39], "north korea": [39.02, 125.75], israel: [31.77, 35.22],
	gaza: [31.5, 34.47], taiwan: [25.03, 121.57], syria: [33.51, 36.29],
	yemen: [15.37, 44.21], iraq: [33.31, 44.37], sudan: [15.59, 32.53],
	libya: [32.9, 13.18], lebanon: [33.89, 35.5], "south china sea": [11.0, 114.0],
	"black sea": [43.0, 34.0], "red sea": [14.5, 43.5], "strait of hormuz": [26.6, 56.3],
	"persian gulf": [26.0, 52.0], afghanistan: [33.94, 67.71], pakistan: [30.38, 69.35],
	india: [20.59, 78.96], myanmar: [19.76, 96.08], somalia: [5.15, 46.2],
	ethiopia: [9.15, 40.49], niger: [17.61, 8.08], mali: [17.57, -4.0],
	"burkina faso": [12.27, -1.52], dprk: [39.02, 125.75], rok: [37.57, 126.98],
};

function inferGeoFromTitle(title: string): { lat: number; lon: number } | null {
	const lower = title.toLowerCase();
	for (const [keyword, coords] of Object.entries(COUNTRY_GEO)) {
		if (lower.includes(keyword)) return { lat: coords[0], lon: coords[1] };
	}
	return null;
}

export const fetchGDELTEvents = internalAction({
	args: {},
	handler: async (ctx) => {
		let totalCount = 0;
		try {
			for (const domain of GDELT_DOMAINS) {
				try {
					const queryEnc = encodeURIComponent(domain.query);
					const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${queryEnc}&mode=artlist&maxrecords=15&format=json&timespan=24h&sort=datedesc`;

					const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
					if (!res.ok) continue;
					const data = await res.json();

					const articles = data.articles || [];
					for (let i = 0; i < Math.min(articles.length, 15); i++) {
						const art = articles[i];
						const geo = inferGeoFromTitle(art.title || "");
						if (!geo) continue; // Skip articles we can't geolocate

						const eventId = `gdelt_${domain.category}_${(art.url || String(i)).replace(/[^a-zA-Z0-9]/g, "").slice(0, 20)}`;
						const item = {
							eventId,
							title: (art.title || "").slice(0, 300),
							category: domain.category,
							latitude: geo.lat,
							longitude: geo.lon,
							sourceUrl: art.url || "",
							sourceName: art.domain || art.source || "unknown",
							confidence: 60,
							provenance: "curated-api",
							severity: domain.severity,
							timestamp: art.seendate ? new Date(art.seendate).getTime() : Date.now(),
						};

						const existing = await ctx.runQuery(internal.entitiesInternal.findGdeltByEventId, { eventId });
						if (existing) {
							await ctx.runMutation(internal.entitiesInternal.updateGdelt, { id: existing._id, ...item });
						} else {
							await ctx.runMutation(internal.entitiesInternal.insertGdelt, item);
						}
						totalCount++;
					}
				} catch {
					/* skip individual domain errors */
				}
			}

			await ctx.runMutation(internal.entitiesInternal.upsertSourceStatus, {
				sourceId: "gdelt",
				name: "GDELT Intelligence",
				status: totalCount > 0 ? "live" : "error",
				lastFetch: Date.now(),
				recordCount: totalCount,
			});
			return { success: true, count: totalCount };
		} catch (e: any) {
			await ctx.runMutation(internal.entitiesInternal.upsertSourceStatus, {
				sourceId: "gdelt",
				name: "GDELT Intelligence",
				status: "error",
				lastFetch: Date.now(),
				recordCount: 0,
				errorMessage: e.message,
			});
			return { success: false, error: e.message };
		}
	},
});
