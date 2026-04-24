/**
 * SuperclusterLayer — High-performance entity clustering for ALL entity types
 * Uses Supercluster.js for viewport-aware clustering with animated zoom transitions.
 * Renders cluster circles with counts, color-coded by dominant entity type.
 */
import { useEffect, useRef, useMemo, useCallback } from "react";
import Supercluster from "supercluster";
import type maplibregl from "maplibre-gl";
import {
	useAircraft,
	useConflictEvents,
	useActiveJammingAlerts,
	useFires,
	useVessels,
	useSeismicEvents,
	useDisasters,
	useSatellitePositions,
	useCyberThreats,
} from "../../hooks/useEntityData";

interface SuperclusterLayerProps {
	mapRef: React.RefObject<maplibregl.Map | null>;
	enabled: boolean;
	layers: Record<string, boolean>;
	onEntitySelect?: (entity: Record<string, unknown> | null) => void;
}

type EntityType = "aircraft" | "conflict" | "jamming" | "fire" | "vessel" | "seismic" | "disaster" | "satellite" | "cyber";

const TYPE_COLORS: Record<EntityType, string> = {
	aircraft: "#06b6d4",
	conflict: "#ef4444",
	jamming: "#f59e0b",
	fire: "#ff4500",
	vessel: "#3b82f6",
	seismic: "#22c55e",
	disaster: "#e879f9",
	satellite: "#a78bfa",
	cyber: "#f43f5e",
};

const TYPE_ICONS: Record<EntityType, string> = {
	aircraft: "✈",
	conflict: "💥",
	jamming: "📡",
	fire: "🔥",
	vessel: "🚢",
	seismic: "🌍",
	disaster: "⚠",
	satellite: "🛰",
	cyber: "🔒",
};

const SC_SRC = "supercluster-src";
const SC_CIRCLES = "supercluster-circles";
const SC_COUNTS = "supercluster-counts";
const SC_ICONS = "supercluster-icons";

interface PointProps {
	entityType: EntityType;
	label: string;
	entity: Record<string, unknown>;
}

