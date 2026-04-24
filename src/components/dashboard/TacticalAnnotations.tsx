import { useState, useCallback, useEffect, useRef } from "react";
import type maplibregl from "maplibre-gl";

/* ── Types ───────────────────────────────────────────────────────────── */
type ToolType = "label" | "circle" | "arrow" | "waypoint";
interface Annotation {
	id: string;
	type: ToolType;
	coords: [number, number]; // [lon, lat]
	endCoords?: [number, number]; // for arrows
	text: string;
	color: string;
	radiusKm?: number; // for circles
}

const COLORS = ["#00ffff", "#ff4444", "#ffaa00", "#44ff44", "#ff44ff", "#4488ff"];
const STORAGE_KEY = "sx_annotations";
const SRC_ID = "sx-annotations-src";

function genId() { return Math.random().toString(36).slice(2, 8); }

function loadAnnotations(): Annotation[] {
	try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
	catch { return []; }
}

/* ── GeoJSON builder ─────────────────────────────────────────────────── */
function buildGeoJSON(annotations: Annotation[]): GeoJSON.FeatureCollection {
	const features: GeoJSON.Feature[] = [];
	for (const ann of annotations) {
		if (ann.type === "label" || ann.type === "waypoint") {
			features.push({
				type: "Feature",
				properties: { id: ann.id, text: ann.text, color: ann.color, annType: ann.type },
				geometry: { type: "Point", coordinates: ann.coords },
			});
		} else if (ann.type === "circle" && ann.radiusKm) {
			// Circle as polygon ring
			const [lon, lat] = ann.coords;
			const pts = 64;
			const ring: [number, number][] = [];
			for (let i = 0; i <= pts; i++) {
				const angle = (i / pts) * 2 * Math.PI;
				const dLat = (ann.radiusKm / 111.32) * Math.cos(angle);
				const dLon = (ann.radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180))) * Math.sin(angle);
				ring.push([lon + dLon, lat + dLat]);
			}
			features.push({
				type: "Feature",
				properties: { id: ann.id, text: ann.text, color: ann.color, annType: "circle" },
				geometry: { type: "LineString", coordinates: ring },
			});
			// Center label
			features.push({
				type: "Feature",
				properties: { id: ann.id + "-lbl", text: `${ann.text} (${ann.radiusKm}km)`, color: ann.color, annType: "circle-label" },
				geometry: { type: "Point", coordinates: ann.coords },
			});
		} else if (ann.type === "arrow" && ann.endCoords) {
			features.push({
				type: "Feature",
				properties: { id: ann.id, text: ann.text, color: ann.color, annType: "arrow" },
				geometry: { type: "LineString", coordinates: [ann.coords, ann.endCoords] },
			});
		}
	}
	return { type: "FeatureCollection", features };
}

/* ── Component ───────────────────────────────────────────────────────── */
interface TacticalAnnotationsProps {
	map: maplibregl.Map | null;
	active: boolean;
	onClose: () => void;
}

