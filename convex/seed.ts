import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Realistic aircraft data across global hotspot regions
const AIRCRAFT_DATA = [
	// Eastern Mediterranean / Black Sea region
	{ icao24: "4b1812", callsign: "SWR287", originCountry: "Switzerland", longitude: 33.42, latitude: 35.14, baroAltitude: 10972, geoAltitude: 11003, velocity: 245, heading: 118, verticalRate: 0, onGround: false, squawk: "1000", category: "A3", jammingFlag: false },
	{ icao24: "3c6752", callsign: "DLH1TN", originCountry: "Germany", longitude: 31.89, latitude: 34.02, baroAltitude: 11277, geoAltitude: 11310, velocity: 238, heading: 142, verticalRate: -0.3, onGround: false, squawk: "6401", category: "A3", jammingFlag: true },
	{ icao24: "424532", callsign: "THY6HR", originCountry: "Turkey", longitude: 32.56, latitude: 36.85, baroAltitude: 10363, geoAltitude: 10401, velocity: 221, heading: 205, verticalRate: 0, onGround: false, squawk: "4723", category: "A3", jammingFlag: true },
	{ icao24: "738072", callsign: "ELY032", originCountry: "Israel", longitude: 34.87, latitude: 32.01, baroAltitude: 4572, geoAltitude: 4610, velocity: 165, heading: 270, verticalRate: -4.5, onGround: false, squawk: "0321", category: "A3", jammingFlag: true },
	{ icao24: "71be03", callsign: "MEA417", originCountry: "Lebanon", longitude: 35.49, latitude: 33.82, baroAltitude: 7620, geoAltitude: 7658, velocity: 198, heading: 310, verticalRate: 2.8, onGround: false, squawk: "2641", category: "A3", jammingFlag: true },
	// Ukraine / Eastern Europe
	{ icao24: "506c8a", callsign: "LOT3YC", originCountry: "Poland", longitude: 23.94, latitude: 51.23, baroAltitude: 11582, geoAltitude: 11614, velocity: 251, heading: 85, verticalRate: 0, onGround: false, squawk: "3211", category: "A3", jammingFlag: false },
	{ icao24: "4ca8ef", callsign: "RYR81KG", originCountry: "Ireland", longitude: 24.71, latitude: 53.89, baroAltitude: 11277, geoAltitude: 11295, velocity: 237, heading: 92, verticalRate: 0, onGround: false, squawk: "1477", category: "A3", jammingFlag: true },
	{ icao24: "471f57", callsign: "WZZ5PV", originCountry: "Hungary", longitude: 22.15, latitude: 48.67, baroAltitude: 10668, geoAltitude: 10702, velocity: 228, heading: 45, verticalRate: 0.5, onGround: false, squawk: "5064", category: "A3", jammingFlag: false },
	// Baltics / Kaliningrad
	{ icao24: "5100ec", callsign: "BTI68F", originCountry: "Latvia", longitude: 24.10, latitude: 56.92, baroAltitude: 10058, geoAltitude: 10082, velocity: 215, heading: 182, verticalRate: 0, onGround: false, squawk: "7220", category: "A3", jammingFlag: true },
	{ icao24: "4062dd", callsign: "FIN83M", originCountry: "Finland", longitude: 25.67, latitude: 59.41, baroAltitude: 11887, geoAltitude: 11918, velocity: 244, heading: 215, verticalRate: -0.2, onGround: false, squawk: "0654", category: "A3", jammingFlag: true },
	// Middle East
	{ icao24: "710059", callsign: "QTR8HK", originCountry: "Qatar", longitude: 48.15, latitude: 29.34, baroAltitude: 12192, geoAltitude: 12230, velocity: 262, heading: 310, verticalRate: 0, onGround: false, squawk: "2006", category: "A3", jammingFlag: false },
	{ icao24: "896312", callsign: "UAE507", originCountry: "UAE", longitude: 55.37, latitude: 25.25, baroAltitude: 3048, geoAltitude: 3078, velocity: 132, heading: 120, verticalRate: -6.2, onGround: false, squawk: "4451", category: "A3", jammingFlag: false },
	{ icao24: "06a1c4", callsign: "SVA154", originCountry: "Saudi Arabia", longitude: 46.69, latitude: 24.71, baroAltitude: 5486, geoAltitude: 5520, velocity: 175, heading: 355, verticalRate: 5.1, onGround: false, squawk: "1032", category: "A3", jammingFlag: false },
	// South China Sea
	{ icao24: "780d8a", callsign: "CPA921", originCountry: "China", longitude: 114.17, latitude: 22.31, baroAltitude: 2438, geoAltitude: 2465, velocity: 128, heading: 72, verticalRate: -3.8, onGround: false, squawk: "5234", category: "A3", jammingFlag: false },
	{ icao24: "75008b", callsign: "SIA227", originCountry: "Singapore", longitude: 110.35, latitude: 12.80, baroAltitude: 11887, geoAltitude: 11920, velocity: 252, heading: 42, verticalRate: 0, onGround: false, squawk: "2377", category: "A3", jammingFlag: false },
	// North Atlantic / GIUK Gap
	{ icao24: "406a12", callsign: "BAW156", originCountry: "UK", longitude: -12.45, latitude: 55.82, baroAltitude: 11582, geoAltitude: 11615, velocity: 248, heading: 285, verticalRate: 0, onGround: false, squawk: "6120", category: "A3", jammingFlag: false },
	{ icao24: "47a2c6", callsign: "NAX7534", originCountry: "Norway", longitude: -3.21, latitude: 62.47, baroAltitude: 10668, geoAltitude: 10695, velocity: 231, heading: 192, verticalRate: 0.8, onGround: false, squawk: "3762", category: "A3", jammingFlag: false },
	// Africa / Sahel
	{ icao24: "010082", callsign: "DAH3041", originCountry: "Algeria", longitude: 3.21, latitude: 36.69, baroAltitude: 8839, geoAltitude: 8870, velocity: 202, heading: 165, verticalRate: 0, onGround: false, squawk: "1245", category: "A3", jammingFlag: false },
	{ icao24: "0d04f5", callsign: "MSR788", originCountry: "Egypt", longitude: 31.41, latitude: 30.12, baroAltitude: 9144, geoAltitude: 9176, velocity: 218, heading: 330, verticalRate: 1.2, onGround: false, squawk: "5631", category: "A3", jammingFlag: false },
	// Arctic / Svalbard
	{ icao24: "47c1a8", callsign: "SAS4531", originCountry: "Norway", longitude: 15.46, latitude: 78.24, baroAltitude: 10363, geoAltitude: 10390, velocity: 210, heading: 175, verticalRate: -1.5, onGround: false, squawk: "0743", category: "A2", jammingFlag: false },
];

