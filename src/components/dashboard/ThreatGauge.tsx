import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

/**
 * Global Threat Assessment Gauge
 * Computes a composite threat level (0-100) from active data:
 * - Conflicts (severity weighted)
 * - Active jamming zones
 * - High-magnitude seismic events
 * - Active disasters
 * - Cyber threats
 * - System alerts
 */

const THREAT_LEVELS = [
	{ max: 20, label: "LOW", color: "#22c55e", bg: "rgba(34,197,94,0.08)" },
	{ max: 40, label: "GUARDED", color: "#3b82f6", bg: "rgba(59,130,246,0.08)" },
	{ max: 60, label: "ELEVATED", color: "#f59e0b", bg: "rgba(245,158,11,0.08)" },
	{ max: 80, label: "HIGH", color: "#f97316", bg: "rgba(249,115,22,0.08)" },
	{ max: 100, label: "SEVERE", color: "#ef4444", bg: "rgba(239,68,68,0.08)" },
];

function getThreatLevel(score: number) {
	return THREAT_LEVELS.find(l => score <= l.max) || THREAT_LEVELS[4];
}

export default function ThreatGauge() {
	const conflicts = useQuery(api.entities.listConflictEvents) ?? [];
	const jamming = useQuery(api.entities.getActiveJammingAlerts) ?? [];
	const alerts = useQuery(api.entities.listSystemAlerts) ?? [];

	const { score, breakdown } = useMemo(() => {
		let s = 10; // baseline ambient threat
		const bd: { source: string; pts: number }[] = [];

		// Conflicts: critical=12pts, high=8, medium=4, low=2
		const conflictPts = conflicts.reduce((acc, c) => {
			const sev = (c.severity as string) || "low";
			if (sev === "critical") return acc + 12;
			if (sev === "high") return acc + 8;
			if (sev === "medium") return acc + 4;
			return acc + 2;
		}, 0);
		const cappedConflict = Math.min(conflictPts, 35);
		if (cappedConflict > 0) bd.push({ source: "CONFLICTS", pts: cappedConflict });
		s += cappedConflict;

		// Jamming zones: 8pts each (max 24)
		const jammingPts = Math.min(jamming.length * 8, 24);
		if (jammingPts > 0) bd.push({ source: "GNSS JAMMING", pts: jammingPts });
		s += jammingPts;

		// System alerts: critical=6, high=4, medium=2
		const alertPts = alerts.filter(a => !(a.acknowledged as boolean)).reduce((acc, a) => {
			const sev = (a.severity as string) || "low";
			if (sev === "critical") return acc + 6;
			if (sev === "high") return acc + 4;
			if (sev === "medium") return acc + 2;
			return acc + 1;
		}, 0);
		const cappedAlert = Math.min(alertPts, 20);
		if (cappedAlert > 0) bd.push({ source: "SYSTEM ALERTS", pts: cappedAlert });
		s += cappedAlert;

		return { score: Math.min(Math.round(s), 100), breakdown: bd };
	}, [conflicts, jamming, alerts]);

	const level = getThreatLevel(score);

	// SVG arc gauge
	const radius = 38;
	const circumference = Math.PI * radius; // half-circle
	const progress = (score / 100) * circumference;

	return (
		<div className="bg-slate-950/80 backdrop-blur-sm border border-slate-800/60 rounded-lg p-2 w-[180px]">
			{/* Header */}
			<div className="text-[7px] font-mono text-slate-600 tracking-[0.2em] text-center mb-1">
				GLOBAL THREAT ASSESSMENT
			</div>

			{/* Gauge */}
			<div className="relative flex justify-center">
				<svg width="100" height="56" viewBox="0 0 100 56">
					{/* Background arc */}
					<path
						d="M 10 50 A 38 38 0 0 1 90 50"
						fill="none"
						stroke="rgba(100,116,139,0.15)"
						strokeWidth="6"
						strokeLinecap="round"
					/>
					{/* Progress arc */}
					<path
						d="M 10 50 A 38 38 0 0 1 90 50"
						fill="none"
						stroke={level.color}
						strokeWidth="6"
						strokeLinecap="round"
						strokeDasharray={`${progress} ${circumference}`}
						style={{ filter: `drop-shadow(0 0 4px ${level.color}40)` }}
					/>
					{/* Score text */}
					<text x="50" y="44" textAnchor="middle" fill={level.color} fontSize="18" fontFamily="monospace" fontWeight="bold">
						{score}
					</text>
					<text x="50" y="54" textAnchor="middle" fill={level.color} fontSize="7" fontFamily="monospace" letterSpacing="0.15em" opacity="0.8">
						{level.label}
					</text>
				</svg>
			</div>

			{/* Breakdown */}
			{breakdown.length > 0 && (
				<div className="mt-1 space-y-0.5">
					{breakdown.slice(0, 3).map(b => (
						<div key={b.source} className="flex items-center justify-between text-[7px] font-mono px-1">
							<span className="text-slate-600 truncate">{b.source}</span>
							<span style={{ color: level.color }}>+{b.pts}</span>
						</div>
					))}
				</div>
			)}

			{/* Threat bar */}
			<div className="mt-1.5 h-1 bg-slate-800/50 rounded-full overflow-hidden">
				<div
					className="h-full rounded-full transition-all duration-1000"
					style={{ width: `${score}%`, backgroundColor: level.color, boxShadow: `0 0 6px ${level.color}60` }}
				/>
			</div>
		</div>
	);
}
