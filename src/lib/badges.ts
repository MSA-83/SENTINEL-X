/**
 * Freshness / Confidence / Provenance badge system
 * Matches reference repo's chip rendering for canonical events.
 */

// ════════════════════════════════════════════════════
// FRESHNESS — How old is the data?
// ════════════════════════════════════════════════════

export type FreshnessLevel = "LIVE" | "RECENT" | "STALE" | "OLD" | "UNKNOWN";

export interface FreshnessInfo {
	label: string;        // e.g. "<1m", "5m", "3h", "2d"
	level: FreshnessLevel;
	color: string;
	bgColor: string;
	ageMs: number;
}

export function getFreshness(timestamp: number | string | null | undefined): FreshnessInfo {
	if (!timestamp) return { label: "UNKNOWN", level: "UNKNOWN", color: "#6a8ca0", bgColor: "#6a8ca022", ageMs: Infinity };

	const ts = typeof timestamp === "string" ? new Date(timestamp).getTime() : timestamp;
	const age = Math.max(0, Date.now() - ts);

	if (age < 60_000) return { label: "<1m", level: "LIVE", color: "#00ff88", bgColor: "#00ff8822", ageMs: age };
	if (age < 300_000) return { label: `${Math.round(age / 60_000)}m`, level: "LIVE", color: "#00ff88", bgColor: "#00ff8822", ageMs: age };
	if (age < 3_600_000) return { label: `${Math.round(age / 60_000)}m`, level: "RECENT", color: "#00ccff", bgColor: "#00ccff22", ageMs: age };
	if (age < 86_400_000) return { label: `${Math.round(age / 3_600_000)}h`, level: "STALE", color: "#ffaa00", bgColor: "#ffaa0022", ageMs: age };
	return { label: `${Math.round(age / 86_400_000)}d`, level: "OLD", color: "#ff4466", bgColor: "#ff446622", ageMs: age };
}

// ════════════════════════════════════════════════════
// CONFIDENCE — How reliable is the data?
// ════════════════════════════════════════════════════

export type ConfidenceLevel = "HIGH" | "MED" | "LOW";

export interface ConfidenceInfo {
	label: string;
	level: ConfidenceLevel;
	value: number;
	color: string;
	bgColor: string;
}

export function getConfidence(value: number | null | undefined): ConfidenceInfo {
	const v = value ?? 50;
	if (v >= 80) return { label: `${v}%`, level: "HIGH", value: v, color: "#00ff88", bgColor: "#00ff8822" };
	if (v >= 50) return { label: `${v}%`, level: "MED", value: v, color: "#ffaa00", bgColor: "#ffaa0022" };
	return { label: `${v}%`, level: "LOW", value: v, color: "#ff4466", bgColor: "#ff446622" };
}

// ════════════════════════════════════════════════════
// PROVENANCE — Where did the data come from?
// ════════════════════════════════════════════════════

export type ProvenanceType = "direct-api" | "geocoded-inferred" | "curated-reference" | "no-location" | "aggregated" | "unknown";

export interface ProvenanceInfo {
	label: string;
	shortLabel: string;
	color: string;
	bgColor: string;
	isInferred: boolean;
}

const PROVENANCE_MAP: Record<string, ProvenanceInfo> = {
	"direct-api":         { label: "DIRECT API",     shortLabel: "API",  color: "#00ccff", bgColor: "#00ccff22", isInferred: false },
	"geocoded-inferred":  { label: "GEO INFERRED",   shortLabel: "INF",  color: "#ffaa00", bgColor: "#ffaa0022", isInferred: true },
	"curated-reference":  { label: "CURATED",         shortLabel: "CUR",  color: "#a855f7", bgColor: "#a855f722", isInferred: false },
	"no-location":        { label: "NO LOCATION",     shortLabel: "N/L",  color: "#6a8ca0", bgColor: "#6a8ca022", isInferred: false },
	"aggregated":         { label: "AGGREGATED",      shortLabel: "AGG",  color: "#00ff88", bgColor: "#00ff8822", isInferred: false },
};

export function getProvenance(type: string | null | undefined): ProvenanceInfo {
	return PROVENANCE_MAP[type || "unknown"] ?? { label: "UNKNOWN", shortLabel: "UNK", color: "#6a8ca0", bgColor: "#6a8ca022", isInferred: false };
}

// ════════════════════════════════════════════════════
// SEVERITY — Threat level chip
// ════════════════════════════════════════════════════

export interface SeverityInfo {
	label: string;
	color: string;
	bgColor: string;
}

export function getSeverity(level: string | null | undefined): SeverityInfo {
	switch (level?.toLowerCase()) {
		case "critical": return { label: "CRITICAL", color: "#ff2244", bgColor: "#ff224422" };
		case "high":     return { label: "HIGH",     color: "#ff6b00", bgColor: "#ff6b0022" };
		case "medium":   return { label: "MEDIUM",   color: "#ffaa00", bgColor: "#ffaa0022" };
		case "low":      return { label: "LOW",      color: "#00d4ff", bgColor: "#00d4ff22" };
		default:         return { label: "INFO",     color: "#6a8ca0", bgColor: "#6a8ca022" };
	}
}

// ════════════════════════════════════════════════════
// ENTITY TYPE BADGE
// ════════════════════════════════════════════════════

export function getEntityTypeLabel(type: string): { label: string; color: string } {
	const map: Record<string, { label: string; color: string }> = {
		aircraft:       { label: "AIRCRAFT",       color: "#00ccff" },
		military_air:   { label: "MIL AIR",        color: "#ff3355" },
		military:       { label: "MIL AIR",        color: "#ff3355" },
		vessel:         { label: "VESSEL",         color: "#00ff88" },
		dark_vessel:    { label: "DARK FLEET",     color: "#ff6633" },
		fishing_vessel: { label: "FISHING",        color: "#33ffcc" },
		satellite:      { label: "SATELLITE",      color: "#ffcc00" },
		debris_object:  { label: "DEBRIS",         color: "#cc2255" },
		conjunction:    { label: "CONJUNCTION",     color: "#ff00ff" },
		iss:            { label: "ISS",            color: "#ff6600" },
		seismic:        { label: "EARTHQUAKE",     color: "#ffee00" },
		wildfire:       { label: "WILDFIRE",       color: "#ff5500" },
		conflict:       { label: "CONFLICT",       color: "#ff2200" },
		disaster:       { label: "DISASTER",       color: "#ff8c00" },
		cyber:          { label: "CYBER",          color: "#66ffcc" },
		gnss:           { label: "GNSS JAM",       color: "#ff6633" },
		social:         { label: "SOCIAL",         color: "#ff44aa" },
		gdelt:          { label: "GDELT",          color: "#ff44aa" },
		news:           { label: "NEWS",           color: "#ff44aa" },
		weather:        { label: "WEATHER",        color: "#4477ff" },
	};
	return map[type] ?? { label: type.toUpperCase().replace(/_/g, " "), color: "#6a8ca0" };
}
