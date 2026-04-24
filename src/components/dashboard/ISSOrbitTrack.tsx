/**
 * ISSOrbitTrack — Draws the ISS predicted orbit path on the map
 * Uses simplified SGP4-like calculation for the next ~90 minutes (1 orbit)
 * Shows: orbit line, ground track, current position marker
 */
import { useEffect, useRef, useCallback } from "react";
import type maplibregl from "maplibre-gl";

interface ISSOrbitTrackProps {
	mapRef: React.RefObject<maplibregl.Map | null>;
	enabled: boolean;
	/** Current ISS lat/lng from the live feed */
	issPosition?: { latitude: number; longitude: number; altitude?: number; velocity?: number } | null;
}

const ORBIT_SOURCE = "iss-orbit-source";
const ORBIT_LAYER = "iss-orbit-layer";
const ORBIT_FUTURE_LAYER = "iss-orbit-future-layer";
const ISS_MARKER_SOURCE = "iss-marker-source";
const ISS_MARKER_LAYER = "iss-marker-layer";
const ISS_LABEL_LAYER = "iss-label-layer";

/** ISS orbital period ≈ 92.68 minutes */
const ORBIT_PERIOD_MS = 92.68 * 60 * 1000;
/** Orbital inclination ≈ 51.6° */
const INCLINATION = 51.6;
/** Points to compute per orbit */
const POINTS_PER_ORBIT = 180;

/**
 * Simplified ISS ground track prediction.
 * Given current position, compute future positions along the orbit
 * using a sine-wave approximation of the inclined orbit.
 */
function predictOrbit(
	currentLat: number,
	currentLng: number,
	durationMs: number = ORBIT_PERIOD_MS,
	numPoints: number = POINTS_PER_ORBIT
): [number, number][] {
	const points: [number, number][] = [];
	const stepMs = durationMs / numPoints;

	// Earth rotation rate: ~360° / 86400s
	const earthRotRate = 360 / 86400; // deg/s

	// Determine current phase from latitude
	// lat = INCLINATION * sin(phase)
	const sinPhase = Math.max(-1, Math.min(1, currentLat / INCLINATION));
	let phase0 = Math.asin(sinPhase);

	// Determine if ascending or descending — use derivative sign heuristic
	// We'll try both and pick one that gives a more continuous track
	const angularRate = (2 * Math.PI) / (ORBIT_PERIOD_MS / 1000); // rad/s

	for (let i = 0; i <= numPoints; i++) {
		const tSec = (i * stepMs) / 1000;
		const phase = phase0 + angularRate * tSec;

		const lat = INCLINATION * Math.sin(phase);

		// Longitude advances due to orbit + Earth rotation beneath
		// Approximate: orbit moves ~360° per period in inertial frame
		// but Earth rotates ~22.9° per orbit, so ground track shifts west
		const orbitalLngRate = 360 / (ORBIT_PERIOD_MS / 1000); // deg/s in inertial
		const groundLngRate = orbitalLngRate - earthRotRate;
		let lng = currentLng + groundLngRate * tSec * Math.cos(phase);

		// Normalize longitude to [-180, 180]
		lng = ((lng + 540) % 360) - 180;

		points.push([lng, lat]);
	}

	return points;
}

/**
 * Split a line at the antimeridian to avoid MapLibre wrapping artifacts.
 * Returns multiple line segments.
 */
function splitAtAntimeridian(points: [number, number][]): [number, number][][] {
	const segments: [number, number][][] = [];
	let current: [number, number][] = [points[0]];

	for (let i = 1; i < points.length; i++) {
		const prev = points[i - 1];
		const curr = points[i];
		const lngDiff = Math.abs(curr[0] - prev[0]);

		if (lngDiff > 180) {
			// Antimeridian crossing
			segments.push(current);
			current = [curr];
		} else {
			current.push(curr);
		}
	}
	if (current.length > 1) segments.push(current);
	return segments;
}

