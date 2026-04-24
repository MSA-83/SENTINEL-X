import { useDataSourceStatus } from "../../hooks/useEntityData";
import { Wifi, WifiOff, AlertTriangle, RefreshCw } from "lucide-react";

export function DataSourcePanel() {
	const sources = useDataSourceStatus();

	if (sources.length === 0) {
		return (
			<div className="p-3 text-center text-[10px] font-mono text-slate-600">
				No data sources connected yet
			</div>
		);
	}

	const online = sources.filter((s) => s.status === "online").length;
	const total = sources.length;

	return (
		<div className="flex flex-col h-full bg-slate-950/90 border-t border-slate-800/60">
			<div className="flex items-center justify-between px-3 py-2 border-b border-slate-800/60">
				<div className="flex items-center gap-2">
					<RefreshCw className="w-3 h-3 text-emerald-400" />
					<span className="text-[10px] font-mono font-bold text-slate-400 tracking-widest">
						DATA SOURCES
					</span>
				</div>
				<span className={`text-[10px] font-mono font-bold ${online === total ? "text-emerald-400" : "text-amber-400"}`}>
					{online}/{total} ONLINE
				</span>
			</div>
			<div className="flex-1 overflow-y-auto space-y-0.5 p-1.5">
				{sources.map((src) => (
					<div
						key={src.sourceId}
						className={`flex items-center justify-between px-2 py-1.5 rounded text-[10px] font-mono border ${
							src.status === "online"
								? "bg-emerald-950/20 border-emerald-900/30"
								: src.status === "error"
								? "bg-red-950/20 border-red-900/30"
								: "bg-slate-900/40 border-slate-800/30"
						}`}
					>
						<div className="flex items-center gap-2 min-w-0">
							{src.status === "online" ? (
								<Wifi className="w-3 h-3 text-emerald-400 shrink-0" />
							) : src.status === "error" ? (
								<AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />
							) : (
								<WifiOff className="w-3 h-3 text-slate-600 shrink-0" />
							)}
							<span className={`truncate ${src.status === "online" ? "text-slate-300" : "text-slate-500"}`}>
								{src.name}
							</span>
						</div>
						<div className="flex items-center gap-2 shrink-0">
							{src.recordCount > 0 && (
								<span className="text-slate-600">{src.recordCount}</span>
							)}
							<span className={`text-[8px] uppercase tracking-wider font-bold ${
								src.status === "online" ? "text-emerald-500" : src.status === "error" ? "text-red-500" : "text-slate-600"
							}`}>
								{src.status}
							</span>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
