/**
 * SolarTerminator — Night/Day overlay
 * Draws a polygon covering the night side of the Earth based on solar position.
 * Updates every 60 seconds.
 */
import { useEffect, useRef, useCallback } from "react";
import type maplibregl from "maplibre-gl";

interface SolarTerminatorProps {
	mapRef: React.RefObject<maplibregl.Map | null>;
	enabled: boolean;
}

const SOURCE_ID = "solar-terminator-source";
const LAYER_ID = "solar-terminator-layer";

/** Compute sun's declination and equation of time */
function solarPosition(date: Date): { lat: number; lng: number } {
	const dayOfYear = Math.floor(
		(date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000
	);
	const declination = -23.44 * Math.cos((360 / 365) * (dayOfYear + 10) * (Math.PI / 180));
	const hourAngle =
		((date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600) / 24) *
			360 -
		180;
	return { lat: declination, lng: -hourAngle };
}

/** Generate the terminator polygon as a GeoJSON ring */
function terminatorGeoJSON(date: Date): GeoJSON.FeatureCollection {
	const sun = solarPosition(date);
	const decRad = (sun.lat * Math.PI) / 180;

	// 360 points along the terminator
	const points: [number, number][] = [];
	for (let i = 0; i <= 360; i++) {
		const lngDeg = -180 + i;
		const lngRad = (lngDeg * Math.PI) / 180;
		// Latitude where the terminator crosses this longitude
		const latRad = Math.atan(
			-Math.cos(lngRad - (sun.lng * Math.PI) / 180) / Math.tan(decRad)
		);
		const latDeg = (latRad * 180) / Math.PI;
		points.push([lngDeg, latDeg]);
	}

	// Determine which pole is in darkness
	const nightPole = sun.lat >= 0 ? -90 : 90;

	// Build the night polygon: terminator line → pole → close
	const nightPoly: [number, number][] = [
		...points,
		[180, nightPole],
		[-180, nightPole],
		points[0], // close ring
	];

	return {
		type: "FeatureCollection",
		features: [
			{
				type: "Feature",
				properties: {},
				geometry: {
					type: "Polygon",
					coordinates: [nightPoly],
				},
			},
		],
	};
}

export default function SolarTerminator({ mapRef, enabled }: SolarTerminatorProps) {
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const update = useCallback(() => {
		const map = mapRef.current;
		if (!map) return;

		const geojson = terminatorGeoJSON(new Date());
		const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;

		if (source) {
			source.setData(geojson as GeoJSON.GeoJSON);
		}
	}, [mapRef]);

	useEffect(() => {
		const map = mapRef.current;
		if (!map) return;

		const setup = () => {
			// Add source if not present
			if (!map.getSource(SOURCE_ID)) {
				map.addSource(SOURCE_ID, {
					type: "geojson",
					data: terminatorGeoJSON(new Date()) as GeoJSON.GeoJSON,
				});
			}

			// Add layer if not present
			if (!map.getLayer(LAYER_ID)) {
				map.addLayer({
					id: LAYER_ID,
					type: "fill",
					source: SOURCE_ID,
					paint: {
						"fill-color": "#0a0e1a",
						"fill-opacity": enabled ? 0.4 : 0,
					},
				});
			}
		};

		if (map.isStyleLoaded()) {
			setup();
		} else {
			map.once("load", setup);
		}

		return () => {
			// Don't remove source/layer on unmount, just manage visibility
		};
	}, [mapRef, enabled]);

	// Toggle visibility
	useEffect(() => {
		const map = mapRef.current;
		if (!map) return;

		const setVis = () => {
			if (map.getLayer(LAYER_ID)) {
				map.setPaintProperty(LAYER_ID, "fill-opacity", enabled ? 0.4 : 0);
			}
		};

		if (map.isStyleLoaded()) {
			setVis();
		} else {
			map.once("load", setVis);
		}
	}, [mapRef, enabled]);

	// Update every 60 seconds
	useEffect(() => {
		if (!enabled) {
			if (intervalRef.current) clearInterval(intervalRef.current);
			intervalRef.current = null;
			return;
		}

		update();
		intervalRef.current = setInterval(update, 60_000);

		return () => {
			if (intervalRef.current) clearInterval(intervalRef.current);
		};
	}, [enabled, update]);

	return null; // Purely imperative — renders to map
}
