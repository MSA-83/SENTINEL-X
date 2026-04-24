/**
 * MeasurementTools — Distance ruler + area calculator
 * Great-circle (Haversine) distance, polygon area via spherical excess
 */
import { useState, useCallback, useEffect, useRef } from "react";
import type maplibregl from "maplibre-gl";

interface MeasurementToolsProps {
	mapRef: React.RefObject<maplibregl.Map | null>;
}

type MeasureMode = "idle" | "distance" | "area";

interface MeasurePoint {
	lng: number;
	lat: number;
}

const R_EARTH_KM = 6371;
const R_EARTH_NM = 3440.065;

function toRad(d: number): number { return d * Math.PI / 180; }

/** Haversine distance in km */
function haversine(a: MeasurePoint, b: MeasurePoint): number {
	const dLat = toRad(b.lat - a.lat);
	const dLng = toRad(b.lng - a.lng);
	const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
	return 2 * R_EARTH_KM * Math.asin(Math.sqrt(h));
}

/** Spherical polygon area (km²) via spherical excess */
function sphericalArea(pts: MeasurePoint[]): number {
	if (pts.length < 3) return 0;
	const n = pts.length;
	let sum = 0;
	for (let i = 0; i < n; i++) {
		const j = (i + 1) % n;
		const k = (i + 2) % n;
		const lat1 = toRad(pts[i].lat), lng1 = toRad(pts[i].lng);
		const lat2 = toRad(pts[j].lat), lng2 = toRad(pts[j].lng);
		const lat3 = toRad(pts[k].lat), lng3 = toRad(pts[k].lng);
		sum += (lng3 - lng1) * Math.sin(lat2);
		void lat1; void lat3; void lng2;
	}
	return Math.abs(sum) * R_EARTH_KM * R_EARTH_KM / 2;
}

function formatDist(km: number): string {
	const nm = km * (R_EARTH_NM / R_EARTH_KM);
	const mi = km * 0.621371;
	if (km < 1) return `${(km * 1000).toFixed(0)}m`;
	return `${km.toFixed(1)}km · ${nm.toFixed(1)}nm · ${mi.toFixed(1)}mi`;
}

function formatArea(km2: number): string {
	if (km2 < 1) return `${(km2 * 1e6).toFixed(0)} m²`;
	if (km2 > 1e6) return `${(km2 / 1e6).toFixed(2)} M km²`;
	return `${km2.toFixed(1)} km²`;
}

const SRC_LINE = "measure-line-src";
const SRC_POINTS = "measure-points-src";
const SRC_POLY = "measure-poly-src";
const LYR_LINE = "measure-line-lyr";
const LYR_POINTS = "measure-points-lyr";
const LYR_POLY = "measure-poly-lyr";

