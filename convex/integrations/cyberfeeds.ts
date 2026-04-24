"use node";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

/** CISA KEV — Known Exploited Vulnerabilities (FREE, no key) */
export const fetchCISAKEV = internalAction({
	args: {},
	handler: async (ctx) => {
		const url = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";
		try {
			const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
			if (!res.ok) throw new Error(`CISA ${res.status}`);
			const data = await res.json();
			const vulns = (data.vulnerabilities || []).slice(0, 50);
			let count = 0;

			for (const v of vulns) {
				const item = {
					intelId: `kev_${v.cveID}`,
					type: "kev",
					title: `${v.cveID}: ${v.vendorProject} ${v.product}`,
					description: (v.shortDescription || v.vulnerabilityName || "").slice(0, 500),
					severity: "critical",
					source: "CISA KEV",
					sourceUrl: `https://nvd.nist.gov/vuln/detail/${v.cveID}`,
					indicator: v.cveID,
					tags: [v.vendorProject, v.product, "KEV"].filter(Boolean),
					timestamp: Date.now(),
				};
				const existing = await ctx.runQuery(internal.entitiesInternal.findCyberIntelById, { intelId: item.intelId });
				if (!existing) {
					await ctx.runMutation(internal.entitiesInternal.insertCyberIntel, item);
					count++;
				}
			}
			await ctx.runMutation(internal.entitiesInternal.upsertSourceStatus, {
				sourceId: "cisa_kev", name: "CISA KEV", status: "live", lastFetch: Date.now(), recordCount: count,
			});
			return { success: true, count };
		} catch (e: any) {
			await ctx.runMutation(internal.entitiesInternal.upsertSourceStatus, {
				sourceId: "cisa_kev", name: "CISA KEV", status: "error", lastFetch: Date.now(), recordCount: 0, errorMessage: (e.message || "").slice(0, 300),
			});
			return { success: false, error: e.message };
		}
	},
});

/** URLhaus — Malware URL feed (FREE download endpoint, no auth) */
export const fetchURLhaus = internalAction({
	args: {},
	handler: async (ctx) => {
		// Use the free JSON download endpoint (no auth required)
		const url = "https://urlhaus.abuse.ch/downloads/json_recent/";
		try {
			const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
			if (!res.ok) throw new Error(`URLhaus download ${res.status}`);
			const data = await res.json();
			// data is an object with numeric keys
			const entries = Object.values(data).slice(0, 50) as any[];
			let count = 0;

			for (const u of entries) {
				if (!u || !Array.isArray(u) || u.length === 0) continue;
				const entry = u[0]; // Each value is an array with one entry
				if (!entry) continue;
				const item = {
					intelId: `urlhaus_${entry.id || entry.urlhaus_reference?.split("/").pop() || count}`,
					type: "urlhaus",
					title: `Malware URL: ${(entry.url || "").slice(0, 80)}`,
					description: `Threat: ${entry.threat || "N/A"} | Status: ${entry.url_status || "unknown"} | Tags: ${(entry.tags || []).join(", ")}`,
					severity: entry.threat === "malware_download" ? "critical" : "high",
					source: "URLhaus (abuse.ch)",
					sourceUrl: entry.urlhaus_reference || "",
					indicator: entry.url || "",
					tags: Array.isArray(entry.tags) ? entry.tags : (entry.tags ? [entry.tags] : []),
					timestamp: Date.now(),
				};
				const existing = await ctx.runQuery(internal.entitiesInternal.findCyberIntelById, { intelId: item.intelId });
				if (!existing) {
					await ctx.runMutation(internal.entitiesInternal.insertCyberIntel, item);
					count++;
				}
			}
			await ctx.runMutation(internal.entitiesInternal.upsertSourceStatus, {
				sourceId: "urlhaus", name: "URLhaus", status: "live", lastFetch: Date.now(), recordCount: count,
			});
			return { success: true, count };
		} catch (e: any) {
			await ctx.runMutation(internal.entitiesInternal.upsertSourceStatus, {
				sourceId: "urlhaus", name: "URLhaus", status: "error", lastFetch: Date.now(), recordCount: 0, errorMessage: (e.message || "").slice(0, 300),
			});
			return { success: false, error: e.message };
		}
	},
});

/** ThreatFox — IOC feed via Feodo Tracker (FREE download, no auth) */
export const fetchThreatFox = internalAction({
	args: {},
	handler: async (ctx) => {
		// The ThreatFox API now requires auth; use Feodo Tracker free JSON instead
		const url = "https://feodotracker.abuse.ch/downloads/ipblocklist_recommended.json";
		try {
			const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
			if (!res.ok) throw new Error(`FeodoTracker ${res.status}`);
			const data = await res.json();
			const entries = Array.isArray(data) ? data.slice(0, 50) : [];
			let count = 0;

			for (const entry of entries) {
				if (!entry.ip_address) continue;
				const item = {
					intelId: `feodo_${entry.ip_address}_${entry.port || 0}`,
					type: "threatfox",
					title: `Botnet C2: ${entry.ip_address}:${entry.port || "?"}`,
					description: `Malware: ${entry.malware || "N/A"} | Status: ${entry.status || "unknown"} | First seen: ${entry.first_seen || "?"}`,
					severity: entry.status === "online" ? "critical" : "high",
					source: "Feodo Tracker (abuse.ch)",
					sourceUrl: `https://feodotracker.abuse.ch/browse/host/${entry.ip_address}/`,
					indicator: entry.ip_address,
					tags: [entry.malware, "C2", "botnet"].filter(Boolean),
					timestamp: Date.now(),
				};
				const existing = await ctx.runQuery(internal.entitiesInternal.findCyberIntelById, { intelId: item.intelId });
				if (!existing) {
					await ctx.runMutation(internal.entitiesInternal.insertCyberIntel, item);
					count++;
				}
			}
			await ctx.runMutation(internal.entitiesInternal.upsertSourceStatus, {
				sourceId: "threatfox", name: "ThreatFox / Feodo", status: "live", lastFetch: Date.now(), recordCount: count,
			});
			return { success: true, count };
		} catch (e: any) {
			await ctx.runMutation(internal.entitiesInternal.upsertSourceStatus, {
				sourceId: "threatfox", name: "ThreatFox / Feodo", status: "error", lastFetch: Date.now(), recordCount: 0, errorMessage: (e.message || "").slice(0, 300),
			});
			return { success: false, error: e.message };
		}
	},
});