export default function SuperclusterLayer({ mapRef, enabled, layers, onEntitySelect }: SuperclusterLayerProps) {
	const aircraft = useAircraft() ?? [];
	const conflicts = useConflictEvents() ?? [];
	const jamming = useActiveJammingAlerts() ?? [];
	const fires = useFires() ?? [];
	const vessels = useVessels() ?? [];
	const seismic = useSeismicEvents() ?? [];
	const disasters = useDisasters() ?? [];
	const satellites = useSatellitePositions() ?? [];
	const cyber = useCyberThreats() ?? [];

	const indexRef = useRef<Supercluster<PointProps, Supercluster.ClusterProperties> | null>(null);
	const prevEnabled = useRef(false);

	// Build GeoJSON points from all visible entity types
	const points = useMemo(() => {
		const pts: Supercluster.PointFeature<PointProps>[] = [];

		const push = (type: EntityType, layerKey: string, items: Record<string, unknown>[], latKey = "latitude", lngKey = "longitude", labelKey = "callsign") => {
			if (!layers[layerKey]) return;
			for (const item of items) {
				const lat = Number(item[latKey] ?? 0);
				const lng = Number(item[lngKey] ?? 0);
				if (!lat && !lng) continue;
				pts.push({
					type: "Feature",
					geometry: { type: "Point", coordinates: [lng, lat] },
					properties: {
						entityType: type,
						label: String(item[labelKey] ?? item.name ?? item.title ?? type),
						entity: item,
					},
				});
			}
		};

		push("aircraft", "aircraft", aircraft as Record<string, unknown>[], "latitude", "longitude", "callsign");
		push("conflict", "conflict", conflicts as Record<string, unknown>[], "latitude", "longitude", "eventType");
		push("jamming", "jamming", jamming as Record<string, unknown>[], "latitude", "longitude", "region");
		push("fire", "wildfires", fires as Record<string, unknown>[], "latitude", "longitude", "source");
		push("vessel", "vessels", vessels as Record<string, unknown>[], "latitude", "longitude", "name");
		push("seismic", "seismic", seismic as Record<string, unknown>[], "latitude", "longitude", "place");
		push("disaster", "disasters", disasters as Record<string, unknown>[], "latitude", "longitude", "title");
		push("satellite", "satellites", satellites as Record<string, unknown>[], "latitude", "longitude", "name");
		push("cyber", "cyber", cyber as Record<string, unknown>[], "latitude", "longitude", "type");

		return pts;
	}, [aircraft, conflicts, jamming, fires, vessels, seismic, disasters, satellites, cyber, layers]);

	// Build supercluster index
	useEffect(() => {
		if (!enabled) return;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const index = new Supercluster<PointProps, any>({
			radius: 60,
			maxZoom: 14,
			minZoom: 0,
			map: (props: PointProps) => ({
				entityType: props.entityType,
				typeCount: { [props.entityType]: 1 },
			}),
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			reduce: (accumulated: any, props: any) => {
				const tc = accumulated.typeCount as Record<string, number> | undefined;
				const ptc = props.typeCount as Record<string, number> | undefined;
				if (tc && ptc) {
					for (const [k, v] of Object.entries(ptc)) {
						tc[k] = (tc[k] || 0) + v;
					}
				}
			},
		});
		index.load(points);
		indexRef.current = index;
	}, [points, enabled]);

	// Determine dominant type color for a cluster
	const getDominantColor = useCallback((props: Record<string, unknown>): string => {
		const tc = props.typeCount as Record<string, number> | undefined;
		if (!tc) return "#6b7280";
		let maxType: EntityType = "aircraft";
		let maxCount = 0;
		for (const [type, count] of Object.entries(tc)) {
			if (count > maxCount) {
				maxCount = count;
				maxType = type as EntityType;
			}
		}
		return TYPE_COLORS[maxType] ?? "#6b7280";
	}, []);

	// Update map layers on zoom/move
	const updateClusters = useCallback(() => {
		const m = mapRef.current;
		const index = indexRef.current;
		if (!m || !index || !enabled) return;

		const bounds = m.getBounds();
		const zoom = Math.floor(m.getZoom());
		const clusters = index.getClusters(
			[bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
			zoom
		);

		const fc: GeoJSON.FeatureCollection = {
			type: "FeatureCollection",
			features: clusters.map((c) => {
				const isCluster = (c.properties as unknown as Record<string, unknown>).cluster;
				const count = (c.properties as unknown as Record<string, unknown>).point_count as number | undefined;
				const dominantColor = isCluster
					? getDominantColor(c.properties as unknown as Record<string, unknown>)
					: TYPE_COLORS[(c.properties as unknown as PointProps).entityType] ?? "#6b7280";

				// Build type breakdown string
				let breakdown = "";
				if (isCluster) {
					const tc = (c.properties as unknown as Record<string, unknown>).typeCount as Record<string, number> | undefined;
					if (tc) {
						breakdown = Object.entries(tc)
							.sort(([, a], [, b]) => b - a)
							.map(([t, n]) => `${TYPE_ICONS[t as EntityType] || "●"} ${n}`)
							.join("  ");
					}
				}

				return {
					...c,
					properties: {
						...c.properties,
						dominantColor,
						displayCount: isCluster ? String(count ?? "") : "",
						displayIcon: isCluster ? "" : TYPE_ICONS[(c.properties as unknown as PointProps).entityType] ?? "●",
						breakdown,
						radius: isCluster
							? Math.min(20 + Math.sqrt((count ?? 2)) * 5, 50)
							: 6,
					},
				};
			}),
		};

		const src = m.getSource(SC_SRC) as maplibregl.GeoJSONSource | undefined;
		if (src) {
			src.setData(fc);
		}
	}, [mapRef, enabled, getDominantColor]);

	// Setup map source + layers
	useEffect(() => {
		const m = mapRef.current;
		if (!m || !m.isStyleLoaded()) return;

		if (enabled && !prevEnabled.current) {
			// Add source + layers
			if (!m.getSource(SC_SRC)) {
				m.addSource(SC_SRC, {
					type: "geojson",
					data: { type: "FeatureCollection", features: [] },
				});
			}

			if (!m.getLayer(SC_CIRCLES)) {
				m.addLayer({
					id: SC_CIRCLES,
					type: "circle",
					source: SC_SRC,
					paint: {
						"circle-color": ["get", "dominantColor"],
						"circle-radius": ["get", "radius"],
						"circle-opacity": 0.7,
						"circle-stroke-width": 2,
						"circle-stroke-color": "rgba(255,255,255,0.5)",
					},
				});
			}

			if (!m.getLayer(SC_COUNTS)) {
				m.addLayer({
					id: SC_COUNTS,
					type: "symbol",
					source: SC_SRC,
					filter: ["has", "point_count"],
					layout: {
						"text-field": ["get", "displayCount"],
						"text-size": 12,
						"text-font": ["Open Sans Bold"],
						"text-allow-overlap": true,
					},
					paint: {
						"text-color": "#ffffff",
					},
				});
			}

			if (!m.getLayer(SC_ICONS)) {
				m.addLayer({
					id: SC_ICONS,
					type: "symbol",
					source: SC_SRC,
					filter: ["!", ["has", "point_count"]],
					layout: {
						"text-field": ["get", "displayIcon"],
						"text-size": 16,
						"text-allow-overlap": true,
					},
				});
			}

			// Click handler — zoom into cluster or select entity
			const handleClick = (e: maplibregl.MapMouseEvent) => {
				const features = m.queryRenderedFeatures(e.point, { layers: [SC_CIRCLES, SC_ICONS] });
				if (!features?.length) return;
				const f = features[0];
				const props = f.properties;
				if (!props) return;

				if (props.cluster) {
					const clusterId = props.cluster_id;
					const index = indexRef.current;
					if (index && clusterId != null) {
						const zoom = index.getClusterExpansionZoom(Number(clusterId));
						const coords = (f.geometry as GeoJSON.Point).coordinates;
						m.easeTo({ center: [coords[0], coords[1]], zoom, duration: 500 });
					}
				} else {
					// Single entity — parse entity from properties
					try {
						const entityStr = props.entity;
						const entity = typeof entityStr === "string" ? JSON.parse(entityStr) : entityStr;
						onEntitySelect?.(entity);
					} catch {
						// Fallback
					}
				}
			};

			m.on("click", SC_CIRCLES, handleClick);
			m.on("click", SC_ICONS, handleClick);
			m.on("mouseenter", SC_CIRCLES, () => { m.getCanvas().style.cursor = "pointer"; });
			m.on("mouseleave", SC_CIRCLES, () => { m.getCanvas().style.cursor = ""; });

			// Listen for zoom/move
			m.on("moveend", updateClusters);
			m.on("zoomend", updateClusters);

			// Initial render
			updateClusters();
		}

		if (!enabled && prevEnabled.current) {
			// Cleanup
			if (m.getLayer(SC_ICONS)) m.removeLayer(SC_ICONS);
			if (m.getLayer(SC_COUNTS)) m.removeLayer(SC_COUNTS);
			if (m.getLayer(SC_CIRCLES)) m.removeLayer(SC_CIRCLES);
			if (m.getSource(SC_SRC)) m.removeSource(SC_SRC);
			m.off("moveend", updateClusters);
			m.off("zoomend", updateClusters);
		}

		prevEnabled.current = enabled;
	}, [enabled, mapRef, updateClusters, onEntitySelect]);

	// Re-run clustering when data changes
	useEffect(() => {
		if (enabled) updateClusters();
	}, [points, enabled, updateClusters]);

	return null; // Pure map layer — no DOM
}