// Realistic ACLED-style conflict events
const CONFLICT_EVENTS = [
	{ eventId: "ACL-2026-041401", eventDate: "2026-04-14", eventType: "Battles", subEventType: "Armed clash", actor1: "Military Forces of Ukraine", actor2: "Military Forces of Russia", country: "Ukraine", region: "Eastern Europe", location: "Pokrovsk", latitude: 48.28, longitude: 37.18, fatalities: 12, notes: "Sustained artillery exchange along the Donetsk contact line. Multiple positions contested over 6-hour engagement.", source: "ACLED", severity: "critical" },
	{ eventId: "ACL-2026-041402", eventDate: "2026-04-14", eventType: "Explosions/Remote violence", subEventType: "Shelling/artillery/missile attack", actor1: "Military Forces of Russia", actor2: "Civilians", country: "Ukraine", region: "Eastern Europe", location: "Kharkiv", latitude: 49.99, longitude: 36.23, fatalities: 5, notes: "Missile strike on residential infrastructure in northern Kharkiv. Emergency services deployed.", source: "ACLED", severity: "critical" },
	{ eventId: "ACL-2026-041403", eventDate: "2026-04-14", eventType: "Violence against civilians", subEventType: "Attack", actor1: "JNIM", actor2: "Civilians", country: "Mali", region: "Western Africa", location: "Mopti", latitude: 14.49, longitude: -4.20, fatalities: 8, notes: "Armed assault on village in Mopti region. MINUSMA investigating. Displacement of approximately 200 families.", source: "ACLED", severity: "high" },
	{ eventId: "ACL-2026-041404", eventDate: "2026-04-14", eventType: "Battles", subEventType: "Armed clash", actor1: "SDF", actor2: "ISIL", country: "Syria", region: "Middle East", location: "Deir ez-Zor", latitude: 35.33, longitude: 40.14, fatalities: 6, notes: "SDF counter-terrorism operation in al-Busayrah countryside targeting ISIL sleeper cells.", source: "ACLED", severity: "high" },
	{ eventId: "ACL-2026-041405", eventDate: "2026-04-13", eventType: "Explosions/Remote violence", subEventType: "Air/drone strike", actor1: "Military Forces of Israel", actor2: "Hamas", country: "Palestine", region: "Middle East", location: "Khan Yunis", latitude: 31.34, longitude: 34.30, fatalities: 15, notes: "Multiple airstrikes targeting tunnel network infrastructure in southern Gaza Strip.", source: "ACLED", severity: "critical" },
	{ eventId: "ACL-2026-041406", eventDate: "2026-04-13", eventType: "Riots", subEventType: "Violent demonstration", actor1: "Protesters", actor2: "Police Forces of Kenya", country: "Kenya", region: "Eastern Africa", location: "Nairobi", latitude: -1.29, longitude: 36.82, fatalities: 0, notes: "Anti-tax protests in CBD area. Tear gas and water cannon deployed. Approximately 2,000 participants.", source: "ACLED", severity: "medium" },
	{ eventId: "ACL-2026-041407", eventDate: "2026-04-13", eventType: "Battles", subEventType: "Armed clash", actor1: "RSF", actor2: "SAF", country: "Sudan", region: "Northern Africa", location: "Khartoum", latitude: 15.59, longitude: 32.53, fatalities: 22, notes: "Heavy fighting in Khartoum North. SAF airstrikes on RSF positions near Shambat Bridge.", source: "ACLED", severity: "critical" },
	{ eventId: "ACL-2026-041408", eventDate: "2026-04-12", eventType: "Violence against civilians", subEventType: "Abduction/forced disappearance", actor1: "Unidentified Armed Group", actor2: "Civilians", country: "Nigeria", region: "Western Africa", location: "Zamfara", latitude: 12.17, longitude: 6.66, fatalities: 0, notes: "Mass abduction of 47 individuals from farming community. Ransom demands issued.", source: "ACLED", severity: "high" },
	{ eventId: "ACL-2026-041409", eventDate: "2026-04-12", eventType: "Explosions/Remote violence", subEventType: "Suicide bomb", actor1: "Al-Shabaab", actor2: "Military Forces of Somalia", country: "Somalia", region: "Eastern Africa", location: "Mogadishu", latitude: 2.05, longitude: 45.32, fatalities: 9, notes: "VBIED attack targeting military convoy on Maka al-Mukarama road.", source: "ACLED", severity: "critical" },
	{ eventId: "ACL-2026-041410", eventDate: "2026-04-12", eventType: "Strategic developments", subEventType: "Agreement", actor1: "Government of Colombia", actor2: "ELN", country: "Colombia", region: "South America", location: "Bogotá", latitude: 4.71, longitude: -74.07, fatalities: 0, notes: "Extension of bilateral ceasefire agreement for additional 90 days. UNMC monitoring continues.", source: "ACLED", severity: "low" },
	{ eventId: "ACL-2026-041411", eventDate: "2026-04-11", eventType: "Battles", subEventType: "Armed clash", actor1: "Military Forces of Myanmar", actor2: "KNLA", country: "Myanmar", region: "Southeast Asia", location: "Myawaddy", latitude: 16.69, longitude: 98.51, fatalities: 3, notes: "Clashes near Thai border crossing. Cross-border displacement reported.", source: "ACLED", severity: "high" },
	{ eventId: "ACL-2026-041412", eventDate: "2026-04-11", eventType: "Explosions/Remote violence", subEventType: "Remote explosive/landmine/IED", actor1: "Houthis", actor2: "Military Forces of Saudi Arabia", country: "Yemen", region: "Middle East", location: "Marib", latitude: 15.45, longitude: 45.33, fatalities: 2, notes: "Drone strike targeting energy infrastructure near Marib dam. Limited damage reported.", source: "ACLED", severity: "medium" },
];

