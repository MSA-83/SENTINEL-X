// ==================== SENTINEL-X Constants ====================

export const APP_NAME = "SENTINEL-X";

// Severity color mapping
export const SEVERITY_COLORS: Record<string, string> = {
	critical: "#ff2244",
	high: "#ff6b00",
	medium: "#ffaa00",
	low: "#00d4ff",
	info: "#6a8ca0",
};

// Layer configuration — 19 layers matching reference repo
export const LAYERS: Record<string, { label: string; icon: string; color: string; domain: string; src: string }> = {
	aircraft:     { label: "AIRCRAFT",      icon: "✈",  color: "#00ccff", domain: "AIR",      src: "ADS-B" },
	military:     { label: "MIL AIR",       icon: "✈",  color: "#ff3355", domain: "AIR",      src: "ADS-B Military" },
	ships:        { label: "MARITIME",      icon: "⚓",  color: "#00ff88", domain: "SEA",      src: "GFW AIS" },
	fishing:      { label: "FISHING",       icon: "🐟",  color: "#33ffcc", domain: "SEA",      src: "GFW Events" },
	satellites:   { label: "SATELLITES",    icon: "★",  color: "#ffcc00", domain: "SPACE",    src: "N2YO + CelesTrak" },
	seismic:      { label: "SEISMIC",       icon: "!",  color: "#ffee00", domain: "WEATHER",  src: "USGS Earthquake" },
	wildfires:    { label: "WILDFIRES",     icon: "🔥",  color: "#ff5500", domain: "WEATHER",  src: "NASA FIRMS" },
	weather:      { label: "WEATHER",       icon: "🌀",  color: "#4477ff", domain: "WEATHER",  src: "OpenWeatherMap" },
	conflict:     { label: "CONFLICT",      icon: "⚔",  color: "#ff2200", domain: "CONFLICT", src: "ACLED + GDELT" },
	disasters:    { label: "DISASTERS",     icon: "⚠",  color: "#ff8c00", domain: "CONFLICT", src: "GDACS + ReliefWeb" },
	nuclear:      { label: "NUCLEAR",       icon: "☢",  color: "#ff00ff", domain: "CONFLICT", src: "GDELT Nuclear" },
	cyber:        { label: "CYBER",         icon: "🔒",  color: "#66ffcc", domain: "CYBER",    src: "CISA + URLhaus + ThreatFox" },
	gnss:         { label: "GNSS",          icon: "📡",  color: "#ff6633", domain: "GNSS",     src: "Curated + GDELT" },
	social:       { label: "SOCIAL",        icon: "📱",  color: "#ff44aa", domain: "SOCIAL",   src: "Reddit OSINT" },
};

export const DOMAIN_LIST = ["ALL", "AIR", "SEA", "SPACE", "WEATHER", "CONFLICT", "CYBER", "GNSS", "SOCIAL"];

export const DOMAIN_COLORS: Record<string, string> = {
	AIR: "#00ccff", SEA: "#00ff88", SPACE: "#ffcc00", WEATHER: "#4477ff",
	CONFLICT: "#ff2200", CYBER: "#66ffcc", GNSS: "#ff6633", SOCIAL: "#ff44aa",
};

// Curated geopolitical threat zones (from reference repo)
export const THREAT_ZONES = [
	{ name: "Ukraine/Russia Front",   lat: 48.5, lon: 37.0, radius: 400, baseThreat: 55, type: "conflict" },
	{ name: "Gaza Strip",             lat: 31.4, lon: 34.5, radius: 120, baseThreat: 70, type: "conflict" },
	{ name: "Iran Theater",           lat: 32.4, lon: 53.7, radius: 500, baseThreat: 65, type: "flashpoint" },
	{ name: "Red Sea / Houthi",       lat: 14.5, lon: 43.5, radius: 350, baseThreat: 60, type: "chokepoint" },
	{ name: "Strait of Hormuz",       lat: 26.5, lon: 56.3, radius: 180, baseThreat: 50, type: "chokepoint" },
	{ name: "Taiwan Strait",          lat: 24.5, lon: 120.0, radius: 250, baseThreat: 55, type: "flashpoint" },
	{ name: "South China Sea",        lat: 13.5, lon: 115.0, radius: 500, baseThreat: 45, type: "flashpoint" },
	{ name: "Korean Peninsula",       lat: 38.0, lon: 127.5, radius: 200, baseThreat: 50, type: "flashpoint" },
	{ name: "Sudan Civil War",        lat: 15.5, lon: 32.5, radius: 350, baseThreat: 50, type: "conflict" },
	{ name: "Black Sea",              lat: 43.5, lon: 34.5, radius: 400, baseThreat: 45, type: "flashpoint" },
	{ name: "Sahel Insurgency",       lat: 14.0, lon: 2.0,  radius: 600, baseThreat: 40, type: "conflict" },
	{ name: "Kashmir LOC",            lat: 34.0, lon: 74.5, radius: 200, baseThreat: 45, type: "flashpoint" },
];

