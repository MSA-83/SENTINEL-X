import { useState, useCallback, useEffect } from "react";
import type maplibregl from "maplibre-gl";

/* ── Basemap Definitions ─────────────────────────────────────────────── */
interface Basemap {
	id: string;
	label: string;
	thumb: string; // emoji or small symbol
	url: string;
}

const BASEMAPS: Basemap[] = [
	{
		id: "dark-ops",
		label: "Dark Ops",
		thumb: "🌑",
		url: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
	},
	{
		id: "satellite",
		label: "Satellite",
		thumb: "🛰",
		url: "https://api.maptiler.com/maps/hybrid/style.json?key=get_your_own_OpIi9ZULNHzrESv6T2vL",
	},
	{
		id: "light-intel",
		label: "Light Intel",
		thumb: "☀",
		url: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
	},
	{
		id: "voyager",
		label: "Voyager",
		thumb: "🧭",
		url: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
	},
	{
		id: "dark-nolabels",
		label: "Dark Clean",
		thumb: "⚫",
		url: "https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json",
	},
	{
		id: "high-contrast",
		label: "Hi-Contrast",
		thumb: "◼",
		url: "https://tiles.stadiamaps.com/styles/stamen_toner.json",
	},
];

const STORAGE_KEY = "sx_basemap";

/* ── Component ───────────────────────────────────────────────────────── */
interface BasemapSwitcherProps {
	map: maplibregl.Map | null;
}

export default function BasemapSwitcher({ map }: BasemapSwitcherProps) {
	const [open, setOpen] = useState(false);
	const [activeId, setActiveId] = useState<string>(() => {
		try { return localStorage.getItem(STORAGE_KEY) || "dark-ops"; }
		catch { return "dark-ops"; }
	});

	// On mount, if we have a saved basemap that's different from default, apply it
	useEffect(() => {
		if (!map || activeId === "dark-ops") return;
		const bm = BASEMAPS.find((b) => b.id === activeId);
		if (bm) {
			try {
				const cam = { center: map.getCenter(), zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() };
				map.setStyle(bm.url);
				map.once("styledata", () => {
					map.flyTo({ ...cam, duration: 0 });
				});
			} catch { /* */ }
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [map]);

	const handleSelect = useCallback(
		(bm: Basemap) => {
			if (!map || bm.id === activeId) return;
			setActiveId(bm.id);
			try { localStorage.setItem(STORAGE_KEY, bm.id); } catch { /* */ }
			// Preserve camera
			const cam = {
				center: map.getCenter(),
				zoom: map.getZoom(),
				bearing: map.getBearing(),
				pitch: map.getPitch(),
			};
			map.setStyle(bm.url);
			map.once("styledata", () => {
				map.flyTo({ ...cam, duration: 0 });
			});
			setOpen(false);
		},
		[map, activeId],
	);

	return (
		<div className="absolute bottom-28 right-2 z-20">
			{/* Toggle button */}
			<button
				onClick={() => setOpen((v) => !v)}
				className={`w-9 h-9 flex items-center justify-center rounded-lg border transition-all shadow-lg shadow-black/40 ${
					open
						? "bg-cyan-900/60 border-cyan-500 text-cyan-300"
						: "bg-slate-900/80 border-slate-700/50 text-slate-400 hover:border-cyan-800 hover:text-cyan-300"
				}`}
				title="Switch basemap"
			>
				<span className="text-base">🗺</span>
			</button>

			{/* Dropdown */}
			{open && (
				<div className="absolute bottom-11 right-0 w-56 bg-slate-950/95 border border-cyan-900/40 rounded-lg
				               backdrop-blur-xl shadow-xl shadow-black/60 p-2 font-mono text-[10px]">
					<div className="text-cyan-400 tracking-widest mb-2 px-1">🗺 BASEMAP</div>
					<div className="grid grid-cols-2 gap-1.5">
						{BASEMAPS.map((bm) => (
							<button
								key={bm.id}
								onClick={() => handleSelect(bm)}
								className={`flex flex-col items-center p-2 rounded-md border transition-all ${
									activeId === bm.id
										? "bg-cyan-900/40 border-cyan-600 text-cyan-300"
										: "bg-slate-800/30 border-slate-700/30 text-slate-400 hover:border-cyan-800 hover:text-slate-200"
								}`}
							>
								<span className="text-lg mb-0.5">{bm.thumb}</span>
								<span className="text-[8px] tracking-wider">{bm.label}</span>
							</button>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
