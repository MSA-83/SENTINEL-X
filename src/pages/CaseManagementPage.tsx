// @ts-nocheck
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
	Plus, Search, ChevronRight, Clock, User, Tag, MapPin, MessageSquare, Paperclip,
	CheckCircle2, XCircle, ArrowUpCircle, Circle, FileText, Shield
} from "lucide-react";

type CaseStatus = "open" | "investigating" | "escalated" | "resolved" | "closed";
type CasePriority = "critical" | "high" | "medium" | "low";

const STATUS_CONFIG: Record<CaseStatus, { label: string; color: string; icon: typeof Circle; bg: string }> = {
	open: { label: "OPEN", color: "#3b82f6", icon: Circle, bg: "bg-blue-500/20 border-blue-500/40" },
	investigating: { label: "INVESTIGATING", color: "#f59e0b", icon: Search, bg: "bg-amber-500/20 border-amber-500/40" },
	escalated: { label: "ESCALATED", color: "#ef4444", icon: ArrowUpCircle, bg: "bg-red-500/20 border-red-500/40" },
	resolved: { label: "RESOLVED", color: "#22c55e", icon: CheckCircle2, bg: "bg-green-500/20 border-green-500/40" },
	closed: { label: "CLOSED", color: "#6b7280", icon: XCircle, bg: "bg-slate-500/20 border-slate-500/40" },
};

const PRIORITY_COLORS: Record<CasePriority, string> = {
	critical: "#ff2244",
	high: "#ff6b00",
	medium: "#ffaa00",
	low: "#00d4ff",
};

