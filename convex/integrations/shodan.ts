/**
 * Shodan — Exposed infrastructure / cyber threat layer
 * https://developer.shodan.io/api
 */
import { internalAction, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

interface CyberEntry {
	threatId: string;
	type: string;
	latitude: number;
	longitude: number;
	ip: string;
	port: number | undefined;
	service: string;
	severity: string;
	description: string;
	source: string;
}

export const fetchCyberThreats = internalAction({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		const shodanKey = process.env.SHODAN_KEY;
		const abusechKey = process.env.ABUSECH_KEY;

		const threats: CyberEntry[] = [];

		// ---- SHODAN: Exposed SCADA/ICS systems ----
		if (shodanKey) {
			try {
				const queries = [
					{ q: "port:502 modbus", type: "scada_modbus", severity: "critical" },
					{ q: "port:102 s7comm", type: "scada_s7", severity: "critical" },
					{ q: "port:47808 bacnet", type: "ics_bacnet", severity: "high" },
				];

				for (const query of queries) {
					const url = `https://api.shodan.io/shodan/host/search?key=${shodanKey}&query=${encodeURIComponent(query.q)}&page=1`;
					const resp = await fetch(url);
					if (!resp.ok) continue;
					const data = await resp.json();

					for (const match of (data.matches ?? []).slice(0, 30)) {
						if (!match.location?.latitude || !match.location?.longitude) continue;
						threats.push({
							threatId: `shodan-${match.ip_str}-${match.port}`,
							type: query.type,
							latitude: match.location.latitude,
							longitude: match.location.longitude,
							ip: match.ip_str || "",
							port: match.port,
							service: match.product || match._shodan?.module || "unknown",
							severity: query.severity,
							description: `Exposed ${query.type.replace("_", " ")} on ${match.ip_str}:${match.port} (${match.org || "Unknown org"})`,
							source: "shodan",
						});
					}
				}
			} catch {
				// Shodan fetch failed
			}
		}

		// ---- ABUSE.CH: Active C2 servers ----
		if (abusechKey) {
			try {
				const resp = await fetch("https://urlhaus-api.abuse.ch/v1/urls/recent/", {
					method: "POST",
					headers: { "Content-Type": "application/x-www-form-urlencoded" },
					body: "limit=50",
				});
				if (resp.ok) {
					const data = await resp.json();
					for (const entry of (data.urls ?? []).slice(0, 30)) {
						// Abuse.ch doesn't have lat/lon directly, so we use the host IP
						// and approximate with a random spread (real impl would use GeoIP)
						if (!entry.host) continue;
						threats.push({
							threatId: `abusech-${entry.id || entry.host}`,
							type: "malware_c2",
							latitude: 40 + (Math.random() - 0.5) * 60,
							longitude: 10 + (Math.random() - 0.5) * 80,
							ip: entry.host || "",
							port: entry.port || undefined,
							service: entry.threat || "malware",
							severity: entry.threat === "emotet" ? "critical" : "high",
							description: `${entry.threat || "Malware"} C2 at ${entry.url || entry.host} — ${entry.url_status || "active"}`,
							source: "abuse.ch",
						});
					}
				}
			} catch {
				// Abuse.ch fetch failed
			}
		}

		await ctx.runMutation(internal.integrations.shodan.storeThreats, { threats });
		await ctx.runMutation(internal.integrations.helpers.updateSourceStatus, {
			sourceId: "cyber",
			name: "Cyber Intel (Shodan + Abuse.ch)",
			status: threats.length > 0 ? "online" : "degraded",
			recordCount: threats.length,
		});
		return null;
	},
});

export const storeThreats = internalMutation({
	args: {
		threats: v.array(v.object({
			threatId: v.string(),
			type: v.string(),
			latitude: v.number(),
			longitude: v.number(),
			ip: v.string(),
			port: v.optional(v.number()),
			service: v.string(),
			severity: v.string(),
			description: v.string(),
			source: v.string(),
		})),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		// Clear old threats
		const old = await ctx.db.query("cyberThreats").collect();
		for (const t of old) {
			await ctx.db.delete(t._id);
		}

		const now = Date.now();
		for (const threat of args.threats) {
			await ctx.db.insert("cyberThreats", { ...threat, timestamp: now });
		}
		return null;
	},
});
