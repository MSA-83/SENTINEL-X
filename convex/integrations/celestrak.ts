"use node";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

/**
 * CelesTrak TLE fetcher — fetches Two-Line Element sets for active debris
 * and bright satellites, then computes approximate positions using simplified
 * SGP4-like math (no external library needed for rough positions).
 *
 * CelesTrak endpoints (free, no auth):
 *   - Active debris: https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle
 *   - Bright sats:   https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=tle
 *   - Last 30 days launches: https://celestrak.org/NORAD/elements/gp.php?GROUP=last-30-days&FORMAT=tle
 */

const CELESTRAK_URLS: Record<string, string> = {
	debris: "https://celestrak.org/NORAD/elements/gp.php?GROUP=cosmos-2251-debris&FORMAT=tle",
	visual: "https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=tle",
};

// Simplified SGP4-like propagation (good enough for map display without satellite.js)
// Computes approximate lat/lon from TLE orbital elements at current time
function propagateTLE(line1: string, line2: string): { lat: number; lon: number; alt: number; norad: string; inclination: number; period: number } | null {
	try {
		const norad = line2.slice(2, 7).trim();
		const inclDeg = parseFloat(line2.slice(8, 16).trim());
		const raanDeg = parseFloat(line2.slice(17, 25).trim());
		const eccStr = "0." + line2.slice(26, 33).trim();
		const ecc = parseFloat(eccStr);
		const argpDeg = parseFloat(line2.slice(34, 42).trim());
		const maDeg = parseFloat(line2.slice(43, 51).trim());
		const meanMotion = parseFloat(line2.slice(52, 63).trim()); // rev/day

		if (isNaN(inclDeg) || isNaN(meanMotion) || meanMotion <= 0) return null;

		// Orbital period in minutes
		const periodMin = 1440.0 / meanMotion;
		// Semi-major axis (km) from Kepler's third law
		const mu = 398600.4418; // km³/s²
		const periodSec = periodMin * 60;
		const a = Math.pow((mu * periodSec * periodSec) / (4 * Math.PI * Math.PI), 1 / 3);
		const altKm = a - 6371.0; // subtract Earth radius

		if (altKm < 100 || altKm > 50000) return null;

		// Approximate epoch from line 1
		const epochYear = parseInt(line1.slice(18, 20).trim());
		const epochDay = parseFloat(line1.slice(20, 32).trim());
		const year = epochYear < 57 ? 2000 + epochYear : 1900 + epochYear;
		const epochDate = new Date(year, 0, 1);
		epochDate.setDate(epochDate.getDate() + epochDay - 1);

		// Time since epoch in minutes
		const now = new Date();
		const dtMin = (now.getTime() - epochDate.getTime()) / 60000;

		// Current mean anomaly
		const n = meanMotion * 2 * Math.PI / 1440; // rad/min
		const M = ((maDeg * Math.PI / 180) + n * dtMin) % (2 * Math.PI);

		// Solve Kepler's equation (Newton's method, 5 iterations)
		let E = M;
		for (let i = 0; i < 5; i++) {
			E = E - (E - ecc * Math.sin(E) - M) / (1 - ecc * Math.cos(E));
		}

		// True anomaly
		const sinV = Math.sqrt(1 - ecc * ecc) * Math.sin(E) / (1 - ecc * Math.cos(E));
		const cosV = (Math.cos(E) - ecc) / (1 - ecc * Math.cos(E));
		const v = Math.atan2(sinV, cosV);

		// Argument of latitude
		const u = (argpDeg * Math.PI / 180) + v;

		// Inclination and RAAN
		const incl = inclDeg * Math.PI / 180;
		// Account for RAAN precession (simplified)
		const raanRad = raanDeg * Math.PI / 180;

		// Compute position in Earth-fixed frame
		// GMST (approximate)
		const J2000 = Date.UTC(2000, 0, 1, 12, 0, 0);
		const d = (now.getTime() - J2000) / 86400000;
		const gmst = (280.46061837 + 360.98564736629 * d) % 360;
		const gmstRad = gmst * Math.PI / 180;

		// Geographic latitude
		const lat = Math.asin(Math.sin(incl) * Math.sin(u)) * 180 / Math.PI;
		// Geographic longitude
		const lon = ((Math.atan2(Math.sin(u) * Math.cos(incl), Math.cos(u)) + raanRad - gmstRad) * 180 / Math.PI) % 360;
		const lonNorm = lon > 180 ? lon - 360 : lon < -180 ? lon + 360 : lon;

		if (isNaN(lat) || isNaN(lonNorm) || Math.abs(lat) > 90) return null;

		return { lat, lon: lonNorm, alt: Math.round(altKm), norad, inclination: inclDeg, period: periodMin };
	} catch {
		return null;
	}
}

