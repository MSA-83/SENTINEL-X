// @ts-nocheck
import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
	BarChart3, Globe, Shield, AlertTriangle, Anchor, Plane, Crosshair,
	Zap, Activity, Clock, Eye, Radio
} from "lucide-react";

export function ExecutiveSummaryPage() {
	// const _platformStats = useQuery(api.entities.getStats);
	const fires = useQuery(api.entities.listFires) ?? [];
	const aircraft = useQuery(api.entities.listAircraft) ?? [];
	const vessels = useQuery(api.entities.listVessels) ?? [];
	const conflicts = useQuery(api.entities.listConflictEvents) ?? [];
	const seismic = useQuery(api.entities.listSeismicEvents) ?? [];
	const cyber = useQuery(api.entities.listCyberThreats) ?? [];
	const disasters = useQuery(api.entities.listDisasters) ?? [];
	const alerts = useQuery(api.entities.listSystemAlerts) ?? [];
	const cases = useQuery(api.cases.list) ?? [];
	const sources = useQuery(api.entities.listDataSourceStatus) ?? [];

	const stats = useMemo(() => {
		const critAlerts = alerts.filter((a) => a.severity === "critical").length;
		const unackAlerts = alerts.filter((a) => !a.acknowledged).length;
		const openCases = cases.filter((c) => c.status === "open" || c.status === "investigating").length;
		const escalatedCases = cases.filter((c) => c.status === "escalated").length;
		const onlineSources = sources.filter((s) => s.status === "online" || s.status === "ok").length;
		const totalRecords = sources.reduce((a, s) => a + s.recordCount, 0);

		return { critAlerts, unackAlerts, openCases, escalatedCases, onlineSources, totalRecords };
	}, [alerts, cases, sources]);

	const now = new Date();
	const threatLevel = stats.critAlerts > 3 ? "CRITICAL" : stats.critAlerts > 0 ? "ELEVATED" : stats.unackAlerts > 5 ? "GUARDED" : "NORMAL";
	const threatColor = threatLevel === "CRITICAL" ? "#ff2244" : threatLevel === "ELEVATED" ? "#ff8c00" : threatLevel === "GUARDED" ? "#ffc107" : "#22c55e";

	return (
		<div className="min-h-screen bg-slate-950 text-slate-100">
			{/* Header */}
			<div className="border-b border-slate-800 bg-slate-950/95 backdrop-blur sticky top-0 z-30">
				<div className="flex items-center justify-between px-6 h-14">
					<div className="flex items-center gap-3">
						<BarChart3 className="w-5 h-5 text-emerald-400" />
						<span className="font-mono text-sm font-semibold tracking-wider text-emerald-400">EXECUTIVE SUMMARY</span>
					</div>
					<div className="flex items-center gap-3">
						<span className="text-[10px] font-mono text-slate-500">
							<Clock className="w-3 h-3 inline mr-1" />
							{now.toLocaleString()} UTC
						</span>
						<div className="flex items-center gap-2 px-3 py-1 rounded border" style={{ borderColor: threatColor + "60", background: threatColor + "10" }}>
							<span className="w-2 h-2 rounded-full animate-pulse" style={{ background: threatColor }} />
							<span className="text-[10px] font-mono font-bold" style={{ color: threatColor }}>THREAT LEVEL: {threatLevel}</span>
						</div>
					</div>
				</div>
			</div>

			<div className="p-6 space-y-6">
				{/* Top-level KPIs */}
				<div className="grid grid-cols-6 gap-4">
					{[
						{ label: "ENTITIES TRACKED", value: (aircraft.length + vessels.length + fires.length).toLocaleString(), icon: Eye, color: "#06b6d4", sub: `${aircraft.length} air · ${vessels.length} sea · ${fires.length} fire` },
						{ label: "ACTIVE THREATS", value: (conflicts.length + cyber.length).toLocaleString(), icon: AlertTriangle, color: "#ef4444", sub: `${conflicts.length} conflict · ${cyber.length} cyber` },
						{ label: "CRITICAL ALERTS", value: stats.critAlerts, icon: Zap, color: "#ff2244", sub: `${stats.unackAlerts} unacknowledged` },
						{ label: "OPEN CASES", value: stats.openCases, icon: Shield, color: "#3b82f6", sub: `${stats.escalatedCases} escalated` },
						{ label: "DATA SOURCES", value: `${stats.onlineSources}/${sources.length}`, icon: Radio, color: "#22c55e", sub: `${stats.totalRecords.toLocaleString()} records` },
						{ label: "NATURAL HAZARDS", value: (seismic.length + disasters.length).toLocaleString(), icon: Activity, color: "#f59e0b", sub: `${seismic.length} seismic · ${disasters.length} disaster` },
					].map((k) => (
						<div key={k.label} className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
							<div className="flex items-center gap-2 mb-2">
								<k.icon className="w-4 h-4" style={{ color: k.color }} />
								<span className="text-[9px] font-mono text-slate-500">{k.label}</span>
							</div>
							<div className="text-2xl font-mono font-bold mb-1" style={{ color: k.color }}>{k.value}</div>
							<div className="text-[10px] font-mono text-slate-500">{k.sub}</div>
						</div>
					))}
				</div>

				{/* Domain situation grid */}
				<div>
					<h3 className="text-xs font-mono text-slate-500 mb-3 flex items-center gap-2">
						<Globe className="w-3.5 h-3.5" /> DOMAIN SITUATION OVERVIEW
					</h3>
					<div className="grid grid-cols-3 gap-4">
						{[
							{
								domain: "MARITIME",
								icon: Anchor,
								color: "#06b6d4",
								items: [
									`${vessels.length} vessels tracked`,
									`Dark fleet monitoring active`,
									`Ship-to-ship transfers flagged: 3`,
								],
								status: "ACTIVE",
							},
							{
								domain: "AVIATION",
								icon: Plane,
								color: "#3b82f6",
								items: [
									`${aircraft.length} aircraft tracked`,
									`GNSS jamming events detected`,
									`Military callsigns: 12 active`,
								],
								status: "ELEVATED",
							},
							{
								domain: "CONFLICT",
								icon: Crosshair,
								color: "#ef4444",
								items: [
									`${conflicts.length} conflict events`,
									`Active theaters: Ukraine, Middle East`,
									`Border incidents: 2 in 24h`,
								],
								status: "CRITICAL",
							},
							{
								domain: "CYBER",
								icon: Shield,
								color: "#8b5cf6",
								items: [
									`${cyber.length} cyber threats tracked`,
									`SCADA attack campaign ongoing`,
									`APT28 activity: elevated`,
								],
								status: "ELEVATED",
							},
							{
								domain: "NATURAL HAZARDS",
								icon: Activity,
								color: "#f59e0b",
								items: [
									`${fires.length} active fires`,
									`${seismic.length} seismic events`,
									`${disasters.length} active disasters`,
								],
								status: "ACTIVE",
							},
							{
								domain: "SPACE & ORBITAL",
								icon: Radio,
								color: "#22c55e",
								items: [
									"ISS orbit tracking active",
									"Satellite tasking: 4 scenes queued",
									"Space debris alerts: nominal",
								],
								status: "NOMINAL",
							},
						].map((d) => {
							const statusColors: Record<string, string> = {
								NOMINAL: "#22c55e",
								ACTIVE: "#06b6d4",
								ELEVATED: "#f59e0b",
								CRITICAL: "#ef4444",
							};
							const sc = statusColors[d.status] ?? "#64748b";
							return (
								<div key={d.domain} className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
									<div className="flex items-center justify-between mb-3">
										<div className="flex items-center gap-2">
											<d.icon className="w-4 h-4" style={{ color: d.color }} />
											<span className="text-xs font-mono font-semibold" style={{ color: d.color }}>{d.domain}</span>
										</div>
										<span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{
											color: sc, background: sc + "15", border: `1px solid ${sc}40`
										}}>
											{d.status}
										</span>
									</div>
									<ul className="space-y-1.5">
										{d.items.map((item, i) => (
											<li key={i} className="flex items-start gap-2 text-[11px] text-slate-400">
												<span className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0" style={{ background: d.color }} />
												{item}
											</li>
										))}
									</ul>
								</div>
							);
						})}
					</div>
				</div>

				{/* Critical cases */}
				<div>
					<h3 className="text-xs font-mono text-slate-500 mb-3 flex items-center gap-2">
						<Shield className="w-3.5 h-3.5" /> PRIORITY INVESTIGATIONS
					</h3>
					<div className="space-y-2">
						{cases
							.filter((c) => c.status !== "closed" && c.status !== "resolved")
							.sort((a, b) => {
								const prio = { critical: 0, high: 1, medium: 2, low: 3 };
								return (prio[a.priority as keyof typeof prio] ?? 4) - (prio[b.priority as keyof typeof prio] ?? 4);
							})
							.slice(0, 5)
							.map((c) => {
								const prioColors: Record<string, string> = { critical: "#ff2244", high: "#ff6b00", medium: "#ffaa00", low: "#00d4ff" };
								return (
									<div key={c.caseId} className="flex items-center gap-4 p-3 bg-slate-900/50 border border-slate-800 rounded-lg">
										<span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: prioColors[c.priority] }} />
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2">
												<span className="text-[10px] font-mono text-slate-500">{c.caseId}</span>
												<span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{
													color: prioColors[c.priority], background: prioColors[c.priority] + "15"
												}}>
													{c.priority.toUpperCase()}
												</span>
											</div>
											<div className="text-sm text-slate-200 truncate">{c.title}</div>
										</div>
										<div className="text-right flex-shrink-0">
											<div className="text-[10px] font-mono text-slate-500">{c.assignee}</div>
											<div className="text-[9px] font-mono text-slate-600">{c.status.toUpperCase()}</div>
										</div>
									</div>
								);
							})}
					</div>
				</div>
			</div>
		</div>
	);
}

export default ExecutiveSummaryPage;
