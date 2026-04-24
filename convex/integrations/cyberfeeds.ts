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
				sourceId: "cisa_kev", name: "CISA KEV", status: "error", lastFetch: Date.now(), recordCount: 0, errorMessage: e.message,
			});
			return { success: false, error: e.message };
		}
	},
});

/** URLhaus — Malware URL feed (FREE, no key) */
export const fetchURLhaus = internalAction({
	args: {},
	handler: async (ctx) => {
		const url = "https://urlhaus-api.abuse.ch/v1/urls/recent/limit/50/";
		try {
			const res = await fetch(url, {
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				signal: AbortSignal.timeout(15000),
			});
			if (!res.ok) throw new Error(`URLhaus ${res.status}`);
			const data = await res.json();
			const urls = (data.urls || []).slice(0, 50);
			let count = 0;

			for (const u of urls) {
				const item = {
					intelId: `urlhaus_${u.id}`,
					type: "urlhaus",
					title: `Malware URL: ${(u.url || "").slice(0, 80)}`,
					description: `Threat: ${u.threat || "N/A"} | Status: ${u.url_status} | Tags: ${(u.tags || []).join(", ")}`,
					severity: u.threat === "malware_download" ? "critical" : "high",
					source: "URLhaus (abuse.ch)",
					sourceUrl: u.urlhaus_reference || "",
					indicator: u.url || "",
					tags: u.tags || [],
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
				sourceId: "urlhaus", name: "URLhaus", status: "error", lastFetch: Date.now(), recordCount: 0, errorMessage: e.message,
			});
			return { success: false, error: e.message };
		}
	},
});

/** ThreatFox — IOC feed (FREE, no key for basic) */
export const fetchThreatFox = internalAction({
	args: {},
	handler: async (ctx) => {
		const url = "https://threatfox-api.abuse.ch/api/v1/";
		try {
			const res = await fetch(url, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ query: "get_iocs", days: 3 }),
				signal: AbortSignal.timeout(15000),
			});
			if (!res.ok) throw new Error(`ThreatFox ${res.status}`);
			const data = await res.json();
			const iocs = (data.data || []).slice(0, 50);
			let count = 0;

			for (const ioc of iocs) {
				const item = {
					intelId: `threatfox_${ioc.id}`,
					type: "threatfox",
					title: `IOC: ${(ioc.ioc || "").slice(0, 80)}`,
					description: `Type: ${ioc.ioc_type || "N/A"} | Malware: ${ioc.malware_printable || "N/A"} | Confidence: ${ioc.confidence_level || 0}%`,
					severity: (ioc.threat_type === "botnet_cc" || ioc.confidence_level > 75) ? "critical" : "high",
					source: "ThreatFox (abuse.ch)",
					sourceUrl: ioc.reference || "",
					indicator: ioc.ioc || "",
					tags: ioc.tags || [],
					timestamp: Date.now(),
				};
				const existing = await ctx.runQuery(internal.entitiesInternal.findCyberIntelById, { intelId: item.intelId });
				if (!existing) {
					await ctx.runMutation(internal.entitiesInternal.insertCyberIntel, item);
					count++;
				}
			}
			await ctx.runMutation(internal.entitiesInternal.upsertSourceStatus, {
				sourceId: "threatfox", name: "ThreatFox", status: "live", lastFetch: Date.now(), recordCount: count,
			});
			return { success: true, count };
		} catch (e: any) {
			await ctx.runMutation(internal.entitiesInternal.upsertSourceStatus, {
				sourceId: "threatfox", name: "ThreatFox", status: "error", lastFetch: Date.now(), recordCount: 0, errorMessage: e.message,
			});
			return { success: false, error: e.message };
		}
	},
});
