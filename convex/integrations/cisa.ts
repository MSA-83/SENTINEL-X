"use node";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

/**
 * CISA KEV + URLhaus + ThreatFox — Enhanced cyber threat intelligence
 * All FREE, no API keys needed
 */
export const fetchCyberIntel = internalAction({
	args: {},
	handler: async (ctx) => {
		let totalCount = 0;

		// ==================== CISA Known Exploited Vulnerabilities ====================
		try {
			const res = await fetch("https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json", {
				signal: AbortSignal.timeout(15000),
			});
			if (res.ok) {
				const data = await res.json();
				const vulns = (data.vulnerabilities || []).slice(0, 25);
				for (const v of vulns) {
					const intelId = `kev_${v.cveID}`;
					const item = {
						intelId,
						type: "kev" as const,
						title: `${v.cveID} — ${v.vendorProject} ${v.product}`,
						description: (v.shortDescription || v.vulnerabilityName || "").slice(0, 500),
						severity: "critical",
						source: "CISA KEV",
						sourceUrl: `https://nvd.nist.gov/vuln/detail/${v.cveID}`,
						indicator: v.cveID,
						tags: [v.vendorProject, v.product].filter(Boolean),
						timestamp: v.dateAdded ? new Date(v.dateAdded).getTime() : Date.now(),
					};

					const existing = await ctx.runQuery(internal.entitiesInternal.findCyberIntelById, { intelId });
					if (!existing) {
						await ctx.runMutation(internal.entitiesInternal.insertCyberIntel, item);
						totalCount++;
					}
				}
			}
		} catch { /* CISA fetch error */ }

		// ==================== URLhaus — Malware URL feeds ====================
		try {
			const res = await fetch("https://urlhaus-api.abuse.ch/v1/urls/recent/", {
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: "limit=20",
				signal: AbortSignal.timeout(15000),
			});
			if (res.ok) {
				const data = await res.json();
				const urls = (data.urls || []).slice(0, 20);
				for (const u of urls) {
					const intelId = `urlhaus_${u.id || u.url_id}`;
					const item = {
						intelId,
						type: "urlhaus" as const,
						title: `Malware URL — ${u.threat || "unknown"}`,
						description: `${u.url || ""} | Tags: ${(u.tags || []).join(", ")} | Reporter: ${u.reporter || "anon"}`,
						severity: "high",
						source: "URLhaus",
						sourceUrl: u.urlhaus_reference || "",
						indicator: u.url,
						tags: u.tags || [],
						timestamp: u.date_added ? new Date(u.date_added).getTime() : Date.now(),
					};

					const existing = await ctx.runQuery(internal.entitiesInternal.findCyberIntelById, { intelId });
					if (!existing) {
						await ctx.runMutation(internal.entitiesInternal.insertCyberIntel, item);
						totalCount++;
					}
				}
			}
		} catch { /* URLhaus fetch error */ }

		// ==================== ThreatFox — IOC feeds ====================
		try {
			const res = await fetch("https://threatfox-api.abuse.ch/api/v1/", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ query: "get_iocs", days: 1 }),
				signal: AbortSignal.timeout(15000),
			});
			if (res.ok) {
				const data = await res.json();
				const iocs = (data.data || []).slice(0, 20);
				for (const ioc of iocs) {
					const intelId = `threatfox_${ioc.id}`;
					const item = {
						intelId,
						type: "threatfox" as const,
						title: `IOC: ${ioc.ioc_type || "unknown"} — ${ioc.malware || "unknown"}`,
						description: `${ioc.ioc || ""} | Malware: ${ioc.malware || ""} | Confidence: ${ioc.confidence_level || 0}%`,
						severity: (ioc.threat_type === "payload_delivery" || ioc.threat_type === "botnet_cc") ? "critical" : "high",
						source: "ThreatFox",
						sourceUrl: ioc.reference || "",
						indicator: ioc.ioc,
						tags: ioc.tags || [],
						timestamp: ioc.first_seen ? new Date(ioc.first_seen).getTime() : Date.now(),
					};

					const existing = await ctx.runQuery(internal.entitiesInternal.findCyberIntelById, { intelId });
					if (!existing) {
						await ctx.runMutation(internal.entitiesInternal.insertCyberIntel, item);
						totalCount++;
					}
				}
			}
		} catch { /* ThreatFox fetch error */ }

		// Update source status
		await ctx.runMutation(internal.entitiesInternal.upsertSourceStatus, {
			sourceId: "cisa",
			name: "CISA/URLhaus/ThreatFox",
			status: totalCount > 0 ? "live" : "error",
			lastFetch: Date.now(),
			recordCount: totalCount,
		});

		return { success: true, count: totalCount };
	},
});