export default function MeasurementTools({ mapRef }: MeasurementToolsProps) {
	const [mode, setMode] = useState<MeasureMode>("idle");
	const [points, setPoints] = useState<MeasurePoint[]>([]);
	const [totalDist, setTotalDist] = useState(0);
	const [area, setArea] = useState(0);
	const [expanded, setExpanded] = useState(false);
	const listenerRef = useRef<((e: maplibregl.MapMouseEvent) => void) | null>(null);

	// Calculate running totals
	useEffect(() => {
		if (points.length >= 2) {
			let d = 0;
			for (let i = 1; i < points.length; i++) d += haversine(points[i - 1], points[i]);
			setTotalDist(d);
		} else {
			setTotalDist(0);
		}
		if (mode === "area" && points.length >= 3) {
			setArea(sphericalArea(points));
		} else {
			setArea(0);
		}
	}, [points, mode]);

	// Sync GeoJSON to map
	useEffect(() => {
		const m = mapRef.current;
		if (!m?.isStyleLoaded()) return;

		const lineCoords = points.map(p => [p.lng, p.lat]);
		const lineGeoJSON: GeoJSON.FeatureCollection = {
			type: "FeatureCollection",
			features: lineCoords.length >= 2 ? [{
				type: "Feature",
				geometry: { type: "LineString", coordinates: lineCoords },
				properties: {},
			}] : [],
		};
		const pointGeoJSON: GeoJSON.FeatureCollection = {
			type: "FeatureCollection",
			features: points.map((p, i) => ({
				type: "Feature" as const,
				geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
				properties: { index: i },
			})),
		};
		const polyGeoJSON: GeoJSON.FeatureCollection = {
			type: "FeatureCollection",
			features: mode === "area" && points.length >= 3 ? [{
				type: "Feature",
				geometry: { type: "Polygon", coordinates: [[...lineCoords, lineCoords[0]]] },
				properties: {},
			}] : [],
		};

		// Ensure sources exist
		for (const [id, data] of [[SRC_LINE, lineGeoJSON], [SRC_POINTS, pointGeoJSON], [SRC_POLY, polyGeoJSON]] as [string, GeoJSON.FeatureCollection][]) {
			const src = m.getSource(id) as maplibregl.GeoJSONSource | undefined;
			if (src) {
				src.setData(data);
			} else {
				m.addSource(id, { type: "geojson", data });
			}
		}

		// Ensure layers exist
		if (!m.getLayer(LYR_POLY)) {
			m.addLayer({ id: LYR_POLY, type: "fill", source: SRC_POLY, paint: { "fill-color": "#06b6d4", "fill-opacity": 0.15 } });
		}
		if (!m.getLayer(LYR_LINE)) {
			m.addLayer({
				id: LYR_LINE, type: "line", source: SRC_LINE,
				paint: { "line-color": "#06b6d4", "line-width": 2, "line-dasharray": [4, 3] },
			});
		}
		if (!m.getLayer(LYR_POINTS)) {
			m.addLayer({
				id: LYR_POINTS, type: "circle", source: SRC_POINTS,
				paint: { "circle-radius": 5, "circle-color": "#06b6d4", "circle-stroke-color": "#fff", "circle-stroke-width": 1 },
			});
		}
	}, [points, mode, mapRef]);

	// Attach click listener
	useEffect(() => {
		const m = mapRef.current;
		if (!m) return;

		// Remove old listener
		if (listenerRef.current) {
			m.off("click", listenerRef.current);
			listenerRef.current = null;
		}

		if (mode === "idle") {
			m.getCanvas().style.cursor = "";
			return;
		}

		m.getCanvas().style.cursor = "crosshair";

		const handler = (e: maplibregl.MapMouseEvent) => {
			setPoints(prev => [...prev, { lng: e.lngLat.lng, lat: e.lngLat.lat }]);
		};
		listenerRef.current = handler;
		m.on("click", handler);

		return () => {
			m.off("click", handler);
			m.getCanvas().style.cursor = "";
			listenerRef.current = null;
		};
	}, [mode, mapRef]);

	// Cleanup layers on unmount or mode reset
	const clearAll = useCallback(() => {
		setPoints([]);
		setTotalDist(0);
		setArea(0);
		const m = mapRef.current;
		if (!m) return;
		for (const lyr of [LYR_POINTS, LYR_LINE, LYR_POLY]) {
			if (m.getLayer(lyr)) m.removeLayer(lyr);
		}
		for (const src of [SRC_POINTS, SRC_LINE, SRC_POLY]) {
			if (m.getSource(src)) m.removeSource(src);
		}
	}, [mapRef]);

	const startMode = useCallback((m: MeasureMode) => {
		clearAll();
		setMode(m);
		setExpanded(true);
	}, [clearAll]);

	const stopMeasuring = useCallback(() => {
		clearAll();
		setMode("idle");
	}, [clearAll]);

	// Segment distances
	const segments: string[] = [];
	for (let i = 1; i < points.length; i++) {
		const d = haversine(points[i - 1], points[i]);
		segments.push(`Leg ${i}: ${formatDist(d)}`);
	}

	if (!expanded) {
		return (
			<button
				type="button"
				onClick={() => setExpanded(true)}
				className="bg-slate-900/90 border border-cyan-800/30 rounded px-2 py-1 text-[9px] font-mono text-cyan-400 hover:bg-slate-800/90"
				title="Measurement Tools"
			>
				📏 MEASURE
			</button>
		);
	}

	return (
		<div className="bg-slate-900/95 border border-cyan-800/30 rounded-lg shadow-xl backdrop-blur-sm w-56">
			{/* Header */}
			<div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-700/50">
				<span className="text-[9px] font-mono font-bold text-cyan-400 tracking-widest">📏 MEASURE</span>
				<button type="button" onClick={() => { stopMeasuring(); setExpanded(false); }} className="text-slate-500 hover:text-white text-xs">✕</button>
			</div>

			{/* Mode buttons */}
			<div className="flex gap-1 p-1.5">
				<button
					type="button"
					onClick={() => startMode("distance")}
					className={`flex-1 px-2 py-1 rounded text-[8px] font-mono font-bold tracking-wider transition-colors ${mode === "distance" ? "bg-cyan-900/40 text-cyan-400 border border-cyan-700/40" : "bg-slate-800/60 text-slate-400 hover:text-white border border-transparent"}`}
				>
					📐 DISTANCE
				</button>
				<button
					type="button"
					onClick={() => startMode("area")}
					className={`flex-1 px-2 py-1 rounded text-[8px] font-mono font-bold tracking-wider transition-colors ${mode === "area" ? "bg-emerald-900/40 text-emerald-400 border border-emerald-700/40" : "bg-slate-800/60 text-slate-400 hover:text-white border border-transparent"}`}
				>
					⬡ AREA
				</button>
			</div>

			{/* Results */}
			{mode !== "idle" && (
				<div className="px-2 pb-2 space-y-1">
					<div className="text-[8px] font-mono text-slate-500">
						{mode === "distance" ? "Click map to add waypoints" : "Click map to draw polygon vertices"}
					</div>

					{points.length > 0 && (
						<div className="text-[8px] font-mono text-slate-400">
							{points.length} point{points.length !== 1 ? "s" : ""}
						</div>
					)}

					{totalDist > 0 && (
						<div className="bg-slate-800/60 rounded px-2 py-1">
							<div className="text-[8px] font-mono text-slate-500 mb-0.5">TOTAL DISTANCE</div>
							<div className="text-[10px] font-mono text-cyan-300 font-bold">{formatDist(totalDist)}</div>
						</div>
					)}

					{segments.length > 0 && (
						<div className="max-h-20 overflow-y-auto space-y-0.5">
							{segments.map((s) => (
								<div key={s} className="text-[7px] font-mono text-slate-500 truncate">{s}</div>
							))}
						</div>
					)}

					{area > 0 && (
						<div className="bg-slate-800/60 rounded px-2 py-1">
							<div className="text-[8px] font-mono text-slate-500 mb-0.5">AREA</div>
							<div className="text-[10px] font-mono text-emerald-300 font-bold">{formatArea(area)}</div>
						</div>
					)}

					{/* Bearing for 2+ points */}
					{points.length >= 2 && (
						<div className="bg-slate-800/60 rounded px-2 py-1">
							<div className="text-[8px] font-mono text-slate-500 mb-0.5">BEARING (last leg)</div>
							<div className="text-[10px] font-mono text-amber-300 font-bold">
								{(() => {
									const a = points[points.length - 2];
									const b = points[points.length - 1];
									const dLng = toRad(b.lng - a.lng);
									const y = Math.sin(dLng) * Math.cos(toRad(b.lat));
									const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) - Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(dLng);
									const brg = ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
									return `${brg.toFixed(1)}° TRUE`;
								})()}
							</div>
						</div>
					)}

					<div className="flex gap-1 pt-1">
						<button
							type="button"
							onClick={() => setPoints(prev => prev.slice(0, -1))}
							disabled={points.length === 0}
							className="flex-1 px-2 py-0.5 rounded text-[8px] font-mono text-slate-400 bg-slate-800/60 hover:bg-slate-700/60 disabled:opacity-30"
						>
							UNDO
						</button>
						<button
							type="button"
							onClick={stopMeasuring}
							className="flex-1 px-2 py-0.5 rounded text-[8px] font-mono text-red-400 bg-red-900/20 hover:bg-red-900/40"
						>
							CLEAR
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
