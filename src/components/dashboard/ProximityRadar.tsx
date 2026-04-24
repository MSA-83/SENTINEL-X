import { useEffect, useRef, useCallback, useState } from "react";
import type maplibregl from "maplibre-gl";

/* ── Concentric Range Rings ──────────────────────────────────────────── */
const RINGS_KM = [25, 50, 100, 200, 500]; // 5 concentric rings
const RING_COLORS = ["#00ffff88", "#00ccff66", "#0099ff44", "#0066ff33", "#0033ff22"];

function ringGeoJSON(lat: number, lon: number, radiusKm: number): GeoJSON.Feature<GeoJSON.LineString> {
	const points = 96;
	const coords: [number, number][] = [];
	for (let i = 0; i <= points; i++) {
		const angle = (i / points) * 2 * Math.PI;
		const dLat = (radiusKm / 111.32) * Math.cos(angle);
		const dLon = (radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180))) * Math.sin(angle);
		coords.push([lon + dLon, lat + dLat]);
	}
	return {
		type: "Feature",
		properties: { radiusKm },
		geometry: { type: "LineString", coordinates: coords },
	};
}

function crosshairGeoJSON(lat: number, lon: number): GeoJSON.FeatureCollection {
	const len = 600 / 111.32; // ~600km arms
	return {
		type: "FeatureCollection",
		features: [
			{
				type: "Feature",
				properties: {},
				geometry: { type: "LineString", coordinates: [[lon - len, lat], [lon + len, lat]] },
			},
			{
				type: "Feature",
				properties: {},
				geometry: { type: "LineString", coordinates: [[lon, lat - len], [lon, lat + len]] },
			},
		],
	};
}

/* ── Component ───────────────────────────────────────────────────────── */
interface ProximityRadarProps {
	map: maplibregl.Map | null;
	center: { lat: number; lon: number } | null; // null = disabled
	onClose: () => void;
}

const SRC_PREFIX = "sx-prox-";
const LAYER_PREFIX = "sx-prox-";