export function CaseManagementPage() {
	const cases = useQuery(api.cases.list) ?? [];
	const stats = useQuery(api.cases.getStats);
	const [searchQuery, setSearchQuery] = useState("");
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [priorityFilter, setPriorityFilter] = useState<string>("all");
	const [selectedCase, setSelectedCase] = useState<string | null>(null);
	const [showCreateForm, setShowCreateForm] = useState(false);

	const filtered = useMemo(() => {
		return cases.filter((c) => {
			if (statusFilter !== "all" && c.status !== statusFilter) return false;
			if (priorityFilter !== "all" && c.priority !== priorityFilter) return false;
			if (searchQuery) {
				const q = searchQuery.toLowerCase();
				return (
					c.title.toLowerCase().includes(q) ||
					c.caseId.toLowerCase().includes(q) ||
					c.description.toLowerCase().includes(q) ||
					c.tags.some((t) => t.toLowerCase().includes(q))
				);
			}
			return true;
		});
	}, [cases, statusFilter, priorityFilter, searchQuery]);

	return (
		<div className="min-h-screen bg-slate-950 text-slate-100">
			{/* Header */}
			<div className="border-b border-slate-800 bg-slate-950/95 backdrop-blur sticky top-0 z-30">
				<div className="flex items-center justify-between px-6 h-14">
					<div className="flex items-center gap-3">
						<Shield className="w-5 h-5 text-cyan-400" />
						<span className="font-mono text-sm font-semibold tracking-wider text-cyan-400">CASE MANAGEMENT</span>
						<span className="text-[10px] font-mono text-slate-500 bg-slate-800 px-2 py-0.5 rounded">{cases.length} CASES</span>
					</div>
					<button
						onClick={() => setShowCreateForm(true)}
						className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/20 border border-cyan-500/40 rounded text-cyan-300 text-xs font-mono hover:bg-cyan-500/30 transition"
					>
						<Plus className="w-3.5 h-3.5" /> NEW CASE
					</button>
				</div>
			</div>

			<div className="flex h-[calc(100vh-3.5rem)]">
				{/* Left panel — case list */}
				<div className="w-[420px] border-r border-slate-800 flex flex-col">
					{/* Stats bar */}
					{stats && (
						<div className="grid grid-cols-4 gap-2 p-3 border-b border-slate-800">
							{[
								{ label: "OPEN", value: stats.open, color: "#3b82f6" },
								{ label: "ACTIVE", value: stats.investigating, color: "#f59e0b" },
								{ label: "ESCALATED", value: stats.escalated, color: "#ef4444" },
								{ label: "RESOLVED", value: stats.resolved, color: "#22c55e" },
							].map((s) => (
								<div key={s.label} className="text-center">
									<div className="text-lg font-mono font-bold" style={{ color: s.color }}>{s.value}</div>
									<div className="text-[9px] font-mono text-slate-500">{s.label}</div>
								</div>
							))}
						</div>
					)}

					{/* Search & filters */}
					<div className="p-3 space-y-2 border-b border-slate-800">
						<div className="relative">
							<Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-500" />
							<input
								type="text"
								placeholder="Search cases..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-slate-300 focus:border-cyan-500 focus:outline-none"
							/>
						</div>
						<div className="flex gap-2">
							<select
								value={statusFilter}
								onChange={(e) => setStatusFilter(e.target.value)}
								className="flex-1 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-[10px] font-mono text-slate-400 focus:outline-none"
							>
								<option value="all">ALL STATUS</option>
								{Object.entries(STATUS_CONFIG).map(([k, v]) => (
									<option key={k} value={k}>{v.label}</option>
								))}
							</select>
							<select
								value={priorityFilter}
								onChange={(e) => setPriorityFilter(e.target.value)}
								className="flex-1 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-[10px] font-mono text-slate-400 focus:outline-none"
							>
								<option value="all">ALL PRIORITY</option>
								<option value="critical">CRITICAL</option>
								<option value="high">HIGH</option>
								<option value="medium">MEDIUM</option>
								<option value="low">LOW</option>
							</select>
						</div>
					</div>

					{/* Case list */}
					<div className="flex-1 overflow-y-auto">
						{filtered.map((c) => {
							const sc = STATUS_CONFIG[c.status as CaseStatus] ?? STATUS_CONFIG.open;
							const Icon = sc.icon;
							return (
								<button
									key={c.caseId}
									onClick={() => setSelectedCase(c.caseId)}
									className={`w-full text-left px-4 py-3 border-b border-slate-800/60 hover:bg-slate-800/40 transition ${
										selectedCase === c.caseId ? "bg-slate-800/60 border-l-2 border-l-cyan-500" : ""
									}`}
								>
									<div className="flex items-center justify-between mb-1">
										<span className="text-[10px] font-mono text-slate-500">{c.caseId}</span>
										<span
											className="text-[9px] font-mono px-1.5 py-0.5 rounded border"
											style={{ color: sc.color, borderColor: sc.color + "60", background: sc.color + "15" }}
										>
											<Icon className="w-2.5 h-2.5 inline mr-1" />
											{sc.label}
										</span>
									</div>
									<div className="text-sm font-medium text-slate-200 mb-1 line-clamp-1">{c.title}</div>
									<div className="text-[11px] text-slate-400 mb-2 line-clamp-2">{c.description}</div>
									<div className="flex items-center gap-3 text-[10px] text-slate-500">
										<span className="flex items-center gap-1">
											<span className="w-1.5 h-1.5 rounded-full" style={{ background: PRIORITY_COLORS[c.priority as CasePriority] }} />
											{c.priority.toUpperCase()}
										</span>
										{c.assignee && (
											<span className="flex items-center gap-1">
												<User className="w-2.5 h-2.5" />
												{c.assignee}
											</span>
										)}
										<span className="flex items-center gap-1">
											<Clock className="w-2.5 h-2.5" />
											{new Date(c.updatedAt).toLocaleDateString()}
										</span>
									</div>
									{c.tags.length > 0 && (
										<div className="flex flex-wrap gap-1 mt-1.5">
											{c.tags.slice(0, 4).map((t) => (
												<span key={t} className="text-[9px] font-mono px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded">{t}</span>
											))}
										</div>
									)}
								</button>
							);
						})}
						{filtered.length === 0 && (
							<div className="p-8 text-center text-slate-500 text-sm">No cases match your filters</div>
						)}
					</div>
				</div>

				{/* Right panel — detail */}
				<div className="flex-1 overflow-y-auto">
					{selectedCase ? (
						<CaseDetail caseId={selectedCase} />
					) : showCreateForm ? (
						<CreateCaseForm onClose={() => setShowCreateForm(false)} onCreated={(id) => { setSelectedCase(id); setShowCreateForm(false); }} />
					) : (
						<div className="flex items-center justify-center h-full text-slate-600">
							<div className="text-center">
								<Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
								<div className="text-sm font-mono">SELECT A CASE TO VIEW DETAILS</div>
								<div className="text-xs text-slate-700 mt-1">or create a new investigation</div>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

function CaseDetail({ caseId }: { caseId: string }) {
	const caseData = useQuery(api.cases.getById, { caseId });
	const notes = useQuery(api.cases.getNotes, { caseId }) ?? [];
	const evidence = useQuery(api.cases.getEvidence, { caseId }) ?? [];
	const updateStatus = useMutation(api.cases.updateStatus);
	const addNote = useMutation(api.cases.addNote);
	const [noteText, setNoteText] = useState("");
	const [activeTab, setActiveTab] = useState<"timeline" | "evidence" | "entities">("timeline");

	if (!caseData) return <div className="p-8 text-slate-500">Loading...</div>;

	const sc = STATUS_CONFIG[caseData.status as CaseStatus] ?? STATUS_CONFIG.open;

	const handleAddNote = async () => {
		if (!noteText.trim()) return;
		await addNote({ caseId, content: noteText.trim() });
		setNoteText("");
	};

	const statusTransitions: Record<string, CaseStatus[]> = {
		open: ["investigating", "escalated", "closed"],
		investigating: ["escalated", "resolved", "closed"],
		escalated: ["investigating", "resolved"],
		resolved: ["closed", "open"],
		closed: ["open"],
	};

	return (
		<div className="p-6">
			{/* Case header */}
			<div className="mb-6">
				<div className="flex items-center gap-3 mb-2">
					<span className="text-xs font-mono text-slate-500">{caseData.caseId}</span>
					<span
						className={`text-[10px] font-mono px-2 py-0.5 rounded border ${sc.bg}`}
						style={{ color: sc.color }}
					>
						{sc.label}
					</span>
					<span
						className="text-[10px] font-mono px-2 py-0.5 rounded"
						style={{ color: PRIORITY_COLORS[caseData.priority as CasePriority], background: PRIORITY_COLORS[caseData.priority as CasePriority] + "20" }}
					>
						{caseData.priority.toUpperCase()} PRIORITY
					</span>
				</div>
				<h2 className="text-xl font-semibold text-slate-100 mb-2">{caseData.title}</h2>
				<p className="text-sm text-slate-400 leading-relaxed">{caseData.description}</p>
			</div>

			{/* Meta grid */}
			<div className="grid grid-cols-4 gap-4 mb-6">
				{[
					{ icon: User, label: "ASSIGNEE", value: caseData.assignee ?? "Unassigned" },
					{ icon: Tag, label: "DOMAIN", value: caseData.domain.toUpperCase() },
					{ icon: Clock, label: "CREATED", value: new Date(caseData.createdAt).toLocaleDateString() },
					{ icon: MapPin, label: "LOCATION", value: caseData.latitude ? `${caseData.latitude.toFixed(2)}°, ${caseData.longitude?.toFixed(2)}°` : "N/A" },
				].map((m) => (
					<div key={m.label} className="bg-slate-900/50 border border-slate-800 rounded-lg p-3">
						<div className="flex items-center gap-1.5 mb-1">
							<m.icon className="w-3 h-3 text-slate-500" />
							<span className="text-[9px] font-mono text-slate-500">{m.label}</span>
						</div>
						<div className="text-xs font-mono text-slate-300">{m.value}</div>
					</div>
				))}
			</div>

			{/* Status transitions */}
			<div className="flex items-center gap-2 mb-6">
				<span className="text-[10px] font-mono text-slate-500">TRANSITION TO:</span>
				{(statusTransitions[caseData.status] ?? []).map((s) => {
					const cfg = STATUS_CONFIG[s];
					return (
						<button
							key={s}
							onClick={() => updateStatus({ caseId, status: s })}
							className="text-[10px] font-mono px-2 py-1 rounded border hover:brightness-125 transition"
							style={{ color: cfg.color, borderColor: cfg.color + "40", background: cfg.color + "10" }}
						>
							{cfg.label}
						</button>
					);
				})}
			</div>

			{/* Tags */}
			{caseData.tags.length > 0 && (
				<div className="flex flex-wrap gap-1.5 mb-6">
					{caseData.tags.map((t) => (
						<span key={t} className="text-[10px] font-mono px-2 py-1 bg-slate-800 text-cyan-400 rounded border border-slate-700">{t}</span>
					))}
				</div>
			)}

			{/* Tabs */}
			<div className="flex gap-4 border-b border-slate-800 mb-4">
				{(["timeline", "evidence", "entities"] as const).map((tab) => (
					<button
						key={tab}
						onClick={() => setActiveTab(tab)}
						className={`px-3 py-2 text-xs font-mono border-b-2 transition ${
							activeTab === tab ? "border-cyan-500 text-cyan-400" : "border-transparent text-slate-500 hover:text-slate-300"
						}`}
					>
						{tab === "timeline" && <MessageSquare className="w-3 h-3 inline mr-1.5" />}
						{tab === "evidence" && <Paperclip className="w-3 h-3 inline mr-1.5" />}
						{tab === "entities" && <FileText className="w-3 h-3 inline mr-1.5" />}
						{tab.toUpperCase()} ({tab === "timeline" ? notes.length : tab === "evidence" ? evidence.length : caseData.linkedEntities.length})
					</button>
				))}
			</div>

			{/* Tab content */}
			{activeTab === "timeline" && (
				<div>
					{/* Add note */}
					<div className="flex gap-2 mb-4">
						<input
							type="text"
							placeholder="Add investigation note..."
							value={noteText}
							onChange={(e) => setNoteText(e.target.value)}
							onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
							className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-slate-300 focus:border-cyan-500 focus:outline-none"
						/>
						<button
							onClick={handleAddNote}
							className="px-3 py-2 bg-cyan-500/20 border border-cyan-500/40 rounded text-cyan-300 text-xs font-mono hover:bg-cyan-500/30 transition"
						>
							ADD
						</button>
					</div>
					{/* Notes list */}
					<div className="space-y-3">
						{notes.map((n, i) => (
							<div key={i} className="flex gap-3">
								<div className="flex flex-col items-center">
									<div className={`w-2 h-2 rounded-full mt-1.5 ${n.type === "status_change" ? "bg-amber-500" : "bg-cyan-500"}`} />
									{i < notes.length - 1 && <div className="w-px flex-1 bg-slate-800 mt-1" />}
								</div>
								<div className="flex-1 pb-3">
									<div className="flex items-center gap-2 mb-1">
										<span className="text-xs font-mono text-slate-300">{n.author}</span>
										<span className="text-[9px] font-mono text-slate-600">{new Date(n.timestamp).toLocaleString()}</span>
										{n.type === "status_change" && (
											<span className="text-[9px] font-mono px-1.5 py-0.5 bg-amber-500/10 text-amber-400 rounded">STATUS</span>
										)}
									</div>
									<div className="text-xs text-slate-400">{n.content}</div>
								</div>
							</div>
						))}
					</div>
				</div>
			)}

			{activeTab === "evidence" && (
				<div className="space-y-2">
					{evidence.length === 0 ? (
						<div className="text-center text-slate-600 text-sm py-8">No evidence attached yet</div>
					) : (
						evidence.map((e, i) => (
							<div key={i} className="flex items-center gap-3 p-3 bg-slate-900/50 border border-slate-800 rounded">
								<Paperclip className="w-4 h-4 text-slate-500" />
								<div className="flex-1">
									<div className="text-xs font-mono text-slate-300">{e.title}</div>
									<div className="text-[10px] text-slate-500">{e.type} • Added by {e.addedBy}</div>
								</div>
								<span className="text-[10px] text-slate-600">{new Date(e.timestamp).toLocaleDateString()}</span>
							</div>
						))
					)}
				</div>
			)}

			{activeTab === "entities" && (
				<div className="space-y-2">
					{caseData.linkedEntities.length === 0 ? (
						<div className="text-center text-slate-600 text-sm py-8">No entities linked yet</div>
					) : (
						caseData.linkedEntities.map((e, i) => (
							<div key={i} className="flex items-center gap-3 p-3 bg-slate-900/50 border border-slate-800 rounded">
								<ChevronRight className="w-4 h-4 text-slate-500" />
								<span className="text-xs font-mono text-slate-300">{e}</span>
							</div>
						))
					)}
				</div>
			)}
		</div>
	);
}

function CreateCaseForm({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
	const create = useMutation(api.cases.create);
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [priority, setPriority] = useState("medium");
	const [domain, setDomain] = useState("conflict");
	const [tags, setTags] = useState("");

	const handleSubmit = async () => {
		if (!title.trim()) return;
		const caseId = await create({
			title: title.trim(),
			description: description.trim(),
			priority,
			domain,
			tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
		});
		onCreated(caseId);
	};

	return (
		<div className="p-6 max-w-2xl">
			<div className="flex items-center justify-between mb-6">
				<h2 className="text-lg font-semibold text-slate-100">Create New Case</h2>
				<button onClick={onClose} className="text-slate-500 hover:text-slate-300">
					<XCircle className="w-5 h-5" />
				</button>
			</div>
			<div className="space-y-4">
				<div>
					<label className="block text-[10px] font-mono text-slate-500 mb-1">TITLE</label>
					<input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
						className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-slate-300 focus:border-cyan-500 focus:outline-none"
						placeholder="Case title..."
					/>
				</div>
				<div>
					<label className="block text-[10px] font-mono text-slate-500 mb-1">DESCRIPTION</label>
					<textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4}
						className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-slate-300 focus:border-cyan-500 focus:outline-none resize-none"
						placeholder="Describe the investigation..."
					/>
				</div>
				<div className="grid grid-cols-2 gap-4">
					<div>
						<label className="block text-[10px] font-mono text-slate-500 mb-1">PRIORITY</label>
						<select value={priority} onChange={(e) => setPriority(e.target.value)}
							className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-slate-300 focus:outline-none">
							<option value="critical">Critical</option>
							<option value="high">High</option>
							<option value="medium">Medium</option>
							<option value="low">Low</option>
						</select>
					</div>
					<div>
						<label className="block text-[10px] font-mono text-slate-500 mb-1">DOMAIN</label>
						<select value={domain} onChange={(e) => setDomain(e.target.value)}
							className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-slate-300 focus:outline-none">
							{["aviation", "maritime", "orbital", "seismic", "conflict", "weather", "cyber", "nuclear", "sigint", "infrastructure", "energy"].map((d) => (
								<option key={d} value={d}>{d}</option>
							))}
						</select>
					</div>
				</div>
				<div>
					<label className="block text-[10px] font-mono text-slate-500 mb-1">TAGS (comma separated)</label>
					<input type="text" value={tags} onChange={(e) => setTags(e.target.value)}
						className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-slate-300 focus:border-cyan-500 focus:outline-none"
						placeholder="dark-fleet, sanctions, maritime..."
					/>
				</div>
				<button onClick={handleSubmit}
					className="w-full py-2 bg-cyan-500/20 border border-cyan-500/40 rounded text-cyan-300 text-sm font-mono hover:bg-cyan-500/30 transition"
				>
					CREATE CASE
				</button>
			</div>
		</div>
	);
}

export default CaseManagementPage;
