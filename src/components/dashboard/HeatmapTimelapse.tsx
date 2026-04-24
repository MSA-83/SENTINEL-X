/**
 * HeatmapTimelapse — Animated fire/conflict density over time
 * Renders a heatmap layer that steps through time windows with animation controls.
 */
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type maplibregl from "maplibre-gl";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

interface HeatmapTimelapseProps {
	mapRef: React.RefObject<maplibregl.Map | null>;
}

type Rec = Record<string, unknown>;
type DataLayer = "fires" | "conflicts" | "seismic" | "all";

const SRC_ID = "heatmap-tl-src";
const LYR_ID = "heatmap-tl-lyr";

const LAYER_COLORS: Record<DataLayer, string[]> = {
	fires: ["rgba(255,0,0,0)", "#ff4500", "#ff8c00", "#ffd700", "#ffffe0"],
	conflicts: ["rgba(128,0,128,0)", "#7b2d8e", "#c026d3", "#e879f9", "#fdf4ff"],
	seismic: ["rgba(0,128,0,0)", "#065f46", "#059669", "#34d399", "#d1fae5"],
	all: ["rgba(0,128,255,0)", "#1e3a5f", "#2563eb", "#60a5fa", "#dbeafe"],
};

function interpolateColor(stops: string[], t: number): string {
	const i = Math.min(Math.floor(t * (stops.length - 1)), stops.length - 2);
	return stops[i + 1] || stops[stops.length - 1];
	// Simple step-based for heatmap config
}

