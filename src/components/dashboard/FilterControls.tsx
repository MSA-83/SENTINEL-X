import { useState, useCallback } from "react";

export interface FilterState {
	severityMin: number; // 0=all, 1=low, 2=med, 3=high, 4=critical
	timeRange: number;   // hours, 0=all
	searchQuery: string;
}

const SEVERITY_LEVELS = [
	{ value: 0, label: "ALL", color: "text-slate-400" },
	{ value: 1, label: "LOW+", color: "text-blue-400" },
	{ value: 2, label: "MED+", color: "text-amber-400" },
	{ value: 3, label: "HIGH+", color: "text-orange-400" },
	{ value: 4, label: "CRIT", color: "text-red-400" },
];

const TIME_RANGES = [
	{ value: 0, label: "ALL" },
	{ value: 1, label: "1H" },
	{ value: 6, label: "6H" },
	{ value: 24, label: "24H" },
	{ value: 72, label: "3D" },
	{ value: 168, label: "7D" },
];

interface FilterControlsProps {
	filters: FilterState;
	onChange: (filters: FilterState) => void;
}

export default function FilterControls({ filters, onChange }: FilterControlsProps) {
	const [expanded, setExpanded] = useState(false);

	const update = useCallback((patch: Partial<FilterState>) => {
		onChange({ ...filters, ...patch });
	}, [filters, onChange]);

	const activeCount = (filters.severityMin > 0 ? 1 : 0) + (filters.timeRange > 0 ? 1 : 0) + (filters.searchQuery ? 1 : 0);

	return (
		<div className="bg-black/40 border border-slate-700/30 rounded-lg overflow-hidden">
			{/* Toggle header */}
			<button
				onClick={() => setExpanded((v) => !v)}
				className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-slate-800/30 transition-colors"
			>
				<div className="flex items-center gap-1.5">
					<span className="text-[10px] font-mono text-slate-400 tracking-wider">FILTERS</span>
					{activeCount > 0 && (
						<span className="px-1 py-0.5 bg-cyan-900/50 border border-cyan-700/40 rounded text-[8px] font-mono text-cyan-400">
							{activeCount}
						</span>
					)}
				</div>
				<span className="text-[10px] text-slate-500">{expanded ? "▲" : "▼"}</span>
			</button>

			{expanded && (
				<div className="px-2 pb-2 space-y-2 border-t border-slate-700/20">
					{/* Severity filter */}
					<div className="pt-1.5">
						<label className="text-[8px] font-mono text-slate-500 tracking-wider">MIN SEVERITY</label>
						<div className="flex gap-0.5 mt-1">
							{SEVERITY_LEVELS.map((s) => (
								<button
									key={s.value}
									onClick={() => update({ severityMin: s.value })}
									className={`flex-1 py-0.5 rounded text-[8px] font-mono font-bold transition-colors ${
										filters.severityMin === s.value
											? `${s.color} bg-slate-800/80 border border-slate-600/40`
											: "text-slate-600 hover:text-slate-400"
									}`}
								>
									{s.label}
								</button>
							))}
						</div>
					</div>

					{/* Time range */}
					<div>
						<label className="text-[8px] font-mono text-slate-500 tracking-wider">TIME RANGE</label>
						<div className="flex gap-0.5 mt-1">
							{TIME_RANGES.map((t) => (
								<button
									key={t.value}
									onClick={() => update({ timeRange: t.value })}
									className={`flex-1 py-0.5 rounded text-[8px] font-mono font-bold transition-colors ${
										filters.timeRange === t.value
											? "text-cyan-400 bg-slate-800/80 border border-slate-600/40"
											: "text-slate-600 hover:text-slate-400"
									}`}
								>
									{t.label}
								</button>
							))}
						</div>
					</div>

					{/* Quick search */}
					<div>
						<input
							type="text"
							placeholder="Filter by keyword..."
							value={filters.searchQuery}
							onChange={(e) => update({ searchQuery: e.target.value })}
							className="w-full bg-black/50 border border-slate-700/40 rounded px-2 py-1 text-[10px] font-mono text-slate-300 placeholder:text-slate-600 outline-none focus:border-cyan-700/60"
						/>
					</div>

					{/* Reset */}
					{activeCount > 0 && (
						<button
							onClick={() => onChange({ severityMin: 0, timeRange: 0, searchQuery: "" })}
							className="w-full text-[9px] font-mono text-red-400/70 hover:text-red-300 py-0.5"
						>
							✕ CLEAR ALL FILTERS
						</button>
					)}
				</div>
			)}
		</div>
	);
}
