/**
 * TerrainControl — 3D Terrain + Hillshade + Extruded Buildings
 * Adds MapTiler terrain tiles, hillshade shading, and 3D extruded buildings at high zoom.
 * Toggle-able via left sidebar button.
 */
import { useEffect, useRef, useCallback } from "react";
import type maplibregl from "maplibre-gl";

interface TerrainControlProps {
	mapRef: React.RefObject<maplibregl.Map | null>;
	enabled: boolean;
}

const TERRAIN_SRC = "terrain-dem";
const HILLSHADE_SRC = "hillshade-dem";
const HILLSHADE_LYR = "hillshade-layer";
const BUILDINGS_SRC = "openmaptiles";
const BUILDINGS_LYR = "3d-buildings";

export default function TerrainControl({ mapRef, enabled }: TerrainControlProps) {
	const wasEnabled = useRef(false);

	const setupTerrain = useCallback(() => {
		const m = mapRef.current;
		if (!m || !m.isStyleLoaded()) return;

		if (enabled && !wasEnabled.current) {
			// Add terrain DEM source
			if (!m.getSource(TERRAIN_SRC)) {
				m.addSource(TERRAIN_SRC, {
					type: "raster-dem",
					tiles: [
						"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
					],
					tileSize: 256,
					maxzoom: 15,
					encoding: "terrarium",
				});
			}

			// Enable 3D terrain exaggeration
			m.setTerrain({ source: TERRAIN_SRC, exaggeration: 1.3 });

			// Add hillshade source + layer
			if (!m.getSource(HILLSHADE_SRC)) {
				m.addSource(HILLSHADE_SRC, {
					type: "raster-dem",
					tiles: [
						"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
					],
					tileSize: 256,
					maxzoom: 15,
					encoding: "terrarium",
				});
			}

			if (!m.getLayer(HILLSHADE_LYR)) {
				// Insert hillshade below all other layers for nice shading
				const layers = m.getStyle().layers;
				const firstSymbol = layers?.find(l => l.type === "symbol");
				m.addLayer({
					id: HILLSHADE_LYR,
					type: "hillshade",
					source: HILLSHADE_SRC,
					paint: {
						"hillshade-exaggeration": 0.5,
						"hillshade-shadow-color": "#000000",
						"hillshade-highlight-color": "#ffffff",
						"hillshade-accent-color": "#1a1a2e",
						"hillshade-illumination-direction": 315,
					},
				}, firstSymbol?.id);
			}

			// Add 3D extruded buildings (from vector tiles if available at zoom >= 14)
			if (!m.getSource(BUILDINGS_SRC)) {
				m.addSource(BUILDINGS_SRC, {
					type: "vector",
					tiles: [
						"https://tiles.stadiamaps.com/data/openmaptiles/{z}/{x}/{y}.pbf",
					],
					maxzoom: 14,
				});
			}

			if (!m.getLayer(BUILDINGS_LYR)) {
				m.addLayer({
					id: BUILDINGS_LYR,
					source: BUILDINGS_SRC,
					"source-layer": "building",
					type: "fill-extrusion",
					minzoom: 13,
					paint: {
						"fill-extrusion-color": [
							"interpolate", ["linear"], ["get", "render_height"],
							0, "#0f172a",
							50, "#1e293b",
							100, "#334155",
							200, "#475569",
						],
						"fill-extrusion-height": [
							"interpolate", ["linear"], ["zoom"],
							13, 0,
							14.5, ["get", "render_height"],
						],
						"fill-extrusion-base": [
							"interpolate", ["linear"], ["zoom"],
							13, 0,
							14.5, ["get", "render_min_height"],
						],
						"fill-extrusion-opacity": 0.7,
					},
				});
			}

			// Pitch the camera for better 3D perspective
			m.easeTo({ pitch: 55, duration: 1000 });

		} else if (!enabled && wasEnabled.current) {
			// Remove terrain
			m.setTerrain(undefined as unknown as maplibregl.TerrainSpecification);

			// Remove layers + sources
			if (m.getLayer(BUILDINGS_LYR)) m.removeLayer(BUILDINGS_LYR);
			if (m.getLayer(HILLSHADE_LYR)) m.removeLayer(HILLSHADE_LYR);
			// Don't remove sources as they may be slow to re-add
			// Reset pitch
			m.easeTo({ pitch: 0, duration: 800 });
		}

		wasEnabled.current = enabled;
	}, [mapRef, enabled]);

	useEffect(() => {
		setupTerrain();
	}, [setupTerrain]);

	// Also try on style load in case map wasn't ready
	useEffect(() => {
		const m = mapRef.current;
		if (!m) return;
		const handler = () => setupTerrain();
		m.on("styledata", handler);
		return () => { m.off("styledata", handler); };
	}, [mapRef, setupTerrain]);

	return null; // Pure map control — no DOM
}
