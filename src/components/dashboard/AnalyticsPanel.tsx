import React, { useMemo } from "react";
import {
	useAircraft,
	useConflictEvents,
	useFires,
	useVessels,
	useSeismicEvents,
	useDisasters,
	useCyberThreats,
	useGdeltEvents,
	useJammingAlerts,
	useSocialPosts,
} from "../../hooks/useEntityData";

/* ───────── tiny SVG sparkline ───────── */
function Sparkline({ data, color, h = 28, w = 100 }: { data: number[]; color: string; h?: number; w?: number }) {
	if (data.length < 2) return <div className="text-[9px] text-slate-600 font-mono">NO DATA</div>;
	const max = Math.max(...data, 1);
	const min = Math.min(...data, 0);
	const range = max - min || 1;
	const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 2) - 1}`).join(" ");
	return (
		<svg width={w} height={h} className="block">
			<polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
			{/* glow */}
			<polyline points={pts} fill="none" stroke={color} strokeWidth={3} strokeLinejoin="round" opacity={0.15} />
		</svg>
	);
}

/* ───────── mini donut ───────── */
function MiniDonut({ slices, size = 56 }: { slices: { label: string; value: number; color: string }[]; size?: number }) {
	const total = slices.reduce((s, x) => s + x.value, 0) || 1;
	const r = (size - 8) / 2;
	const cx = size / 2;
	const cy = size / 2;
	let accAngle = -90;
	const paths: React.ReactElement[] = [];
	for (const sl of slices) {
		if (sl.value <= 0) continue;
		const angle = (sl.value / total) * 360;
		const startRad = (accAngle * Math.PI) / 180;
		const endRad = ((accAngle + angle) * Math.PI) / 180;
		const large = angle > 180 ? 1 : 0;
		const x1 = cx + r * Math.cos(startRad);
		const y1 = cy + r * Math.sin(startRad);
		const x2 = cx + r * Math.cos(endRad);
		const y2 = cy + r * Math.sin(endRad);
		paths.push(
			<path
				key={sl.label}
				d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`}
				fill={sl.color}
				opacity={0.85}
				stroke="#0f172a"
				strokeWidth={1}
			/>
		);
		accAngle += angle;
	}
	return (
		<svg width={size} height={size}>
			{paths}
			<circle cx={cx} cy={cy} r={r * 0.5} fill="#0f172a" />
			<text x={cx} y={cy + 3} textAnchor="middle" className="fill-slate-300 text-[9px] font-mono font-bold">
				{total}
			</text>
		</svg>
	);
}

/* ───────── horizontal bar ───────── */
function HBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
	const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
	return (
		<div className="flex items-center gap-2 text-[9px] font-mono">
			<span className="w-16 text-right text-slate-500 truncate">{label}</span>
			<div className="flex-1 h-2 bg-slate-800/60 rounded overflow-hidden">
				<div className="h-full rounded transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
			</div>
			<span className="w-8 text-right text-slate-400">{value}</span>
		</div>
	);
}

/* ───────── bucket timestamps into hourly bins ───────── */
function hourlyBins(timestamps: number[], hours = 24): number[] {
	const now = Date.now();
	const bins = new Array(hours).fill(0);
	for (const ts of timestamps) {
		const age = (now - ts) / 3600000;
		if (age >= 0 && age < hours) bins[Math.floor(age)] += 1;
	}
	return bins.reverse(); // oldest first
}

