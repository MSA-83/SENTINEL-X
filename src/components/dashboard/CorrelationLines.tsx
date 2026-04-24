import { useEffect, useMemo } from "react";
import maplibregl from "maplibre-gl";
import {
	useAircraft,
	useConflictEvents,
	useJammingAlerts,
	useFires,
	useSeismicEvents,
	useDisasters,
} from "../../hooks/useEntityData";

/* ═══════════════ proximity correlation engine ═══════════════ */
interface CorrelationLink {
	id: string;
	from: [number, number]; // [lng, lat]
	to: [number, number];
	type: string; // "jamming-aircraft" | "quake-disaster" | "fire-conflict" | "emerg-conflict"
	label: string;
	color: string;
	strength: number; // 0-1
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
	const R = 6371;
	const dLat = ((lat2 - lat1) * Math.PI) / 180;
	const dLon = ((lon2 - lon1) * Math.PI) / 180;
	const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
	return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ═══════════════════════════════════ COMPONENT ═══════════════════════════════════ */
interface CorrelationLinesProps {
	mapRef: React.RefObject<maplibregl.Map | null>;
	enabled: boolean;
}

const SOURCE_ID = "correlation-lines-source";
const LAYER_ID = "correlation-lines-layer";
const LABEL_LAYER = "correlation-labels-layer";

export default function CorrelationLines({ mapRef, enabled }: CorrelationLinesProps) {
	const aircraft = useAircraft();
	const conflicts = useConflictEvents();
	const jamming = useJammingAlerts();
	const fires = useFires();
	const seismic = useSeismicEvents();
	const disasters = useDisasters();

	const links = useMemo<CorrelationLink[]>(() => {
		if (!enabled) return [];
		const out: CorrelationLink[] = [];
		const PROXIMITY_KM = 200; // link threshold

		// 1. Jamming zones ↔ nearby aircraft
		for (const j of jamming) {
			let linked = 0;
			for (const a of aircraft) {
				if (linked >= 3) break; // cap per zone
				const d = haversineKm(j.centerLat, j.centerLon, a.latitude, a.longitude);
				if (d < PROXIMITY_KM) {
					out.push({
						id: `jam-ac-${j.alertId}-${a.icao24}`,
						from: [j.centerLon, j.centerLat],
						to: [a.longitude, a.latitude],
						type: "jamming-aircraft",
						label: `GNSS JAM → ${a.callsign || a.icao24}`,
						color: "#f43f5e",
						strength: 1 - d / PROXIMITY_KM,
					});
					linked++;
				}
			}
		}

		// 2. Emergency squawk aircraft ↔ nearest conflict
		for (const a of aircraft) {
			if (!a.squawk || !["7500", "7600", "7700"].includes(a.squawk)) continue;
			let nearest = Infinity;
			let nearestConflict: (typeof conflicts)[0] | null = null;
			for (const c of conflicts) {
				const d = haversineKm(a.latitude, a.longitude, c.latitude, c.longitude);
				if (d < nearest && d < 500) {
					nearest = d;
					nearestConflict = c;
				}
			}
			if (nearestConflict) {
				out.push({
					id: `emerg-conf-${a.icao24}-${nearestConflict.eventId}`,
					from: [a.longitude, a.latitude],
					to: [nearestConflict.longitude, nearestConflict.latitude],
					type: "emerg-conflict",
					label: `SQ${a.squawk} ↔ ${nearestConflict.location}`,
					color: "#ef4444",
					strength: 1 - nearest / 500,
				});
			}
		}

		// 3. Fires ↔ nearby conflicts (war-related fires)
		for (const f of fires.slice(0, 50)) {
			// cap iteration
			for (const c of conflicts) {
				const d = haversineKm(f.latitude, f.longitude, c.latitude, c.longitude);
				if (d < 100) {
					out.push({
						id: `fire-conf-${f.sourceId}-${c.eventId}`,
						from: [f.longitude, f.latitude],
						to: [c.longitude, c.latitude],
						type: "fire-conflict",
						label: `FIRE ↔ ${c.eventType}`,
						color: "#f97316",
						strength: 1 - d / 100,
					});
					break; // one link per fire
				}
			}
		}

		// 4. Seismic ↔ disasters (same-area quake + disaster)
		for (const s of seismic) {
			if (s.magnitude < 4.5) continue;
			for (const d of disasters) {
				const dist = haversineKm(s.latitude, s.longitude, d.latitude, d.longitude);
				if (dist < 300) {
					out.push({
						id: `quake-dis-${s.eventId}-${d.eventId}`,
						from: [s.longitude, s.latitude],
						to: [d.longitude, d.latitude],
						type: "quake-disaster",
						label: `M${s.magnitude} ↔ ${d.title.slice(0, 30)}`,
						color: "#a855f7",
						strength: 1 - dist / 300,
					});
					break;
				}
			}
		}

		return out;
	}, [enabled, aircraft, conflicts, jamming, fires, seismic, disasters]);

	// ── Render GeoJSON to map ──
	useEffect(() => {
		const m = mapRef.current;
		if (!m || !m.isStyleLoaded()) return;

		const fc: GeoJSON.FeatureCollection = {
			type: "FeatureCollection",
			features: links.map((l) => ({
				type: "Feature" as const,
				properties: { id: l.id, type: l.type, label: l.label, color: l.color, strength: l.strength },
				geometry: { type: "LineString" as const, coordinates: [l.from, l.to] },
			})),
		};

		if (m.getSource(SOURCE_ID)) {
			(m.getSource(SOURCE_ID) as maplibregl.GeoJSONSource).setData(fc);
		} else {
			m.addSource(SOURCE_ID, { type: "geojson", data: fc });
			m.addLayer({
				id: LAYER_ID,
				type: "line",
				source: SOURCE_ID,
				paint: {
					"line-color": ["get", "color"],
					"line-width": ["interpolate", ["linear"], ["get", "strength"], 0, 1, 1, 3],
					"line-opacity": ["interpolate", ["linear"], ["get", "strength"], 0, 0.3, 1, 0.7],
					"line-dasharray": [4, 4],
				},
			});
			m.addLayer({
				id: LABEL_LAYER,
				type: "symbol",
				source: SOURCE_ID,
				layout: {
					"symbol-placement": "line-center",
					"text-field": ["get", "label"],
					"text-size": 9,
					"text-font": ["Open Sans Regular"],
					"text-allow-overlap": false,
				},
				paint: {
					"text-color": ["get", "color"],
					"text-halo-color": "#0f172a",
					"text-halo-width": 1.5,
					"text-opacity": 0.8,
				},
			});
		}

		// Visibility
		m.setLayoutProperty(LAYER_ID, "visibility", enabled ? "visible" : "none");
		m.setLayoutProperty(LABEL_LAYER, "visibility", enabled ? "visible" : "none");
	}, [links, enabled, mapRef]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			const m = mapRef.current;
			if (!m) return;
			try {
				if (m.getLayer(LABEL_LAYER)) m.removeLayer(LABEL_LAYER);
				if (m.getLayer(LAYER_ID)) m.removeLayer(LAYER_ID);
				if (m.getSource(SOURCE_ID)) m.removeSource(SOURCE_ID);
			} catch {
				/* ignore */
			}
		};
	}, [mapRef]);

	return null; // rendering via map layers
}
