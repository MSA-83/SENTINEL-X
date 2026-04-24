import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";

/**
 * Adds animated HTML marker overlays for critical entities.
 * These float above the WebGL map as DOM elements with CSS pulse animations.
 */
interface CriticalMarkersProps {
	mapRef: React.RefObject<maplibregl.Map | null>;
	aircraft: Array<Record<string, unknown>>;
	seismicEvents: Array<Record<string, unknown>>;
	disasters: Array<Record<string, unknown>>;
}

interface MarkerDef {
	id: string;
	lng: number;
	lat: number;
	type: "squawk" | "earthquake" | "disaster";
	label: string;
	color: string;
	size: number;
}

function getMarkers(
	aircraft: Array<Record<string, unknown>>,
	seismicEvents: Array<Record<string, unknown>>,
	disasters: Array<Record<string, unknown>>,
): MarkerDef[] {
	const out: MarkerDef[] = [];

	// Emergency squawk aircraft
	for (const a of aircraft) {
		const sq = String(a.squawk ?? "");
		if (!["7500", "7600", "7700"].includes(sq)) continue;
		const lat = Number(a.latitude ?? a.lat ?? 0);
		const lng = Number(a.longitude ?? a.lon ?? a.lng ?? 0);
		if (!lat && !lng) continue;
		const label = sq === "7500" ? "HIJACK" : sq === "7600" ? "RADIO" : "MAYDAY";
		out.push({ id: `sq-${a.icao24 ?? sq}`, lng, lat, type: "squawk", label, color: "#ef4444", size: 28 });
	}

	// Major earthquakes (M5.5+)
	for (const s of seismicEvents) {
		const mag = Number(s.magnitude ?? 0);
		if (mag < 5.5) continue;
		const lat = Number(s.latitude ?? s.lat ?? 0);
		const lng = Number(s.longitude ?? s.lon ?? s.lng ?? 0);
		if (!lat && !lng) continue;
		out.push({ id: `eq-${s.eventId ?? s._id}`, lng, lat, type: "earthquake", label: `M${mag.toFixed(1)}`, color: "#f59e0b", size: 20 + mag * 4 });
	}

	// Red alert disasters
	for (const d of disasters) {
		if (String(d.alertLevel ?? "").toLowerCase() !== "red") continue;
		const lat = Number(d.latitude ?? d.lat ?? 0);
		const lng = Number(d.longitude ?? d.lon ?? d.lng ?? 0);
		if (!lat && !lng) continue;
		out.push({ id: `dis-${d.eventId ?? d._id}`, lng, lat, type: "disaster", label: "RED", color: "#dc2626", size: 24 });
	}

	return out;
}

export default function CriticalMarkers({ mapRef, aircraft, seismicEvents, disasters }: CriticalMarkersProps) {
	const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());

	useEffect(() => {
		const m = mapRef.current;
		if (!m) return;

		const desired = getMarkers(aircraft, seismicEvents, disasters);
		const desiredIds = new Set(desired.map((d) => d.id));
		const current = markersRef.current;

		// Remove stale markers
		for (const [id, marker] of current.entries()) {
			if (!desiredIds.has(id)) {
				marker.remove();
				current.delete(id);
			}
		}

		// Add/update markers
		for (const def of desired) {
			if (current.has(def.id)) {
				current.get(def.id)!.setLngLat([def.lng, def.lat]);
				continue;
			}

			const el = document.createElement("div");
			el.style.cssText = `position:relative;width:${def.size * 2}px;height:${def.size * 2}px;pointer-events:none;`;

			// Outer pulsing ring
			const ring1 = document.createElement("div");
			ring1.style.cssText = `
				position:absolute;inset:0;border-radius:50%;
				border:2px solid ${def.color};
				animation:critical-pulse 2s ease-out infinite;opacity:0.6;
			`;

			// Second ring (delayed)
			const ring2 = document.createElement("div");
			ring2.style.cssText = `
				position:absolute;inset:${def.size * 0.15}px;border-radius:50%;
				border:1.5px solid ${def.color};
				animation:critical-pulse 2s ease-out infinite 0.6s;opacity:0.4;
			`;

			// Center dot with glow
			const dot = document.createElement("div");
			dot.style.cssText = `
				position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
				width:8px;height:8px;background:${def.color};border-radius:50%;
				box-shadow:0 0 8px ${def.color},0 0 16px ${def.color}66;
			`;

			// Label below
			const label = document.createElement("div");
			label.style.cssText = `
				position:absolute;top:100%;left:50%;transform:translate(-50%,4px);
				font-size:8px;font-family:monospace;font-weight:bold;
				color:${def.color};text-shadow:0 0 4px ${def.color}88;
				white-space:nowrap;letter-spacing:1px;
			`;
			label.textContent = def.label;

			el.appendChild(ring1);
			el.appendChild(ring2);
			el.appendChild(dot);
			el.appendChild(label);

			const marker = new maplibregl.Marker({ element: el })
				.setLngLat([def.lng, def.lat])
				.addTo(m);
			current.set(def.id, marker);
		}
	}, [aircraft, seismicEvents, disasters, mapRef]);

	// Cleanup on unmount
	useEffect(() => {
		const current = markersRef.current;
		return () => {
			for (const marker of current.values()) marker.remove();
			current.clear();
		};
	}, []);

	return null; // Renders via DOM markers on the map
}