/* ═══════════════════════════════════ MAIN ═══════════════════════════════════ */
export default function AnalyticsPanel() {
	const aircraft = useAircraft();
	const conflicts = useConflictEvents();
	const fires = useFires();
	const vessels = useVessels();
	const seismic = useSeismicEvents();
	const disasters = useDisasters();
	const cyber = useCyberThreats();
	const gdelt = useGdeltEvents();
	const jamming = useJammingAlerts();
	const social = useSocialPosts();

	// ── Sparkline: entity counts per hour (24h) ──
	const conflictSpark = useMemo(() => hourlyBins(conflicts.map((c) => c.timestamp)), [conflicts]);
	const fireSpark = useMemo(() => hourlyBins(fires.map((f) => f.timestamp)), [fires]);
	const seismicSpark = useMemo(() => hourlyBins(seismic.map((s) => s.timestamp)), [seismic]);
	const cyberSpark = useMemo(() => hourlyBins(cyber.map((c) => c.timestamp)), [cyber]);

	// ── Donut: entity distribution ──
	const donutSlices = useMemo(
		() => [
			{ label: "Aircraft", value: aircraft.length, color: "#22d3ee" },
			{ label: "Conflicts", value: conflicts.length, color: "#ef4444" },
			{ label: "Fires", value: fires.length, color: "#f97316" },
			{ label: "Vessels", value: vessels.length, color: "#3b82f6" },
			{ label: "Seismic", value: seismic.length, color: "#eab308" },
			{ label: "Disasters", value: disasters.length, color: "#a855f7" },
			{ label: "Cyber", value: cyber.length, color: "#10b981" },
			{ label: "GDELT", value: gdelt.length, color: "#6366f1" },
		],
		[aircraft, conflicts, fires, vessels, seismic, disasters, cyber, gdelt]
	);

	// ── Severity breakdown for conflicts ──
	const severityCounts = useMemo(() => {
		const m: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
		for (const c of conflicts) m[c.severity] = (m[c.severity] || 0) + 1;
		return m;
	}, [conflicts]);
	const maxSev = Math.max(...Object.values(severityCounts), 1);

	// ── Country breakdown for conflicts ──
	const countryCounts = useMemo(() => {
		const m: Record<string, number> = {};
		for (const c of conflicts) m[c.country] = (m[c.country] || 0) + 1;
		return Object.entries(m)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 6);
	}, [conflicts]);
	const maxCountry = countryCounts[0]?.[1] ?? 1;

	// ── Key stats ──
	const milAircraft = aircraft.filter((a) => a.isMilitary).length;
	const emergSquawks = aircraft.filter((a) => a.squawk && ["7500", "7600", "7700"].includes(a.squawk)).length;
	const bigQuakes = seismic.filter((s) => s.magnitude >= 5.0).length;
	const activeJam = jamming.filter((j) => j.status === "active").length;

	return (
		<div className="p-3 space-y-4 overflow-y-auto h-full scrollbar-thin">
			{/* ── HEADER ── */}
			<div className="flex items-center justify-between">
				<div className="text-[10px] font-mono font-bold text-cyan-400 tracking-widest">ANALYTICS DASHBOARD</div>
				<div className="text-[8px] font-mono text-slate-600">{new Date().toISOString().slice(0, 10)}</div>
			</div>

			{/* ── KEY METRICS ── */}
			<div className="grid grid-cols-2 gap-2">
				{[
					{ label: "TOTAL ENTITIES", value: aircraft.length + conflicts.length + fires.length + vessels.length + seismic.length + disasters.length + cyber.length + gdelt.length + social.length, color: "text-cyan-400" },
					{ label: "MILITARY A/C", value: milAircraft, color: "text-orange-400" },
					{ label: "EMERG SQUAWKS", value: emergSquawks, color: emergSquawks > 0 ? "text-red-400" : "text-slate-400" },
					{ label: "M5.0+ QUAKES", value: bigQuakes, color: bigQuakes > 0 ? "text-amber-400" : "text-slate-400" },
					{ label: "ACTIVE JAMMING", value: activeJam, color: activeJam > 0 ? "text-red-400" : "text-slate-400" },
					{ label: "OSINT ITEMS", value: gdelt.length + social.length, color: "text-indigo-400" },
				].map((m) => (
					<div key={m.label} className="bg-slate-900/60 border border-slate-800/50 rounded p-2">
						<div className="text-[8px] font-mono text-slate-500 tracking-wider">{m.label}</div>
						<div className={`text-lg font-mono font-bold ${m.color}`}>{m.value.toLocaleString()}</div>
					</div>
				))}
			</div>

			{/* ── ENTITY DISTRIBUTION ── */}
			<div className="bg-slate-900/40 border border-slate-800/40 rounded p-2">
				<div className="text-[9px] font-mono font-bold text-slate-400 tracking-widest mb-2">ENTITY DISTRIBUTION</div>
				<div className="flex items-center gap-3">
					<MiniDonut slices={donutSlices} size={72} />
					<div className="flex-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
						{donutSlices.map((s) => (
							<div key={s.label} className="flex items-center gap-1.5 text-[8px] font-mono">
								<span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
								<span className="text-slate-500 truncate">{s.label}</span>
								<span className="text-slate-400 ml-auto">{s.value}</span>
							</div>
						))}
					</div>
				</div>
			</div>

			{/* ── 24H TREND SPARKLINES ── */}
			<div className="bg-slate-900/40 border border-slate-800/40 rounded p-2 space-y-2">
				<div className="text-[9px] font-mono font-bold text-slate-400 tracking-widest">24H TREND</div>
				{[
					{ label: "CONFLICTS", data: conflictSpark, color: "#ef4444" },
					{ label: "FIRES", data: fireSpark, color: "#f97316" },
					{ label: "SEISMIC", data: seismicSpark, color: "#eab308" },
					{ label: "CYBER", data: cyberSpark, color: "#10b981" },
				].map((row) => (
					<div key={row.label} className="flex items-center gap-2">
						<span className="text-[8px] font-mono text-slate-500 w-14 text-right">{row.label}</span>
						<Sparkline data={row.data} color={row.color} w={140} h={20} />
						<span className="text-[9px] font-mono text-slate-400 w-6 text-right">
							{row.data.reduce((a, b) => a + b, 0)}
						</span>
					</div>
				))}
				<div className="text-[7px] font-mono text-slate-600 text-right">oldest ← → newest</div>
			</div>

			{/* ── CONFLICT SEVERITY ── */}
			<div className="bg-slate-900/40 border border-slate-800/40 rounded p-2 space-y-1">
				<div className="text-[9px] font-mono font-bold text-slate-400 tracking-widest mb-1">CONFLICT SEVERITY</div>
				<HBar label="CRITICAL" value={severityCounts.critical} max={maxSev} color="#ef4444" />
				<HBar label="HIGH" value={severityCounts.high} max={maxSev} color="#f97316" />
				<HBar label="MEDIUM" value={severityCounts.medium} max={maxSev} color="#eab308" />
				<HBar label="LOW" value={severityCounts.low} max={maxSev} color="#22c55e" />
			</div>

			{/* ── TOP CONFLICT COUNTRIES ── */}
			{countryCounts.length > 0 && (
				<div className="bg-slate-900/40 border border-slate-800/40 rounded p-2 space-y-1">
					<div className="text-[9px] font-mono font-bold text-slate-400 tracking-widest mb-1">TOP CONFLICT REGIONS</div>
					{countryCounts.map(([country, count]) => (
						<HBar key={country} label={country} value={count} max={maxCountry} color="#6366f1" />
					))}
				</div>
			)}

			{/* ── DATA FRESHNESS ── */}
			<div className="bg-slate-900/40 border border-slate-800/40 rounded p-2">
				<div className="text-[9px] font-mono font-bold text-slate-400 tracking-widest mb-2">DATA FRESHNESS</div>
				<div className="space-y-1">
					{[
						{ label: "ADS-B", items: aircraft, ts: (a: Record<string, unknown>) => (a as { lastUpdate: number }).lastUpdate },
						{ label: "Conflicts", items: conflicts, ts: (c: Record<string, unknown>) => (c as { timestamp: number }).timestamp },
						{ label: "Fires", items: fires, ts: (f: Record<string, unknown>) => (f as { timestamp: number }).timestamp },
						{ label: "Seismic", items: seismic, ts: (s: Record<string, unknown>) => (s as { timestamp: number }).timestamp },
					].map((src) => {
						const latest = src.items.length > 0 ? Math.max(...src.items.map(src.ts)) : 0;
						const ago = latest > 0 ? Math.floor((Date.now() - latest) / 60000) : -1;
						const fresh = ago >= 0 && ago < 30;
						return (
							<div key={src.label} className="flex items-center gap-2 text-[8px] font-mono">
								<span className={`w-1.5 h-1.5 rounded-full ${fresh ? "bg-emerald-400" : ago < 0 ? "bg-slate-600" : "bg-amber-400"}`} />
								<span className="text-slate-500 w-14">{src.label}</span>
								<span className="text-slate-400">
									{ago < 0 ? "—" : ago < 1 ? "<1m ago" : `${ago}m ago`}
								</span>
								<span className="text-slate-600 ml-auto">{src.items.length} records</span>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
