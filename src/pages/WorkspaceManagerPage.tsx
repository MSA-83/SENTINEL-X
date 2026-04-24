// @ts-nocheck
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
	Layers, Plus, Search, Users, Clock, Settings, Trash2, Play, Pause,
	Map as MapIcon, Edit, X, ChevronRight, Shield, Radio
} from "lucide-react";

export function WorkspaceManagerPage() {
	const workspaces = useQuery(api.admin.listWorkspaces) ?? [];
	const createWorkspace = useMutation(api.admin.createWorkspace);
	const updateWorkspace = useMutation(api.admin.updateWorkspace);
	const deleteWorkspace = useMutation(api.admin.deleteWorkspace);
	const [selectedWs, setSelectedWs] = useState<string | null>(null);
	const [showCreate, setShowCreate] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");

	// New workspace form state
	const [newName, setNewName] = useState("");
	const [newDesc, setNewDesc] = useState("");
	const [newType, setNewType] = useState("monitoring");
	const [newLayers, setNewLayers] = useState<string[]>(["aircraft", "ships"]);

	const TYPE_CONFIG: Record<string, { color: string; icon: string }> = {
		mission: { color: "#ef4444", icon: "⚔" },
		investigation: { color: "#f59e0b", icon: "🔍" },
		monitoring: { color: "#22c55e", icon: "📡" },
		exercise: { color: "#3b82f6", icon: "🎯" },
	};

	const AVAILABLE_LAYERS = [
		"aircraft", "ships", "fishing", "military", "conflict", "fires", "seismic",
		"cyber", "satellites", "gnss", "weather", "nuclear", "infrastructure",
	];

	const filtered = workspaces.filter((w) => {
		if (!searchQuery) return true;
		const q = searchQuery.toLowerCase();
		return w.name.toLowerCase().includes(q) || w.description.toLowerCase().includes(q);
	});

	const selectedData = selectedWs ? workspaces.find((w) => w.workspaceId === selectedWs) : null;

	const handleCreate = async () => {
		if (!newName.trim()) return;
		const id = await createWorkspace({
			name: newName.trim(),
			description: newDesc.trim(),
			type: newType,
			layers: newLayers,
		});
		setSelectedWs(id);
		setShowCreate(false);
		setNewName("");
		setNewDesc("");
		setNewType("monitoring");
		setNewLayers(["aircraft", "ships"]);
	};

	const toggleLayer = (layer: string) => {
		setNewLayers((prev) =>
			prev.includes(layer) ? prev.filter((l) => l !== layer) : [...prev, layer]
		);
	};

	return (
		<div className="min-h-screen bg-slate-950 text-slate-100">
			{/* Header */}
			<div className="border-b border-slate-800 bg-slate-950/95 backdrop-blur sticky top-0 z-30">
				<div className="flex items-center justify-between px-6 h-14">
					<div className="flex items-center gap-3">
						<Layers className="w-5 h-5 text-blue-400" />
						<span className="font-mono text-sm font-semibold tracking-wider text-blue-400">WORKSPACE MANAGER</span>
						<span className="text-[10px] font-mono text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
							{workspaces.length} WORKSPACES
						</span>
					</div>
					<button
						onClick={() => setShowCreate(true)}
						className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 border border-blue-500/40 rounded text-blue-300 text-xs font-mono hover:bg-blue-500/30 transition"
					>
						<Plus className="w-3.5 h-3.5" /> NEW WORKSPACE
					</button>
				</div>
			</div>

			<div className="flex h-[calc(100vh-3.5rem)]">
				{/* Left — workspace list */}
				<div className="w-[380px] border-r border-slate-800 flex flex-col">
					{/* Search */}
					<div className="p-3 border-b border-slate-800">
						<div className="relative">
							<Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-500" />
							<input
								type="text"
								placeholder="Search workspaces..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-slate-300 focus:border-blue-500 focus:outline-none"
							/>
						</div>
					</div>

					{/* Workspace cards */}
					<div className="flex-1 overflow-y-auto p-3 space-y-2">
						{filtered.map((w) => {
							const tc = TYPE_CONFIG[w.type] ?? { color: "#64748b", icon: "📦" };
							return (
								<button
									key={w.workspaceId}
									onClick={() => { setSelectedWs(w.workspaceId); setShowCreate(false); }}
									className={`w-full text-left p-4 rounded-lg border transition ${
										selectedWs === w.workspaceId
											? "bg-slate-800/60 border-blue-500/40"
											: "bg-slate-900/50 border-slate-800 hover:bg-slate-800/40"
									}`}
								>
									<div className="flex items-center gap-2 mb-2">
										<span className="text-lg">{tc.icon}</span>
										<span className="text-sm font-semibold text-slate-200 flex-1 truncate">{w.name}</span>
										<span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{
											color: tc.color, background: tc.color + "15", border: `1px solid ${tc.color}40`
										}}>
											{w.type.toUpperCase()}
										</span>
									</div>
									<p className="text-[11px] text-slate-400 mb-2 line-clamp-2">{w.description}</p>
									<div className="flex flex-wrap gap-1 mb-2">
										{w.layers.slice(0, 5).map((l) => (
											<span key={l} className="text-[9px] font-mono px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded">{l}</span>
										))}
										{w.layers.length > 5 && (
											<span className="text-[9px] font-mono text-slate-500">+{w.layers.length - 5}</span>
										)}
									</div>
									<div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono">
										<span className="flex items-center gap-1">
											<Users className="w-2.5 h-2.5" /> {w.members.length}
										</span>
										<span className={`flex items-center gap-1 ${w.status === "active" ? "text-green-400" : "text-slate-500"}`}>
											<span className={`w-1.5 h-1.5 rounded-full ${w.status === "active" ? "bg-green-400" : "bg-slate-500"}`} />
											{w.status.toUpperCase()}
										</span>
										<span className="flex items-center gap-1">
											<Clock className="w-2.5 h-2.5" />
											{new Date(w.updatedAt).toLocaleDateString()}
										</span>
									</div>
								</button>
							);
						})}
					</div>
				</div>

				{/* Right — detail or create form */}
				<div className="flex-1 overflow-y-auto">
					{showCreate ? (
						<div className="p-6 max-w-2xl">
							<div className="flex items-center justify-between mb-6">
								<h2 className="text-lg font-semibold text-slate-100">Create New Workspace</h2>
								<button onClick={() => setShowCreate(false)} className="text-slate-500 hover:text-slate-300">
									<X className="w-5 h-5" />
								</button>
							</div>
							<div className="space-y-4">
								<div>
									<label className="block text-[10px] font-mono text-slate-500 mb-1">WORKSPACE NAME</label>
									<input
										type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
										className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-slate-300 focus:border-blue-500 focus:outline-none"
										placeholder="e.g. Mediterranean Watch"
									/>
								</div>
								<div>
									<label className="block text-[10px] font-mono text-slate-500 mb-1">DESCRIPTION</label>
									<textarea
										value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={3}
										className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-slate-300 focus:border-blue-500 focus:outline-none resize-none"
										placeholder="What is this workspace for?"
									/>
								</div>
								<div>
									<label className="block text-[10px] font-mono text-slate-500 mb-1">TYPE</label>
									<div className="flex gap-2">
										{Object.entries(TYPE_CONFIG).map(([k, v]) => (
											<button
												key={k}
												onClick={() => setNewType(k)}
												className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-mono transition ${
													newType === k
														? "border-opacity-40"
														: "border-slate-700 text-slate-500"
												}`}
												style={newType === k ? { color: v.color, borderColor: v.color + "60", background: v.color + "15" } : {}}
											>
												<span>{v.icon}</span> {k.toUpperCase()}
											</button>
										))}
									</div>
								</div>
								<div>
									<label className="block text-[10px] font-mono text-slate-500 mb-1">LAYERS</label>
									<div className="flex flex-wrap gap-2">
										{AVAILABLE_LAYERS.map((l) => (
											<button
												key={l}
												onClick={() => toggleLayer(l)}
												className={`text-[10px] font-mono px-2 py-1 rounded border transition ${
													newLayers.includes(l)
														? "bg-blue-500/20 border-blue-500/40 text-blue-300"
														: "border-slate-700 text-slate-500 hover:text-slate-300"
												}`}
											>
												{l}
											</button>
										))}
									</div>
								</div>
								<button
									onClick={handleCreate}
									className="w-full py-2 bg-blue-500/20 border border-blue-500/40 rounded text-blue-300 text-sm font-mono hover:bg-blue-500/30 transition"
								>
									CREATE WORKSPACE
								</button>
							</div>
						</div>
					) : selectedData ? (
						<div className="p-6">
							<div className="flex items-center gap-3 mb-6">
								<span className="text-2xl">{TYPE_CONFIG[selectedData.type]?.icon ?? "📦"}</span>
								<div className="flex-1">
									<h2 className="text-xl font-semibold text-slate-100">{selectedData.name}</h2>
									<div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
										<span style={{ color: TYPE_CONFIG[selectedData.type]?.color }}>{selectedData.type.toUpperCase()}</span>
										<span>·</span>
										<span>{selectedData.workspaceId}</span>
									</div>
								</div>
								<div className="flex gap-2">
									<button
										onClick={() => updateWorkspace({
											workspaceId: selectedData.workspaceId,
											status: selectedData.status === "active" ? "paused" : "active",
										})}
										className="flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded border border-slate-700 text-slate-400 hover:text-slate-200 transition"
									>
										{selectedData.status === "active" ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
										{selectedData.status === "active" ? "PAUSE" : "RESUME"}
									</button>
									<button
										onClick={() => { deleteWorkspace({ workspaceId: selectedData.workspaceId }); setSelectedWs(null); }}
										className="flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded border border-red-500/40 text-red-400 hover:bg-red-500/10 transition"
									>
										<Trash2 className="w-3 h-3" /> DELETE
									</button>
								</div>
							</div>

							<p className="text-sm text-slate-400 mb-6">{selectedData.description}</p>

							{/* Details grid */}
							<div className="grid grid-cols-3 gap-4 mb-6">
								<div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
									<div className="flex items-center gap-1.5 mb-2">
										<Users className="w-3.5 h-3.5 text-slate-500" />
										<span className="text-[9px] font-mono text-slate-500">MEMBERS</span>
									</div>
									<div className="text-lg font-mono font-bold text-blue-400">{selectedData.members.length}</div>
								</div>
								<div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
									<div className="flex items-center gap-1.5 mb-2">
										<MapIcon className="w-3.5 h-3.5 text-slate-500" />
										<span className="text-[9px] font-mono text-slate-500">LAYERS</span>
									</div>
									<div className="text-lg font-mono font-bold text-cyan-400">{selectedData.layers.length}</div>
								</div>
								<div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
									<div className="flex items-center gap-1.5 mb-2">
										<Clock className="w-3.5 h-3.5 text-slate-500" />
										<span className="text-[9px] font-mono text-slate-500">CREATED</span>
									</div>
									<div className="text-xs font-mono text-slate-300">{new Date(selectedData.createdAt).toLocaleDateString()}</div>
								</div>
							</div>

							{/* Active layers */}
							<div className="mb-6">
								<h3 className="text-[10px] font-mono text-slate-500 mb-2">ACTIVE LAYERS</h3>
								<div className="flex flex-wrap gap-2">
									{selectedData.layers.map((l) => (
										<span key={l} className="text-[10px] font-mono px-2 py-1 bg-blue-500/10 text-blue-300 rounded border border-blue-500/30">
											{l}
										</span>
									))}
								</div>
							</div>

							{/* Members */}
							<div>
								<h3 className="text-[10px] font-mono text-slate-500 mb-2">TEAM MEMBERS</h3>
								<div className="space-y-1">
									{selectedData.members.map((m) => (
										<div key={m} className="flex items-center gap-2 p-2 bg-slate-900/50 border border-slate-800 rounded">
											<div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-mono text-slate-300">
												{m[0].toUpperCase()}
											</div>
											<span className="text-xs font-mono text-slate-300">{m}</span>
											{m === selectedData.ownerId && (
												<span className="text-[9px] font-mono px-1 py-0.5 bg-amber-500/10 text-amber-400 rounded">OWNER</span>
											)}
										</div>
									))}
								</div>
							</div>
						</div>
					) : (
						<div className="flex items-center justify-center h-full text-slate-600">
							<div className="text-center">
								<Layers className="w-12 h-12 mx-auto mb-3 opacity-30" />
								<div className="text-sm font-mono">SELECT A WORKSPACE</div>
								<div className="text-xs text-slate-700 mt-1">or create a new mission workspace</div>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

export default WorkspaceManagerPage;
