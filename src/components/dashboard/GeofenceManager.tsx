import { useState, useCallback, useRef, useEffect } from "react";
import type maplibregl from "maplibre-gl";

interface GeofenceZone {
	id: string;
	name: string;
	points: [number, number][]; // [lng, lat]
	color: string;
	alertOnEntry: boolean;
	active: boolean;
}

interface GeofenceManagerProps {
	mapRef: React.RefObject<maplibregl.Map | null>;
	onZonesChange?: (zones: { id: string; name: string; points: [number, number][]; active: boolean; alertOnEntry: boolean }[]) => void;
}

const ZONE_COLORS = ["#06b6d4", "#f59e0b", "#ef4444", "#8b5cf6", "#10b981", "#f97316"];

export default function GeofenceManager({ mapRef, onZonesChange }: GeofenceManagerProps) {
	const [zones, setZones] = useState<GeofenceZone[]>([]);
	const [drawing, setDrawing] = useState(false);
	const [currentPoints, setCurrentPoints] = useState<[number, number][]>([]);
	const [zoneName, setZoneName] = useState("");
	const drawListenerRef = useRef<((e: maplibregl.MapMouseEvent) => void) | null>(null);

	// Notify parent of zone changes
	useEffect(() => {
		onZonesChange?.(zones.map((z) => ({
			id: z.id,
			name: z.name,
			points: z.points,
			active: z.active,
			alertOnEntry: true,
		})));
	}, [zones, onZonesChange]);

	// Sync geofence polygons to map
	useEffect(() => {
		const m = mapRef.current;
		if (!m?.isStyleLoaded()) return;

		const sourceId = "geofence-zones-source";
		const layerId = "geofence-zones-fill";
		const outlineId = "geofence-zones-outline";
		const labelId = "geofence-zones-label";

		const features: GeoJSON.Feature[] = zones
			.filter((z) => z.active)
			.map((z) => ({
				type: "Feature" as const,
				properties: { name: z.name, color: z.color },
				geometry: {
					type: "Polygon" as const,
					coordinates: [z.points.length >= 3 ? [...z.points, z.points[0]] : z.points],
				},
			}));

		const fc: GeoJSON.FeatureCollection = { type: "FeatureCollection", features };

		if (m.getSource(sourceId)) {
			(m.getSource(sourceId) as maplibregl.GeoJSONSource).setData(fc);
		} else {
			m.addSource(sourceId, { type: "geojson", data: fc });
			m.addLayer({
				id: layerId, type: "fill", source: sourceId,
				paint: { "fill-color": ["get", "color"], "fill-opacity": 0.1 },
			});
			m.addLayer({
				id: outlineId, type: "line", source: sourceId,
				paint: {
					"line-color": ["get", "color"],
					"line-width": 2,
					"line-dasharray": [4, 2],
					"line-opacity": 0.7,
				},
			});
			m.addLayer({
				id: labelId, type: "symbol", source: sourceId,
				layout: {
					"text-field": ["get", "name"],
					"text-size": 10,
					"text-font": ["Open Sans Regular"],
				},
				paint: { "text-color": ["get", "color"], "text-halo-color": "#0f172a", "text-halo-width": 1 },
			});
		}
	}, [zones, mapRef]);

	// Sync drawing polygon preview
	useEffect(() => {
		const m = mapRef.current;
		if (!m?.isStyleLoaded()) return;
		const srcId = "geofence-drawing-source";
		const layId = "geofence-drawing-line";
		const ptId = "geofence-drawing-points";

		const lineFeatures: GeoJSON.Feature[] = currentPoints.length >= 2 ? [{
			type: "Feature", properties: {},
			geometry: { type: "LineString", coordinates: [...currentPoints, ...(currentPoints.length >= 3 ? [currentPoints[0]] : [])] },
		}] : [];
		const pointFeatures: GeoJSON.Feature[] = currentPoints.map((p) => ({
			type: "Feature", properties: {},
			geometry: { type: "Point", coordinates: p },
		}));

		const fc: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [...lineFeatures, ...pointFeatures] };

		if (m.getSource(srcId)) {
			(m.getSource(srcId) as maplibregl.GeoJSONSource).setData(fc);
		} else {
			m.addSource(srcId, { type: "geojson", data: fc });
			m.addLayer({
				id: layId, type: "line", source: srcId,
				paint: { "line-color": "#06b6d4", "line-width": 2, "line-dasharray": [2, 2] },
				filter: ["==", "$type", "LineString"],
			});
			m.addLayer({
				id: ptId, type: "circle", source: srcId,
				paint: { "circle-radius": 4, "circle-color": "#06b6d4", "circle-stroke-width": 1, "circle-stroke-color": "#fff" },
				filter: ["==", "$type", "Point"],
			});
		}
	}, [currentPoints, mapRef]);

	const startDrawing = useCallback(() => {
		const m = mapRef.current;
		if (!m) return;
		setDrawing(true);
		setCurrentPoints([]);
		m.getCanvas().style.cursor = "crosshair";

		const handler = (e: maplibregl.MapMouseEvent) => {
			setCurrentPoints((prev) => [...prev, [e.lngLat.lng, e.lngLat.lat]]);
		};
		drawListenerRef.current = handler;
		m.on("click", handler);
	}, [mapRef]);

	const finishDrawing = useCallback(() => {
		const m = mapRef.current;
		if (!m || currentPoints.length < 3) return;

		if (drawListenerRef.current) {
			m.off("click", drawListenerRef.current);
			drawListenerRef.current = null;
		}
		m.getCanvas().style.cursor = "";

		const newZone: GeofenceZone = {
			id: `zone-${Date.now()}`,
			name: zoneName || `Zone ${zones.length + 1}`,
			points: currentPoints,
			color: ZONE_COLORS[zones.length % ZONE_COLORS.length],
			alertOnEntry: true,
			active: true,
		};

		setZones((prev) => [...prev, newZone]);
		setCurrentPoints([]);
		setDrawing(false);
		setZoneName("");
	}, [currentPoints, zoneName, zones.length, mapRef]);

	const cancelDrawing = useCallback(() => {
		const m = mapRef.current;
		if (m && drawListenerRef.current) {
			m.off("click", drawListenerRef.current);
			drawListenerRef.current = null;
			m.getCanvas().style.cursor = "";
		}
		setCurrentPoints([]);
		setDrawing(false);
		setZoneName("");
	}, [mapRef]);

	const removeZone = useCallback((id: string) => {
		setZones((prev) => prev.filter((z) => z.id !== id));
	}, []);

	const toggleZone = useCallback((id: string) => {
		setZones((prev) => prev.map((z) => z.id === id ? { ...z, active: !z.active } : z));
	}, []);

	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between">
				<span className="text-[10px] font-mono text-slate-400 tracking-wider">GEOFENCE ZONES</span>
				<span className="text-[8px] font-mono text-slate-600">{zones.length} zones</span>
			</div>

			{/* Drawing controls */}
			{!drawing ? (
				<button
					onClick={startDrawing}
					className="w-full py-1.5 bg-cyan-950/40 hover:bg-cyan-900/40 border border-cyan-700/30 rounded text-[10px] font-mono text-cyan-400 transition-colors"
				>
					✏ DRAW NEW ZONE
				</button>
			) : (
				<div className="space-y-1.5 p-2 bg-cyan-950/20 border border-cyan-700/30 rounded">
					<div className="text-[9px] font-mono text-cyan-400">
						🎯 Click map to add points ({currentPoints.length} placed)
					</div>
					<input
						type="text"
						placeholder="Zone name..."
						value={zoneName}
						onChange={(e) => setZoneName(e.target.value)}
						className="w-full bg-black/50 border border-slate-700/40 rounded px-2 py-1 text-[10px] font-mono text-slate-300 placeholder:text-slate-600 outline-none focus:border-cyan-700/60"
					/>
					<div className="flex gap-1">
						<button
							onClick={finishDrawing}
							disabled={currentPoints.length < 3}
							className="flex-1 py-1 bg-emerald-900/40 hover:bg-emerald-800/40 border border-emerald-700/30 rounded text-[9px] font-mono text-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed"
						>
							✓ FINISH ({currentPoints.length < 3 ? `need ${3 - currentPoints.length} more` : "ready"})
						</button>
						<button
							onClick={cancelDrawing}
							className="px-2 py-1 bg-red-900/30 hover:bg-red-800/30 border border-red-700/30 rounded text-[9px] font-mono text-red-400"
						>
							✕
						</button>
					</div>
				</div>
			)}

			{/* Zone list */}
			{zones.length > 0 && (
				<div className="space-y-1">
					{zones.map((z) => (
						<div key={z.id} className="flex items-center gap-1.5 p-1.5 bg-black/30 border border-slate-700/20 rounded">
							<div className="w-2 h-2 rounded-full" style={{ backgroundColor: z.color, opacity: z.active ? 1 : 0.3 }} />
							<span className={`flex-1 text-[10px] font-mono truncate ${z.active ? "text-slate-300" : "text-slate-600"}`}>
								{z.name}
							</span>
							<span className="text-[8px] font-mono text-slate-600">{z.points.length}pt</span>
							<button
								onClick={() => toggleZone(z.id)}
								className="text-[9px] font-mono text-slate-500 hover:text-slate-300"
								title={z.active ? "Disable" : "Enable"}
							>
								{z.active ? "👁" : "◌"}
							</button>
							<button
								onClick={() => removeZone(z.id)}
								className="text-[9px] font-mono text-red-500/60 hover:text-red-400"
								title="Delete zone"
							>
								✕
							</button>
						</div>
					))}
				</div>
			)}

			{zones.length === 0 && !drawing && (
				<div className="text-[9px] font-mono text-slate-600 text-center py-2">
					No zones defined. Draw polygons on the map to create alert boundaries.
				</div>
			)}
		</div>
	);
}