// Squawk code threat detection
export const SQUAWK_DB: Record<string, { label: string; severity: string }> = {
	"7500": { label: "HIJACK", severity: "critical" },
	"7600": { label: "COMMS FAIL", severity: "high" },
	"7700": { label: "EMERGENCY", severity: "critical" },
	"7777": { label: "MIL INTERCEPT", severity: "high" },
	"7400": { label: "UAV LOST LINK", severity: "high" },
};

// Military callsign regex (from reference)
export const MIL_CALLSIGN_RE = /^(RCH|USAF|REACH|DUKE|NATO|JAKE|VIPER|GHOST|BRONC|BLADE|EVAC|KNIFE|EAGLE|COBRA|REAPER|FURY|IRON|WOLF|HAWK|RAPTOR|TITAN|NAVY|SKULL|DEMON|PYTHON)/i;

// Satellite imagery products (from reference)
export const SAT_PRODUCTS: Record<string, { label: string; sub: string; tileUrl?: string; gibsLayer?: string; matrixSet?: string; format?: string; maxZoom: number; daily: boolean; desc: string; copernicus?: boolean }> = {
	modis_terra:  { label: "MODIS Terra",    sub: "True Color",    gibsLayer: "MODIS_Terra_CorrectedReflectance_TrueColor",  matrixSet: "GoogleMapsCompatible_Level9",  format: "jpg", maxZoom: 9,  daily: true,  desc: "250 m/px daily" },
	modis_aqua:   { label: "MODIS Aqua",     sub: "True Color",    gibsLayer: "MODIS_Aqua_CorrectedReflectance_TrueColor",   matrixSet: "GoogleMapsCompatible_Level9",  format: "jpg", maxZoom: 9,  daily: true,  desc: "250 m/px afternoon pass" },
	viirs_snpp:   { label: "VIIRS SNPP",     sub: "True Color",    gibsLayer: "VIIRS_SNPP_CorrectedReflectance_TrueColor",   matrixSet: "GoogleMapsCompatible_Level9",  format: "jpg", maxZoom: 9,  daily: true,  desc: "250 m/px daily" },
	viirs_night:  { label: "VIIRS Night",    sub: "Day/Night Band", gibsLayer: "VIIRS_SNPP_DayNightBand_AtSensor_M15",       matrixSet: "GoogleMapsCompatible_Level8",  format: "png", maxZoom: 8,  daily: false, desc: "Monthly composite" },
	sentinel2:    { label: "Sentinel-2",     sub: "Cloudless 2024", tileUrl: "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857_512/default/GoogleMapsCompatible_Level15/{z}/{y}/{x}.jpg", maxZoom: 15, daily: false, desc: "10 m/px annual mosaic" },
	copernicus:   { label: "Copernicus SH",  sub: "Sentinel-2 L2A", maxZoom: 16, daily: true, desc: "10 m/px hi-res (OAuth2)", copernicus: true },
};

// Initial view state (centered on Middle East / Eastern Mediterranean hotspot belt)
export const INITIAL_VIEW_STATE = {
	longitude: 30,
	latitude: 38,
	zoom: 3.2,
	pitch: 0,
	bearing: 0,
};

// Map style
export const MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

// Keyboard shortcuts reference
export const KEYBOARD_SHORTCUTS = [
	{ key: "S", desc: "Toggle search" },
	{ key: "Z", desc: "Toggle threat zones" },
	{ key: "T", desc: "Toggle timeline" },
	{ key: "L", desc: "Toggle left panel" },
	{ key: "R", desc: "Toggle right panel" },
	{ key: "1-9", desc: "Toggle domains" },
	{ key: "ESC", desc: "Close panels" },
];