// GNSS Jamming alerts — realistic hotspots
const JAMMING_ALERTS = [
	{ alertId: "JAM-2026-0414-001", h3Index: "872a10c6fffffff", centerLat: 34.85, centerLon: 33.60, radius: 120, affectedAircraft: 7, avgCn0Drop: 9.4, maxCn0Drop: 14.2, severity: "critical", status: "active", region: "Eastern Mediterranean / Cyprus FIR", notes: "Persistent GNSS interference affecting L1/L5 bands. Source triangulation indicates Latakia region." },
	{ alertId: "JAM-2026-0414-002", h3Index: "872a10d7fffffff", centerLat: 56.35, centerLon: 21.80, radius: 85, affectedAircraft: 4, avgCn0Drop: 7.8, maxCn0Drop: 11.6, severity: "high", status: "active", region: "Baltic Sea / Kaliningrad", notes: "Intermittent GPS/GLONASS degradation. Correlates with known EW activity patterns." },
	{ alertId: "JAM-2026-0414-003", h3Index: "872a10e8fffffff", centerLat: 48.92, centerLon: 38.50, radius: 200, affectedAircraft: 12, avgCn0Drop: 12.1, maxCn0Drop: 18.7, severity: "critical", status: "active", region: "Eastern Ukraine / Donbas", notes: "Broadband GNSS denial zone. All satellite constellations affected. EW front-line activity." },
	{ alertId: "JAM-2026-0414-004", h3Index: "872a10a3fffffff", centerLat: 32.10, centerLon: 34.80, radius: 60, affectedAircraft: 3, avgCn0Drop: 6.2, maxCn0Drop: 8.9, severity: "medium", status: "active", region: "Israel / Ben Gurion TMA", notes: "Localized GNSS spoofing detected. Aircraft reporting position shifts of 15-20nm." },
	{ alertId: "JAM-2026-0413-005", h3Index: "872a10b2fffffff", centerLat: 59.90, centerLon: 30.30, radius: 45, affectedAircraft: 2, avgCn0Drop: 5.1, maxCn0Drop: 7.3, severity: "low", status: "resolved", region: "St. Petersburg / Pulkovo", notes: "Brief interference event during military exercise. Resolved after 4 hours." },
	{ alertId: "JAM-2026-0413-006", h3Index: "872a10c1fffffff", centerLat: 33.51, centerLon: 36.28, radius: 75, affectedAircraft: 5, avgCn0Drop: 8.5, maxCn0Drop: 13.1, severity: "high", status: "active", region: "Damascus FIR / Syria", notes: "Ongoing GNSS denial. Multiple ANSPs issuing NOTAMs for the region." },
];

