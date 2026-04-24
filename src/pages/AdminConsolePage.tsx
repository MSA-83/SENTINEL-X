// @ts-nocheck
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
	Settings, Users, Database, Shield, Clock, Server, Eye, EyeOff, AlertTriangle, CheckCircle, XCircle, Radio, Cpu
} from "lucide-react";

type AdminTab = "users" | "sources" | "system" | "audit" | "workspaces";

export function AdminConsolePage() {
	const [activeTab, setActiveTab] = useState<AdminTab>("system");

	return (
		<div className="min-h-screen bg-slate-950 text-slate-100">
			{/* Header */}
			<div className="border-b border-slate-800 bg-slate-950/95 backdrop-blur sticky top-0 z-30">
				<div className="flex items-center justify-between px-6 h-14">
					<div className="flex items-center gap-3">
						<Settings className="w-5 h-5 text-amber-400" />
						<span className="font-mono text-sm font-semibold tracking-wider text-amber-400">ADMIN CONSOLE</span>
					</div>
					<div className="flex items-center gap-1">
						{([
							{ id: "system", label: "SYSTEM", icon: Server },
							{ id: "users", label: "USERS", icon: Users },
							{ id: "sources", label: "SOURCES", icon: Database },
							{ id: "audit", label: "AUDIT LOG", icon: Clock },
							{ id: "workspaces", label: "WORKSPACES", icon: Radio },
						] as const).map((t) => (
							<button
								key={t.id}
								onClick={() => setActiveTab(t.id)}
								className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-mono transition ${
									activeTab === t.id
										? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
										: "text-slate-500 hover:text-slate-300"
								}`}
							>
								<t.icon className="w-3 h-3" />
								{t.label}
							</button>
						))}
					</div>
				</div>
			</div>

			<div className="p-6">
				{activeTab === "system" && <SystemHealth />}
				{activeTab === "users" && <UserManagement />}
				{activeTab === "sources" && <SourceManagement />}
				{activeTab === "audit" && <AuditLog />}
				{activeTab === "workspaces" && <WorkspaceManagement />}
			</div>
		</div>
	);
}

function SystemHealth() {
	const health = useQuery(api.admin.getSystemHealth);
	if (!health) return <div className="text-slate-500">Loading system health...</div>;

	const entityCards = [
		{ label: "Aircraft", value: health.entities.aircraft, icon: "✈", color: "#00ccff" },
		{ label: "Vessels", value: health.entities.vessels, icon: "⚓", color: "#00ff88" },
		{ label: "Fires", value: health.entities.fires, icon: "🔥", color: "#ff5500" },
		{ label: "Conflicts", value: health.entities.conflicts, icon: "⚔", color: "#ff2200" },
		{ label: "Seismic", value: health.entities.seismic, icon: "⚡", color: "#ffee00" },
		{ label: "Cyber", value: health.entities.cyber, icon: "🔒", color: "#66ffcc" },
		{ label: "Disasters", value: health.entities.disasters, icon: "⚠", color: "#ff8c00" },
	];

	return (
		<div className="space-y-6">
			{/* Status overview */}
			<div className="grid grid-cols-5 gap-4">
				{[
					{ label: "SOURCES ONLINE", value: `${health.sources.online}/${health.sources.total}`, color: health.sources.offline > 0 ? "#f59e0b" : "#22c55e", icon: CheckCircle },
					{ label: "SOURCES DEGRADED", value: health.sources.degraded, color: health.sources.degraded > 0 ? "#f59e0b" : "#22c55e", icon: AlertTriangle },
					{ label: "SOURCES OFFLINE", value: health.sources.offline, color: health.sources.offline > 0 ? "#ef4444" : "#22c55e", icon: XCircle },
					{ label: "UNACK ALERTS", value: health.alerts.unacknowledged, color: health.alerts.critical > 0 ? "#ef4444" : "#f59e0b", icon: AlertTriangle },
					{ label: "OPEN CASES", value: health.cases.open, color: "#3b82f6", icon: Shield },
				].map((s) => (
					<div key={s.label} className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
						<div className="flex items-center gap-2 mb-2">
							<s.icon className="w-4 h-4" style={{ color: s.color }} />
							<span className="text-[9px] font-mono text-slate-500">{s.label}</span>
						</div>
						<div className="text-2xl font-mono font-bold" style={{ color: s.color }}>{s.value}</div>
					</div>
				))}
			</div>

			{/* Entity counts */}
			<div>
				<h3 className="text-xs font-mono text-slate-500 mb-3">ENTITY INVENTORY</h3>
				<div className="grid grid-cols-7 gap-3">
					{entityCards.map((e) => (
						<div key={e.label} className="bg-slate-900/50 border border-slate-800 rounded-lg p-3 text-center">
							<div className="text-lg mb-1">{e.icon}</div>
							<div className="text-lg font-mono font-bold" style={{ color: e.color }}>{e.value.toLocaleString()}</div>
							<div className="text-[9px] font-mono text-slate-500">{e.label.toUpperCase()}</div>
						</div>
					))}
				</div>
			</div>

			{/* System metrics */}
			<div>
				<h3 className="text-xs font-mono text-slate-500 mb-3">SYSTEM METRICS</h3>
				<div className="grid grid-cols-3 gap-4">
					{[
						{ label: "Knowledge Graph", value: `${health.kgNodes} nodes`, icon: Cpu, color: "#8b5cf6" },
						{ label: "Total Alerts", value: health.alerts.total, icon: AlertTriangle, color: "#f59e0b" },
						{ label: "Total Cases", value: health.cases.total, icon: Shield, color: "#3b82f6" },
					].map((m) => (
						<div key={m.label} className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
							<div className="flex items-center gap-2 mb-2">
								<m.icon className="w-4 h-4" style={{ color: m.color }} />
								<span className="text-xs font-mono text-slate-400">{m.label}</span>
							</div>
							<div className="text-xl font-mono font-bold" style={{ color: m.color }}>{m.value}</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

function UserManagement() {
	const users = useQuery(api.admin.listUsers) ?? [];
	const toggleActive = useMutation(api.admin.toggleUserActive);
	const updateRole = useMutation(api.admin.updateUserRole);

	const ROLE_COLORS: Record<string, string> = {
		super_admin: "#ef4444",
		admin: "#f59e0b",
		analyst: "#3b82f6",
		operator: "#22c55e",
		viewer: "#8b5cf6",
		executive: "#06b6d4",
	};

	return (
		<div>
			<div className="flex items-center justify-between mb-4">
				<h3 className="text-xs font-mono text-slate-500">USER MANAGEMENT ({users.length} users)</h3>
			</div>
			<div className="bg-slate-900/50 border border-slate-800 rounded-lg overflow-hidden">
				<table className="w-full text-xs">
					<thead>
						<tr className="border-b border-slate-800">
							<th className="px-4 py-2.5 text-left font-mono text-[10px] text-slate-500">USER</th>
							<th className="px-4 py-2.5 text-left font-mono text-[10px] text-slate-500">ROLE</th>
							<th className="px-4 py-2.5 text-left font-mono text-[10px] text-slate-500">DEPARTMENT</th>
							<th className="px-4 py-2.5 text-left font-mono text-[10px] text-slate-500">CLEARANCE</th>
							<th className="px-4 py-2.5 text-left font-mono text-[10px] text-slate-500">STATUS</th>
							<th className="px-4 py-2.5 text-left font-mono text-[10px] text-slate-500">ACTIONS</th>
						</tr>
					</thead>
					<tbody>
						{users.map((u) => (
							<tr key={u.userId} className="border-b border-slate-800/50 hover:bg-slate-800/30">
								<td className="px-4 py-2.5">
									<div className="text-slate-200">{u.displayName}</div>
									<div className="text-[10px] text-slate-500 font-mono">{u.userId}</div>
								</td>
								<td className="px-4 py-2.5">
									<select
										value={u.role}
										onChange={(e) => updateRole({ userId: u.userId, role: e.target.value })}
										className="bg-transparent text-xs font-mono px-1 py-0.5 rounded border border-transparent hover:border-slate-700 focus:outline-none"
										style={{ color: ROLE_COLORS[u.role] ?? "#64748b" }}
									>
										{["super_admin", "admin", "analyst", "operator", "viewer", "executive"].map((r) => (
											<option key={r} value={r}>{r.toUpperCase()}</option>
										))}
									</select>
								</td>
								<td className="px-4 py-2.5 text-slate-400 font-mono">{u.department ?? "—"}</td>
								<td className="px-4 py-2.5">
									<span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
										u.clearanceLevel === "TOP SECRET" ? "bg-red-500/10 text-red-400" :
										u.clearanceLevel === "SECRET" ? "bg-amber-500/10 text-amber-400" :
										"bg-slate-700/50 text-slate-400"
									}`}>{u.clearanceLevel ?? "N/A"}</span>
								</td>
								<td className="px-4 py-2.5">
									<span className={`flex items-center gap-1 text-[10px] font-mono ${u.isActive ? "text-green-400" : "text-red-400"}`}>
										<span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? "bg-green-400" : "bg-red-400"}`} />
										{u.isActive ? "ACTIVE" : "DISABLED"}
									</span>
								</td>
								<td className="px-4 py-2.5">
									<button
										onClick={() => toggleActive({ userId: u.userId })}
										className="text-[10px] font-mono px-2 py-1 rounded border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition"
									>
										{u.isActive ? <EyeOff className="w-3 h-3 inline mr-1" /> : <Eye className="w-3 h-3 inline mr-1" />}
										{u.isActive ? "DISABLE" : "ENABLE"}
									</button>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

function SourceManagement() {
	const sources = useQuery(api.entities.listDataSourceStatus) ?? [];

	return (
		<div>
			<h3 className="text-xs font-mono text-slate-500 mb-4">DATA SOURCE STATUS ({sources.length} sources)</h3>
			<div className="grid grid-cols-2 gap-3">
				{sources.map((s) => {
					const isOnline = s.status === "online" || s.status === "ok";
					const isDegraded = s.status === "degraded";
					return (
						<div key={s.sourceId} className={`bg-slate-900/50 border rounded-lg p-4 ${
							isOnline ? "border-green-500/30" : isDegraded ? "border-amber-500/30" : "border-red-500/30"
						}`}>
							<div className="flex items-center justify-between mb-2">
								<div className="flex items-center gap-2">
									<span className={`w-2 h-2 rounded-full ${isOnline ? "bg-green-400 animate-pulse" : isDegraded ? "bg-amber-400" : "bg-red-400"}`} />
									<span className="text-sm font-mono text-slate-200">{s.name}</span>
								</div>
								<span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
									isOnline ? "bg-green-500/10 text-green-400" : isDegraded ? "bg-amber-500/10 text-amber-400" : "bg-red-500/10 text-red-400"
								}`}>{s.status.toUpperCase()}</span>
							</div>
							<div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
								<span>{s.recordCount.toLocaleString()} records</span>
								<span>Last: {new Date(s.lastFetch).toLocaleTimeString()}</span>
							</div>
							{s.errorMessage && (
								<div className="mt-2 text-[10px] text-red-400 font-mono bg-red-500/10 px-2 py-1 rounded">{s.errorMessage}</div>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}

function AuditLog() {
	const entries = useQuery(api.admin.listAuditLog) ?? [];

	const ACTION_COLORS: Record<string, string> = {
		login: "#22c55e",
		logout: "#6b7280",
		create: "#3b82f6",
		update: "#f59e0b",
		delete: "#ef4444",
		export: "#8b5cf6",
		search: "#06b6d4",
		view: "#64748b",
	};

	return (
		<div>
			<h3 className="text-xs font-mono text-slate-500 mb-4">AUDIT LOG ({entries.length} entries)</h3>
			<div className="bg-slate-900/50 border border-slate-800 rounded-lg overflow-hidden">
				<table className="w-full text-xs">
					<thead>
						<tr className="border-b border-slate-800">
							<th className="px-4 py-2.5 text-left font-mono text-[10px] text-slate-500">TIME</th>
							<th className="px-4 py-2.5 text-left font-mono text-[10px] text-slate-500">ACTION</th>
							<th className="px-4 py-2.5 text-left font-mono text-[10px] text-slate-500">ACTOR</th>
							<th className="px-4 py-2.5 text-left font-mono text-[10px] text-slate-500">RESOURCE</th>
							<th className="px-4 py-2.5 text-left font-mono text-[10px] text-slate-500">DETAILS</th>
						</tr>
					</thead>
					<tbody>
						{entries.map((e, i) => (
							<tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30">
								<td className="px-4 py-2 font-mono text-slate-500">{new Date(e.timestamp).toLocaleString()}</td>
								<td className="px-4 py-2">
									<span className="font-mono px-1.5 py-0.5 rounded" style={{
										color: ACTION_COLORS[e.action] ?? "#64748b",
										background: (ACTION_COLORS[e.action] ?? "#64748b") + "15",
									}}>
										{e.action.toUpperCase()}
									</span>
								</td>
								<td className="px-4 py-2 text-slate-300 font-mono">{e.actor}</td>
								<td className="px-4 py-2 text-slate-400 font-mono">{e.resource}{e.resourceId ? ` (${e.resourceId})` : ""}</td>
								<td className="px-4 py-2 text-slate-500 max-w-xs truncate">{e.details ?? "—"}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

function WorkspaceManagement() {
	const workspaces = useQuery(api.admin.listWorkspaces) ?? [];
	const createWs = useMutation(api.admin.createWorkspace);
	// @ts-expect-error unused
const _deleteWs = useMutation(api.admin.deleteWorkspace);

	const TYPE_COLORS: Record<string, string> = {
		mission: "#ef4444",
		investigation: "#f59e0b",
		monitoring: "#22c55e",
		exercise: "#3b82f6",
	};

	return (
		<div>
			<div className="flex items-center justify-between mb-4">
				<h3 className="text-xs font-mono text-slate-500">WORKSPACES ({workspaces.length})</h3>
				<button
					onClick={() => createWs({ name: `Workspace ${Date.now().toString(36)}`, description: "New workspace", type: "monitoring", layers: ["aircraft", "ships"] })}
					className="text-[10px] font-mono px-2 py-1 bg-amber-500/20 border border-amber-500/40 rounded text-amber-300 hover:bg-amber-500/30 transition"
				>
					+ NEW WORKSPACE
				</button>
			</div>
			<div className="grid grid-cols-2 gap-4">
				{workspaces.map((w) => (
					<div key={w.workspaceId} className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
						<div className="flex items-center justify-between mb-2">
							<span className="text-sm font-semibold text-slate-200">{w.name}</span>
							<span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{
								color: TYPE_COLORS[w.type] ?? "#64748b",
								background: (TYPE_COLORS[w.type] ?? "#64748b") + "15",
								border: `1px solid ${(TYPE_COLORS[w.type] ?? "#64748b")}40`,
							}}>
								{w.type.toUpperCase()}
							</span>
						</div>
						<p className="text-xs text-slate-400 mb-3 line-clamp-2">{w.description}</p>
						<div className="flex flex-wrap gap-1 mb-3">
							{w.layers.map((l) => (
								<span key={l} className="text-[9px] font-mono px-1.5 py-0.5 bg-slate-800 text-cyan-400 rounded">{l}</span>
							))}
						</div>
						<div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
							<span>{w.members.length} members</span>
							<span>{w.status.toUpperCase()}</span>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

export default AdminConsolePage;
