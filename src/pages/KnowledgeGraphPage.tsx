// @ts-nocheck
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
	Network, Search, ZoomIn, ZoomOut, Maximize,
	Ship, Plane, Building, User, MapPin, Activity, X
} from "lucide-react";

const NODE_TYPE_CONFIG: Record<string, { icon: typeof User; color: string; label: string }> = {
	person: { icon: User, color: "#f59e0b", label: "Person" },
	organization: { icon: Building, color: "#8b5cf6", label: "Organization" },
	vessel: { icon: Ship, color: "#06b6d4", label: "Vessel" },
	aircraft: { icon: Plane, color: "#3b82f6", label: "Aircraft" },
	facility: { icon: Building, color: "#ef4444", label: "Facility" },
	event: { icon: Activity, color: "#f97316", label: "Event" },
	location: { icon: MapPin, color: "#22c55e", label: "Location" },
	network: { icon: Network, color: "#ec4899", label: "Network" },
};

const REL_COLORS: Record<string, string> = {
	owns: "#f59e0b",
	visited: "#22c55e",
	linked_to: "#8b5cf6",
	transmitted_to: "#06b6d4",
	observed_near: "#f97316",
	sanctioned_by: "#ef4444",
	operates: "#3b82f6",
	crewed_by: "#6366f1",
};

interface GraphNode {
	id: string;
	type: string;
	label: string;
	properties: Record<string, unknown>;
	riskScore?: number;
	x: number;
	y: number;
	vx: number;
	vy: number;
}

interface GraphEdge {
	id: string;
	source: string;
	target: string;
	relationship: string;
	confidence: number;
}

