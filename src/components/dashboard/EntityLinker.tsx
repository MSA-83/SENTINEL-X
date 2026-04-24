import { useState, useEffect, useCallback } from "react";
import type maplibregl from "maplibre-gl";

/* ── Types ───────────────────────────────────────────────────────────── */
interface LinkedEntity {
	id: string;
	label: string;
	lat: number;
	lon: number;
	type: string;
}

interface EntityLink {
	id: string;
	from: LinkedEntity;
	to: LinkedEntity;
	note: string;
	color: string;
	linkType: "associated" | "suspicious" | "confirmed" | "tracking";
	createdAt: number;
}

const STORAGE_KEY = "sx_entity_links";
const LINK_COLORS: Record<string, string> = {
	associated: "#8b5cf6",
	suspicious: "#f59e0b",
	confirmed: "#22c55e",
	tracking: "#06b6d4",
};

function genId() { return Math.random().toString(36).slice(2, 8); }

function loadLinks(): EntityLink[] {
	try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
	catch { return []; }
}

/* ── Hook ────────────────────────────────────────────────────────────── */
export function useEntityLinks() {
	const [links, setLinks] = useState<EntityLink[]>(loadLinks);

	useEffect(() => {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
	}, [links]);

	const addLink = useCallback((link: Omit<EntityLink, "id" | "createdAt">) => {
		setLinks((prev) => [...prev, { ...link, id: genId(), createdAt: Date.now() }]);
	}, []);

	const removeLink = useCallback((id: string) => {
		setLinks((prev) => prev.filter((l) => l.id !== id));
	}, []);

	const clearLinks = useCallback(() => setLinks([]), []);

	return { links, addLink, removeLink, clearLinks };
}

/* ── Map Rendering ───────────────────────────────────────────────────── */
interface EntityLinkerMapProps {
	map: maplibregl.Map | null;
	links: EntityLink[];
}

export function EntityLinkerMapOverlay({ map, links }: EntityLinkerMapProps) {
	useEffect(() => {
		if (!map || links.length === 0) {
			// Cleanup
			if (map) {
				try {
					if (map.getLayer("sx-elink-lines")) map.removeLayer("sx-elink-lines");
					if (map.getLayer("sx-elink-labels")) map.removeLayer("sx-elink-labels");
					if (map.getSource("sx-elink")) map.removeSource("sx-elink");
				} catch { /* */ }
			}
			return;
		}

		const features: GeoJSON.Feature[] = links.map((link) => ({
			type: "Feature",
			properties: {
				color: LINK_COLORS[link.linkType] || "#888",
				note: link.note || link.linkType.toUpperCase(),
				linkType: link.linkType,
			},
			geometry: {
				type: "LineString",
				coordinates: [
					[link.from.lon, link.from.lat],
					[link.to.lon, link.to.lat],
				],
			},
		}));

		// Midpoints for labels
		const midpoints: GeoJSON.Feature[] = links.map((link) => ({
			type: "Feature",
			properties: {
				text: link.note || link.linkType.toUpperCase(),
				color: LINK_COLORS[link.linkType] || "#888",
			},
			geometry: {
				type: "Point",
				coordinates: [
					(link.from.lon + link.to.lon) / 2,
					(link.from.lat + link.to.lat) / 2,
				],
			},
		}));

		const geojson: GeoJSON.FeatureCollection = {
			type: "FeatureCollection",
			features: [...features, ...midpoints],
		};

		try {
			if (map.getSource("sx-elink")) {
				(map.getSource("sx-elink") as maplibregl.GeoJSONSource).setData(geojson);
			} else {
				map.addSource("sx-elink", { type: "geojson", data: geojson });
				map.addLayer({
					id: "sx-elink-lines",
					type: "line",
					source: "sx-elink",
					filter: ["==", "$type", "LineString"],
					paint: {
						"line-color": ["get", "color"],
						"line-width": 2,
						"line-dasharray": [6, 3],
						"line-opacity": 0.7,
					},
				});
				map.addLayer({
					id: "sx-elink-labels",
					type: "symbol",
					source: "sx-elink",
					filter: ["==", "$type", "Point"],
					layout: {
						"text-field": ["get", "text"],
						"text-size": 9,
						"text-font": ["Open Sans Bold"],
					},
					paint: {
						"text-color": ["get", "color"],
						"text-halo-color": "#000",
						"text-halo-width": 1.5,
					},
				});
			}
		} catch { /* */ }

		return () => {
			try {
				if (map.getLayer("sx-elink-lines")) map.removeLayer("sx-elink-lines");
				if (map.getLayer("sx-elink-labels")) map.removeLayer("sx-elink-labels");
				if (map.getSource("sx-elink")) map.removeSource("sx-elink");
			} catch { /* */ }
		};
	}, [map, links]);

	return null;
}

