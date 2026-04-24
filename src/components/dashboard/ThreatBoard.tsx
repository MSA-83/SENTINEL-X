import { useThreatZones } from "../../hooks/useEntityData";

function severityColor(score: number): string {
	if (score >= 75) return "text-red-400";
	if (score >= 55) return "text-orange-400";
	if (score >= 35) return "text-amber-400";
	return "text-cyan-400";
}

function severityBg(score: number): string {
	if (score >= 75) return "border-l-red-500 bg-red-950/20";
	if (score >= 55) return "border-l-orange-500 bg-orange-950/10";
	if (score >= 35) return "border-l-amber-500/50";
	return "border-l-cyan-800/30";
}

function severityLabel(score: number): string {
	if (score >= 75) return "CRITICAL";
	if (score >= 55) return "HIGH";
	if (score >= 35) return "MEDIUM";
	return "LOW";
}

interface ThreatBoardProps {
	onZoneSelect?: (lat: number, lon: number) => void;
}

export default function ThreatBoard({ onZoneSelect }: ThreatBoardProps) {
	const zones = useThreatZones();
	const sorted = [...zones].sort((a, b) => b.currentScore - a.currentScore);

	const critical = sorted.filter((z) => z.currentScore >= 75).length;
	const high = sorted.filter((z) => z.currentScore >= 55 && z.currentScore < 75).length;
	const totalEvents = sorted.reduce((sum, z) => sum + z.activeEvents, 0);
	const avgScore = sorted.length > 0 ? Math.round(sorted.reduce((sum, z) => sum + z.currentScore, 0) / sorted.length) : 0;

	return (
		<div className="flex flex-col h-full">
			{/* Summary stats */}
			<div className="flex items-center gap-6 px-3 py-2 border-b border-slate-800/60">
				<div className="flex flex-col items-center">
					<span className="text-lg font-bold font-mono text-red-400">{critical}</span>
					<span className="text-[6px] tracking-[2px] text-slate-500">CRITICAL</span>
				</div>
				<div className="flex flex-col items-center">
					<span className="text-lg font-bold font-mono text-orange-400">{high}</span>
					<span className="text-[6px] tracking-[2px] text-slate-500">HIGH</span>
				</div>
				<div className="flex flex-col items-center">
					<span className="text-lg font-bold font-mono text-slate-300">{totalEvents}</span>
					<span className="text-[6px] tracking-[2px] text-slate-500">EVENTS</span>
				</div>
				<div className="flex flex-col items-center ml-auto">
					<span className={`text-lg font-bold font-mono ${severityColor(avgScore)}`}>{avgScore}</span>
					<span className="text-[6px] tracking-[2px] text-slate-500">AVG SCORE</span>
				</div>
			</div>

			{/* Global threat bar */}
			<div className="px-3 py-1.5">
				<div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
					<div
						className="h-full rounded-full transition-all duration-700"
						style={{
							width: `${avgScore}%`,
							background: avgScore >= 75
								? "linear-gradient(90deg, #ef4444, #dc2626)"
								: avgScore >= 55
									? "linear-gradient(90deg, #f97316, #ea580c)"
									: avgScore >= 35
										? "linear-gradient(90deg, #eab308, #d97706)"
										: "linear-gradient(90deg, #22d3ee, #0891b2)",
						}}
					/>
				</div>
			</div>

			{/* Zone list */}
			<div className="flex-1 overflow-y-auto">
				{sorted.length === 0 && (
					<div className="px-3 py-4 text-center text-[9px] text-slate-500 font-mono">
						Threat engine computing...
					</div>
				)}
				{sorted.map((zone) => (
					<button
						key={zone.name}
						type="button"
						onClick={() => onZoneSelect?.(zone.latitude, zone.longitude)}
						className={`w-full text-left px-3 py-1.5 border-l-2 border-b border-b-slate-900/30 transition-all hover:bg-white/[0.02] cursor-pointer ${severityBg(zone.currentScore)}`}
					>
						<div className="flex items-center justify-between">
							<span className="text-[9px] text-slate-200 font-medium truncate mr-2">{zone.name}</span>
							<span className={`text-sm font-bold font-mono ${severityColor(zone.currentScore)}`}>
								{zone.currentScore}
							</span>
						</div>
						<div className="flex items-center gap-2 mt-0.5">
							<span className="text-[7px] tracking-wide text-slate-500">
								{severityLabel(zone.currentScore)} · {zone.type.toUpperCase()} · {zone.activeEvents} events
							</span>
						</div>
					</button>
				))}
			</div>
		</div>
	);
}