export default function HeatmapTimelapse({ mapRef }: HeatmapTimelapseProps) {
	const fires = useQuery(api.entities.listFires) ?? [];
	const conflicts = useQuery(api.entities.listConflictEvents) ?? [];
	const seismic = useQuery(api.entities.listSeismicEvents) ?? [];

	const [layer, setLayer] = useState<DataLayer>("fires");
	const [playing, setPlaying] = useState(false);
	const [frame, setFrame] = useState(0);
	const [speed, setSpeed] = useState(1);
	const [totalFrames] = useState(24); // 24 time slices
	const [expanded, setExpanded] = useState(false);
	const [intensity, setIntensity] = useState(0.6);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	// Build time-bucketed data
	const timeFrames = useMemo(() => {
		const now = Date.now();
		const windowMs = 7 * 24 * 60 * 60 * 1000; // 7 days
		const sliceMs = windowMs / totalFrames;

		const allPoints: { lat: number; lng: number; ts: number; weight: number; type: string }[] = [];

		if (layer === "fires" || layer === "all") {
			for (const f of fires as Rec[]) {
				allPoints.push({
					lat: Number(f.latitude ?? 0),
					lng: Number(f.longitude ?? 0),
					ts: Number(f.timestamp ?? f.acqDate ?? now),
					weight: Number(f.brightness ?? f.confidence ?? 50) / 100,
					type: "fire",
				});
			}
		}

		if (layer === "conflicts" || layer === "all") {
			for (const c of conflicts as Rec[]) {
				const sevW: Record<string, number> = { critical: 1, high: 0.8, medium: 0.5, low: 0.3 };
				allPoints.push({
					lat: Number(c.latitude ?? 0),
					lng: Number(c.longitude ?? 0),
					ts: Number(c.timestamp ?? now),
					weight: sevW[String(c.severity ?? "medium").toLowerCase()] ?? 0.5,
					type: "conflict",
				});
			}
		}

		if (layer === "seismic" || layer === "all") {
			for (const s of seismic as Rec[]) {
				allPoints.push({
					lat: Number(s.latitude ?? 0),
					lng: Number(s.longitude ?? 0),
					ts: Number(s.time ?? s.timestamp ?? now),
					weight: Math.min(Number(s.magnitude ?? 3) / 8, 1),
					type: "seismic",
				});
			}
		}

		// Group into time slices with cumulative accumulation
		const frames: GeoJSON.FeatureCollection[] = [];
		for (let i = 0; i < totalFrames; i++) {
			const tEnd = now - windowMs + (i + 1) * sliceMs;
			// Cumulative — show everything up to this time
			const pts = allPoints.filter(p => p.ts <= tEnd);
			frames.push({
				type: "FeatureCollection",
				features: pts.map(p => ({
					type: "Feature" as const,
					geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
					properties: { weight: p.weight },
				})),
			});
		}

		return frames;
	}, [fires, conflicts, seismic, layer, totalFrames]);

	// Sync heatmap to map
	useEffect(() => {
		const m = mapRef.current;
		if (!m?.isStyleLoaded() || !timeFrames[frame]) return;

		const data = timeFrames[frame];
		const src = m.getSource(SRC_ID) as maplibregl.GeoJSONSource | undefined;
		if (src) {
			src.setData(data);
		} else {
			m.addSource(SRC_ID, { type: "geojson", data });
		}

		const colors = LAYER_COLORS[layer];
		void interpolateColor; // Used for reference

		if (!m.getLayer(LYR_ID)) {
			m.addLayer({
				id: LYR_ID,
				type: "heatmap",
				source: SRC_ID,
				paint: {
					"heatmap-weight": ["get", "weight"],
					"heatmap-intensity": intensity,
					"heatmap-radius": 20,
					"heatmap-color": [
						"interpolate", ["linear"], ["heatmap-density"],
						0, colors[0],
						0.25, colors[1],
						0.5, colors[2],
						0.75, colors[3],
						1, colors[4],
					],
					"heatmap-opacity": 0.8,
				},
			});
		} else {
			m.setPaintProperty(LYR_ID, "heatmap-intensity", intensity);
			m.setPaintProperty(LYR_ID, "heatmap-color", [
				"interpolate", ["linear"], ["heatmap-density"],
				0, colors[0],
				0.25, colors[1],
				0.5, colors[2],
				0.75, colors[3],
				1, colors[4],
			]);
		}
	}, [frame, timeFrames, mapRef, layer, intensity]);

	// Animation loop
	useEffect(() => {
		if (playing) {
			intervalRef.current = setInterval(() => {
				setFrame(f => {
					const next = f + 1;
					if (next >= totalFrames) {
						setPlaying(false);
						return totalFrames - 1;
					}
					return next;
				});
			}, 800 / speed);
		} else {
			if (intervalRef.current) clearInterval(intervalRef.current);
		}
		return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
	}, [playing, speed, totalFrames]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			const m = mapRef.current;
			if (m) {
				if (m.getLayer(LYR_ID)) m.removeLayer(LYR_ID);
				if (m.getSource(SRC_ID)) m.removeSource(SRC_ID);
			}
		};
	}, [mapRef]);

	const reset = useCallback(() => { setFrame(0); setPlaying(false); }, []);
	const togglePlay = useCallback(() => setPlaying(p => !p), []);

	// Time label for current frame
	const frameTime = useMemo(() => {
		const now = Date.now();
		const windowMs = 7 * 24 * 60 * 60 * 1000;
		const sliceMs = windowMs / totalFrames;
		const t = new Date(now - windowMs + (frame + 1) * sliceMs);
		return t.toISOString().slice(0, 16).replace("T", " ") + "Z";
	}, [frame, totalFrames]);

	if (!expanded) {
		return (
			<button
				type="button"
				onClick={() => setExpanded(true)}
				className="bg-slate-900/90 border border-orange-800/30 rounded px-2 py-1 text-[9px] font-mono text-orange-400 hover:bg-slate-800/90"
			>
				🔥 TIMELAPSE
			</button>
		);
	}

	return (
		<div className="bg-slate-900/95 border border-orange-800/30 rounded-lg shadow-xl backdrop-blur-sm w-64">
			{/* Header */}
			<div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-700/50">
				<span className="text-[9px] font-mono font-bold text-orange-400 tracking-widest">🔥 HEATMAP TIMELAPSE</span>
				<button type="button" onClick={() => { setPlaying(false); setExpanded(false); const m = mapRef.current; if (m) { if (m.getLayer(LYR_ID)) m.removeLayer(LYR_ID); if (m.getSource(SRC_ID)) m.removeSource(SRC_ID); } }} className="text-slate-500 hover:text-white text-xs">✕</button>
			</div>

			{/* Layer selector */}
			<div className="flex gap-1 p-1.5">
				{(["fires", "conflicts", "seismic", "all"] as const).map(l => (
					<button
						key={l}
						type="button"
						onClick={() => { setLayer(l); reset(); }}
						className={`flex-1 px-1 py-0.5 rounded text-[7px] font-mono font-bold tracking-wider transition-colors ${
							layer === l
								? "bg-orange-900/30 text-orange-400 border border-orange-700/30"
								: "bg-slate-800/40 text-slate-500 hover:text-slate-300 border border-transparent"
						}`}
					>
						{l === "fires" ? "🔥" : l === "conflicts" ? "💥" : l === "seismic" ? "🌍" : "⬡"} {l.toUpperCase()}
					</button>
				))}
			</div>

			{/* Timeline */}
			<div className="px-2 pb-1">
				<div className="text-[8px] font-mono text-slate-400 text-center mb-1">{frameTime}</div>
				<input
					type="range"
					min={0}
					max={totalFrames - 1}
					value={frame}
					onChange={e => { setFrame(Number(e.target.value)); setPlaying(false); }}
					className="w-full h-1 accent-orange-500"
				/>
				{/* Progress bar visual */}
				<div className="h-1 bg-slate-800 rounded-full mt-0.5 overflow-hidden">
					<div
						className="h-full bg-gradient-to-r from-orange-600 to-red-500 transition-all duration-300"
						style={{ width: `${(frame / (totalFrames - 1)) * 100}%` }}
					/>
				</div>
			</div>

			{/* Controls */}
			<div className="flex items-center gap-1 px-2 pb-1.5">
				<button type="button" onClick={reset} className="px-2 py-0.5 rounded text-[8px] font-mono text-slate-400 bg-slate-800/60 hover:bg-slate-700/60">⏮</button>
				<button
					type="button"
					onClick={togglePlay}
					className={`flex-1 py-0.5 rounded text-[8px] font-mono font-bold tracking-wider ${playing ? "bg-red-900/30 text-red-400 border border-red-700/30" : "bg-emerald-900/30 text-emerald-400 border border-emerald-700/30"}`}
				>
					{playing ? "⏸ PAUSE" : "▶ PLAY"}
				</button>
				<button
					type="button"
					onClick={() => setSpeed(s => s >= 4 ? 0.5 : s * 2)}
					className="px-2 py-0.5 rounded text-[8px] font-mono text-amber-400 bg-slate-800/60 hover:bg-slate-700/60"
				>
					{speed}×
				</button>
			</div>

			{/* Intensity slider */}
			<div className="px-2 pb-2">
				<div className="flex items-center justify-between">
					<span className="text-[7px] font-mono text-slate-500">INTENSITY</span>
					<span className="text-[7px] font-mono text-slate-400">{(intensity * 100).toFixed(0)}%</span>
				</div>
				<input
					type="range"
					min={0.1}
					max={1.5}
					step={0.1}
					value={intensity}
					onChange={e => setIntensity(Number(e.target.value))}
					className="w-full h-1 accent-orange-500"
				/>
			</div>

			{/* Stats */}
			<div className="px-2 pb-2 flex gap-2 text-[7px] font-mono text-slate-500">
				<span>🔥 {fires.length} fires</span>
				<span>💥 {conflicts.length} conflicts</span>
				<span>🌍 {seismic.length} quakes</span>
			</div>
		</div>
	);
}