// Satellite scenes
const SATELLITE_SCENES = [
	{ sceneId: "S2B_MSIL2A_20260414T082559", satellite: "Sentinel-2B", acquisitionDate: "2026-04-14T08:25:59Z", cloudCover: 12.4, bbox: { minLon: 35.5, minLat: 33.0, maxLon: 37.5, maxLat: 35.0 }, centerLat: 34.0, centerLon: 36.5, resolution: 10, processingLevel: "L2A", status: "available" },
	{ sceneId: "S1A_IW_GRDH_20260414T043216", satellite: "Sentinel-1A", acquisitionDate: "2026-04-14T04:32:16Z", cloudCover: 0, bbox: { minLon: 36.0, minLat: 47.0, maxLon: 40.0, maxLat: 50.0 }, centerLat: 48.5, centerLon: 38.0, resolution: 10, processingLevel: "GRD", status: "available" },
	{ sceneId: "S2A_MSIL2A_20260413T094031", satellite: "Sentinel-2A", acquisitionDate: "2026-04-13T09:40:31Z", cloudCover: 45.2, bbox: { minLon: 30.0, minLat: 14.0, maxLon: 34.0, maxLat: 17.0 }, centerLat: 15.5, centerLon: 32.0, resolution: 10, processingLevel: "L2A", status: "available" },
	{ sceneId: "S1B_IW_GRDH_20260413T155842", satellite: "Sentinel-1B", acquisitionDate: "2026-04-13T15:58:42Z", cloudCover: 0, bbox: { minLon: 20.0, minLat: 55.0, maxLon: 25.0, maxLat: 58.0 }, centerLat: 56.5, centerLon: 22.5, resolution: 10, processingLevel: "GRD", status: "available" },
];

