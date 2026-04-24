import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";

interface MinimapProps {
	mainCenter: { lat: number; lng: number };
	mainZoom: number;
	mainBounds: [[number, number], [number, number]] | null;
	onNavigate: (lat: number, lng: number) => void;
}

export default function Minimap({ mainCenter, mainZoom, mainBounds, onNavigate }: MinimapProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const mapRef = useRef<maplibregl.Map | null>(null);
	const markerRef = useRef<maplibregl.Marker | null>(null);

	useEffect(() => {
		if (!containerRef.current) return;
		const m = new maplibregl.Map({
			container: containerRef.current,
			style: "https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json",
			center: [mainCenter.lng, mainCenter.lat],
			zoom: 0.8,
			interactive: false,
			attributionControl: false,
		});
		mapRef.current = m;

		// Click to navigate
		containerRef.current.addEventListener("click", (e) => {
			const rect = containerRef.current!.getBoundingClientRect();
			const lngLat = m.unproject([e.clientX - rect.left, e.clientY - rect.top]);
			onNavigate(lngLat.lat, lngLat.lng);
		});

		return () => m.remove();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Update viewport rectangle
	useEffect(() => {
		const m = mapRef.current;
		if (!m || !m.isStyleLoaded()) return;

		// Create or update marker showing main map center
		if (!markerRef.current) {
			const el = document.createElement("div");
			el.style.width = "6px";
			el.style.height = "6px";
			el.style.borderRadius = "50%";
			el.style.backgroundColor = "#22d3ee";
			el.style.boxShadow = "0 0 6px #22d3ee";
			markerRef.current = new maplibregl.Marker({ element: el }).setLngLat([mainCenter.lng, mainCenter.lat]).addTo(m);
		} else {
			markerRef.current.setLngLat([mainCenter.lng, mainCenter.lat]);
		}

		// Draw viewport rectangle
		if (mainBounds) {
			const src = m.getSource("viewport-box") as maplibregl.GeoJSONSource;
			const box: GeoJSON.Feature = {
				type: "Feature",
				geometry: {
					type: "Polygon",
					coordinates: [[
						[mainBounds[0][0], mainBounds[0][1]],
						[mainBounds[1][0], mainBounds[0][1]],
						[mainBounds[1][0], mainBounds[1][1]],
						[mainBounds[0][0], mainBounds[1][1]],
						[mainBounds[0][0], mainBounds[0][1]],
					]],
				},
				properties: {},
			};

			if (src) {
				src.setData({ type: "FeatureCollection", features: [box] });
			} else {
				m.addSource("viewport-box", {
					type: "geojson",
					data: { type: "FeatureCollection", features: [box] },
				});
				m.addLayer({
					id: "viewport-fill",
					type: "fill",
					source: "viewport-box",
					paint: { "fill-color": "#22d3ee", "fill-opacity": 0.08 },
				});
				m.addLayer({
					id: "viewport-outline",
					type: "line",
					source: "viewport-box",
					paint: { "line-color": "#22d3ee", "line-width": 1, "line-opacity": 0.6 },
				});
			}
		}
	}, [mainCenter, mainBounds]);

	return (
		<div className="absolute bottom-12 right-2 z-20 w-28 h-20 rounded border border-slate-600/50 overflow-hidden shadow-lg cursor-crosshair">
			<div ref={containerRef} className="w-full h-full" />
			<div className="absolute top-0.5 left-1 text-[7px] font-mono text-slate-500 pointer-events-none">
				Z{mainZoom.toFixed(1)}
			</div>
		</div>
	);
}
