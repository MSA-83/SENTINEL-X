import {
	useAircraft,
	useConflictEvents,
	useFires,
	useVessels,
	useCyberThreats,
	useSeismicEvents,
	useDisasters,
	useSatellitePositions,
	useThreatZones,
} from "../../hooks/useEntityData";
import { DOMAIN_COLORS } from "../../lib/constants";

interface StatCell {
	label: string;
	value: number;
	domain: string;
	icon: string;
}

export default function StatsRing() {
	const aircraft = useAircraft() ?? [];
	const conflicts = useConflictEvents() ?? [];
	const fires = useFires() ?? [];
	const vessels = useVessels() ?? [];
	const cyber = useCyberThreats() ?? [];
	const seismic = useSeismicEvents() ?? [];
	const disasters = useDisasters() ?? [];
	const sats = useSatellitePositions() ?? [];
	const threatZones = useThreatZones() ?? [];

	const avgThreat = threatZones.length > 0
		? Math.round(threatZones.reduce((s, z) => s + (z.currentScore ?? z.baseScore ?? 0), 0) / threatZones.length)
		: 0;

	const stats: StatCell[] = [
		{ label: "AIRCRAFT", value: aircraft.length, domain: "AIR", icon: "✈" },
		{ label: "VESSELS", value: vessels.length, domain: "SEA", icon: "🚢" },
		{ label: "SATS", value: sats.length, domain: "SPACE", icon: "🛰" },
		{ label: "FIRES", value: fires.length, domain: "WEATHER", icon: "🔥" },
		{ label: "CONFLICTS", value: conflicts.length, domain: "CONFLICT", icon: "⚔" },
		{ label: "CYBER", value: cyber.length, domain: "CYBER", icon: "🛡" },
		{ label: "SEISMIC", value: seismic.length, domain: "WEATHER", icon: "🌍" },
		{ label: "DISASTERS", value: disasters.length, domain: "CONFLICT", icon: "⚠" },
	];

	const total = stats.reduce((s, c) => s + c.value, 0);

	return (
		<div className="flex items-center gap-1 px-2 py-1 bg-slate-950/90 border-t border-slate-800/50 overflow-x-auto scrollbar-none">
			{/* Global threat indicator */}
			<div className="flex items-center gap-1 pr-2 border-r border-slate-700/40 shrink-0">
				<div
					className="w-2 h-2 rounded-full animate-pulse"
					style={{
						backgroundColor: avgThreat >= 60 ? "#ef4444" : avgThreat >= 40 ? "#f97316" : avgThreat >= 20 ? "#eab308" : "#22c55e",
					}}
				/>
				<span className="text-[9px] font-mono text-slate-400">THREAT</span>
				<span className={`text-[10px] font-mono font-bold ${
					avgThreat >= 60 ? "text-red-400" : avgThreat >= 40 ? "text-orange-400" : avgThreat >= 20 ? "text-yellow-400" : "text-green-400"
				}`}>
					{avgThreat}
				</span>
			</div>

			{/* Entity counts */}
			{stats.map((s) => (
				<div
					key={s.label}
					className="flex items-center gap-1 px-1.5 shrink-0"
				>
					<span className="text-[10px]">{s.icon}</span>
					<span className="text-[8px] font-mono text-slate-500">{s.label}</span>
					<span
						className="text-[10px] font-mono font-bold"
						style={{ color: DOMAIN_COLORS[s.domain] ?? "#94a3b8" }}
					>
						{s.value}
					</span>
				</div>
			))}

			{/* Total */}
			<div className="flex items-center gap-1 pl-2 border-l border-slate-700/40 shrink-0 ml-auto">
				<span className="text-[8px] font-mono text-slate-500">TOTAL</span>
				<span className="text-[10px] font-mono font-bold text-cyan-400">{total}</span>
			</div>
		</div>
	);
}