export function KnowledgeGraphPage() {
	const rawNodes = useQuery(api.knowledgeGraph.listNodes) ?? [];
	const rawEdges = useQuery(api.knowledgeGraph.listEdges) ?? [];
	const stats = useQuery(api.knowledgeGraph.getStats);
	const [selectedNode, setSelectedNode] = useState<string | null>(null);
	const [searchTerm, setSearchTerm] = useState("");
	const [filterType, setFilterType] = useState("all");
	const [zoom, setZoom] = useState(1);
	const [pan, setPan] = useState({ x: 0, y: 0 });
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const animRef = useRef<number>(0);
	const isDragging = useRef(false);
	const dragStart = useRef({ x: 0, y: 0 });
	const dragNode = useRef<string | null>(null);

	// Build graph data
	const { nodes, edges } = useMemo(() => {
		const filteredNodes = rawNodes.filter((n) => {
			if (filterType !== "all" && n.type !== filterType) return false;
			if (searchTerm && !n.label.toLowerCase().includes(searchTerm.toLowerCase())) return false;
			return true;
		});
		const nodeIds = new Set(filteredNodes.map((n) => n.nodeId));
		const gNodes: GraphNode[] = filteredNodes.map((n, i) => {
			const angle = (2 * Math.PI * i) / filteredNodes.length;
			const radius = 200 + Math.random() * 100;
			return {
				id: n.nodeId,
				type: n.type,
				label: n.label,
				properties: JSON.parse(n.properties || "{}"),
				riskScore: n.riskScore ?? undefined,
				x: 400 + Math.cos(angle) * radius,
				y: 300 + Math.sin(angle) * radius,
				vx: 0,
				vy: 0,
			};
		});
		const gEdges: GraphEdge[] = rawEdges
			.filter((e) => nodeIds.has(e.sourceNodeId) && nodeIds.has(e.targetNodeId))
			.map((e) => ({
				id: e.edgeId,
				source: e.sourceNodeId,
				target: e.targetNodeId,
				relationship: e.relationship,
				confidence: e.confidence,
			}));
		return { nodes: gNodes, edges: gEdges };
	}, [rawNodes, rawEdges, filterType, searchTerm]);

	// Force-directed layout
	const nodesRef = useRef<GraphNode[]>([]);
	useEffect(() => {
		nodesRef.current = nodes.map((n) => ({ ...n }));
	}, [nodes]);

	const simulate = useCallback(() => {
		const ns = nodesRef.current;
		if (ns.length === 0) return;

		// Center gravity
		const cx = 400, cy = 300;
		for (const n of ns) {
			n.vx += (cx - n.x) * 0.001;
			n.vy += (cy - n.y) * 0.001;
		}

		// Repulsion
		for (let i = 0; i < ns.length; i++) {
			for (let j = i + 1; j < ns.length; j++) {
				const dx = ns[j].x - ns[i].x;
				const dy = ns[j].y - ns[i].y;
				const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
				const force = 5000 / (dist * dist);
				const fx = (dx / dist) * force;
				const fy = (dy / dist) * force;
				ns[i].vx -= fx;
				ns[i].vy -= fy;
				ns[j].vx += fx;
				ns[j].vy += fy;
			}
		}

		// Spring (edges)
		for (const e of edges) {
			const s = ns.find((n) => n.id === e.source);
			const t = ns.find((n) => n.id === e.target);
			if (!s || !t) continue;
			const dx = t.x - s.x;
			const dy = t.y - s.y;
			const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
			const ideal = 150;
			const force = (dist - ideal) * 0.01;
			const fx = (dx / dist) * force;
			const fy = (dy / dist) * force;
			s.vx += fx;
			s.vy += fy;
			t.vx -= fx;
			t.vy -= fy;
		}

		// Damping & update
		for (const n of ns) {
			if (dragNode.current === n.id) continue;
			n.vx *= 0.85;
			n.vy *= 0.85;
			n.x += n.vx;
			n.y += n.vy;
		}
	}, [edges]);

	// Canvas rendering
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const render = () => {
			simulate();
			const ns = nodesRef.current;
			const w = canvas.width;
			const h = canvas.height;

			ctx.clearRect(0, 0, w, h);
			ctx.save();
			ctx.translate(pan.x + w / 2, pan.y + h / 2);
			ctx.scale(zoom, zoom);
			ctx.translate(-w / 2, -h / 2);

			// Draw edges
			for (const e of edges) {
				const s = ns.find((n) => n.id === e.source);
				const t = ns.find((n) => n.id === e.target);
				if (!s || !t) continue;
				ctx.beginPath();
				ctx.moveTo(s.x, s.y);
				ctx.lineTo(t.x, t.y);
				ctx.strokeStyle = (REL_COLORS[e.relationship] ?? "#475569") + "80";
				ctx.lineWidth = Math.max(0.5, e.confidence * 2);
				ctx.stroke();

				// Arrow
				const angle = Math.atan2(t.y - s.y, t.x - s.x);
				const midX = (s.x + t.x) / 2;
				const midY = (s.y + t.y) / 2;
				ctx.beginPath();
				ctx.moveTo(midX + Math.cos(angle) * 8, midY + Math.sin(angle) * 8);
				ctx.lineTo(midX + Math.cos(angle + 2.5) * 5, midY + Math.sin(angle + 2.5) * 5);
				ctx.lineTo(midX + Math.cos(angle - 2.5) * 5, midY + Math.sin(angle - 2.5) * 5);
				ctx.fillStyle = REL_COLORS[e.relationship] ?? "#475569";
				ctx.fill();

				// Edge label
				ctx.fillStyle = "#64748b";
				ctx.font = "8px monospace";
				ctx.textAlign = "center";
				ctx.fillText(e.relationship, midX, midY - 6);
			}

			// Draw nodes
			for (const n of ns) {
				const cfg = NODE_TYPE_CONFIG[n.type] ?? { color: "#64748b" };
				const isSelected = selectedNode === n.id;
				const radius = isSelected ? 22 : 18;

				// Glow for selected / high risk
				if (isSelected || (n.riskScore && n.riskScore > 80)) {
					ctx.beginPath();
					ctx.arc(n.x, n.y, radius + 6, 0, Math.PI * 2);
					ctx.fillStyle = (isSelected ? "#06b6d4" : "#ef4444") + "20";
					ctx.fill();
				}

				// Node circle
				ctx.beginPath();
				ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
				ctx.fillStyle = cfg.color + "30";
				ctx.fill();
				ctx.strokeStyle = isSelected ? "#06b6d4" : cfg.color;
				ctx.lineWidth = isSelected ? 2.5 : 1.5;
				ctx.stroke();

				// Icon letter
				ctx.fillStyle = cfg.color;
				ctx.font = "bold 12px monospace";
				ctx.textAlign = "center";
				ctx.textBaseline = "middle";
				ctx.fillText(n.type[0].toUpperCase(), n.x, n.y);

				// Label
				ctx.fillStyle = "#e2e8f0";
				ctx.font = "10px monospace";
				ctx.textBaseline = "top";
				ctx.fillText(n.label.length > 20 ? n.label.slice(0, 18) + "…" : n.label, n.x, n.y + radius + 4);

				// Risk badge
				if (n.riskScore !== undefined) {
					const riskColor = n.riskScore > 80 ? "#ef4444" : n.riskScore > 60 ? "#f59e0b" : "#22c55e";
					ctx.fillStyle = riskColor;
					ctx.font = "bold 8px monospace";
					ctx.textAlign = "right";
					ctx.textBaseline = "bottom";
					ctx.fillText(`${n.riskScore}`, n.x + radius, n.y - radius + 2);
				}
			}

			ctx.restore();
			animRef.current = requestAnimationFrame(render);
		};

		animRef.current = requestAnimationFrame(render);
		return () => cancelAnimationFrame(animRef.current);
	}, [edges, zoom, pan, simulate, selectedNode]);

	// Resize canvas
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const resize = () => {
			const parent = canvas.parentElement;
			if (parent) {
				canvas.width = parent.clientWidth;
				canvas.height = parent.clientHeight;
			}
		};
		resize();
		window.addEventListener("resize", resize);
		return () => window.removeEventListener("resize", resize);
	}, []);

	// Mouse interactions
	const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const rect = canvas.getBoundingClientRect();
		const mx = (e.clientX - rect.left - pan.x - canvas.width / 2) / zoom + canvas.width / 2;
		const my = (e.clientY - rect.top - pan.y - canvas.height / 2) / zoom + canvas.height / 2;

		// Check if clicking a node
		const ns = nodesRef.current;
		for (const n of ns) {
			const dx = mx - n.x;
			const dy = my - n.y;
			if (dx * dx + dy * dy < 400) {
				setSelectedNode(n.id);
				dragNode.current = n.id;
				return;
			}
		}
		isDragging.current = true;
		dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
	};

	const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
		if (dragNode.current) {
			const canvas = canvasRef.current;
			if (!canvas) return;
			const rect = canvas.getBoundingClientRect();
			const mx = (e.clientX - rect.left - pan.x - canvas.width / 2) / zoom + canvas.width / 2;
			const my = (e.clientY - rect.top - pan.y - canvas.height / 2) / zoom + canvas.height / 2;
			const ns = nodesRef.current;
			const node = ns.find((n) => n.id === dragNode.current);
			if (node) {
				node.x = mx;
				node.y = my;
				node.vx = 0;
				node.vy = 0;
			}
		} else if (isDragging.current) {
			setPan({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
		}
	};

	const handleMouseUp = () => {
		isDragging.current = false;
		dragNode.current = null;
	};

	const handleWheel = (e: React.WheelEvent) => {
		e.preventDefault();
		setZoom((z) => Math.max(0.3, Math.min(3, z - e.deltaY * 0.001)));
	};

	const selectedNodeData = selectedNode ? rawNodes.find((n) => n.nodeId === selectedNode) : null;
	const selectedEdges = selectedNode ? rawEdges.filter((e) => e.sourceNodeId === selectedNode || e.targetNodeId === selectedNode) : [];

	return (
		<div className="min-h-screen bg-slate-950 text-slate-100">
			{/* Header */}
			<div className="border-b border-slate-800 bg-slate-950/95 backdrop-blur sticky top-0 z-30">
				<div className="flex items-center justify-between px-6 h-14">
					<div className="flex items-center gap-3">
						<Network className="w-5 h-5 text-purple-400" />
						<span className="font-mono text-sm font-semibold tracking-wider text-purple-400">KNOWLEDGE GRAPH</span>
						{stats && (
							<span className="text-[10px] font-mono text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
								{stats.totalNodes} NODES · {stats.totalEdges} EDGES
							</span>
						)}
					</div>
					<div className="flex items-center gap-2">
						<div className="relative">
							<Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-500" />
							<input
								type="text"
								placeholder="Search graph..."
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								className="pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-slate-300 focus:border-purple-500 focus:outline-none w-48"
							/>
						</div>
						<select
							value={filterType}
							onChange={(e) => setFilterType(e.target.value)}
							className="px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-[10px] font-mono text-slate-400 focus:outline-none"
						>
							<option value="all">ALL TYPES</option>
							{Object.entries(NODE_TYPE_CONFIG).map(([k, v]) => (
								<option key={k} value={k}>{v.label.toUpperCase()}</option>
							))}
						</select>
					</div>
				</div>
			</div>

			<div className="flex h-[calc(100vh-3.5rem)]">
				{/* Graph canvas */}
				<div className="flex-1 relative">
					<canvas
						ref={canvasRef}
						onMouseDown={handleMouseDown}
						onMouseMove={handleMouseMove}
						onMouseUp={handleMouseUp}
						onMouseLeave={handleMouseUp}
						onWheel={handleWheel}
						className="w-full h-full cursor-grab active:cursor-grabbing"
					/>
					{/* Zoom controls */}
					<div className="absolute bottom-4 left-4 flex flex-col gap-1">
						<button onClick={() => setZoom((z) => Math.min(3, z + 0.2))} className="w-8 h-8 bg-slate-900 border border-slate-700 rounded flex items-center justify-center text-slate-400 hover:text-slate-200">
							<ZoomIn className="w-4 h-4" />
						</button>
						<button onClick={() => setZoom((z) => Math.max(0.3, z - 0.2))} className="w-8 h-8 bg-slate-900 border border-slate-700 rounded flex items-center justify-center text-slate-400 hover:text-slate-200">
							<ZoomOut className="w-4 h-4" />
						</button>
						<button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="w-8 h-8 bg-slate-900 border border-slate-700 rounded flex items-center justify-center text-slate-400 hover:text-slate-200">
							<Maximize className="w-4 h-4" />
						</button>
					</div>

					{/* Legend */}
					<div className="absolute top-4 left-4 bg-slate-900/90 border border-slate-800 rounded p-3">
						<div className="text-[9px] font-mono text-slate-500 mb-2">NODE TYPES</div>
						<div className="space-y-1">
							{Object.entries(NODE_TYPE_CONFIG).map(([k, v]) => (
								<div key={k} className="flex items-center gap-2 text-[10px]">
									<div className="w-3 h-3 rounded-full" style={{ background: v.color + "40", border: `1.5px solid ${v.color}` }} />
									<span className="font-mono text-slate-400">{v.label}</span>
								</div>
							))}
						</div>
					</div>
				</div>

				{/* Right panel — node detail */}
				{selectedNodeData && (
					<div className="w-[360px] border-l border-slate-800 overflow-y-auto">
						<div className="p-4">
							<div className="flex items-center justify-between mb-4">
								<div className="flex items-center gap-2">
									<div
										className="w-8 h-8 rounded-full flex items-center justify-center"
										style={{ background: (NODE_TYPE_CONFIG[selectedNodeData.type]?.color ?? "#64748b") + "30" }}
									>
										<span className="text-sm font-bold" style={{ color: NODE_TYPE_CONFIG[selectedNodeData.type]?.color }}>
											{selectedNodeData.type[0].toUpperCase()}
										</span>
									</div>
									<div>
										<div className="text-sm font-semibold text-slate-200">{selectedNodeData.label}</div>
										<div className="text-[10px] font-mono text-slate-500">{selectedNodeData.type.toUpperCase()} · {selectedNodeData.nodeId}</div>
									</div>
								</div>
								<button onClick={() => setSelectedNode(null)} className="text-slate-500 hover:text-slate-300">
									<X className="w-4 h-4" />
								</button>
							</div>

							{/* Risk score */}
							{selectedNodeData.riskScore !== undefined && (
								<div className="mb-4 p-3 bg-slate-900/50 border border-slate-800 rounded">
									<div className="text-[9px] font-mono text-slate-500 mb-1">RISK SCORE</div>
									<div className="flex items-center gap-2">
										<div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
											<div
												className="h-full rounded-full transition-all"
												style={{
													width: `${selectedNodeData.riskScore}%`,
													background: selectedNodeData.riskScore > 80 ? "#ef4444" : selectedNodeData.riskScore > 60 ? "#f59e0b" : "#22c55e",
												}}
											/>
										</div>
										<span className="text-sm font-mono font-bold" style={{
											color: selectedNodeData.riskScore > 80 ? "#ef4444" : selectedNodeData.riskScore > 60 ? "#f59e0b" : "#22c55e",
										}}>
											{selectedNodeData.riskScore}
										</span>
									</div>
								</div>
							)}

							{/* Properties */}
							<div className="mb-4">
								<div className="text-[9px] font-mono text-slate-500 mb-2">PROPERTIES</div>
								<div className="space-y-1.5">
									{Object.entries(JSON.parse(selectedNodeData.properties || "{}")).map(([k, v]) => (
										<div key={k} className="flex justify-between text-xs bg-slate-900/50 px-2 py-1 rounded">
											<span className="font-mono text-slate-500">{k}</span>
											<span className="text-slate-300 text-right max-w-[180px] truncate">
												{typeof v === "object" ? JSON.stringify(v) : String(v)}
											</span>
										</div>
									))}
								</div>
							</div>

							{/* Connected edges */}
							<div>
								<div className="text-[9px] font-mono text-slate-500 mb-2">RELATIONSHIPS ({selectedEdges.length})</div>
								<div className="space-y-1.5">
									{selectedEdges.map((e) => {
										const isSource = e.sourceNodeId === selectedNode;
										const otherNodeId = isSource ? e.targetNodeId : e.sourceNodeId;
										const otherNode = rawNodes.find((n) => n.nodeId === otherNodeId);
										return (
											<button
												key={e.edgeId}
												onClick={() => setSelectedNode(otherNodeId)}
												className="w-full text-left flex items-center gap-2 p-2 bg-slate-900/50 border border-slate-800 rounded hover:bg-slate-800/50 transition"
											>
												<div
													className="w-2 h-2 rounded-full"
													style={{ background: REL_COLORS[e.relationship] ?? "#475569" }}
												/>
												<div className="flex-1 min-w-0">
													<div className="text-[10px] font-mono" style={{ color: REL_COLORS[e.relationship] ?? "#475569" }}>
														{isSource ? "→" : "←"} {e.relationship.toUpperCase()}
													</div>
													<div className="text-xs text-slate-300 truncate">{otherNode?.label ?? otherNodeId}</div>
												</div>
												<div className="text-[9px] font-mono text-slate-600">{Math.round(e.confidence * 100)}%</div>
											</button>
										);
									})}
								</div>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

export default KnowledgeGraphPage;