export const seedAll = internalMutation({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		// Check if already seeded
		const existing = await ctx.db
			.query("platformStats")
			.withIndex("by_key", (q) => q.eq("key", "seeded"))
			.unique();
		if (existing) return null;

		const now = Date.now();

		// Seed aircraft
		for (const ac of AIRCRAFT_DATA) {
			await ctx.db.insert("aircraft", { ...ac, lastUpdate: now });
		}

		// Seed conflict events
		for (const evt of CONFLICT_EVENTS) {
			await ctx.db.insert("conflictEvents", { ...evt, timestamp: now - Math.random() * 86400000 * 3 });
		}

		// Seed jamming alerts
		for (const alert of JAMMING_ALERTS) {
			await ctx.db.insert("jammingAlerts", { ...alert, detectedAt: now - Math.random() * 86400000, resolvedAt: alert.status === "resolved" ? now - 3600000 : undefined });
		}

		// Seed satellite scenes
		for (const scene of SATELLITE_SCENES) {
			await ctx.db.insert("satelliteScenes", { ...scene, timestamp: now - Math.random() * 86400000 * 2 });
		}

		// Seed system alerts
		const sysAlerts = [
			{ type: "gnss_jamming", severity: "critical", title: "GNSS Denial Zone Expanded", message: "Eastern Mediterranean jamming zone expanded to 120nm radius. 7 aircraft affected. EUROCONTROL NOTAM issued.", source: "FLINK:gnss-pipeline", latitude: 34.85, longitude: 33.60, entityRef: "JAM-2026-0414-001", acknowledged: false },
			{ type: "conflict_escalation", severity: "critical", title: "Heavy Fighting — Khartoum", message: "SAF airstrikes intensifying in Khartoum North. Civilian casualty reports increasing. UN Security Council briefing scheduled.", source: "ACLED:monitor", latitude: 15.59, longitude: 32.53, entityRef: "ACL-2026-041407", acknowledged: false },
			{ type: "gnss_jamming", severity: "high", title: "Baltic GNSS Degradation", message: "GPS/GLONASS interference detected near Kaliningrad. 4 commercial flights rerouted. NOTAM ESSA-W0432.", source: "FLINK:gnss-pipeline", latitude: 56.35, longitude: 21.80, entityRef: "JAM-2026-0414-002", acknowledged: false },
			{ type: "satellite_acquisition", severity: "low", title: "Sentinel-1A SAR Pass — Donbas", message: "New SAR acquisition over Eastern Ukraine. GRD product available for change detection analysis.", source: "COPERNICUS:adapter", latitude: 48.5, longitude: 38.0, entityRef: "S1A_IW_GRDH_20260414T043216", acknowledged: true },
			{ type: "anomaly_detection", severity: "medium", title: "ADS-B Position Anomaly", message: "Aircraft ELY032 reporting 15nm position offset near Ben Gurion. Suspected GNSS spoofing event.", source: "FLINK:adsb-pipeline", latitude: 32.01, longitude: 34.87, entityRef: "738072", acknowledged: false },
			{ type: "conflict_new", severity: "high", title: "Mass Abduction — Zamfara", message: "47 civilians abducted from farming community. Nigerian Army deploying response forces.", source: "ACLED:monitor", latitude: 12.17, longitude: 6.66, entityRef: "ACL-2026-041408", acknowledged: false },
		];

		for (const sa of sysAlerts) {
			await ctx.db.insert("systemAlerts", { ...sa, timestamp: now - Math.random() * 3600000 * 6 });
		}

		// Platform stats
		const stats = [
			{ key: "seeded", value: 1 },
			{ key: "totalAircraft", value: AIRCRAFT_DATA.length },
			{ key: "activeAlerts", value: JAMMING_ALERTS.filter((a) => a.status === "active").length },
			{ key: "conflictEvents24h", value: 7 },
			{ key: "satellitePasses", value: SATELLITE_SCENES.length },
			{ key: "dataSourcesOnline", value: 6 },
			{ key: "eventsPerSecond", value: 1247 },
			{ key: "totalEntities", value: AIRCRAFT_DATA.length + CONFLICT_EVENTS.length + JAMMING_ALERTS.length },
		];

		for (const stat of stats) {
			await ctx.db.insert("platformStats", { ...stat, updatedAt: now });
		}

		return null;
	},
});
