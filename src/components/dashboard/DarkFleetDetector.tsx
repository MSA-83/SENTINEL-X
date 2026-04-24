/**
 * DarkFleetDetector — AIS Gap Detection
 * Identifies vessels that go dark (stop transmitting AIS) and flags suspicious patterns:
 * - Vessels near sanctioned zones
 * - Gaps in transmission (last seen > threshold ago)
 * - Speed anomalies before going dark
 * - Proximity to known dark-fleet hotspots
 */
import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

type Rec = Record<string, unknown>;

// Known dark-fleet / sanction-evasion hotspots
const SUSPICIOUS_ZONES: { name: string; lat: number; lng: number; radiusKm: number; reason: string }[] = [
	{ name: "Strait of Hormuz", lat: 26.5, lng: 56.3, radiusKm: 200, reason: "Iran sanctions evasion" },
	{ name: "Kerch Strait", lat: 45.3, lng: 36.6, radiusKm: 150, reason: "Russia sanctions corridor" },
	{ name: "Ship-to-Ship Xfer (SE Asia)", lat: 1.2, lng: 104.0, radiusKm: 300, reason: "Illicit STS transfers" },
	{ name: "North Korea EEZ", lat: 39.0, lng: 127.5, radiusKm: 250, reason: "DPRK sanctions zone" },
	{ name: "Libya Coast", lat: 32.9, lng: 13.1, radiusKm: 200, reason: "Arms embargo zone" },
	{ name: "Venezuela Coast", lat: 10.5, lng: -66.9, radiusKm: 250, reason: "Oil sanctions evasion" },
	{ name: "Syrian Waters", lat: 35.0, lng: 35.5, radiusKm: 150, reason: "Syria sanctions zone" },
	{ name: "Gulf of Guinea", lat: 4.0, lng: 3.0, radiusKm: 300, reason: "Piracy / IUU fishing" },
];

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
	const R = 6371;
	const dLat = (lat2 - lat1) * Math.PI / 180;
	const dLng = (lng2 - lng1) * Math.PI / 180;
	const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
	return 2 * R * Math.asin(Math.sqrt(a));
}

interface DarkVessel {
	mmsi: string;
	name: string;
	latitude: number;
	longitude: number;
	speed: number;
	flag: string;
	lastSeen: number;
	gapHours: number;
	riskScore: number;
	riskFactors: string[];
	nearZone: string | null;
	shipType: string;
}

