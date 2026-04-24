import { useDataSourceStatus } from "../../hooks/useEntityData";

const STATUS_DOT: Record<string, string> = {
	active: "bg-emerald-400 shadow-emerald-400/50",
	degraded: "bg-amber-400 shadow-amber-400/50",
	error: "bg-red-400 shadow-red-400/50 animate-pulse",
	stale: "bg-slate-500",
};

export default function DataHealthBar() {
	const sources = useDataSourceStatus();
	if (!sources.length) return null;

	const active = sources.filter((s: Record<string, unknown>) => s.status === "active").length;
	const degraded = sources.filter((s: Record<string, unknown>) => s.status === "degraded").length;
	const errored = sources.filter((s: Record<string, unknown>) => s.status === "error").length;
	const total = sources.length;

	const healthPct = Math.round(((active + degraded * 0.5) / total) * 100);
	const color = healthPct >= 80 ? "text-emerald-400" : healthPct >= 50 ? "text-amber-400" : "text-red-400";

	return (
		<div className="flex items-center gap-2 px-2 py-1 bg-black/50 border border-slate-700/30 rounded">
			{/* Health percentage */}
			<span className={`text-[10px] font-mono font-bold ${color}`}>
				{healthPct}%
			</span>

			{/* Dot grid */}
			<div className="flex items-center gap-0.5 flex-wrap">
				{sources.slice(0, 16).map((s: Record<string, unknown>, i: number) => (
					<div
						key={i}
						title={`${s.name ?? "source"}: ${s.status}`}
						className={`w-1.5 h-1.5 rounded-full shadow-sm ${STATUS_DOT[String(s.status ?? "stale")]}`}
					/>
				))}
			</div>

			{/* Summary */}
			<div className="text-[8px] font-mono text-slate-500 whitespace-nowrap">
				{active}↑ {degraded > 0 ? `${degraded}~ ` : ""}{errored > 0 ? `${errored}✕` : ""}
			</div>
		</div>
	);
}