function parseTLEText(text: string, type: "debris" | "satellite", limit: number) {
	const lines = text.trim().split("\n");
	const results: Array<{
		noradId: string;
		name: string;
		latitude: number;
		longitude: number;
		altitude: number;
		inclination: number;
		period: number;
		entityType: string;
		source: string;
	}> = [];

	for (let i = 0; i < lines.length - 2 && results.length < limit; i += 3) {
		const name = lines[i].trim();
		const line1 = lines[i + 1]?.trim();
		const line2 = lines[i + 2]?.trim();

		if (!line1?.startsWith("1") || !line2?.startsWith("2")) continue;

		const pos = propagateTLE(line1, line2);
		if (!pos) continue;

		results.push({
			noradId: pos.norad,
			name: name.slice(0, 24),
			latitude: pos.lat,
			longitude: pos.lon,
			altitude: pos.alt,
			inclination: Math.round(pos.inclination * 10) / 10,
			period: Math.round(pos.period * 10) / 10,
			entityType: type === "debris" ? "debris" : "satellite",
			source: "CelesTrak SGP4",
		});
	}

	return results;
}

export const fetchCelesTrak = internalAction({
	args: {},
	handler: async (ctx) => {
		const results: Array<{
			noradId: string; name: string; latitude: number; longitude: number;
			altitude: number; inclination: number; period: number; entityType: string; source: string;
		}> = [];

		for (const [type, url] of Object.entries(CELESTRAK_URLS)) {
			try {
				const resp = await fetch(url, {
					headers: { "User-Agent": "SentinelX/1.0" },
					signal: AbortSignal.timeout(15000),
				});

				if (!resp.ok) {
					console.log(`CelesTrak ${type}: HTTP ${resp.status}`);
					continue;
				}

				const text = await resp.text();
				const parsed = parseTLEText(text, type === "debris" ? "debris" : "satellite", 60);
				results.push(...parsed);
				console.log(`CelesTrak ${type}: parsed ${parsed.length} objects`);
			} catch (e) {
				console.error(`CelesTrak ${type} error:`, e);
			}
		}

		// Upsert into satellitePositions table (reuse existing table)
		let upserted = 0;
		for (const obj of results) {
			try {
				await ctx.runMutation(internal.entitiesInternal.upsertSatellitePosition, {
					satId: `celestrak-${obj.noradId}`,
					satName: `${obj.entityType === "debris" ? "DEB " : ""}${obj.name}`,
					latitude: obj.latitude,
					longitude: obj.longitude,
					altitude: obj.altitude,
					velocity: 0, // Not computed in simplified model
					timestamp: Date.now(),
				});
				upserted++;
			} catch (e) {
				console.error(`Failed to upsert ${obj.noradId}:`, e);
			}
		}

		// Update source status
		await ctx.runMutation(internal.entitiesInternal.upsertSourceStatus, {
			sourceId: "celestrak",
			name: "CelesTrak SGP4",
			status: results.length > 0 ? "ok" : "error",
			lastFetch: Date.now(),
			recordCount: upserted,
		});

		console.log(`CelesTrak: ${upserted} satellite/debris positions updated`);
	},
});