export default function TacticalAnnotations({ map, active, onClose }: TacticalAnnotationsProps) {
	const [annotations, setAnnotations] = useState<Annotation[]>(loadAnnotations);
	const [tool, setTool] = useState<ToolType>("label");
	const [color, setColor] = useState(COLORS[0]);
	const [text, setText] = useState("");
	const [radius, setRadius] = useState(50);
	const [placing, setPlacing] = useState(false);
	const [arrowStart, setArrowStart] = useState<[number, number] | null>(null);
	const clickHandlerRef = useRef<((e: maplibregl.MapMouseEvent) => void) | null>(null);

	// Persist
	useEffect(() => {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(annotations));
	}, [annotations]);

	// Render on map
	useEffect(() => {
		if (!map) return;
		const geojson = buildGeoJSON(annotations);
		try {
			if (map.getSource(SRC_ID)) {
				(map.getSource(SRC_ID) as maplibregl.GeoJSONSource).setData(geojson);
			} else {
				map.addSource(SRC_ID, { type: "geojson", data: geojson });
				// Circles & arrows: line layer
				map.addLayer({
					id: "sx-ann-lines",
					type: "line",
					source: SRC_ID,
					filter: ["==", "$type", "LineString"],
					paint: {
						"line-color": ["get", "color"],
						"line-width": 2,
						"line-dasharray": [4, 3],
						"line-opacity": 0.8,
					},
				});
				// Labels, waypoints, circle-labels
				map.addLayer({
					id: "sx-ann-labels",
					type: "symbol",
					source: SRC_ID,
					filter: ["==", "$type", "Point"],
					layout: {
						"text-field": ["get", "text"],
						"text-size": 11,
						"text-font": ["Open Sans Bold"],
						"text-anchor": "bottom",
						"text-offset": [0, -0.5],
					},
					paint: {
						"text-color": ["get", "color"],
						"text-halo-color": "#000000",
						"text-halo-width": 2,
					},
				});
				// Dots for point annotations
				map.addLayer({
					id: "sx-ann-dots",
					type: "circle",
					source: SRC_ID,
					filter: ["all", ["==", "$type", "Point"], ["in", "annType", "label", "waypoint"]],
					paint: {
						"circle-radius": 5,
						"circle-color": ["get", "color"],
						"circle-opacity": 0.8,
						"circle-stroke-width": 1,
						"circle-stroke-color": "#000",
					},
				});
			}
		} catch { /* style may have changed */ }

		return () => {
			try {
				if (map.getLayer("sx-ann-lines")) map.removeLayer("sx-ann-lines");
				if (map.getLayer("sx-ann-labels")) map.removeLayer("sx-ann-labels");
				if (map.getLayer("sx-ann-dots")) map.removeLayer("sx-ann-dots");
				if (map.getSource(SRC_ID)) map.removeSource(SRC_ID);
			} catch { /* */ }
		};
	}, [map, annotations]);

	// Click handler for placing annotations
	useEffect(() => {
		if (!map || !active || !placing) {
			// Remove old handler
			if (map && clickHandlerRef.current) {
				map.off("click", clickHandlerRef.current);
				clickHandlerRef.current = null;
				map.getCanvas().style.cursor = "";
			}
			return;
		}

		map.getCanvas().style.cursor = "crosshair";
		const handler = (e: maplibregl.MapMouseEvent) => {
			const coords: [number, number] = [e.lngLat.lng, e.lngLat.lat];
			if (tool === "arrow") {
				if (!arrowStart) {
					setArrowStart(coords);
					return; // wait for second click
				}
				setAnnotations((prev) => [...prev, {
					id: genId(), type: "arrow", coords: arrowStart, endCoords: coords,
					text: text || "→", color, radiusKm: undefined,
				}]);
				setArrowStart(null);
				setPlacing(false);
			} else {
				setAnnotations((prev) => [...prev, {
					id: genId(), type: tool, coords, text: text || (tool === "waypoint" ? `WP-${prev.length + 1}` : "📍"),
					color, radiusKm: tool === "circle" ? radius : undefined,
				}]);
				setPlacing(false);
			}
		};
		clickHandlerRef.current = handler;
		map.on("click", handler);
		return () => {
			map.off("click", handler);
			clickHandlerRef.current = null;
			map.getCanvas().style.cursor = "";
		};
	}, [map, active, placing, tool, text, color, radius, arrowStart]);

	const removeAnnotation = useCallback((id: string) => {
		setAnnotations((prev) => prev.filter((a) => a.id !== id));
	}, []);

	const clearAll = useCallback(() => setAnnotations([]), []);

	if (!active) return null;

	return (
		<div className="absolute top-16 left-52 z-30 bg-slate-900/95 border border-pink-900/50
		               rounded-lg backdrop-blur-md shadow-xl shadow-black/60 p-2 font-mono text-[10px] w-56">
			<div className="flex items-center justify-between mb-2">
				<span className="text-pink-400 tracking-widest">✏ ANNOTATIONS</span>
				<button onClick={onClose} className="text-slate-500 hover:text-pink-300">✕</button>
			</div>

			{/* Tool selection */}
			<div className="flex gap-1 mb-2">
				{(["label", "circle", "arrow", "waypoint"] as ToolType[]).map((t) => (
					<button
						key={t}
						onClick={() => { setTool(t); setArrowStart(null); }}
						className={`flex-1 py-1 rounded text-[8px] tracking-wider border transition-all ${
							tool === t
								? "bg-pink-900/40 border-pink-600 text-pink-300"
								: "border-slate-700/40 text-slate-500 hover:border-pink-800"
						}`}
					>
						{t === "label" ? "Aa" : t === "circle" ? "◯" : t === "arrow" ? "→" : "◆"} {t.toUpperCase()}
					</button>
				))}
			</div>

			{/* Color picker */}
			<div className="flex items-center gap-1 mb-2">
				<span className="text-slate-500 w-10">COLOR</span>
				{COLORS.map((c) => (
					<button
						key={c}
						onClick={() => setColor(c)}
						className={`w-5 h-5 rounded-full border-2 transition-all ${
							color === c ? "border-white scale-110" : "border-slate-700"
						}`}
						style={{ background: c }}
					/>
				))}
			</div>

			{/* Text input */}
			<div className="flex items-center gap-2 mb-2">
				<span className="text-slate-500 w-10">TEXT</span>
				<input
					type="text"
					value={text}
					onChange={(e) => setText(e.target.value)}
					placeholder={tool === "waypoint" ? "WP-1" : "Label text..."}
					maxLength={40}
					className="flex-1 bg-slate-800 border border-slate-600/40 rounded px-2 py-1
					           text-pink-300 text-[10px] focus:outline-none focus:border-pink-500"
				/>
			</div>

			{/* Radius for circles */}
			{tool === "circle" && (
				<div className="flex items-center gap-2 mb-2">
					<span className="text-slate-500 w-10">RADIUS</span>
					<input
						type="range" min="5" max="500" value={radius}
						onChange={(e) => setRadius(Number(e.target.value))}
						className="flex-1 accent-pink-500"
					/>
					<span className="text-pink-300 w-12 text-right">{radius}km</span>
				</div>
			)}

			{/* Arrow hint */}
			{tool === "arrow" && arrowStart && (
				<div className="text-amber-400 text-[9px] mb-2 animate-pulse">
					Click map for arrow endpoint...
				</div>
			)}

			{/* Place button */}
			<button
				onClick={() => setPlacing(true)}
				disabled={placing}
				className={`w-full py-1.5 rounded tracking-widest transition-all border ${
					placing
						? "bg-pink-800/40 border-pink-500 text-pink-300 animate-pulse"
						: "bg-pink-900/30 border-pink-700/50 text-pink-300 hover:bg-pink-800/40"
				}`}
			>
				{placing ? "⊕ CLICK MAP TO PLACE..." : "⊕ PLACE ON MAP"}
			</button>

			{/* Annotation list */}
			{annotations.length > 0 && (
				<div className="mt-2 pt-2 border-t border-slate-800/40 max-h-32 overflow-y-auto space-y-1">
					{annotations.map((ann) => (
						<div key={ann.id} className="flex items-center justify-between">
							<div className="flex items-center gap-1.5 truncate">
								<span className="w-2 h-2 rounded-full" style={{ background: ann.color }} />
								<span className="text-slate-300 truncate">{ann.text}</span>
								<span className="text-slate-600 text-[8px]">{ann.type}</span>
							</div>
							<button onClick={() => removeAnnotation(ann.id)} className="text-slate-600 hover:text-red-400">✕</button>
						</div>
					))}
				</div>
			)}

			{/* Footer */}
			<div className="mt-2 pt-1 border-t border-slate-800/40 flex items-center justify-between">
				<span className="text-slate-600">{annotations.length} annotations</span>
				{annotations.length > 0 && (
					<button onClick={clearAll} className="text-red-500/50 hover:text-red-400 text-[9px]">CLEAR ALL</button>
				)}
			</div>
		</div>
	);
}
