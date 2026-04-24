// @ts-nocheck
import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
	Crosshair, Search, Plane, Ship, Flame, Radio, Activity, MapPin, SortAsc, SortDesc, AlertTriangle
} from "lucide-react";

type AssetType = "aircraft" | "vessel" | "fire" | "seismic" | "conflict" | "cyber";
type SortField = "name" | "type" | "risk" | "updated";

interface UnifiedAsset {
	id: string;
	name: string;
	type: AssetType;
	subtype?: string;
	lat?: number;
	lng?: number;
	altitude?: number;
	speed?: number;
	heading?: number;
	country?: string;
	risk: number;
	status: string;
	updated: number;
	raw: Record<string, unknown>;
}

const TYPE_CONFIG: Record<AssetType, { icon: typeof Plane; color: string; label: string }> = {
	aircraft: { icon: Plane, color: "#00ccff", label: "Aircraft" },
	vessel: { icon: Ship, color: "#00ff88", label: "Vessel" },
	fire: { icon: Flame, color: "#ff5500", label: "Fire" },
	seismic: { icon: Activity, color: "#ffee00", label: "Seismic" },
	conflict: { icon: AlertTriangle, color: "#ff2200", label: "Conflict" },
	cyber: { icon: Radio, color: "#66ffcc", label: "Cyber" },
};