export default function DarkFleetDetector() {
	const vessels = useQuery(api.entities.listVessels) ?? [];
	const [sortBy, setSortBy] = useState<"risk" | "gap" | "speed">("risk");
	const [expanded, setExpanded] = useState(false);

	const darkVessels = useMemo(() => {
		const now = Date.now();
		const GAP_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours = suspicious
		const results: DarkVessel[] = [];

		for (const v of vessels as Rec[]) {
			const ts = Number(v.timestamp ?? 0);
			const age = now - ts;
			if (age < GAP_THRESHOLD_MS && Number(v.speed ?? 0) > 0.5) continue; // Active vessel, skip

			const lat = Number(v.latitude ?? 0);
			const lng = Number(v.longitude ?? 0);
			const speed = Number(v.speed ?? 0);
			const gapHours = age / (1000 * 60 * 60);

			const riskFactors: string[] = [];
			let riskScore = 0;

			// Gap analysis
			if (gapHours > 48) { riskFactors.push(`AIS dark ${gapHours.toFixed(0)}h`); riskScore += 30; }
			else if (gapHours > 12) { riskFactors.push(`AIS gap ${gapHours.toFixed(0)}h`); riskScore += 20; }
			else if (gapHours > 2) { riskFactors.push(`AIS delay ${gapHours.toFixed(1)}h`); riskScore += 10; }

			// Speed anomaly (was moving fast before going dark)
			if (speed > 15 && gapHours > 2) { riskFactors.push(`High speed before dark: ${speed.toFixed(1)}kts`); riskScore += 15; }
			if (speed === 0 && gapHours > 6) { riskFactors.push("Stationary + dark"); riskScore += 10; }

			// Proximity to suspicious zones
			let nearZone: string | null = null;
			for (const zone of SUSPICIOUS_ZONES) {
				const dist = haversineKm(lat, lng, zone.lat, zone.lng);
				if (dist < zone.radiusKm) {
					nearZone = zone.name;
					riskFactors.push(`Near ${zone.name} (${zone.reason})`);
					riskScore += 25;
					break;
				} else if (dist < zone.radiusKm * 2) {
					riskFactors.push(`Approaching ${zone.name}`);
					riskScore += 10;
				}
			}

			// Flag analysis — flags of convenience increase risk
			const FOC_FLAGS = ["PA", "LR", "MH", "HK", "BS", "MT", "CY", "BM", "VU", "KM", "TO", "TZ"];
			const flag = String(v.flag ?? "").toUpperCase().slice(0, 2);
			if (FOC_FLAGS.includes(flag)) { riskFactors.push(`Flag of convenience: ${v.flag}`); riskScore += 10; }

			// Unknown destination
			const dest = String(v.destination ?? "").trim();
			if (!dest || dest === "Unknown" || dest === "N/A") { riskFactors.push("No declared destination"); riskScore += 5; }

			// Only include if there's some risk
			if (riskScore >= 10) {
				results.push({
					mmsi: String(v.mmsi ?? ""),
					name: String(v.name ?? "Unknown"),
					latitude: lat,
					longitude: lng,
					speed,
					flag: String(v.flag ?? "?"),
					lastSeen: ts,
					gapHours,
					riskScore: Math.min(riskScore, 100),
					riskFactors,
					nearZone,
					shipType: String(v.shipType ?? "Unknown"),
				});
			}
		}

		// Sort
		if (sortBy === "risk") results.sort((a, b) => b.riskScore - a.riskScore);
		else if (sortBy === "gap") results.sort((a, b) => b.gapHours - a.gapHours);
		else results.sort((a, b) => b.speed - a.speed);

		return results;
	}, [vessels, sortBy]);

	const criticalCount = darkVessels.filter(v => v.riskScore >= 60).length;
	const highCount = darkVessels.filter(v => v.riskScore >= 30 && v.riskScore < 60).length;

	return (
		<div className="space-y-2">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<span className="text-[9px] font-mono font-bold text-red-400 tracking-widest">🚢 DARK FLEET</span>
					<span className="text-[8px] font-mono text-slate-500">{darkVessels.length} flagged</span>
				</div>
				<div className="flex items-center gap-1">
					{criticalCount > 0 && (
						<span className="px-1.5 py-0.5 rounded text-[7px] font-mono font-bold bg-red-900/30 text-red-400 border border-red-700/30 animate-pulse">
							{criticalCount} CRIT
						</span>
					)}
					{highCount > 0 && (
						<span className="px-1.5 py-0.5 rounded text-[7px] font-mono font-bold bg-orange-900/30 text-orange-400 border border-orange-700/30">
							{highCount} HIGH
						</span>
					)}
				</div>
			</div>

			{/* Sort controls */}
			<div className="flex gap-1">
				{(["risk", "gap", "speed"] as const).map(s => (
					<button
						key={s}
						type="button"
						onClick={() => setSortBy(s)}
						className={`flex-1 px-1 py-0.5 rounded text-[7px] font-mono font-bold tracking-wider transition-colors ${
							sortBy === s
								? "bg-cyan-900/30 text-cyan-400 border border-cyan-700/30"
								: "bg-slate-800/40 text-slate-500 hover:text-slate-300 border border-transparent"
						}`}
					>
						{s.toUpperCase()}
					</button>
				))}
			</div>

			{/* Vessel list */}
			<div className="space-y-1 max-h-80 overflow-y-auto scrollbar-thin">
				{darkVessels.length === 0 && (
					<div className="text-[8px] font-mono text-slate-600 text-center py-4">
						No suspicious vessel activity detected. All AIS signals nominal.
					</div>
				)}
				{darkVessels.slice(0, expanded ? 50 : 8).map(v => (
					<div key={v.mmsi} className="bg-slate-800/40 rounded px-2 py-1.5 border border-slate-700/30 hover:border-slate-600/50 transition-colors">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-1.5">
								<span className={`w-1.5 h-1.5 rounded-full ${
									v.riskScore >= 60 ? "bg-red-500 animate-pulse" :
									v.riskScore >= 30 ? "bg-orange-500" : "bg-yellow-500"
								}`} />
								<span className="text-[9px] font-mono font-bold text-slate-200 truncate max-w-[100px]">{v.name}</span>
								<span className="text-[7px] font-mono text-slate-500">{v.mmsi}</span>
							</div>
							<div className="flex items-center gap-1">
								<span className="text-[8px] font-mono text-slate-500">{v.flag}</span>
								<span className={`px-1 py-0 rounded text-[7px] font-mono font-bold ${
									v.riskScore >= 60 ? "bg-red-900/40 text-red-400" :
									v.riskScore >= 30 ? "bg-orange-900/40 text-orange-400" :
									"bg-yellow-900/40 text-yellow-400"
								}`}>
									{v.riskScore}
								</span>
							</div>
						</div>

						<div className="mt-1 flex items-center gap-2 text-[7px] font-mono text-slate-500">
							<span>🕐 {v.gapHours < 1 ? `${(v.gapHours * 60).toFixed(0)}m` : `${v.gapHours.toFixed(1)}h`} dark</span>
							<span>⚡ {v.speed.toFixed(1)} kts</span>
							<span>{v.shipType}</span>
						</div>

						{v.nearZone && (
							<div className="mt-0.5 text-[7px] font-mono text-red-400">
								📍 Near: {v.nearZone}
							</div>
						)}

						<div className="mt-1 flex flex-wrap gap-1">
							{v.riskFactors.slice(0, 3).map((f) => (
								<span key={f} className="px-1 py-0 rounded text-[6px] font-mono bg-slate-700/30 text-slate-400">{f}</span>
							))}
						</div>
					</div>
				))}
			</div>

			{darkVessels.length > 8 && (
				<button
					type="button"
					onClick={() => setExpanded(!expanded)}
					className="w-full py-1 rounded text-[8px] font-mono text-cyan-400 bg-slate-800/40 hover:bg-slate-700/40 border border-slate-700/30"
				>
					{expanded ? "COLLAPSE" : `SHOW ALL ${darkVessels.length} FLAGGED VESSELS`}
				</button>
			)}

			{/* Suspicious Zones Legend */}
			<details className="mt-1">
				<summary className="text-[7px] font-mono text-slate-500 cursor-pointer hover:text-slate-400">
					MONITORED ZONES ({SUSPICIOUS_ZONES.length})
				</summary>
				<div className="mt-1 space-y-0.5 pl-2">
					{SUSPICIOUS_ZONES.map(z => (
						<div key={z.name} className="text-[7px] font-mono text-slate-600">
							⬡ {z.name} — {z.reason} ({z.radiusKm}km)
						</div>
					))}
				</div>
			</details>
		</div>
	);
}