export default function ProximityRadar({ map, center, onClose }: ProximityRadarProps) {
	const activeRef = useRef(false);
	const [showLabels, setShowLabels] = useState(true);

	/* Cleanup helper */
	const cleanup = useCallback(() => {
		if (!map) return;
		try {
			// Remove ring layers + sources
			for (let i = 0; i < RINGS_KM.length; i++) {
				const layerId = `${LAYER_PREFIX}ring-${i}`;
				const srcId = `${SRC_PREFIX}ring-${i}`;
				if (map.getLayer(layerId)) map.removeLayer(layerId);
				if (map.getSource(srcId)) map.removeSource(srcId);
				// Label layers
				const lblId = `${LAYER_PREFIX}lbl-${i}`;
				const lblSrc = `${SRC_PREFIX}lbl-${i}`;
				if (map.getLayer(lblId)) map.removeLayer(lblId);
				if (map.getSource(lblSrc)) map.removeSource(lblSrc);
			}
			// Crosshair
			if (map.getLayer(`${LAYER_PREFIX}cross`)) map.removeLayer(`${LAYER_PREFIX}cross`);
			if (map.getSource(`${SRC_PREFIX}cross`)) map.removeSource(`${SRC_PREFIX}cross`);
			// Center dot
			if (map.getLayer(`${LAYER_PREFIX}dot`)) map.removeLayer(`${LAYER_PREFIX}dot`);
			if (map.getSource(`${SRC_PREFIX}dot`)) map.removeSource(`${SRC_PREFIX}dot`);
		} catch {
			/* style may have changed */
		}
		activeRef.current = false;
	}, [map]);

	/* Render rings */
	useEffect(() => {
		if (!map || !center) {
			cleanup();
			return;
		}

		// Clean first
		cleanup();
		activeRef.current = true;

		const { lat, lon } = center;

		// Crosshair
		try {
			map.addSource(`${SRC_PREFIX}cross`, { type: "geojson", data: crosshairGeoJSON(lat, lon) });
			map.addLayer({
				id: `${LAYER_PREFIX}cross`,
				type: "line",
				source: `${SRC_PREFIX}cross`,
				paint: { "line-color": "#00ffff22", "line-width": 1, "line-dasharray": [6, 6] },
			});
		} catch { /* */ }

		// Center dot
		try {
			map.addSource(`${SRC_PREFIX}dot`, {
				type: "geojson",
				data: {
					type: "FeatureCollection",
					features: [{
						type: "Feature", properties: {},
						geometry: { type: "Point", coordinates: [lon, lat] },
					}],
				},
			});
			map.addLayer({
				id: `${LAYER_PREFIX}dot`,
				type: "circle",
				source: `${SRC_PREFIX}dot`,
				paint: {
					"circle-radius": 6,
					"circle-color": "#00ffff",
					"circle-opacity": 0.9,
					"circle-stroke-width": 2,
					"circle-stroke-color": "#000",
				},
			});
		} catch { /* */ }

		// Concentric rings
		RINGS_KM.forEach((r, i) => {
			const srcId = `${SRC_PREFIX}ring-${i}`;
			const layerId = `${LAYER_PREFIX}ring-${i}`;
			try {
				map.addSource(srcId, {
					type: "geojson",
					data: { type: "FeatureCollection", features: [ringGeoJSON(lat, lon, r)] },
				});
				map.addLayer({
					id: layerId,
					type: "line",
					source: srcId,
					paint: {
						"line-color": RING_COLORS[i],
						"line-width": 1.5,
						"line-dasharray": [4, 4],
					},
				});
			} catch { /* */ }

			// Distance labels
			if (showLabels) {
				const lblSrc = `${SRC_PREFIX}lbl-${i}`;
				const lblId = `${LAYER_PREFIX}lbl-${i}`;
				try {
					map.addSource(lblSrc, {
						type: "geojson",
						data: {
							type: "FeatureCollection",
							features: [{
								type: "Feature",
								properties: { text: `${r} km` },
								geometry: {
									type: "Point",
									coordinates: [lon, lat + r / 111.32], // top of ring
								},
							}],
						},
					});
					map.addLayer({
						id: lblId,
						type: "symbol",
						source: lblSrc,
						layout: {
							"text-field": ["get", "text"],
							"text-size": 10,
							"text-font": ["Open Sans Bold"],
							"text-anchor": "bottom",
						},
						paint: {
							"text-color": "#00ddff",
							"text-halo-color": "#000000",
							"text-halo-width": 1.5,
						},
					});
				} catch { /* */ }
			}
		});

		return () => {
			if (activeRef.current) cleanup();
		};
	}, [map, center, cleanup, showLabels]);

	if (!center) return null;

	return (
		<div className="absolute top-16 right-4 z-30 bg-slate-900/95 border border-cyan-900/50
		                rounded-lg backdrop-blur-md shadow-xl shadow-black/60 p-2 font-mono text-[10px] w-48">
			<div className="flex items-center justify-between mb-1">
				<span className="text-cyan-400 tracking-widest">◎ PROXIMITY RADAR</span>
				<button onClick={onClose} className="text-slate-500 hover:text-cyan-300">✕</button>
			</div>
			<div className="text-slate-400 mb-1">
				{center.lat.toFixed(4)}°, {center.lon.toFixed(4)}°
			</div>
			<div className="flex flex-wrap gap-1 mb-2">
				{RINGS_KM.map((r, i) => (
					<span key={r} className="px-1.5 py-0.5 rounded text-[8px] border" style={{
						borderColor: RING_COLORS[i], color: RING_COLORS[i].slice(0, 7),
					}}>
						{r}km
					</span>
				))}
			</div>
			<label className="flex items-center gap-2 text-slate-400 cursor-pointer">
				<input
					type="checkbox" checked={showLabels}
					onChange={(e) => setShowLabels(e.target.checked)}
					className="accent-cyan-500"
				/>
				Show range labels
			</label>
		</div>
	);
}