export default function ISSOrbitTrack({ mapRef, enabled, issPosition }: ISSOrbitTrackProps) {
	const prevEnabled = useRef(false);

	const updateTrack = useCallback(() => {
		const map = mapRef.current;
		if (!map || !issPosition) return;

		const { latitude, longitude } = issPosition;

		// Predict orbit path
		const orbitPoints = predictOrbit(latitude, longitude, ORBIT_PERIOD_MS, POINTS_PER_ORBIT);

		// Split for antimeridian
		const segments = splitAtAntimeridian(orbitPoints);

		// Build GeoJSON MultiLineString
		const orbitGeoJSON: GeoJSON.FeatureCollection = {
			type: "FeatureCollection",
			features: segments.map((seg, idx) => ({
				type: "Feature" as const,
				properties: { segment: idx },
				geometry: {
					type: "LineString" as const,
					coordinates: seg,
				},
			})),
		};

		// ISS marker
		const markerGeoJSON: GeoJSON.FeatureCollection = {
			type: "FeatureCollection",
			features: [
				{
					type: "Feature",
					properties: {
						label: "ISS",
						altitude: issPosition.altitude ? `${Math.round(issPosition.altitude)}km` : "",
						velocity: issPosition.velocity ? `${Math.round(issPosition.velocity)}km/s` : "",
					},
					geometry: {
						type: "Point",
						coordinates: [longitude, latitude],
					},
				},
			],
		};

		// Update sources
		const orbitSrc = map.getSource(ORBIT_SOURCE) as maplibregl.GeoJSONSource | undefined;
		if (orbitSrc) {
			orbitSrc.setData(orbitGeoJSON as GeoJSON.GeoJSON);
		}

		const markerSrc = map.getSource(ISS_MARKER_SOURCE) as maplibregl.GeoJSONSource | undefined;
		if (markerSrc) {
			markerSrc.setData(markerGeoJSON as GeoJSON.GeoJSON);
		}
	}, [mapRef, issPosition]);

	// Add sources and layers
	useEffect(() => {
		const map = mapRef.current;
		if (!map) return;

		const setup = () => {
			// Orbit line source
			if (!map.getSource(ORBIT_SOURCE)) {
				map.addSource(ORBIT_SOURCE, {
					type: "geojson",
					data: { type: "FeatureCollection", features: [] } as GeoJSON.GeoJSON,
				});
			}

			// ISS marker source
			if (!map.getSource(ISS_MARKER_SOURCE)) {
				map.addSource(ISS_MARKER_SOURCE, {
					type: "geojson",
					data: { type: "FeatureCollection", features: [] } as GeoJSON.GeoJSON,
				});
			}

			// Orbit line layer (past path — dimmer)
			if (!map.getLayer(ORBIT_LAYER)) {
				map.addLayer({
					id: ORBIT_LAYER,
					type: "line",
					source: ORBIT_SOURCE,
					paint: {
						"line-color": "#fbbf24",
						"line-width": 1.5,
						"line-opacity": enabled ? 0.5 : 0,
						"line-dasharray": [4, 4],
					},
				});
			}

			// Future orbit (brighter)
			if (!map.getLayer(ORBIT_FUTURE_LAYER)) {
				map.addLayer({
					id: ORBIT_FUTURE_LAYER,
					type: "line",
					source: ORBIT_SOURCE,
					paint: {
						"line-color": "#fde68a",
						"line-width": 2,
						"line-opacity": enabled ? 0.8 : 0,
						"line-dasharray": [2, 2],
					},
					filter: ["==", ["get", "segment"], 0],
				});
			}

			// ISS marker
			if (!map.getLayer(ISS_MARKER_LAYER)) {
				map.addLayer({
					id: ISS_MARKER_LAYER,
					type: "circle",
					source: ISS_MARKER_SOURCE,
					paint: {
						"circle-radius": 8,
						"circle-color": "#fbbf24",
						"circle-opacity": enabled ? 1 : 0,
						"circle-stroke-width": 3,
						"circle-stroke-color": "#ffffff",
						"circle-stroke-opacity": enabled ? 0.8 : 0,
					},
				});
			}

			// ISS label
			if (!map.getLayer(ISS_LABEL_LAYER)) {
				map.addLayer({
					id: ISS_LABEL_LAYER,
					type: "symbol",
					source: ISS_MARKER_SOURCE,
					layout: {
						"text-field": ["concat", "🛰 ISS ", ["get", "altitude"]],
						"text-font": ["Open Sans Bold"],
						"text-size": 11,
						"text-offset": [0, -1.8],
						"text-anchor": "bottom",
					},
					paint: {
						"text-color": "#fde68a",
						"text-halo-color": "#000000",
						"text-halo-width": 1.5,
						"text-opacity": enabled ? 1 : 0,
					},
				});
			}
		};

		if (map.isStyleLoaded()) setup();
		else map.once("load", setup);
	}, [mapRef, enabled]);

	// Toggle visibility
	useEffect(() => {
		const map = mapRef.current;
		if (!map) return;

		const setVis = () => {
			const layers = [
				{ id: ORBIT_LAYER, prop: "line-opacity", val: enabled ? 0.5 : 0 },
				{ id: ORBIT_FUTURE_LAYER, prop: "line-opacity", val: enabled ? 0.8 : 0 },
				{ id: ISS_MARKER_LAYER, prop: "circle-opacity", val: enabled ? 1 : 0 },
				{ id: ISS_LABEL_LAYER, prop: "text-opacity", val: enabled ? 1 : 0 },
			];
			for (const l of layers) {
				try {
					if (map.getLayer(l.id)) map.setPaintProperty(l.id, l.prop, l.val);
				} catch {
					/* ignore */
				}
			}
			// Also update stroke opacity
			try {
				if (map.getLayer(ISS_MARKER_LAYER)) {
					map.setPaintProperty(ISS_MARKER_LAYER, "circle-stroke-opacity", enabled ? 0.8 : 0);
				}
			} catch {
				/* ignore */
			}
		};

		if (map.isStyleLoaded()) setVis();
		else map.once("load", setVis);

		prevEnabled.current = enabled;
	}, [mapRef, enabled]);

	// Update track when ISS position changes
	useEffect(() => {
		if (enabled && issPosition) {
			updateTrack();
		}
	}, [enabled, issPosition, updateTrack]);

	return null;
}