export function AssetTrackingPage() {
	const aircraft = useQuery(api.entities.listAircraft) ?? [];
	const vessels = useQuery(api.entities.listVessels) ?? [];
	const fires = useQuery(api.entities.listFires) ?? [];
	const seismic = useQuery(api.entities.listSeismicEvents) ?? [];
	const conflicts = useQuery(api.entities.listConflictEvents) ?? [];
	const cyber = useQuery(api.entities.listCyberThreats) ?? [];

	const [searchQuery, setSearchQuery] = useState("");
	const [typeFilter, setTypeFilter] = useState<string>("all");
	const [sortField, setSortField] = useState<SortField>("updated");
	const [sortAsc, setSortAsc] = useState(false);
	const [selectedAsset, setSelectedAsset] = useState<string | null>(null);

	// Unify all entities
	const allAssets = useMemo<UnifiedAsset[]>(() => {
		const assets: UnifiedAsset[] = [];
		for (const a of aircraft) {
			assets.push({
				id: `ac-${a.icao24 || a.callsign}`,
				name: a.callsign || a.icao24 || "Unknown",
				type: "aircraft",
				subtype: a.category || (a.military ? "Military" : "Civil"),
				lat: a.latitude,
				lng: a.longitude,
				altitude: a.altitude ?? undefined,
				speed: a.speed ?? undefined,
				heading: a.heading ?? undefined,
				country: a.country ?? undefined,
				risk: a.squawk === "7700" || a.squawk === "7600" ? 90 : a.military ? 60 : 20,
				status: a.onGround ? "ground" : "airborne",
				updated: a.lastSeen ?? Date.now(),
				raw: a as unknown as Record<string, unknown>,
			});
		}
		for (const v of vessels) {
			assets.push({
				id: `vs-${v.mmsi}`,
				name: v.name || v.mmsi || "Unknown",
				type: "vessel",
				subtype: v.shipType ?? undefined,
				lat: v.latitude,
				lng: v.longitude,
				speed: v.speed ?? undefined,
				heading: v.heading ?? undefined,
				country: v.flag ?? undefined,
				risk: v.destination === "UNKNOWN" ? 70 : 30,
				status: (v.speed ?? 0) > 0.5 ? "underway" : "anchored",
				updated: v.lastSeen ?? Date.now(),
				raw: v as unknown as Record<string, unknown>,
			});
		}
		for (const f of fires) {
			assets.push({
				id: `fi-${f.latitude}-${f.longitude}`,
				name: `Fire ${f.latitude?.toFixed(2)}°, ${f.longitude?.toFixed(2)}°`,
				type: "fire",
				lat: f.latitude,
				lng: f.longitude,
				risk: (f.confidence ?? 50) > 80 ? 80 : 50,
				status: "active",
				updated: f.detectedAt ?? Date.now(),
				raw: f as unknown as Record<string, unknown>,
			});
		}
		for (const s of seismic) {
			assets.push({
				id: `se-${s.eventId}`,
				name: s.place || `M${s.magnitude} Event`,
				type: "seismic",
				lat: s.latitude,
				lng: s.longitude,
				risk: (s.magnitude ?? 0) > 5 ? 85 : (s.magnitude ?? 0) > 3 ? 50 : 20,
				status: "detected",
				updated: s.time ?? Date.now(),
				raw: s as unknown as Record<string, unknown>,
			});
		}
		for (const c of conflicts) {
			assets.push({
				id: `co-${c.eventId}`,
				name: c.title || c.eventType || "Conflict Event",
				type: "conflict",
				subtype: c.eventType ?? undefined,
				lat: c.latitude,
				lng: c.longitude,
				country: c.country ?? undefined,
				risk: c.severity === "critical" ? 95 : c.severity === "high" ? 75 : 45,
				status: c.status || "active",
				updated: c.reportedAt ?? Date.now(),
				raw: c as unknown as Record<string, unknown>,
			});
		}
		for (const cy of cyber) {
			assets.push({
				id: `cy-${cy.threatId}`,
				name: cy.title || cy.threatType || "Cyber Threat",
				type: "cyber",
				subtype: cy.threatType ?? undefined,
				risk: cy.severity === "critical" ? 95 : cy.severity === "high" ? 75 : 40,
				status: cy.status || "active",
				updated: cy.detectedAt ?? Date.now(),
				raw: cy as unknown as Record<string, unknown>,
			});
		}
		return assets;
	}, [aircraft, vessels, fires, seismic, conflicts, cyber]);

	// Filter and sort
	const filtered = useMemo(() => {
		let result = allAssets;
		if (typeFilter !== "all") result = result.filter((a) => a.type === typeFilter);
		if (searchQuery) {
			const q = searchQuery.toLowerCase();
			result = result.filter((a) =>
				a.name.toLowerCase().includes(q) ||
				a.type.includes(q) ||
				a.subtype?.toLowerCase().includes(q) ||
				a.country?.toLowerCase().includes(q)
			);
		}
		result.sort((a, b) => {
			let cmp = 0;
			if (sortField === "name") cmp = a.name.localeCompare(b.name);
			else if (sortField === "type") cmp = a.type.localeCompare(b.type);
			else if (sortField === "risk") cmp = a.risk - b.risk;
			else cmp = a.updated - b.updated;
			return sortAsc ? cmp : -cmp;
		});
		return result;
	}, [allAssets, typeFilter, searchQuery, sortField, sortAsc]);

	const selectedData = selectedAsset ? allAssets.find((a) => a.id === selectedAsset) : null;

	// Type counts
	const typeCounts = useMemo(() => {
		const counts: Record<string, number> = {};
		allAssets.forEach((a) => { counts[a.type] = (counts[a.type] || 0) + 1; });
		return counts;
	}, [allAssets]);

	return (
		<div className="min-h-screen bg-slate-950 text-slate-100">
			{/* Header */}
			<div className="border-b border-slate-800 bg-slate-950/95 backdrop-blur sticky top-0 z-30">
				<div className="flex items-center justify-between px-6 h-14">
					<div className="flex items-center gap-3">
						<Crosshair className="w-5 h-5 text-cyan-400" />
						<span className="font-mono text-sm font-semibold tracking-wider text-cyan-400">ASSET TRACKING</span>
						<span className="text-[10px] font-mono text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
							{allAssets.length} ENTITIES
						</span>
					</div>
				</div>
			</div>

			<div className="flex h-[calc(100vh-3.5rem)]">
				{/* Left — asset list */}
				<div className="w-[480px] border-r border-slate-800 flex flex-col">
					{/* Type filter chips */}
					<div className="flex gap-2 p-3 border-b border-slate-800 overflow-x-auto">
						<button
							onClick={() => setTypeFilter("all")}
							className={`flex-shrink-0 text-[10px] font-mono px-2 py-1 rounded border transition ${
								typeFilter === "all" ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300" : "border-slate-700 text-slate-500 hover:text-slate-300"
							}`}
						>
							ALL ({allAssets.length})
						</button>
						{(Object.entries(TYPE_CONFIG) as [AssetType, typeof TYPE_CONFIG.aircraft][]).map(([k, v]) => (
							<button
								key={k}
								onClick={() => setTypeFilter(k)}
								className={`flex-shrink-0 flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded border transition ${
									typeFilter === k
										? `border-opacity-40 text-opacity-100`
										: "border-slate-700 text-slate-500 hover:text-slate-300"
								}`}
								style={typeFilter === k ? { color: v.color, borderColor: v.color + "60", background: v.color + "15" } : {}}
							>
								<v.icon className="w-2.5 h-2.5" />
								{v.label.toUpperCase()} ({typeCounts[k] || 0})
							</button>
						))}
					</div>

					{/* Search + sort */}
					<div className="flex gap-2 p-3 border-b border-slate-800">
						<div className="relative flex-1">
							<Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-500" />
							<input
								type="text"
								placeholder="Search assets..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-slate-300 focus:border-cyan-500 focus:outline-none"
							/>
						</div>
						<select
							value={sortField}
							onChange={(e) => setSortField(e.target.value as SortField)}
							className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-[10px] font-mono text-slate-400 focus:outline-none"
						>
							<option value="updated">LAST SEEN</option>
							<option value="risk">RISK</option>
							<option value="name">NAME</option>
							<option value="type">TYPE</option>
						</select>
						<button
							onClick={() => setSortAsc(!sortAsc)}
							className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-slate-400 hover:text-slate-200"
						>
							{sortAsc ? <SortAsc className="w-3.5 h-3.5" /> : <SortDesc className="w-3.5 h-3.5" />}
						</button>
					</div>

					{/* Asset list */}
					<div className="flex-1 overflow-y-auto">
						{filtered.map((a) => {
							const cfg = TYPE_CONFIG[a.type];
							const riskColor = a.risk > 80 ? "#ef4444" : a.risk > 60 ? "#f59e0b" : a.risk > 40 ? "#eab308" : "#22c55e";
							return (
								<button
									key={a.id}
									onClick={() => setSelectedAsset(a.id)}
									className={`w-full text-left px-4 py-2.5 border-b border-slate-800/60 hover:bg-slate-800/40 transition ${
										selectedAsset === a.id ? "bg-slate-800/60 border-l-2" : ""
									}`}
									style={selectedAsset === a.id ? { borderLeftColor: cfg.color } : {}}
								>
									<div className="flex items-center gap-3">
										<div className="w-8 h-8 rounded flex items-center justify-center" style={{ background: cfg.color + "20" }}>
											<cfg.icon className="w-4 h-4" style={{ color: cfg.color }} />
										</div>
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2">
												<span className="text-sm text-slate-200 font-medium truncate">{a.name}</span>
												{a.subtype && <span className="text-[9px] font-mono text-slate-500">{a.subtype}</span>}
											</div>
											<div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono">
												{a.lat !== undefined && (
													<span><MapPin className="w-2.5 h-2.5 inline" /> {a.lat.toFixed(2)}°, {a.lng?.toFixed(2)}°</span>
												)}
												{a.speed !== undefined && <span>{a.speed.toFixed(0)} kts</span>}
												{a.altitude !== undefined && <span>FL{Math.round(a.altitude / 100)}</span>}
												{a.country && <span>{a.country}</span>}
											</div>
										</div>
										<div className="flex flex-col items-end gap-1">
											<div className="flex items-center gap-1">
												<div className="w-1.5 h-1.5 rounded-full" style={{ background: riskColor }} />
												<span className="text-[10px] font-mono" style={{ color: riskColor }}>{a.risk}</span>
											</div>
											<span className="text-[9px] font-mono text-slate-600">{a.status}</span>
										</div>
									</div>
								</button>
							);
						})}
						{filtered.length === 0 && (
							<div className="p-8 text-center text-slate-600 text-sm">No assets match your filters</div>
						)}
					</div>
				</div>

				{/* Right — asset detail */}
				<div className="flex-1 overflow-y-auto">
					{selectedData ? (
						<div className="p-6">
							<div className="flex items-center gap-3 mb-6">
								<div
									className="w-12 h-12 rounded-lg flex items-center justify-center"
									style={{ background: TYPE_CONFIG[selectedData.type].color + "20" }}
								>
									{(() => { const Icon = TYPE_CONFIG[selectedData.type].icon; return <Icon className="w-6 h-6" style={{ color: TYPE_CONFIG[selectedData.type].color }} />; })()}
								</div>
								<div>
									<h2 className="text-lg font-semibold text-slate-100">{selectedData.name}</h2>
									<div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
										<span style={{ color: TYPE_CONFIG[selectedData.type].color }}>{selectedData.type.toUpperCase()}</span>
										{selectedData.subtype && <><span>·</span><span>{selectedData.subtype}</span></>}
										<span>·</span>
										<span>{selectedData.status.toUpperCase()}</span>
									</div>
								</div>
							</div>

							{/* Risk gauge */}
							<div className="mb-6 p-4 bg-slate-900/50 border border-slate-800 rounded-lg">
								<div className="flex items-center justify-between mb-2">
									<span className="text-[9px] font-mono text-slate-500">RISK ASSESSMENT</span>
									<span className="text-lg font-mono font-bold" style={{
										color: selectedData.risk > 80 ? "#ef4444" : selectedData.risk > 60 ? "#f59e0b" : "#22c55e"
									}}>
										{selectedData.risk}/100
									</span>
								</div>
								<div className="h-2 bg-slate-800 rounded-full overflow-hidden">
									<div
										className="h-full rounded-full transition-all"
										style={{
											width: `${selectedData.risk}%`,
											background: selectedData.risk > 80 ? "#ef4444" : selectedData.risk > 60 ? "#f59e0b" : "#22c55e",
										}}
									/>
								</div>
							</div>

							{/* Position grid */}
							<div className="grid grid-cols-3 gap-3 mb-6">
								{[
									{ label: "LATITUDE", value: selectedData.lat?.toFixed(4) ?? "N/A" },
									{ label: "LONGITUDE", value: selectedData.lng?.toFixed(4) ?? "N/A" },
									{ label: "ALTITUDE", value: selectedData.altitude ? `${selectedData.altitude.toLocaleString()} ft` : "N/A" },
									{ label: "SPEED", value: selectedData.speed ? `${selectedData.speed.toFixed(1)} kts` : "N/A" },
									{ label: "HEADING", value: selectedData.heading ? `${selectedData.heading.toFixed(0)}°` : "N/A" },
									{ label: "COUNTRY", value: selectedData.country ?? "N/A" },
								].map((p) => (
									<div key={p.label} className="bg-slate-900/50 border border-slate-800 rounded p-3">
										<div className="text-[9px] font-mono text-slate-500 mb-0.5">{p.label}</div>
										<div className="text-xs font-mono text-slate-300">{p.value}</div>
									</div>
								))}
							</div>

							{/* Raw data */}
							<div>
								<h3 className="text-[10px] font-mono text-slate-500 mb-2">RAW DATA</h3>
								<div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 max-h-96 overflow-y-auto">
									<pre className="text-[10px] font-mono text-slate-400 whitespace-pre-wrap">
										{JSON.stringify(selectedData.raw, null, 2)}
									</pre>
								</div>
							</div>
						</div>
					) : (
						<div className="flex items-center justify-center h-full text-slate-600">
							<div className="text-center">
								<Crosshair className="w-12 h-12 mx-auto mb-3 opacity-30" />
								<div className="text-sm font-mono">SELECT AN ASSET TO VIEW DETAILS</div>
								<div className="text-xs text-slate-700 mt-1">{allAssets.length} entities across {Object.keys(typeCounts).length} domains</div>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

export default AssetTrackingPage;
