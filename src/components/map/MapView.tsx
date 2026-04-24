import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
	useAircraft,
	useConflictEvents,
	useActiveJammingAlerts,
	useFires,
	useVessels,
	useNewsItems,
	useCyberThreats,
	useWeatherData,
	useSatellitePositions,
	useSeismicEvents,
	useDisasters,
	useISSPositions,
	useSocialPosts,
	useGdeltEvents,
	useThreatZones,
} from "../../hooks/useEntityData";
import { INITIAL_VIEW_STATE, MAP_STYLE } from "../../lib/constants";

import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// ==================== MILITARY DETECTION ====================
const MIL_RE = /^(REACH|EVAC|RCH|JAKE|KING|DUKE|NATO|RRR|SPAR|SAM|EXEC|TABOR|VIPER|COBRA|HAWK|FURY|WRATH|DOOM|REAPER|SKULL|ANGRY|RAGE|TOPGUN|BONE|GHOST|HAVOC|DEMON|RAZOR|CHAOS|HUNTER|STRIKE)/i;
const SQUAWK_MAP: Record<string, { label: string; color: string }> = {
	"7500": { label: "⚠ HIJACK", color: "#ef4444" },
	"7600": { label: "⚠ RADIO FAIL", color: "#f97316" },
	"7700": { label: "⚠ EMERGENCY", color: "#ef4444" },
};

interface MapViewProps {
	layers: Record<string, boolean>;
	onEntitySelect?: (entity: Record<string, unknown> | null) => void;
	flyTo?: { lat: number; lon: number } | null;
	onCursorMove?: (coords: { lat: number; lng: number } | null) => void;
	onViewChange?: (center: { lat: number; lng: number }, zoom: number, bounds: [[number, number], [number, number]] | null) => void;
	/** Ref callback to expose the map instance for screenshots */
	onMapReady?: (map: maplibregl.Map) => void;
	/** Show aircraft trails */
	showTrails?: boolean;
}

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