/* ── Panel Component ─────────────────────────────────────────────────── */
interface EntityLinkerPanelProps {
	links: EntityLink[];
	onAdd: (link: Omit<EntityLink, "id" | "createdAt">) => void;
	onRemove: (id: string) => void;
	onClear: () => void;
	selectedEntity: Record<string, unknown> | null;
	/** Set by user: first entity for new link */
	linkSource: LinkedEntity | null;
	onSetLinkSource: (e: LinkedEntity | null) => void;
}

function extractLinkedEntity(entity: Record<string, unknown>): LinkedEntity | null {
	const lat = entity.latitude as number | undefined;
	const lon = entity.longitude as number | undefined;
	if (lat == null || lon == null) return null;

	const id =
		(entity.icao24 as string) ||
		(entity.mmsi as string) ||
		(entity.eventId as string) ||
		(entity._id as string) ||
		"unknown";

	const label =
		(entity.callsign as string) ||
		(entity.name as string) ||
		(entity.title as string) ||
		id;

	const type =
		(entity._entityType as string) ||
		(entity.icao24 ? "aircraft" : entity.mmsi ? "vessel" : "entity");

	return { id, label, lat, lon, type };
}

export function EntityLinkerPanel({
	links, onAdd, onRemove, onClear, selectedEntity, linkSource, onSetLinkSource,
}: EntityLinkerPanelProps) {
	const [linkType, setLinkType] = useState<EntityLink["linkType"]>("associated");
	const [note, setNote] = useState("");

	const currentEntity = selectedEntity ? extractLinkedEntity(selectedEntity) : null;

	const handleSetSource = useCallback(() => {
		if (currentEntity) onSetLinkSource(currentEntity);
	}, [currentEntity, onSetLinkSource]);

	const handleCreateLink = useCallback(() => {
		if (!linkSource || !currentEntity) return;
		onAdd({
			from: linkSource,
			to: currentEntity,
			note: note.trim(),
			color: LINK_COLORS[linkType],
			linkType,
		});
		onSetLinkSource(null);
		setNote("");
	}, [linkSource, currentEntity, note, linkType, onAdd, onSetLinkSource]);

	const haversine = (a: LinkedEntity, b: LinkedEntity) => {
		const R = 6371;
		const dLat = ((b.lat - a.lat) * Math.PI) / 180;
		const dLon = ((b.lon - a.lon) * Math.PI) / 180;
		const sinLat = Math.sin(dLat / 2);
		const sinLon = Math.sin(dLon / 2);
		const h = sinLat * sinLat + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinLon * sinLon;
		return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
	};

	return (
		<div className="flex flex-col h-full font-mono text-[10px]">
			{/* Header */}
			<div className="px-3 py-2 border-b border-cyan-900/30 text-cyan-400 tracking-widest">
				🔗 ENTITY LINKS
			</div>

			{/* Link builder */}
			<div className="p-2 border-b border-cyan-900/20 space-y-2 bg-slate-800/20">
				{/* Source entity */}
				<div className="flex items-center gap-2">
					<span className="text-slate-500 w-12">FROM</span>
					{linkSource ? (
						<div className="flex-1 flex items-center gap-1">
							<span className="text-cyan-300">{linkSource.label}</span>
							<span className="text-slate-600">({linkSource.type})</span>
							<button onClick={() => onSetLinkSource(null)} className="text-red-500/50 hover:text-red-400 ml-1">✕</button>
						</div>
					) : (
						<button
							onClick={handleSetSource}
							disabled={!currentEntity}
							className="flex-1 py-1 bg-slate-800/60 border border-dashed border-slate-600/40 rounded
							           text-slate-500 hover:border-cyan-700 disabled:opacity-30 text-[9px]"
						>
							{currentEntity ? `Set "${currentEntity.label}"` : "Select entity on map first"}
						</button>
					)}
				</div>

				{/* Target entity */}
				<div className="flex items-center gap-2">
					<span className="text-slate-500 w-12">TO</span>
					{currentEntity && linkSource ? (
						<span className="text-amber-300">{currentEntity.label} <span className="text-slate-600">({currentEntity.type})</span></span>
					) : (
						<span className="text-slate-600">Select second entity</span>
					)}
				</div>

				{/* Link type */}
				<div className="flex items-center gap-1">
					<span className="text-slate-500 w-12">TYPE</span>
					<div className="flex gap-1 flex-1">
						{(["associated", "suspicious", "confirmed", "tracking"] as const).map((t) => (
							<button
								key={t}
								onClick={() => setLinkType(t)}
								className={`px-1.5 py-1 rounded text-[8px] tracking-wider border transition-all ${
									linkType === t
										? `border-current bg-opacity-20`
										: "border-slate-700/30 text-slate-500 hover:border-slate-600"
								}`}
								style={linkType === t ? { color: LINK_COLORS[t], borderColor: LINK_COLORS[t], background: LINK_COLORS[t] + "20" } : {}}
							>
								{t.toUpperCase()}
							</button>
						))}
					</div>
				</div>

				{/* Note */}
				<div className="flex items-center gap-2">
					<span className="text-slate-500 w-12">NOTE</span>
					<input
						type="text"
						value={note}
						onChange={(e) => setNote(e.target.value)}
						placeholder="Optional note..."
						maxLength={50}
						className="flex-1 bg-slate-900 border border-slate-600/40 rounded px-2 py-1
						           text-cyan-300 text-[10px] focus:outline-none focus:border-cyan-500"
					/>
				</div>

				{/* Create button */}
				<button
					onClick={handleCreateLink}
					disabled={!linkSource || !currentEntity}
					className="w-full py-1.5 bg-cyan-900/40 border border-cyan-700/50 rounded text-cyan-300
					           tracking-widest hover:bg-cyan-800/50 disabled:opacity-30 transition-all"
				>
					🔗 CREATE LINK
				</button>
			</div>

			{/* Existing links */}
			<div className="flex-1 overflow-y-auto">
				{links.length === 0 && (
					<div className="text-slate-600 text-center py-6">
						No entity links yet.<br />
						Select an entity → set as FROM → select another → link.
					</div>
				)}
				{links.map((link) => (
					<div
						key={link.id}
						className="px-3 py-2 border-b border-slate-800/50 hover:bg-slate-800/20"
					>
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-1.5">
								<span className="w-2 h-2 rounded-full" style={{ background: LINK_COLORS[link.linkType] }} />
								<span className="text-slate-300">{link.from.label}</span>
								<span className="text-slate-600">⟶</span>
								<span className="text-slate-300">{link.to.label}</span>
							</div>
							<button onClick={() => onRemove(link.id)} className="text-red-500/40 hover:text-red-400">✕</button>
						</div>
						<div className="flex items-center gap-2 mt-0.5 ml-4">
							<span className="text-[8px] px-1 py-0.5 rounded" style={{
								color: LINK_COLORS[link.linkType],
								border: `1px solid ${LINK_COLORS[link.linkType]}40`,
								background: `${LINK_COLORS[link.linkType]}10`,
							}}>
								{link.linkType.toUpperCase()}
							</span>
							{link.note && <span className="text-slate-500">{link.note}</span>}
							<span className="text-slate-600">{haversine(link.from, link.to).toFixed(0)}km</span>
						</div>
					</div>
				))}
			</div>

			{/* Footer */}
			{links.length > 0 && (
				<div className="px-3 py-1.5 border-t border-cyan-900/30 flex items-center justify-between">
					<span className="text-slate-500 text-[9px]">{links.length} LINK{links.length !== 1 ? "S" : ""}</span>
					<button
						onClick={onClear}
						className="text-red-500/50 hover:text-red-400 text-[9px] tracking-wider"
					>
						CLEAR ALL
					</button>
				</div>
			)}
		</div>
	);
}
