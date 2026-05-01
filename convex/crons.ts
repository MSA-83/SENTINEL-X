import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

const crons = cronJobs();

// ==================== CLEANUP JOBS ====================

// Purge expired kgEdges (every Sunday at 3 AM)
crons.interval("kg:cleanup", { hours: 168 }, internal.knowledgeGraph.purgeExpiredEdges);

// ==================== HIGH FREQUENCY (2-15 min) ====================

// NASA FIRMS — Active fire hotspots (every 15 min)
crons.interval("firms:fires", { minutes: 15 }, internal.integrations.firms.fetchFires);

// N2YO — Satellite positions (every 5 min)
crons.interval("n2yo:satellites", { minutes: 5 }, internal.integrations.n2yo.fetchSatellites);

// ADS-B — Live aircraft (every 5 min)
crons.interval("adsb:aircraft", { minutes: 5 }, internal.integrations.adsb.fetchAircraft);

// ISS — International Space Station position (every 2 min) — FREE
crons.interval("iss:position", { minutes: 2 }, internal.integrations.iss.fetchISSPosition);

// USGS — Earthquake events (every 5 min) — FREE
crons.interval("usgs:seismic", { minutes: 5 }, internal.integrations.usgs.fetchEarthquakes);

// ==================== MEDIUM FREQUENCY (10-30 min) ====================

// NewsAPI — OSINT news feed (every 10 min)
crons.interval("newsapi:osint", { minutes: 10 }, internal.integrations.newsapi.fetchNews);

// OpenWeatherMap — Weather for AOIs (every 30 min)
crons.interval("openweather:weather", { minutes: 30 }, internal.integrations.openweather.fetchWeather);

// Global Fishing Watch — Vessel tracking (every 15 min)
crons.interval("gfw:vessels", { minutes: 15 }, internal.integrations.gfw.fetchVessels);

// GDACS — Disaster events (every 15 min) — FREE
crons.interval("gdacs:disasters", { minutes: 15 }, internal.integrations.gdacs.fetchDisasters);

// GDELT — Multi-category OSINT (every 15 min) — FREE
crons.interval("gdelt:osint", { minutes: 15 }, internal.integrations.gdelt.fetchGDELTEvents);

// Reddit — Social OSINT (every 10 min) — FREE
crons.interval("reddit:social", { minutes: 10 }, internal.integrations.reddit.fetchRedditOSINT);

// ==================== LOW FREQUENCY (1-6 hr) ====================

// Shodan + Abuse.ch — Cyber threat intel (every 60 min)
crons.interval("cyber:threats", { minutes: 60 }, internal.integrations.shodan.fetchCyberThreats);

// AVWX — Aviation weather (every 30 min)
crons.interval("avwx:aviation", { minutes: 30 }, internal.integrations.avwx.fetchAviationWeather);

// Space-Track — TLE data (every 6 hours)
crons.interval("spacetrack:tle", { hours: 6 }, internal.integrations.spacetrack.fetchTLEs);

// CelesTrak — Debris + bright satellite positions via SGP4 (every 30 min) — FREE
crons.interval("celestrak:sgp4", { minutes: 30 }, internal.integrations.celestrak.fetchCelesTrak);

// Copernicus — Sentinel imagery catalog (every 6 hours)
crons.interval("copernicus:sentinel", { hours: 6 }, internal.integrations.copernicus.fetchSentinelScenes);

// Planet Labs — High-res imagery catalog (every 6 hours)
crons.interval("planet:scenes", { hours: 6 }, internal.integrations.planet.fetchPlanetScenes);

// CISA KEV — Known exploited vulnerabilities (every 6 hours) — FREE
crons.interval("cisa:kev", { hours: 6 }, internal.integrations.cyberfeeds.fetchCISAKEV);

// URLhaus — Malware URLs (every 2 hours) — FREE
crons.interval("urlhaus:malware", { hours: 2 }, internal.integrations.cyberfeeds.fetchURLhaus);

// ThreatFox — IOC feed (every 2 hours) — FREE
crons.interval("threatfox:iocs", { hours: 2 }, internal.integrations.cyberfeeds.fetchThreatFox);

// Threat Engine — Compute zone scores (every 10 min)
crons.interval("threat:engine", { minutes: 10 }, internal.integrations.threatEngine.computeThreatScores);

export default crons;
