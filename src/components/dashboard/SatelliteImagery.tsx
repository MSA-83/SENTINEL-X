import { useState, useCallback } from "react";
import { SAT_PRODUCTS } from "../../lib/constants";
import type maplibregl from "maplibre-gl";

interface SatelliteImageryProps {
	mapRef: React.RefObject<maplibregl.Map | null>;
}

function getGibsUrl(product: typeof SAT_PRODUCTS[string], date: string): string {
	if (product.tileUrl) return product.tileUrl;
	if (product.gibsLayer) {
		return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${product.gibsLayer}/default/${date}/${product.matrixSet}/{z}/{y}/{x}.${product.format}`;
	}
	return "";
}

export default function SatelliteImagery({ mapRef }: SatelliteImageryProps) {
	const [activeLayer, setActiveLayer] = useState<string | null>(null);
	const [opacity, setOpacity] = useState(0.7);
	const [date, setDate] = useState(() => {
		const d = new Date();
		d.setDate(d.getDate() - 1); // yesterday for latest availability
		return d.toISOString().slice(0, 10);
	});

	const toggleLayer = useCallback((key: string) => {
		const m = mapRef.current;
		if (!m) return;

		// Remove existing imagery layer
		if (m.getLayer("sat-imagery-layer")) m.removeLayer("sat-imagery-layer");
		if (m.getSource("sat-imagery-source")) m.removeSource("sat-imagery-source");

		if (activeLayer === key) {
			setActiveLayer(null);
			return;
		}

		const product = SAT_PRODUCTS[key];
		if (!product) return;

		const url = getGibsUrl(product, date);
		if (!url) return;

		m.addSource("sat-imagery-source", {
			type: "raster",
			tiles: [url],
			tileSize: 256,
			maxzoom: product.maxZoom,
		});
		m.addLayer({
			id: "sat-imagery-layer",
			type: "raster",
			source: "sat-imagery-source",
			paint: { "raster-opacity": opacity },
		}, m.getLayer("fires-cluster") ? "fires-cluster" : undefined); // below data layers

		setActiveLayer(key);
	}, [mapRef, activeLayer, date, opacity]);

	// Update opacity live
	const handleOpacity = useCallback((val: number) => {
		setOpacity(val);
		const m = mapRef.current;
		if (m?.getLayer("sat-imagery-layer")) {
			m.setPaintProperty("sat-imagery-layer", "raster-opacity", val);
		}
	}, [mapRef]);

	const entries = Object.entries(SAT_PRODUCTS).filter(([, v]) => !v.copernicus); // skip oauth-only

	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between">
				<span className="text-[10px] font-mono text-slate-400 tracking-wider">SATELLITE IMAGERY</span>
				{activeLayer && (
					<button
						onClick={() => toggleLayer(activeLayer)}
						className="text-[9px] font-mono text-red-400 hover:text-red-300"
					>
						✕ OFF
					</button>
				)}
			</div>

			{/* Date picker for daily products */}
			<div className="flex items-center gap-2">
				<label className="text-[9px] font-mono text-slate-500">DATE</label>
				<input
					type="date"
					value={date}
					onChange={(e) => setDate(e.target.value)}
					className="bg-black/50 border border-slate-700/50 rounded px-1.5 py-0.5 text-[10px] font-mono text-slate-300 outline-none focus:border-cyan-700"
				/>
			</div>

			{/* Opacity slider */}
			<div className="flex items-center gap-2">
				<label className="text-[9px] font-mono text-slate-500">OPACITY</label>
				<input
					type="range" min="0.1" max="1" step="0.05"
					value={opacity}
					onChange={(e) => handleOpacity(parseFloat(e.target.value))}
					className="flex-1 h-1 accent-cyan-500"
				/>
				<span className="text-[9px] font-mono text-slate-400 w-6 text-right">{(opacity * 100).toFixed(0)}%</span>
			</div>

			{/* Product buttons */}
			<div className="grid grid-cols-2 gap-1">
				{entries.map(([key, product]) => (
					<button
						key={key}
						onClick={() => toggleLayer(key)}
						className={`p-1.5 rounded border text-left transition-colors ${
							activeLayer === key
								? "bg-cyan-950/60 border-cyan-600/60 text-cyan-300"
								: "bg-black/30 border-slate-700/30 text-slate-400 hover:bg-slate-800/50 hover:text-slate-300"
						}`}
					>
						<div className="text-[10px] font-mono font-bold truncate">{product.label}</div>
						<div className="text-[8px] font-mono text-slate-500">{product.sub}</div>
						<div className="text-[7px] font-mono text-slate-600 mt-0.5">{product.desc}</div>
					</button>
				))}
			</div>
		</div>
	);
}