export function MapView({ layers, onEntitySelect, flyTo, onCursorMove, onViewChange, onMapReady, showTrails }: MapViewProps) {
	const aircraft = useAircraft();
	const conflicts = useConflictEvents();
	const jammingAlerts = useActiveJammingAlerts();
	const fires = useFires();
	const vessels = useVessels();
	const news = useNewsItems();
	const cyberThreats = useCyberThreats();
	const weatherData = useWeatherData();
	const satPositions = useSatellitePositions();
	const seismicEvents = useSeismicEvents();
	const disasters = useDisasters();
	const issPositions = useISSPositions();
	const socialPosts = useSocialPosts();
	const gdeltEvents = useGdeltEvents();
	const threatZones = useThreatZones();
	const simulateMovement = useMutation(api.entities.simulateAircraftMovement);
	const [map, setMap] = useState<maplibregl.Map | null>(null);
	const trailsEnabled = showTrails ?? false;
	const [trailHistory, setTrailHistory] = useState<Record<string, [number, number][]>>({});


	// Fly to location when triggered
	useEffect(() => {
		if (map && flyTo) {
			map.flyTo({ center: [flyTo.lon, flyTo.lat], zoom: 6, duration: 1500 });
		}
	}, [map, flyTo]);

	// Initialize map
	useEffect(() => {
		const m = new maplibregl.Map({
			container: "sentinel-map",
			style: MAP_STYLE,
			center: [INITIAL_VIEW_STATE.longitude, INITIAL_VIEW_STATE.latitude],
			zoom: INITIAL_VIEW_STATE.zoom,
			pitch: INITIAL_VIEW_STATE.pitch,
			bearing: INITIAL_VIEW_STATE.bearing,
			attributionControl: false,
		});

		m.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), "top-right");

		m.on("load", () => {
			setMap(m);
			onMapReady?.(m);

			// Cursor coordinate tracking
			m.on("mousemove", (e) => {
				onCursorMove?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
			});
			m.on("mouseout", () => onCursorMove?.(null));

			// View change tracking for minimap
			const emitView = () => {
				const c = m.getCenter();
				const b = m.getBounds();
				onViewChange?.(
					{ lat: c.lat, lng: c.lng },
					m.getZoom(),
					b ? [[b.getWest(), b.getSouth()], [b.getEast(), b.getNorth()]] : null,
				);
			};
			m.on("moveend", emitView);
			m.on("zoomend", emitView);
			emitView();

			// ===== ALL SOURCES =====
			const sources = [
				"aircraft-source", "military-source", "conflicts-source", "jamming-source",
				"fires-source", "vessels-source", "darkships-source", "fishing-source",
				"news-source", "cyber-source", "weather-source", "satpos-source",
				"iss-source", "iss-trail-source", "seismic-source", "disasters-source", "social-source",
				"gdelt-source", "threat-zones-source",
			];
			for (const id of sources) {
				if (id === "fires-source") {
					// Fires use clustering for dense areas
					m.addSource(id, { type: "geojson", data: EMPTY_FC, cluster: true, clusterMaxZoom: 8, clusterRadius: 40 });
				} else if (id === "conflicts-source") {
					m.addSource(id, { type: "geojson", data: EMPTY_FC, cluster: true, clusterMaxZoom: 6, clusterRadius: 35 });
				} else {
					m.addSource(id, { type: "geojson", data: EMPTY_FC });
				}
			}
			m.addSource("aircraft-trails-source", { type: "geojson", data: EMPTY_FC });

			// Create arrow icon for aircraft heading
			const arrowSize = 40;
			const canvas = document.createElement("canvas");
			canvas.width = arrowSize; canvas.height = arrowSize;
			const cx = canvas.getContext("2d")!;
			// Draw an upward-pointing arrow/chevron (will be rotated by heading)
			cx.clearRect(0, 0, arrowSize, arrowSize);
			cx.fillStyle = "#22d3ee";
			cx.beginPath();
			cx.moveTo(arrowSize / 2, 2);          // top point
			cx.lineTo(arrowSize - 6, arrowSize - 6); // bottom right
			cx.lineTo(arrowSize / 2, arrowSize - 12); // notch
			cx.lineTo(6, arrowSize - 6);            // bottom left
			cx.closePath();
			cx.fill();
			cx.strokeStyle = "#67e8f9"; cx.lineWidth = 1; cx.stroke();
			const arrowImg = cx.getImageData(0, 0, arrowSize, arrowSize);
			m.addImage("aircraft-arrow", arrowImg, { sdf: false });

			// Military arrow (orange)
			cx.clearRect(0, 0, arrowSize, arrowSize);
			cx.fillStyle = "#f97316";
			cx.beginPath();
			cx.moveTo(arrowSize / 2, 2);
			cx.lineTo(arrowSize - 6, arrowSize - 6);
			cx.lineTo(arrowSize / 2, arrowSize - 12);
			cx.lineTo(6, arrowSize - 6);
			cx.closePath();
			cx.fill();
			cx.strokeStyle = "#fdba74"; cx.lineWidth = 1; cx.stroke();
			m.addImage("military-arrow", cx.getImageData(0, 0, arrowSize, arrowSize), { sdf: false });

			// Emergency arrow (red)
			cx.clearRect(0, 0, arrowSize, arrowSize);
			cx.fillStyle = "#ef4444";
			cx.beginPath();
			cx.moveTo(arrowSize / 2, 2);
			cx.lineTo(arrowSize - 6, arrowSize - 6);
			cx.lineTo(arrowSize / 2, arrowSize - 12);
			cx.lineTo(6, arrowSize - 6);
			cx.closePath();
			cx.fill();
			cx.strokeStyle = "#fca5a5"; cx.lineWidth = 1.5; cx.stroke();
			m.addImage("emergency-arrow", cx.getImageData(0, 0, arrowSize, arrowSize), { sdf: false });

			// ===== THREAT ZONES (very bottom — soft glow) =====
			m.addLayer({
				id: "threat-zones-glow", type: "circle", source: "threat-zones-source",
				paint: {
					"circle-radius": ["interpolate", ["linear"], ["get", "radius"], 100, 50, 500, 100, 2000, 180],
					"circle-color": ["interpolate", ["linear"], ["get", "currentScore"],
						20, "rgba(34, 211, 238, 0.03)", 45, "rgba(234, 179, 8, 0.05)",
						65, "rgba(249, 115, 22, 0.06)", 80, "rgba(239, 68, 68, 0.08)"],
					"circle-blur": 1,
				},
			});
			m.addLayer({
				id: "threat-zones-ring", type: "circle", source: "threat-zones-source",
				paint: {
					"circle-radius": ["interpolate", ["linear"], ["get", "radius"], 100, 40, 500, 80, 2000, 150],
					"circle-color": "transparent",
					"circle-stroke-width": 1,
					"circle-stroke-color": ["interpolate", ["linear"], ["get", "currentScore"],
						20, "rgba(34, 211, 238, 0.1)", 45, "rgba(234, 179, 8, 0.2)",
						65, "rgba(249, 115, 22, 0.3)", 80, "rgba(239, 68, 68, 0.4)"],
					"circle-stroke-opacity": 0.6,
				},
			});
			m.addLayer({
				id: "threat-zones-labels", type: "symbol", source: "threat-zones-source",
				layout: {
					"text-field": ["concat", ["get", "name"], "\n", ["to-string", ["get", "currentScore"]]],
					"text-size": 9, "text-font": ["Open Sans Bold"],
				},
				paint: {
					"text-color": ["interpolate", ["linear"], ["get", "currentScore"],
						20, "#67e8f9", 45, "#fde047", 65, "#fb923c", 80, "#fca5a5"],
					"text-halo-color": "rgba(0,0,0,0.9)", "text-halo-width": 1.5,
				},
				minzoom: 3,
			});

			// ===== JAMMING LAYERS =====
			m.addLayer({
				id: "jamming-zone-layer", type: "circle", source: "jamming-source",
				paint: {
					"circle-radius": ["interpolate", ["linear"], ["get", "radius"], 40, 30, 100, 55, 200, 80],
					"circle-color": ["match", ["get", "severity"],
						"critical", "rgba(239, 68, 68, 0.15)", "high", "rgba(249, 115, 22, 0.12)",
						"medium", "rgba(234, 179, 8, 0.10)", "rgba(59, 130, 246, 0.08)"],
					"circle-stroke-width": 2,
					"circle-stroke-color": ["match", ["get", "severity"],
						"critical", "rgba(239, 68, 68, 0.6)", "high", "rgba(249, 115, 22, 0.5)",
						"medium", "rgba(234, 179, 8, 0.4)", "rgba(59, 130, 246, 0.3)"],
				},
			});
			m.addLayer({
				id: "jamming-center-layer", type: "circle", source: "jamming-source",
				paint: {
					"circle-radius": 6, "circle-color": "#ef4444",
					"circle-stroke-width": 3, "circle-stroke-color": "#fca5a5",
					"circle-opacity": ["interpolate", ["linear"], ["get", "avgCn0Drop"], 5, 0.5, 15, 1.0],
				},
			});
			m.addLayer({
				id: "jamming-labels", type: "symbol", source: "jamming-source",
				layout: {
					"text-field": ["concat", "⚠ ", ["get", "region"]],
					"text-size": 11, "text-offset": [0, -2], "text-anchor": "bottom",
					"text-font": ["Open Sans Bold"],
				},
				paint: { "text-color": "#fca5a5", "text-halo-color": "rgba(0,0,0,0.9)", "text-halo-width": 1.5 },
				minzoom: 3,
			});

			// ===== SEISMIC LAYER (concentric rings for magnitude) =====
			m.addLayer({
				id: "seismic-outer-ring", type: "circle", source: "seismic-source",
				paint: {
					"circle-radius": ["interpolate", ["linear"], ["get", "magnitude"], 1, 12, 4, 24, 6, 40, 8, 60],
					"circle-color": "transparent",
					"circle-stroke-width": ["interpolate", ["linear"], ["get", "magnitude"], 1, 0.5, 4, 1, 6, 1.5],
					"circle-stroke-color": ["interpolate", ["linear"], ["get", "magnitude"],
						2, "rgba(245,158,11,0.15)", 4, "rgba(249,115,22,0.2)", 6, "rgba(239,68,68,0.25)", 8, "rgba(220,38,38,0.3)"],
					"circle-stroke-opacity": 0.6,
				},
			});
			m.addLayer({
				id: "seismic-glow", type: "circle", source: "seismic-source",
				paint: {
					"circle-radius": ["interpolate", ["linear"], ["get", "magnitude"], 1, 8, 4, 16, 6, 28, 8, 40],
					"circle-color": "rgba(249, 115, 22, 0.08)", "circle-blur": 1,
				},
			});
			m.addLayer({
				id: "seismic-layer", type: "circle", source: "seismic-source",
				paint: {
					"circle-radius": ["interpolate", ["linear"], ["get", "magnitude"], 1, 3, 4, 6, 6, 12, 8, 20],
					"circle-color": ["interpolate", ["linear"], ["get", "magnitude"],
						2, "#f59e0b", 4, "#f97316", 5.5, "#ef4444", 7, "#dc2626"],
					"circle-opacity": 0.8,
					"circle-stroke-width": 2,
					"circle-stroke-color": ["interpolate", ["linear"], ["get", "magnitude"],
						2, "rgba(245,158,11,0.4)", 5, "rgba(239,68,68,0.5)", 7, "rgba(220,38,38,0.6)"],
				},
			});
			m.addLayer({
				id: "seismic-labels", type: "symbol", source: "seismic-source",
				layout: {
					"text-field": ["concat", "M", ["to-string", ["get", "magnitude"]]],
					"text-size": 10, "text-offset": [0, -1.5], "text-anchor": "bottom",
					"text-font": ["Open Sans Bold"],
				},
				paint: { "text-color": "#fb923c", "text-halo-color": "rgba(0,0,0,0.9)", "text-halo-width": 1.5 },
				minzoom: 3,
			});

			// ===== DISASTERS LAYER =====
			m.addLayer({
				id: "disasters-layer", type: "circle", source: "disasters-source",
				paint: {
					"circle-radius": ["match", ["get", "alertLevel"], "red", 10, "orange", 7, 5],
					"circle-color": ["match", ["get", "alertLevel"], "red", "#ef4444", "orange", "#f97316", "#eab308"],
					"circle-opacity": 0.8,
					"circle-stroke-width": 2.5,
					"circle-stroke-color": ["match", ["get", "alertLevel"], "red", "#fca5a5", "orange", "#fdba74", "#fde047"],
				},
			});
			m.addLayer({
				id: "disasters-labels", type: "symbol", source: "disasters-source",
				layout: {
					"text-field": ["get", "title"], "text-size": 9,
					"text-offset": [0, 1.5], "text-anchor": "top",
					"text-font": ["Open Sans Regular"],
					"text-max-width": 15,
				},
				paint: { "text-color": "#fca5a5", "text-halo-color": "rgba(0,0,0,0.8)", "text-halo-width": 1.2 },
				minzoom: 3,
			});

			// ===== FIRE CLUSTERS =====
			m.addLayer({
				id: "fires-cluster", type: "circle", source: "fires-source",
				filter: ["has", "point_count"],
				paint: {
					"circle-color": ["step", ["get", "point_count"],
						"#f97316", 20, "#ef4444", 100, "#dc2626"],
					"circle-radius": ["step", ["get", "point_count"],
						14, 20, 18, 100, 24],
					"circle-opacity": 0.85,
					"circle-stroke-width": 2,
					"circle-stroke-color": "rgba(255,200,100,0.4)",
				},
			});
			m.addLayer({
				id: "fires-cluster-count", type: "symbol", source: "fires-source",
				filter: ["has", "point_count"],
				layout: {
					"text-field": "{point_count_abbreviated}",
					"text-size": 10,
					"text-font": ["Open Sans Bold"],
				},
				paint: { "text-color": "#ffffff" },
			});

			// ===== FIRES HEATMAP (zoom < 6) =====
			m.addLayer({
				id: "fires-heat", type: "heatmap", source: "fires-source",
				filter: ["!", ["has", "point_count"]],
				maxzoom: 8,
				paint: {
					"heatmap-weight": ["interpolate", ["linear"], ["get", "brightness"], 300, 0.3, 400, 0.7, 500, 1],
					"heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 0.6, 6, 1.5],
					"heatmap-color": ["interpolate", ["linear"], ["heatmap-density"],
						0, "rgba(0,0,0,0)", 0.1, "rgba(255,140,0,0.15)", 0.3, "rgba(255,100,0,0.4)",
						0.5, "rgba(255,69,0,0.6)", 0.7, "rgba(255,30,0,0.8)", 1, "rgba(255,0,0,1)"],
					"heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 4, 4, 12, 7, 20],
					"heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 5, 0.9, 8, 0],
				},
			});
			// ===== FIRES POINTS (zoom >= 5, unclustered) =====
			m.addLayer({
				id: "fires-layer", type: "circle", source: "fires-source",
				filter: ["!", ["has", "point_count"]],
				minzoom: 4,
				paint: {
					"circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 1.5, 6, 3, 8, 5, 12, 8],
					"circle-color": ["interpolate", ["linear"], ["get", "brightness"],
						300, "#f59e0b", 350, "#f97316", 400, "#ef4444", 500, "#dc2626"],
					"circle-opacity": ["interpolate", ["linear"], ["zoom"], 4, 0.1, 6, 0.7, 8, 0.9],
					"circle-blur": 0.3,
				},
			});
			m.addLayer({
				id: "fires-glow", type: "circle", source: "fires-source",
				filter: ["!", ["has", "point_count"]],
				minzoom: 5,
				paint: {
					"circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 6, 8, 12, 12, 18],
					"circle-color": "rgba(249, 115, 22, 0.12)", "circle-blur": 1,
					"circle-opacity": ["interpolate", ["linear"], ["zoom"], 5, 0.3, 7, 0.6],
				},
			});

			// ===== VESSELS LAYER =====
			m.addLayer({
				id: "vessels-layer", type: "circle", source: "vessels-source",
				paint: {
					"circle-radius": 5, "circle-color": "#3b82f6",
					"circle-stroke-width": 1.5, "circle-stroke-color": "#93c5fd", "circle-opacity": 0.85,
				},
			});
			m.addLayer({
				id: "vessels-labels", type: "symbol", source: "vessels-source",
				layout: {
					"text-field": ["get", "name"], "text-size": 9,
					"text-offset": [0, 1.3], "text-anchor": "top", "text-font": ["Open Sans Regular"],
				},
				paint: { "text-color": "#93c5fd", "text-halo-color": "rgba(0,0,0,0.8)", "text-halo-width": 1 },
				minzoom: 5,
			});

			// ===== DARK SHIPS LAYER (AIS-gap vessels) =====
			m.addLayer({
				id: "darkships-layer", type: "circle", source: "darkships-source",
				paint: {
					"circle-radius": 6, "circle-color": "#ef4444",
					"circle-stroke-width": 2, "circle-stroke-color": "#fca5a5",
					"circle-opacity": 0.9,
				},
			});

			// ===== FISHING LAYER =====
			m.addLayer({
				id: "fishing-layer", type: "circle", source: "fishing-source",
				paint: {
					"circle-radius": 4, "circle-color": "#2dd4bf",
					"circle-stroke-width": 1, "circle-stroke-color": "#5eead4", "circle-opacity": 0.75,
				},
			});

			// ===== CYBER THREATS =====
			m.addLayer({
				id: "cyber-layer", type: "circle", source: "cyber-source",
				paint: {
					"circle-radius": ["match", ["get", "severity"], "critical", 7, "high", 5, 4],
					"circle-color": "#a855f7",
					"circle-stroke-width": 1.5, "circle-stroke-color": "#c084fc", "circle-opacity": 0.8,
				},
			});
			m.addLayer({
				id: "cyber-glow", type: "circle", source: "cyber-source",
				paint: { "circle-radius": 15, "circle-color": "rgba(168, 85, 247, 0.12)", "circle-blur": 1 },
			});

			// ===== NEWS / OSINT =====
			m.addLayer({
				id: "news-layer", type: "circle", source: "news-source",
				paint: {
					"circle-radius": 6,
					"circle-color": ["match", ["get", "category"],
						"conflict", "#f97316", "gnss", "#ef4444", "cyber", "#a855f7", "kinetic", "#dc2626", "#10b981"],
					"circle-stroke-width": 2, "circle-stroke-color": "#10b981", "circle-opacity": 0.75,
				},
			});

			// ===== SOCIAL POSTS (Reddit OSINT) =====
			m.addLayer({
				id: "social-layer", type: "circle", source: "social-source",
				paint: {
					"circle-radius": 5, "circle-color": "#ec4899",
					"circle-stroke-width": 1.5, "circle-stroke-color": "#f472b6",
					"circle-opacity": ["interpolate", ["linear"], ["get", "confidence"], 0, 0.3, 50, 0.6, 100, 0.9],
				},
			});

			// ===== GDELT EVENTS =====
			m.addLayer({
				id: "gdelt-layer", type: "circle", source: "gdelt-source",
				paint: {
					"circle-radius": 5,
					"circle-color": ["match", ["get", "category"],
						"nuclear", "#ef4444", "conflict", "#f97316", "cyber", "#a855f7", "maritime", "#3b82f6", "#eab308"],
					"circle-stroke-width": 1.5,
					"circle-stroke-color": ["match", ["get", "category"],
						"nuclear", "#fca5a5", "conflict", "#fdba74", "cyber", "#c084fc", "maritime", "#93c5fd", "#fde047"],
					"circle-opacity": 0.7,
				},
			});

			// ===== WEATHER =====
			m.addLayer({
				id: "weather-layer", type: "circle", source: "weather-source",
				paint: {
					"circle-radius": 12,
					"circle-color": ["interpolate", ["linear"], ["get", "temp"],
						-10, "#3b82f6", 0, "#06b6d4", 15, "#22c55e", 30, "#f97316", 45, "#ef4444"],
					"circle-opacity": 0.4,
					"circle-stroke-width": 1.5, "circle-stroke-color": "rgba(255,255,255,0.3)",
				},
			});
			m.addLayer({
				id: "weather-labels", type: "symbol", source: "weather-source",
				layout: {
					"text-field": ["concat", ["get", "name"], "\n", ["to-string", ["round", ["get", "temp"]]], "°C"],
					"text-size": 9, "text-font": ["Open Sans Regular"],
				},
				paint: { "text-color": "#e2e8f0", "text-halo-color": "rgba(0,0,0,0.9)", "text-halo-width": 1.5 },
				minzoom: 4,
			});

			// ===== ISS ORBIT =====
			m.addLayer({
				id: "iss-layer", type: "circle", source: "iss-source",
				paint: {
					"circle-radius": 8, "circle-color": "#facc15",
					"circle-stroke-width": 3, "circle-stroke-color": "#fef08a",
					"circle-opacity": 0.95,
				},
			});
			m.addLayer({
				id: "iss-glow", type: "circle", source: "iss-source",
				paint: { "circle-radius": 20, "circle-color": "rgba(250, 204, 21, 0.15)", "circle-blur": 1 },
			});
			m.addLayer({
				id: "iss-labels", type: "symbol", source: "iss-source",
				layout: {
					"text-field": "🚀 ISS", "text-size": 11,
					"text-offset": [0, -2], "text-anchor": "bottom",
					"text-font": ["Open Sans Bold"],
				},
				paint: { "text-color": "#fef08a", "text-halo-color": "rgba(0,0,0,0.9)", "text-halo-width": 1.5 },
			});

			// ISS orbit trail (dashed line connecting recent positions)
			m.addLayer({
				id: "iss-trail", type: "line", source: "iss-trail-source",
				paint: {
					"line-color": "#fef08a",
					"line-width": 1.5,
					"line-opacity": 0.5,
					"line-dasharray": [2, 3],
				},
			});

			// ===== SATELLITE POSITIONS =====
			m.addLayer({
				id: "satpos-layer", type: "circle", source: "satpos-source",
				paint: {
					"circle-radius": 5, "circle-color": "#84cc16",
					"circle-stroke-width": 2, "circle-stroke-color": "#a3e635", "circle-opacity": 0.9,
				},
			});
			m.addLayer({
				id: "satpos-labels", type: "symbol", source: "satpos-source",
				layout: {
					"text-field": ["get", "satName"], "text-size": 9,
					"text-offset": [0, 1.3], "text-anchor": "top", "text-font": ["Open Sans Regular"],
				},
				paint: { "text-color": "#a3e635", "text-halo-color": "rgba(0,0,0,0.9)", "text-halo-width": 1.2 },
				minzoom: 2,
			});

			// ===== AIRCRAFT TRAILS =====
			m.addLayer({
				id: "aircraft-trails-layer", type: "line", source: "aircraft-trails-source",
				paint: {
					"line-color": ["case",
						["get", "isMilitary"], "#f97316",
						["get", "isEmergency"], "#ef4444",
						"#22d3ee"],
					"line-width": 1.5,
					"line-opacity": 0.5,
					"line-dasharray": [2, 3],
				},
				layout: { "visibility": "none" },
			});

			// ===== AIRCRAFT (top layer) — directional arrows =====
			m.addLayer({
				id: "aircraft-layer", type: "symbol", source: "aircraft-source",
				layout: {
					"icon-image": ["case",
						["get", "isEmergency"], "emergency-arrow",
						["get", "isMilitary"], "military-arrow",
						"aircraft-arrow"],
					"icon-size": ["case",
						["get", "isEmergency"], 0.7,
						["get", "isMilitary"], 0.6,
						0.5],
					"icon-rotate": ["get", "heading"],
					"icon-rotation-alignment": "map",
					"icon-allow-overlap": true,
					"icon-ignore-placement": true,
				},
			});
			m.addLayer({
				id: "aircraft-labels", type: "symbol", source: "aircraft-source",
				layout: {
					"text-field": ["case",
						["has", "squawkLabel"], ["concat", ["get", "squawkLabel"], " ", ["get", "callsign"]],
						["get", "isMilitary"], ["concat", "🎖 ", ["get", "callsign"]],
						["get", "callsign"]],
					"text-size": 10,
					"text-offset": [0, 1.5], "text-anchor": "top",
					"text-font": ["Open Sans Regular"],
				},
				paint: {
					"text-color": ["case",
						["get", "isEmergency"], "#fca5a5",
						["get", "isMilitary"], "#fdba74",
						"#94a3b8"],
					"text-halo-color": "rgba(0,0,0,0.8)", "text-halo-width": 1,
				},
			});

			// ===== MILITARY AIRCRAFT (separate source for domain filtering) =====
			m.addLayer({
				id: "military-layer", type: "circle", source: "military-source",
				paint: {
					"circle-radius": 7, "circle-color": "#f97316",
					"circle-stroke-width": 2.5, "circle-stroke-color": "#fdba74",
					"circle-opacity": 0.95,
				},
			});
			m.addLayer({
				id: "military-labels", type: "symbol", source: "military-source",
				layout: {
					"text-field": ["concat", "🎖 ", ["get", "callsign"]],
					"text-size": 10, "text-offset": [0, 1.5], "text-anchor": "top",
					"text-font": ["Open Sans Bold"],
				},
				paint: { "text-color": "#fdba74", "text-halo-color": "rgba(0,0,0,0.9)", "text-halo-width": 1.5 },
			});

			// ===== CONFLICT CLUSTERS =====
			m.addLayer({
				id: "conflicts-cluster", type: "circle", source: "conflicts-source",
				filter: ["has", "point_count"],
				paint: {
					"circle-color": ["step", ["get", "point_count"],
						"#ef4444", 10, "#dc2626", 50, "#991b1b"],
					"circle-radius": ["step", ["get", "point_count"],
						12, 10, 16, 50, 22],
					"circle-opacity": 0.8,
					"circle-stroke-width": 2,
					"circle-stroke-color": "rgba(252,165,165,0.4)",
				},
			});
			m.addLayer({
				id: "conflicts-cluster-count", type: "symbol", source: "conflicts-source",
				filter: ["has", "point_count"],
				layout: {
					"text-field": "{point_count_abbreviated}",
					"text-size": 10,
					"text-font": ["Open Sans Bold"],
				},
				paint: { "text-color": "#ffffff" },
			});
			// ===== CONFLICT EVENTS (unclustered) =====
			m.addLayer({
				id: "conflicts-layer", type: "circle", source: "conflicts-source",
				filter: ["!", ["has", "point_count"]],
				paint: {
					"circle-radius": ["interpolate", ["linear"], ["get", "fatalities"], 0, 5, 5, 9, 10, 13, 20, 18],
					"circle-color": ["match", ["get", "severity"],
						"critical", "#ef4444", "high", "#f97316", "medium", "#eab308", "low", "#3b82f6", "#6b7280"],
					"circle-opacity": 0.7,
					"circle-stroke-width": 2,
					"circle-stroke-color": ["match", ["get", "severity"],
						"critical", "#fca5a5", "high", "#fdba74", "medium", "#fde047", "low", "#93c5fd", "#9ca3af"],
					"circle-stroke-opacity": 0.5,
				},
			});
			m.addLayer({
				id: "conflicts-labels", type: "symbol", source: "conflicts-source",
				filter: ["!", ["has", "point_count"]],
				layout: {
					"text-field": ["get", "location"], "text-size": 10,
					"text-offset": [0, 1.8], "text-anchor": "top", "text-font": ["Open Sans Regular"],
				},
				paint: { "text-color": "#fbbf24", "text-halo-color": "rgba(0,0,0,0.8)", "text-halo-width": 1 },
				minzoom: 4,
			});

			// ===== CLUSTER CLICK → ZOOM =====
			for (const clusterLayerId of ["fires-cluster", "conflicts-cluster"]) {
				const src = clusterLayerId.replace("-cluster", "-source");
				m.on("click", clusterLayerId, (e) => {
					const feature = e.features?.[0];
					if (!feature) return;
					const clusterId = feature.properties?.cluster_id;
					const source = m.getSource(src) as maplibregl.GeoJSONSource;
					source.getClusterExpansionZoom(clusterId).then((zoom) => {
						const coords = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
						m.easeTo({ center: coords, zoom: zoom + 0.5, duration: 500 });
					});
				});
				m.on("mouseenter", clusterLayerId, () => { m.getCanvas().style.cursor = "pointer"; });
				m.on("mouseleave", clusterLayerId, () => { m.getCanvas().style.cursor = ""; });
			}

			// ===== CLICK HANDLERS =====
			const clickLayers = [
				"aircraft-layer", "military-layer", "conflicts-layer", "jamming-center-layer",
				"fires-layer", "vessels-layer", "cyber-layer", "news-layer",
				"seismic-layer", "disasters-layer", "iss-layer", "social-layer", "gdelt-layer",
			];
			for (const layerId of clickLayers) {
				m.on("click", layerId, (e) => {
					if (e.features?.[0]?.properties) {
						onEntitySelect?.({ ...e.features[0].properties, _layerType: layerId.replace("-layer", "") });
					}
				});
				m.on("mouseenter", layerId, () => { m.getCanvas().style.cursor = "pointer"; });
				m.on("mouseleave", layerId, () => { m.getCanvas().style.cursor = ""; });
			}

			// ===== TOOLTIPS =====
			const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: "deck-tooltip" });

			m.on("mousemove", "aircraft-layer", (e) => {
				if (!e.features?.[0]) return;
				const p = e.features[0].properties!;
				const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number];
				const jammed = p.jammingFlag === true || p.jammingFlag === "true";
				const mil = p.isMilitary === true || p.isMilitary === "true";
				const squawkInfo = SQUAWK_MAP[p.squawk as string];
				popup.setLngLat(coords).setHTML(`
					<div style="font-family: monospace; font-size: 11px;">
						<div style="color: ${squawkInfo ? squawkInfo.color : mil ? "#f97316" : jammed ? "#ef4444" : "#22d3ee"}; font-weight: bold;">
							${squawkInfo ? squawkInfo.label + " " : mil ? "🎖 MIL " : ""}✈ ${p.callsign}
						</div>
						<div>ICAO: ${p.icao24} | ${p.originCountry}</div>
						<div>ALT: ${Math.round(Number(p.baroAltitude))}m | SPD: ${Math.round(Number(p.velocity))}m/s</div>
						${jammed ? '<div style="color: #ef4444; margin-top: 2px;">⚠ GNSS INTERFERENCE</div>' : ""}
						${squawkInfo ? `<div style="color: ${squawkInfo.color}; margin-top: 2px;">SQUAWK: ${p.squawk} ${squawkInfo.label}</div>` : ""}
					</div>`).addTo(m);
			});

			m.on("mousemove", "seismic-layer", (e) => {
				if (!e.features?.[0]) return;
				const p = e.features[0].properties!;
				const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number];
				popup.setLngLat(coords).setHTML(`
					<div style="font-family: monospace; font-size: 11px;">
						<div style="color: #f97316; font-weight: bold;">🌋 M${Number(p.magnitude).toFixed(1)} EARTHQUAKE</div>
						<div>${p.place}</div>
						<div>Depth: ${Number(p.depth).toFixed(1)}km | ${p.magType}</div>
						${p.tsunami === "true" || p.tsunami === true ? '<div style="color: #ef4444;">⚠ TSUNAMI WARNING</div>' : ""}
					</div>`).addTo(m);
			});

			m.on("mousemove", "disasters-layer", (e) => {
				if (!e.features?.[0]) return;
				const p = e.features[0].properties!;
				const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number];
				popup.setLngLat(coords).setHTML(`
					<div style="font-family: monospace; font-size: 11px;">
						<div style="color: #ef4444; font-weight: bold;">⚠ ${p.eventType} — ${p.alertLevel?.toUpperCase()}</div>
						<div style="max-width: 250px; word-wrap: break-word;">${p.title}</div>
						<div>${p.country} | ${p.source}</div>
					</div>`).addTo(m);
			});

			m.on("mousemove", "iss-layer", (e) => {
				if (!e.features?.[0]) return;
				const p = e.features[0].properties!;
				const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number];
				popup.setLngLat(coords).setHTML(`
					<div style="font-family: monospace; font-size: 11px;">
						<div style="color: #facc15; font-weight: bold;">🚀 ISS (ZARYA)</div>
						<div>ALT: ${Number(p.altitude).toFixed(1)}km | SPD: ${Number(p.velocity).toFixed(0)}km/h</div>
						<div>Visibility: ${p.visibility}</div>
					</div>`).addTo(m);
			});

			m.on("mousemove", "gdelt-layer", (e) => {
				if (!e.features?.[0]) return;
				const p = e.features[0].properties!;
				const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number];
				popup.setLngLat(coords).setHTML(`
					<div style="font-family: monospace; font-size: 11px; max-width: 280px;">
						<div style="color: #eab308; font-weight: bold;">📡 GDELT — ${String(p.category).toUpperCase()}</div>
						<div style="word-wrap: break-word;">${p.title}</div>
						<div style="color: #94a3b8;">${p.sourceName}</div>
					</div>`).addTo(m);
			});

			m.on("mousemove", "social-layer", (e) => {
				if (!e.features?.[0]) return;
				const p = e.features[0].properties!;
				const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number];
				popup.setLngLat(coords).setHTML(`
					<div style="font-family: monospace; font-size: 11px; max-width: 280px;">
						<div style="color: #ec4899; font-weight: bold;">📱 r/${p.subreddit}</div>
						<div style="word-wrap: break-word;">${p.title}</div>
						<div style="color: #94a3b8;">↑${p.score} | 💬${p.numComments}</div>
					</div>`).addTo(m);
			});

			m.on("mousemove", "conflicts-layer", (e) => {
				if (!e.features?.[0]) return;
				const p = e.features[0].properties!;
				const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number];
				popup.setLngLat(coords).setHTML(`
					<div style="font-family: monospace; font-size: 11px;">
						<div style="color: #f97316; font-weight: bold;">${p.eventType}</div>
						<div>${p.location}, ${p.country}</div>
						<div>${p.actor1}${p.actor2 ? ` vs ${p.actor2}` : ""}</div>
						<div>Fatalities: ${p.fatalities}</div>
					</div>`).addTo(m);
			});

			m.on("mousemove", "fires-layer", (e) => {
				if (!e.features?.[0]) return;
				const p = e.features[0].properties!;
				const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number];
				popup.setLngLat(coords).setHTML(`
					<div style="font-family: monospace; font-size: 11px;">
						<div style="color: #f97316; font-weight: bold;">🔥 THERMAL ANOMALY</div>
						<div>Brightness: ${Number(p.brightness).toFixed(1)}K | FRP: ${Number(p.frp).toFixed(1)}MW</div>
						<div>Confidence: ${p.confidence} | ${p.satellite}</div>
					</div>`).addTo(m);
			});

			m.on("mousemove", "vessels-layer", (e) => {
				if (!e.features?.[0]) return;
				const p = e.features[0].properties!;
				const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number];
				popup.setLngLat(coords).setHTML(`
					<div style="font-family: monospace; font-size: 11px;">
						<div style="color: #3b82f6; font-weight: bold;">🚢 ${p.name}</div>
						<div>MMSI: ${p.mmsi} | ${p.flag}</div>
						<div>Type: ${p.shipType} | Speed: ${Number(p.speed).toFixed(1)}kn</div>
					</div>`).addTo(m);
			});

			m.on("mousemove", "cyber-layer", (e) => {
				if (!e.features?.[0]) return;
				const p = e.features[0].properties!;
				const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number];
				popup.setLngLat(coords).setHTML(`
					<div style="font-family: monospace; font-size: 11px;">
						<div style="color: #a855f7; font-weight: bold;">🛡️ ${String(p.type).toUpperCase()}</div>
						<div>${p.ip}${p.port ? `:${p.port}` : ""} | ${p.service}</div>
						<div style="color: ${p.severity === "critical" ? "#ef4444" : "#f97316"};">${String(p.severity).toUpperCase()} — ${p.source}</div>
					</div>`).addTo(m);
			});

			m.on("mousemove", "news-layer", (e) => {
				if (!e.features?.[0]) return;
				const p = e.features[0].properties!;
				const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number];
				popup.setLngLat(coords).setHTML(`
					<div style="font-family: monospace; font-size: 11px; max-width: 280px;">
						<div style="color: #10b981; font-weight: bold;">📰 OSINT</div>
						<div style="font-weight: bold; margin: 2px 0;">${p.title}</div>
						<div style="color: #94a3b8;">${p.sourceName} | ${String(p.category).toUpperCase()}</div>
					</div>`).addTo(m);
			});

			m.on("mousemove", "jamming-center-layer", (e) => {
				if (!e.features?.[0]) return;
				const p = e.features[0].properties!;
				const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number];
				popup.setLngLat(coords).setHTML(`
					<div style="font-family: monospace; font-size: 11px;">
						<div style="color: #ef4444; font-weight: bold;">⚠ GNSS JAMMING</div>
						<div>${p.region} | Radius: ${p.radius}nm</div>
						<div>Aircraft: ${p.affectedAircraft} | C/N₀: -${p.avgCn0Drop}dB</div>
					</div>`).addTo(m);
			});

			const tooltipLayers = [
				"aircraft-layer", "military-layer", "conflicts-layer", "fires-layer", "vessels-layer",
				"cyber-layer", "news-layer", "jamming-center-layer", "seismic-layer", "disasters-layer",
				"iss-layer", "social-layer", "gdelt-layer",
			];
			for (const layerId of tooltipLayers) {
				m.on("mouseleave", layerId, () => popup.remove());
			}
		});

		return () => m.remove();
	}, []);

	// ===== DATA UPDATERS =====

	// Aircraft — with military + squawk detection
	useEffect(() => {
		if (!map?.isStyleLoaded()) return;
		const src = map.getSource("aircraft-source") as maplibregl.GeoJSONSource;
		if (!src) return;
		const milSrc = map.getSource("military-source") as maplibregl.GeoJSONSource;

		const allFeatures = aircraft.map((ac) => {
			const isMilitary = MIL_RE.test(ac.callsign || "");
			const squawkInfo = SQUAWK_MAP[ac.squawk || ""];
			return {
				type: "Feature" as const,
				geometry: { type: "Point" as const, coordinates: [ac.longitude, ac.latitude] },
				properties: {
					icao24: ac.icao24, callsign: ac.callsign, originCountry: ac.originCountry,
					baroAltitude: ac.baroAltitude, velocity: ac.velocity, heading: ac.heading,
					squawk: ac.squawk || "N/A", jammingFlag: ac.jammingFlag,
					isMilitary, isEmergency: !!squawkInfo,
					squawkLabel: squawkInfo?.label || "",
					latitude: ac.latitude, longitude: ac.longitude,
				},
			};
		});

		src.setData({ type: "FeatureCollection", features: allFeatures });

		if (milSrc) {
			milSrc.setData({
				type: "FeatureCollection",
				features: allFeatures.filter((f) => f.properties.isMilitary),
			});
		}
	}, [map, aircraft]);

	// ===== TRAIL TRACKING =====
	useEffect(() => {
		if (!trailsEnabled || !aircraft?.length) return;
		setTrailHistory(prev => {
			const next = { ...prev };
			for (const ac of aircraft) {
				const key = ac.icao24 || ac.callsign || "";
				if (!key) continue;
				const trail = next[key] || [];
				const lastPt = trail[trail.length - 1];
				if (!lastPt || lastPt[0] !== ac.longitude || lastPt[1] !== ac.latitude) {
					next[key] = [...trail.slice(-50), [ac.longitude, ac.latitude]];
				}
			}
			return next;
		});
	}, [aircraft, trailsEnabled]);

	useEffect(() => {
		if (!map?.isStyleLoaded()) return;
		const src = map.getSource("aircraft-trails-source") as maplibregl.GeoJSONSource;
		if (!src) return;
		const trailLayer = map.getLayoutProperty("aircraft-trails-layer", "visibility");
		if (trailsEnabled && trailLayer === "none") {
			map.setLayoutProperty("aircraft-trails-layer", "visibility", "visible");
		} else if (!trailsEnabled && trailLayer === "visible") {
			map.setLayoutProperty("aircraft-trails-layer", "visibility", "none");
		}
		if (!trailsEnabled) return;
		const features = Object.entries(trailHistory)
			.filter(([, pts]) => pts.length >= 2)
			.map(([key, pts]) => {
				const ac = aircraft.find(a => (a.icao24 || a.callsign) === key);
				return {
					type: "Feature" as const,
					geometry: { type: "LineString" as const, coordinates: pts },
					properties: {
						icao24: key,
						isMilitary: ac ? MIL_RE.test(ac.callsign || "") : false,
						isEmergency: ac ? !!SQUAWK_MAP[ac.squawk || ""] : false,
					},
				};
			});
		src.setData({ type: "FeatureCollection", features });
	}, [map, trailHistory, trailsEnabled, aircraft]);

	useEffect(() => {
		if (!map?.isStyleLoaded()) return;
		const src = map.getSource("conflicts-source") as maplibregl.GeoJSONSource;
		if (!src) return;
		src.setData({
			type: "FeatureCollection",
			features: conflicts.map((evt) => ({
				type: "Feature" as const,
				geometry: { type: "Point" as const, coordinates: [evt.longitude, evt.latitude] },
				properties: {
					eventId: evt.eventId, eventType: evt.eventType, subEventType: evt.subEventType,
					actor1: evt.actor1, actor2: evt.actor2 || "", country: evt.country,
					location: evt.location, fatalities: evt.fatalities, severity: evt.severity,
					eventDate: evt.eventDate, notes: evt.notes,
					latitude: evt.latitude, longitude: evt.longitude,
				},
			})),
		});
	}, [map, conflicts]);

	useEffect(() => {
		if (!map?.isStyleLoaded()) return;
		const src = map.getSource("jamming-source") as maplibregl.GeoJSONSource;
		if (!src) return;
		src.setData({
			type: "FeatureCollection",
			features: jammingAlerts.map((a) => ({
				type: "Feature" as const,
				geometry: { type: "Point" as const, coordinates: [a.centerLon, a.centerLat] },
				properties: {
					alertId: a.alertId, region: a.region, radius: a.radius,
					affectedAircraft: a.affectedAircraft, avgCn0Drop: a.avgCn0Drop,
					maxCn0Drop: a.maxCn0Drop, severity: a.severity, status: a.status,
					latitude: a.centerLat, longitude: a.centerLon,
				},
			})),
		});
	}, [map, jammingAlerts]);

	useEffect(() => {
		if (!map?.isStyleLoaded()) return;
		const src = map.getSource("fires-source") as maplibregl.GeoJSONSource;
		if (!src) return;
		src.setData({
			type: "FeatureCollection",
			features: fires.map((f) => ({
				type: "Feature" as const,
				geometry: { type: "Point" as const, coordinates: [f.longitude, f.latitude] },
				properties: {
					brightness: f.brightness, confidence: f.confidence, frp: f.frp,
					satellite: f.satellite, acqDate: f.acqDate, dayNight: f.dayNight,
					latitude: f.latitude, longitude: f.longitude,
				},
			})),
		});
	}, [map, fires]);

	// Vessels — split into normal / dark fleet / fishing
	useEffect(() => {
		if (!map?.isStyleLoaded()) return;
		const vesselSrc = map.getSource("vessels-source") as maplibregl.GeoJSONSource;
		const darkSrc = map.getSource("darkships-source") as maplibregl.GeoJSONSource;
		const fishSrc = map.getSource("fishing-source") as maplibregl.GeoJSONSource;
		if (!vesselSrc) return;

		const allFeatures = vessels.map((v) => ({
			type: "Feature" as const,
			geometry: { type: "Point" as const, coordinates: [v.longitude, v.latitude] },
			properties: {
				mmsi: v.mmsi, name: v.name, speed: v.speed, course: v.course,
				shipType: v.shipType, flag: v.flag, destination: v.destination, source: v.source,
				latitude: v.latitude, longitude: v.longitude,
			},
		}));

		const fishTypes = ["fishing", "trawler", "longliner", "seiner"];
		const fishFeatures = allFeatures.filter((f) =>
			fishTypes.some((t) => (f.properties.shipType || "").toLowerCase().includes(t)));
		const darkFeatures = allFeatures.filter((f) =>
			!f.properties.name || f.properties.name === "Unknown" || f.properties.speed < 0.5);
		const normalFeatures = allFeatures.filter((f) =>
			!fishFeatures.includes(f) && !darkFeatures.includes(f));

		vesselSrc.setData({ type: "FeatureCollection", features: normalFeatures });
		if (darkSrc) darkSrc.setData({ type: "FeatureCollection", features: darkFeatures });
		if (fishSrc) fishSrc.setData({ type: "FeatureCollection", features: fishFeatures });
	}, [map, vessels]);

	useEffect(() => {
		if (!map?.isStyleLoaded()) return;
		const src = map.getSource("news-source") as maplibregl.GeoJSONSource;
		if (!src) return;
		src.setData({
			type: "FeatureCollection",
			features: news.filter((n) => n.latitude && n.longitude).map((n) => ({
				type: "Feature" as const,
				geometry: { type: "Point" as const, coordinates: [n.longitude!, n.latitude!] },
				properties: {
					title: n.title, description: n.description, sourceName: n.sourceName,
					category: n.category, publishedAt: n.publishedAt, url: n.url,
					latitude: n.latitude, longitude: n.longitude,
				},
			})),
		});
	}, [map, news]);

	useEffect(() => {
		if (!map?.isStyleLoaded()) return;
		const src = map.getSource("cyber-source") as maplibregl.GeoJSONSource;
		if (!src) return;
		src.setData({
			type: "FeatureCollection",
			features: cyberThreats.map((t) => ({
				type: "Feature" as const,
				geometry: { type: "Point" as const, coordinates: [t.longitude, t.latitude] },
				properties: {
					threatId: t.threatId, type: t.type, ip: t.ip, port: t.port,
					service: t.service, severity: t.severity, description: t.description,
					source: t.source, latitude: t.latitude, longitude: t.longitude,
				},
			})),
		});
	}, [map, cyberThreats]);

	useEffect(() => {
		if (!map?.isStyleLoaded()) return;
		const src = map.getSource("weather-source") as maplibregl.GeoJSONSource;
		if (!src) return;
		src.setData({
			type: "FeatureCollection",
			features: weatherData.map((w) => ({
				type: "Feature" as const,
				geometry: { type: "Point" as const, coordinates: [w.longitude, w.latitude] },
				properties: {
					name: w.name, temp: w.temp, humidity: w.humidity, windSpeed: w.windSpeed,
					description: w.description, icon: w.icon,
					latitude: w.latitude, longitude: w.longitude,
				},
			})),
		});
	}, [map, weatherData]);

	useEffect(() => {
		if (!map?.isStyleLoaded()) return;
		const src = map.getSource("satpos-source") as maplibregl.GeoJSONSource;
		if (!src) return;
		src.setData({
			type: "FeatureCollection",
			features: satPositions.map((s) => ({
				type: "Feature" as const,
				geometry: { type: "Point" as const, coordinates: [s.longitude, s.latitude] },
				properties: {
					satId: s.satId, satName: s.satName, altitude: s.altitude, velocity: s.velocity,
					latitude: s.latitude, longitude: s.longitude,
				},
			})),
		});
	}, [map, satPositions]);

	// ===== NEW DATA SOURCES =====

	useEffect(() => {
		if (!map?.isStyleLoaded()) return;
		const src = map.getSource("seismic-source") as maplibregl.GeoJSONSource;
		if (!src) return;
		src.setData({
			type: "FeatureCollection",
			features: seismicEvents.map((e) => ({
				type: "Feature" as const,
				geometry: { type: "Point" as const, coordinates: [e.longitude, e.latitude] },
				properties: {
					eventId: e.eventId, magnitude: e.magnitude, place: e.place,
					depth: e.depth, magType: e.magType, tsunami: e.tsunami,
					severity: e.severity, url: e.url,
					latitude: e.latitude, longitude: e.longitude,
				},
			})),
		});
	}, [map, seismicEvents]);

	useEffect(() => {
		if (!map?.isStyleLoaded()) return;
		const src = map.getSource("disasters-source") as maplibregl.GeoJSONSource;
		if (!src) return;
		src.setData({
			type: "FeatureCollection",
			features: disasters.map((d) => ({
				type: "Feature" as const,
				geometry: { type: "Point" as const, coordinates: [d.longitude, d.latitude] },
				properties: {
					eventId: d.eventId, title: d.title, eventType: d.eventType,
					alertLevel: d.alertLevel, country: d.country, severity: d.severity,
					source: d.source, description: d.description,
					latitude: d.latitude, longitude: d.longitude,
				},
			})),
		});
	}, [map, disasters]);

	useEffect(() => {
		if (!map?.isStyleLoaded()) return;
		const src = map.getSource("iss-source") as maplibregl.GeoJSONSource;
		if (!src) return;
		const latest = issPositions[0]; // Most recent position
		src.setData({
			type: "FeatureCollection",
			features: latest ? [{
				type: "Feature" as const,
				geometry: { type: "Point" as const, coordinates: [latest.longitude, latest.latitude] },
				properties: {
					altitude: latest.altitude, velocity: latest.velocity,
					visibility: latest.visibility,
					latitude: latest.latitude, longitude: latest.longitude,
				},
			}] : [],
		});
		// Orbit trail - connect all stored positions as a line
		const trailSrc = map.getSource("iss-trail-source") as maplibregl.GeoJSONSource;
		if (trailSrc && issPositions.length >= 2) {
			const coords = issPositions.map((p) => [p.longitude, p.latitude]);
			trailSrc.setData({
				type: "FeatureCollection",
				features: [{
					type: "Feature" as const,
					geometry: { type: "LineString" as const, coordinates: coords },
					properties: {},
				}],
			});
		}
	}, [map, issPositions]);

	useEffect(() => {
		if (!map?.isStyleLoaded()) return;
		const src = map.getSource("social-source") as maplibregl.GeoJSONSource;
		if (!src) return;
		src.setData({
			type: "FeatureCollection",
			features: socialPosts.filter((p) => p.latitude && p.longitude).map((p) => ({
				type: "Feature" as const,
				geometry: { type: "Point" as const, coordinates: [p.longitude!, p.latitude!] },
				properties: {
					postId: p.postId, subreddit: p.subreddit, title: p.title,
					score: p.score, numComments: p.numComments,
					confidence: p.confidence, provenance: p.provenance,
					latitude: p.latitude, longitude: p.longitude,
				},
			})),
		});
	}, [map, socialPosts]);

	useEffect(() => {
		if (!map?.isStyleLoaded()) return;
		const src = map.getSource("gdelt-source") as maplibregl.GeoJSONSource;
		if (!src) return;
		src.setData({
			type: "FeatureCollection",
			features: gdeltEvents.map((g) => ({
				type: "Feature" as const,
				geometry: { type: "Point" as const, coordinates: [g.longitude, g.latitude] },
				properties: {
					eventId: g.eventId, title: g.title, category: g.category,
					sourceName: g.sourceName, sourceUrl: g.sourceUrl,
					severity: g.severity, confidence: g.confidence,
					latitude: g.latitude, longitude: g.longitude,
				},
			})),
		});
	}, [map, gdeltEvents]);

	useEffect(() => {
		if (!map?.isStyleLoaded()) return;
		const src = map.getSource("threat-zones-source") as maplibregl.GeoJSONSource;
		if (!src) return;
		src.setData({
			type: "FeatureCollection",
			features: threatZones.map((z) => ({
				type: "Feature" as const,
				geometry: { type: "Point" as const, coordinates: [z.longitude, z.latitude] },
				properties: {
					name: z.name, radius: z.radius, baseScore: z.baseScore,
					type: z.type, currentScore: z.currentScore,
					activeEvents: z.activeEvents,
					latitude: z.latitude, longitude: z.longitude,
				},
			})),
		});
	}, [map, threatZones]);

	// ===== LAYER VISIBILITY =====
	useEffect(() => {
		if (!map?.isStyleLoaded()) return;
		const layerMap: Record<string, string[]> = {
			aircraft: ["aircraft-layer", "aircraft-labels"],
			military: ["military-layer", "military-labels"],
			conflict: ["conflicts-cluster", "conflicts-cluster-count", "conflicts-layer", "conflicts-labels"],
			gnss: ["jamming-zone-layer", "jamming-center-layer", "jamming-labels"],
			wildfires: ["fires-cluster", "fires-cluster-count", "fires-heat", "fires-layer", "fires-glow"],
			ships: ["vessels-layer", "vessels-labels"],
			fishing: ["fishing-layer", "darkships-layer"],
			cyber: ["cyber-layer", "cyber-glow"],
			weather: ["weather-layer", "weather-labels"],
			satellites: ["satpos-layer", "satpos-labels", "iss-layer", "iss-glow", "iss-labels", "iss-trail"],
			seismic: ["seismic-outer-ring", "seismic-glow", "seismic-layer", "seismic-labels"],
			disasters: ["disasters-layer", "disasters-labels"],
			social: ["social-layer", "gdelt-layer"],
			nuclear: [],
		};
		// Threat zones always visible (they're info overlays)
		for (const id of ["threat-zones-glow", "threat-zones-ring", "threat-zones-labels"]) {
			try { map.setLayoutProperty(id, "visibility", "visible"); } catch { /* */ }
		}
		for (const [key, layerIds] of Object.entries(layerMap)) {
			const visible = layers[key] !== false;
			for (const id of layerIds) {
				try { map.setLayoutProperty(id, "visibility", visible ? "visible" : "none"); } catch { /* */ }
			}
		}
	}, [map, layers]);

	// Simulate aircraft movement every 5s
	useEffect(() => {
		const interval = setInterval(() => { simulateMovement().catch(() => {}); }, 5000);
		return () => clearInterval(interval);
	}, [simulateMovement]);

	return (
		<div className="relative w-full h-full">
			<div id="sentinel-map" className="w-full h-full" />
			<div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm text-[10px] font-mono text-slate-400 px-2 py-1 rounded border border-slate-700/50 pointer-events-none">
				SENTINEL-X v4.0.0 | MULTI-INT FUSION | {new Date().toISOString().replace("T", " ").slice(0, 19)}Z
			</div>
		</div>
	);
}
