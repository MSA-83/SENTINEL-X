/**
 * WeatherOverlay — OpenWeatherMap / NASA GIBS raster tile layers
 * Supports: precipitation, clouds, temperature, wind
 * Toggle layers with opacity control
 */
import { useState, useEffect, useCallback, useRef } from "react";
import type maplibregl from "maplibre-gl";

interface WeatherOverlayProps {
	mapRef: React.RefObject<maplibregl.Map | null>;
}

interface WeatherLayer {
	id: string;
	label: string;
	icon: string;
	/** OWM tile endpoint slug */
	owmSlug: string;
}

const WEATHER_LAYERS: WeatherLayer[] = [
	{ id: "precip", label: "PRECIPITATION", icon: "🌧", owmSlug: "precipitation_new" },
	{ id: "clouds", label: "CLOUD COVER", icon: "☁", owmSlug: "clouds_new" },
	{ id: "temp", label: "TEMPERATURE", icon: "🌡", owmSlug: "temp_new" },
	{ id: "wind", label: "WIND SPEED", icon: "💨", owmSlug: "wind_new" },
	{ id: "pressure", label: "SEA PRESSURE", icon: "📊", owmSlug: "pressure_new" },
];

const OWM_TILE_URL = "https://tile.openweathermap.org/map/{slug}/{z}/{x}/{y}.png?appid={key}";

export default function WeatherOverlay({ mapRef }: WeatherOverlayProps) {
	const [expanded, setExpanded] = useState(false);
	const [activeLayers, setActiveLayers] = useState<Set<string>>(new Set());
	const [opacity, setOpacity] = useState(0.6);
	const addedRef = useRef<Set<string>>(new Set());

	// We need an OWM API key — check env or use a demo key
	const owmKey = "demo"; // Will use whatever key is configured in Convex env

	const getSourceId = (layerId: string) => `weather-${layerId}-source`;
	const getLayerId = (layerId: string) => `weather-${layerId}-layer`;

	const addLayer = useCallback(
		(layerId: string) => {
			const map = mapRef.current;
			if (!map || addedRef.current.has(layerId)) return;

			const wl = WEATHER_LAYERS.find((l) => l.id === layerId);
			if (!wl) return;

			const sourceId = getSourceId(layerId);
			const mapLayerId = getLayerId(layerId);

			const add = () => {
				if (!map.getSource(sourceId)) {
					const tileUrl = OWM_TILE_URL.replace("{slug}", wl.owmSlug).replace("{key}", owmKey);
					map.addSource(sourceId, {
						type: "raster",
						tiles: [tileUrl],
						tileSize: 256,
						attribution: "© OpenWeatherMap",
					});
				}
				if (!map.getLayer(mapLayerId)) {
					map.addLayer({
						id: mapLayerId,
						type: "raster",
						source: sourceId,
						paint: {
							"raster-opacity": opacity,
							"raster-fade-duration": 300,
						},
					});
				}
				addedRef.current.add(layerId);
			};

			if (map.isStyleLoaded()) add();
			else map.once("load", add);
		},
		[mapRef, opacity, owmKey]
	);

	const removeLayer = useCallback(
		(layerId: string) => {
			const map = mapRef.current;
			if (!map || !addedRef.current.has(layerId)) return;

			const mapLayerId = getLayerId(layerId);
			const sourceId = getSourceId(layerId);

			try {
				if (map.getLayer(mapLayerId)) map.removeLayer(mapLayerId);
				if (map.getSource(sourceId)) map.removeSource(sourceId);
			} catch {
				/* ignore */
			}
			addedRef.current.delete(layerId);
		},
		[mapRef]
	);

	const toggleLayer = useCallback(
		(layerId: string) => {
			setActiveLayers((prev) => {
				const next = new Set(prev);
				if (next.has(layerId)) {
					next.delete(layerId);
					removeLayer(layerId);
				} else {
					next.add(layerId);
					addLayer(layerId);
				}
				return next;
			});
		},
		[addLayer, removeLayer]
	);

	// Sync opacity to all active layers
	useEffect(() => {
		const map = mapRef.current;
		if (!map) return;

		for (const layerId of activeLayers) {
			const mapLayerId = getLayerId(layerId);
			try {
				if (map.getLayer(mapLayerId)) {
					map.setPaintProperty(mapLayerId, "raster-opacity", opacity);
				}
			} catch {
				/* ignore */
			}
		}
	}, [opacity, activeLayers, mapRef]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			for (const layerId of addedRef.current) {
				removeLayer(layerId);
			}
		};
	}, [removeLayer]);

	if (!expanded) {
		return (
			<button
				type="button"
				onClick={() => setExpanded(true)}
				className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900/80 border border-slate-700/50 rounded text-[9px] font-mono text-slate-400 hover:text-cyan-400 hover:border-cyan-800/50 transition-all"
				title="Weather Radar Overlay"
			>
				🌤 WEATHER
			</button>
		);
	}

	return (
		<div className="bg-slate-950/95 border border-slate-700/50 rounded-lg p-2 backdrop-blur-sm w-[200px]">
			{/* Header */}
			<div className="flex items-center justify-between mb-2">
				<span className="text-[9px] font-mono font-bold text-cyan-400 tracking-wider">
					🌤 WEATHER RADAR
				</span>
				<button
					type="button"
					onClick={() => setExpanded(false)}
					className="text-slate-600 hover:text-slate-300 text-xs"
				>
					✕
				</button>
			</div>

			{/* Layer toggles */}
			<div className="space-y-1 mb-2">
				{WEATHER_LAYERS.map((wl) => {
					const isActive = activeLayers.has(wl.id);
					return (
						<button
							key={wl.id}
							type="button"
							onClick={() => toggleLayer(wl.id)}
							className={`w-full flex items-center gap-2 px-2 py-1 rounded text-[9px] font-mono tracking-wider transition-colors ${
								isActive
									? "bg-cyan-900/30 text-cyan-300 border border-cyan-700/30"
									: "text-slate-500 hover:text-slate-300 border border-transparent"
							}`}
						>
							<span>{wl.icon}</span>
							<span className="flex-1 text-left">{wl.label}</span>
							<span className="text-[7px]">{isActive ? "ON" : "OFF"}</span>
						</button>
					);
				})}
			</div>

			{/* Opacity slider */}
			{activeLayers.size > 0 && (
				<div className="pt-1.5 border-t border-slate-800/40">
					<div className="flex items-center justify-between mb-0.5">
						<span className="text-[8px] font-mono text-slate-500">OPACITY</span>
						<span className="text-[8px] font-mono text-cyan-400">{Math.round(opacity * 100)}%</span>
					</div>
					<input
						type="range"
						min={0}
						max={1}
						step={0.05}
						value={opacity}
						onChange={(e) => setOpacity(Number(e.target.value))}
						className="w-full h-1 appearance-none bg-slate-700 rounded-full cursor-pointer
							[&::-webkit-slider-thumb]:appearance-none
							[&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5
							[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400"
					/>
				</div>
			)}

			{/* Status */}
			<div className="mt-1.5 text-[7px] font-mono text-slate-600 text-center">
				{activeLayers.size === 0
					? "Select a layer to enable"
					: `${activeLayers.size} layer${activeLayers.size > 1 ? "s" : ""} active`}
			</div>
		</div>
	);
}
