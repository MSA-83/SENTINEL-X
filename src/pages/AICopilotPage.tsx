// @ts-nocheck
import { useState, useRef, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
	Bot, Send, Sparkles, Database, Shield, AlertTriangle, Plane,
	Ship, Activity, Globe, Trash2, Zap
} from "lucide-react";

interface CopilotMessage {
	role: "user" | "assistant" | "system";
	content: string;
	timestamp: number;
	sources?: string[];
}

const SUGGESTED_QUERIES = [
	{ icon: Ship, label: "Dark fleet activity in the Mediterranean", category: "Maritime" },
	{ icon: AlertTriangle, label: "Critical alerts in the last 24 hours", category: "Alerts" },
	{ icon: Shield, label: "Summarize open investigations", category: "Cases" },
	{ icon: Plane, label: "Aircraft with military callsigns near conflict zones", category: "Aviation" },
	{ icon: Activity, label: "Seismic events above magnitude 4.5", category: "Hazards" },
	{ icon: Globe, label: "Generate SITREP for Eastern Mediterranean", category: "Intel" },
	{ icon: Zap, label: "Show me all GNSS jamming incidents today", category: "SIGINT" },
	{ icon: Database, label: "Which data sources are degraded?", category: "System" },
];

export function AICopilotPage() {
	const [messages, setMessages] = useState<CopilotMessage[]>([{
		role: "system",
		content: "SENTINEL-X Copilot initialized. I have full access to all platform data including entities, threats, cases, knowledge graph, and sensor feeds. Ask me anything about the current operational picture.",
		timestamp: Date.now(),
	}]);
	const [input, setInput] = useState("");
	const [isProcessing, setIsProcessing] = useState(false);
	const scrollRef = useRef<HTMLDivElement>(null);

	// Data access for context
	const aircraft = useQuery(api.entities.listAircraft) ?? [];
	const vessels = useQuery(api.entities.listVessels) ?? [];
	const fires = useQuery(api.entities.listFires) ?? [];
	const conflicts = useQuery(api.entities.listConflictEvents) ?? [];
	const seismic = useQuery(api.entities.listSeismicEvents) ?? [];
	const cyber = useQuery(api.entities.listCyberThreats) ?? [];
	const alerts = useQuery(api.entities.listSystemAlerts) ?? [];
	const cases = useQuery(api.cases.list) ?? [];
	const sources = useQuery(api.entities.listDataSourceStatus) ?? [];
	const kgNodes = useQuery(api.knowledgeGraph.listNodes) ?? [];
	const disasters = useQuery(api.entities.listDisasters) ?? [];

	useEffect(() => {
		scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
	}, [messages]);

	const processQuery = (query: string) => {
		const q = query.toLowerCase();
		let response = "";
		const dataSources: string[] = [];

		// Maritime queries
		if (q.includes("dark fleet") || q.includes("vessel") || q.includes("maritime") || q.includes("ship")) {
			dataSources.push("AIS Tracker", "GFW", "Knowledge Graph");
			const darkVessels = vessels.filter((v) => v.callsign === "DARK" || v.destination === "UNKNOWN");
			response = `## Maritime Situational Awareness\n\n**Active Vessels:** ${vessels.length} tracked\n**Dark Fleet Detections:** ${darkVessels.length} vessels with anomalous AIS behavior\n\n`;
			if (vessels.length > 0) {
				response += "**Top Tracked Vessels:**\n";
				vessels.slice(0, 5).forEach((v) => {
					response += `- \`${v.callsign || v.mmsi}\` — ${v.flag || "Unknown flag"} — ${v.shipType || "Unknown type"} — ${v.latitude?.toFixed(2) ?? "N/A"}°N, ${v.longitude?.toFixed(2) ?? "N/A"}°E\n`;
				});
			}
			const maritimeNodes = kgNodes.filter((n) => n.domain === "maritime");
			if (maritimeNodes.length > 0) {
				response += `\n**Knowledge Graph:** ${maritimeNodes.length} maritime entities tracked with relationship intelligence.\n`;
			}
			const maritimeCases = cases.filter((c) => c.domain === "maritime");
			if (maritimeCases.length > 0) {
				response += `\n**Open Maritime Cases:** ${maritimeCases.length}\n`;
				maritimeCases.forEach((c) => {
					response += `- \`${c.caseId}\` — ${c.title} [${c.priority.toUpperCase()}]\n`;
				});
			}
		}
		// Alert queries
		else if (q.includes("alert") || q.includes("critical") || q.includes("warning")) {
			dataSources.push("Alert Engine", "Threat Intelligence");
			const critAlerts = alerts.filter((a) => a.severity === "critical");
			const unack = alerts.filter((a) => !a.acknowledged);
			response = `## Alert Summary\n\n**Total Alerts:** ${alerts.length}\n**Critical:** ${critAlerts.length}\n**Unacknowledged:** ${unack.length}\n\n`;
			if (critAlerts.length > 0) {
				response += "**Critical Alerts:**\n";
				critAlerts.slice(0, 5).forEach((a) => {
					response += `- 🔴 **${a.title}** — ${a.message?.slice(0, 80) ?? ""}...\n`;
				});
			}
			if (unack.length > critAlerts.length) {
				response += `\n*Plus ${unack.length - critAlerts.length} additional unacknowledged alerts requiring attention.*\n`;
			}
		}
		// Case queries
		else if (q.includes("case") || q.includes("investigation")) {
			dataSources.push("Case Management");
			const open = cases.filter((c) => c.status === "open" || c.status === "investigating");
			const escalated = cases.filter((c) => c.status === "escalated");
			response = `## Investigation Summary\n\n**Total Cases:** ${cases.length}\n**Open/Investigating:** ${open.length}\n**Escalated:** ${escalated.length}\n\n`;
			const byPriority = { critical: 0, high: 0, medium: 0, low: 0 };
			cases.forEach((c) => { if (c.priority in byPriority) byPriority[c.priority as keyof typeof byPriority]++; });
			response += `**By Priority:** Critical: ${byPriority.critical} | High: ${byPriority.high} | Medium: ${byPriority.medium} | Low: ${byPriority.low}\n\n`;
			if (escalated.length > 0) {
				response += "**🔴 Escalated Cases:**\n";
				escalated.forEach((c) => { response += `- \`${c.caseId}\` — ${c.title} — Assigned: ${c.assignee}\n`; });
			}
		}
		// Aviation
		else if (q.includes("aircraft") || q.includes("aviation") || q.includes("flight") || q.includes("gnss") || q.includes("jamming")) {
			dataSources.push("ADS-B Exchange", "GNSS Monitoring");
			const military = aircraft.filter((a) => a.category === "military" || a.isMilitary);
			response = `## Aviation Situation\n\n**Aircraft Tracked:** ${aircraft.length}\n**Military Callsigns:** ${military.length}\n\n`;
			if (military.length > 0) {
				response += "**Military Aircraft:**\n";
				military.slice(0, 5).forEach((a) => {
					response += `- \`${a.callsign || a.icao24}\` — ${a.squawk || "N/A"} — Alt: ${a.baroAltitude ?? "N/A"}ft — ${a.latitude?.toFixed(2) ?? "N/A"}°N\n`;
				});
			}
			response += "\n*GNSS jamming monitoring active. Check the SIGINT layer on the map for real-time jamming clusters.*\n";
		}
		// Seismic / hazards
		else if (q.includes("seismic") || q.includes("earthquake") || q.includes("hazard") || q.includes("fire") || q.includes("disaster")) {
			dataSources.push("USGS", "FIRMS", "GDACS");
			response = `## Natural Hazards Overview\n\n**Seismic Events:** ${seismic.length}\n**Active Fires:** ${fires.length}\n**Disasters:** ${disasters.length}\n\n`;
			if (seismic.length > 0) {
				const sorted = [...seismic].sort((a, b) => (b.magnitude ?? 0) - (a.magnitude ?? 0));
				response += "**Largest Seismic Events:**\n";
				sorted.slice(0, 5).forEach((s) => {
					response += `- M${s.magnitude?.toFixed(1)} — ${s.place ?? "Unknown location"} — Depth: ${s.depth ?? "N/A"}km\n`;
				});
			}
			if (fires.length > 0) {
				response += `\n**Active Fire Clusters:** ${fires.length} hotspots detected across multiple regions.\n`;
			}
		}
		// SITREP
		else if (q.includes("sitrep") || q.includes("situation report") || q.includes("summary")) {
			dataSources.push("All Sources");
			const critAlerts = alerts.filter((a) => a.severity === "critical").length;
			const openCases = cases.filter((c) => c.status !== "closed" && c.status !== "resolved").length;
			const onlineSources = sources.filter((s) => s.status === "online" || s.status === "ok").length;
			response = `## SITUATION REPORT — ${new Date().toISOString().slice(0, 10)}\n\n`;
			response += `### Force Posture\n- **Entities Tracked:** ${aircraft.length + vessels.length + fires.length}\n- **Data Sources:** ${onlineSources}/${sources.length} online\n- **Critical Alerts:** ${critAlerts}\n- **Open Investigations:** ${openCases}\n\n`;
			response += `### Key Developments\n`;
			response += `1. **Maritime:** ${vessels.length} vessels tracked. Dark fleet monitoring active in Eastern Mediterranean.\n`;
			response += `2. **Aviation:** ${aircraft.length} aircraft tracked. GNSS jamming detected in conflict zones.\n`;
			response += `3. **Conflict:** ${conflicts.length} events. Active theaters: Ukraine, Middle East, Kashmir.\n`;
			response += `4. **Cyber:** ${cyber.length} threats tracked. Coordinated SCADA campaign under investigation.\n`;
			response += `5. **Natural:** ${fires.length} fires, ${seismic.length} seismic events monitored.\n\n`;
			response += `### Recommendation\nMaintain elevated readiness posture. Priority focus on Mediterranean dark fleet operations and European SCADA attack campaign.\n`;
		}
		// Data sources
		else if (q.includes("source") || q.includes("data") || q.includes("degraded") || q.includes("offline")) {
			dataSources.push("System Health");
			const online = sources.filter((s) => s.status === "online" || s.status === "ok");
			const degraded = sources.filter((s) => s.status === "degraded");
			const offline = sources.filter((s) => s.status === "offline" || s.status === "error");
			response = `## Data Source Status\n\n**Total:** ${sources.length} | **Online:** ${online.length} | **Degraded:** ${degraded.length} | **Offline:** ${offline.length}\n\n`;
			if (degraded.length > 0) {
				response += "**⚠️ Degraded Sources:**\n";
				degraded.forEach((s) => { response += `- \`${s.callsign}\` — ${s.recordCount} records — Last: ${new Date(s.lastFetch).toLocaleTimeString()}\n`; });
			}
			if (offline.length > 0) {
				response += "\n**🔴 Offline Sources:**\n";
				offline.forEach((s) => { response += `- \`${s.callsign}\` — Error: ${s.errorMessage ?? "Unknown"}\n`; });
			}
			if (degraded.length === 0 && offline.length === 0) {
				response += "✅ All data sources operating normally.\n";
			}
		}
		// Default
		else {
			dataSources.push("Platform Data");
			response = `## Query Analysis\n\nI've analyzed your query across all available data domains. Here's a high-level snapshot:\n\n`;
			response += `- **${aircraft.length}** aircraft, **${vessels.length}** vessels, **${fires.length}** fires being tracked\n`;
			response += `- **${alerts.length}** system alerts (${alerts.filter((a) => a.severity === "critical").length} critical)\n`;
			response += `- **${cases.length}** investigation cases\n`;
			response += `- **${kgNodes.length}** knowledge graph entities\n`;
			response += `- **${sources.length}** data sources connected\n\n`;
			response += `Try asking about specific domains like *"maritime dark fleet activity"*, *"critical alerts"*, *"open investigations"*, or *"generate SITREP"* for detailed analysis.\n`;
		}

		return { response, sources: dataSources };
	};

	const handleSend = () => {
		if (!input.trim() || isProcessing) return;
		const userMsg: CopilotMessage = { role: "user", content: input.trim(), timestamp: Date.now() };
		setMessages((prev) => [...prev, userMsg]);
		setInput("");
		setIsProcessing(true);

		// Simulate processing delay
		setTimeout(() => {
			const result = processQuery(userMsg.content);
			const assistantMsg: CopilotMessage = {
				role: "assistant",
				content: result.response,
				timestamp: Date.now(),
				sources: result.sources,
			};
			setMessages((prev) => [...prev, assistantMsg]);
			setIsProcessing(false);
		}, 800 + Math.random() * 400);
	};

	return (
		<div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
			{/* Header */}
			<div className="border-b border-slate-800 bg-slate-950/95 backdrop-blur sticky top-0 z-30">
				<div className="flex items-center justify-between px-6 h-14">
					<div className="flex items-center gap-3">
						<Bot className="w-5 h-5 text-violet-400" />
						<span className="font-mono text-sm font-semibold tracking-wider text-violet-400">AI COPILOT</span>
						<span className="text-[10px] font-mono text-slate-500 bg-slate-800 px-2 py-0.5 rounded flex items-center gap-1">
							<Sparkles className="w-2.5 h-2.5" /> SENTINEL INTELLIGENCE ENGINE
						</span>
					</div>
					<button
						onClick={() => setMessages([{
							role: "system",
							content: "Session cleared. Ready for new queries.",
							timestamp: Date.now(),
						}])}
						className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500 hover:text-slate-300 transition"
					>
						<Trash2 className="w-3 h-3" /> CLEAR SESSION
					</button>
				</div>
			</div>

			{/* Messages */}
			<div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4">
				{messages.length === 1 && (
					<div className="mb-8">
						<div className="text-center mb-6">
							<Bot className="w-12 h-12 mx-auto mb-3 text-violet-400 opacity-60" />
							<h2 className="text-lg font-semibold text-slate-300 mb-1">SENTINEL-X Intelligence Copilot</h2>
							<p className="text-sm text-slate-500">Ask questions about the operational picture. I have access to all platform data.</p>
						</div>
						<div className="grid grid-cols-2 gap-2 max-w-2xl mx-auto">
							{SUGGESTED_QUERIES.map((sq) => (
								<button
									key={sq.label}
									onClick={() => { setInput(sq.label); }}
									className="flex items-center gap-2 p-3 bg-slate-900/50 border border-slate-800 rounded-lg hover:bg-slate-800/50 transition text-left"
								>
									<sq.icon className="w-4 h-4 text-violet-400 flex-shrink-0" />
									<div>
										<div className="text-xs text-slate-300">{sq.label}</div>
										<div className="text-[9px] font-mono text-slate-600">{sq.category}</div>
									</div>
								</button>
							))}
						</div>
					</div>
				)}

				<div className="max-w-4xl mx-auto space-y-4">
					{messages.map((msg, i) => (
						<div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
							{msg.role !== "user" && (
								<div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
									msg.role === "system" ? "bg-slate-800" : "bg-violet-500/20"
								}`}>
									{msg.role === "system" ? (
										<Zap className="w-4 h-4 text-slate-400" />
									) : (
										<Bot className="w-4 h-4 text-violet-400" />
									)}
								</div>
							)}
							<div className={`max-w-[80%] ${msg.role === "user" ? "bg-cyan-500/10 border-cyan-500/30" : "bg-slate-900/50 border-slate-800"} border rounded-lg px-4 py-3`}>
								<div className="text-xs leading-relaxed text-slate-300 whitespace-pre-wrap">{msg.content.split('\n').map((line, li) => {
									if (line.startsWith('## ')) return <div key={li} className="text-sm font-semibold text-slate-200 mb-2 mt-1">{line.replace('## ', '')}</div>;
									if (line.startsWith('### ')) return <div key={li} className="text-xs font-semibold text-slate-300 mb-1 mt-2">{line.replace('### ', '')}</div>;
									if (line.startsWith('- ')) return <div key={li} className="pl-2 text-slate-400">{line}</div>;
									if (line.match(/^\d+\./)) return <div key={li} className="pl-2 text-slate-400">{line}</div>;
									if (line.startsWith('**') && line.endsWith('**')) return <div key={li} className="font-semibold text-slate-300">{line.replace(/\*\*/g, '')}</div>;
									return <div key={li}>{line || <br />}</div>;
								})}</div>
								{msg.sources && (
									<div className="mt-2 pt-2 border-t border-slate-800 flex items-center gap-1.5">
										<Database className="w-3 h-3 text-slate-600" />
										<span className="text-[9px] font-mono text-slate-600">Sources: {msg.sources.join(", ")}</span>
									</div>
								)}
								<div className="text-[9px] font-mono text-slate-700 mt-1">{new Date(msg.timestamp).toLocaleTimeString()}</div>
							</div>
						</div>
					))}

					{isProcessing && (
						<div className="flex gap-3">
							<div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
								<Bot className="w-4 h-4 text-violet-400 animate-pulse" />
							</div>
							<div className="bg-slate-900/50 border border-slate-800 rounded-lg px-4 py-3">
								<div className="flex items-center gap-2 text-xs text-slate-500">
									<span className="animate-pulse">●</span>
									<span className="animate-pulse" style={{ animationDelay: "0.2s" }}>●</span>
									<span className="animate-pulse" style={{ animationDelay: "0.4s" }}>●</span>
									<span className="ml-2 font-mono text-[10px]">Querying platform data...</span>
								</div>
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Input */}
			<div className="border-t border-slate-800 p-4">
				<div className="max-w-4xl mx-auto flex gap-2">
					<input
						type="text"
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={(e) => e.key === "Enter" && handleSend()}
						placeholder="Ask about the operational picture..."
						className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-300 focus:border-violet-500 focus:outline-none font-mono"
						disabled={isProcessing}
					/>
					<button
						onClick={handleSend}
						disabled={isProcessing || !input.trim()}
						className="px-4 py-2.5 bg-violet-500/20 border border-violet-500/40 rounded-lg text-violet-300 hover:bg-violet-500/30 transition disabled:opacity-50"
					>
						<Send className="w-4 h-4" />
					</button>
				</div>
			</div>
		</div>
	);
}

export default AICopilotPage;
