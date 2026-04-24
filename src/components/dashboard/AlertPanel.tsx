import { useState } from "react";
import { useSystemAlerts, useNewsItems, useDataSourceStatus, useSocialPosts, useCyberIntel } from "../../hooks/useEntityData";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";

const TABS = ["ALERTS", "OSINT", "SOCIAL", "CYBER", "SOURCES"] as const;

export default function AlertPanel() {
	const [tab, setTab] = useState<typeof TABS[number]>("ALERTS");
	const alerts = useSystemAlerts();
	const news = useNewsItems();
	const sources = useDataSourceStatus();
	const social = useSocialPosts();
	const cyberIntel = useCyberIntel();
	const ackAlert = useMutation(api.entities.acknowledgeAlert);

	const unacked = alerts.filter((a) => !a.acknowledged);

	const severityColor = (sev: string) =>
		sev === "critical" ? "#ff2244" : sev === "high" ? "#ff6b00" : sev === "medium" ? "#ffaa00" : "#00d4ff";

	return (
		<div className="flex flex-col h-full">
			{/* Tabs */}
			<div className="flex border-b border-[rgba(0,204,255,0.1)]">
				{TABS.map((t) => (
					<button
						key={t}
						onClick={() => setTab(t)}
						className={`flex-1 py-1.5 text-[9px] font-mono tracking-[0.15em] transition-colors relative ${
							tab === t ? "text-[#00ccff] bg-[rgba(0,204,255,0.05)]" : "text-[#3a5a6c] hover:text-[#6a8ca0]"
						}`}
					>
						{t}
						{t === "ALERTS" && unacked.length > 0 && (
							<span className="absolute top-0.5 right-1 w-1.5 h-1.5 rounded-full bg-[#ff2244] animate-pulse" />
						)}
					</button>
				))}
			</div>

			{/* Content */}
			<div className="flex-1 overflow-y-auto p-2 space-y-1">
				{tab === "ALERTS" && unacked.map((a) => (
					<div
						key={a._id}
						className="p-2 rounded border-l-2 bg-[rgba(0,204,255,0.03)]"
						style={{ borderColor: severityColor(a.severity) }}
					>
						<div className="flex items-start justify-between">
							<div className="flex-1">
								<span className="text-[8px] font-mono tracking-wider" style={{ color: severityColor(a.severity) }}>
									{a.severity.toUpperCase()} — {a.source}
								</span>
								<div className="text-[10px] text-[#c8dce8] mt-0.5">{a.message}</div>
								<div className="text-[8px] text-[#3a5a6c] mt-0.5">{new Date(a.timestamp).toLocaleTimeString()}</div>
							</div>
							<button
								onClick={() => ackAlert({ id: a._id })}
								className="text-[8px] text-[#4a6a7c] hover:text-[#00ccff] shrink-0 ml-1"
							>
								ACK
							</button>
						</div>
					</div>
				))}
				{tab === "ALERTS" && unacked.length === 0 && (
					<div className="text-[10px] text-[#3a5a6c] font-mono py-4 text-center">ALL CLEAR</div>
				)}

				{tab === "OSINT" && news.map((n, i) => (
					<a
						key={i}
						href={n.url}
						target="_blank"
						rel="noopener noreferrer"
						className="block p-2 rounded hover:bg-[rgba(0,204,255,0.05)] transition-colors"
					>
						<div className="text-[10px] text-[#c8dce8] leading-tight">{n.title}</div>
						<div className="text-[8px] text-[#3a5a6c] mt-0.5">
							{n.sourceName} · {new Date(n.publishedAt).toLocaleTimeString()}
						</div>
					</a>
				))}

				{tab === "SOCIAL" && social.map((p, i) => (
					<a
						key={i}
						href={p.permalink}
						target="_blank"
						rel="noopener noreferrer"
						className="block p-2 rounded hover:bg-[rgba(255,68,170,0.05)] transition-colors"
					>
						<div className="flex items-center gap-1.5 mb-0.5">
							<span className="text-[8px] font-mono text-[#ff44aa]">r/{p.subreddit}</span>
							<span className="text-[8px] text-[#4a6a7c]">▲{p.score}</span>
							<span className="text-[8px] text-[#3a5a6c]">{p.numComments}💬</span>
						</div>
						<div className="text-[10px] text-[#c8dce8] leading-tight">{p.title}</div>
						<div className="text-[8px] text-[#3a5a6c] mt-0.5">u/{p.author}</div>
					</a>
				))}

				{tab === "CYBER" && cyberIntel.map((c, i) => (
					<div
						key={i}
						className="p-2 rounded border-l-2 bg-[rgba(102,255,204,0.02)]"
						style={{ borderColor: severityColor(c.severity) }}
					>
						<div className="flex items-center gap-1.5 mb-0.5">
							<span className="text-[8px] font-mono" style={{ color: severityColor(c.severity) }}>{c.severity.toUpperCase()}</span>
							<span className="text-[8px] text-[#3a5a6c]">{c.source}</span>
						</div>
						<div className="text-[10px] text-[#c8dce8] leading-tight">{c.title}</div>
						<div className="text-[9px] text-[#4a6a7c] mt-0.5">{c.description}</div>
						{c.sourceUrl && (
							<a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[8px] text-[#00ccff] mt-0.5 block hover:underline">
								Source →
							</a>
						)}
					</div>
				))}

				{tab === "SOURCES" && sources.map((s, i) => {
					const isLive = s.status === "live";
					return (
						<div key={i} className="flex items-center gap-2 p-1.5 rounded bg-[rgba(0,204,255,0.03)]">
							<span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isLive ? "bg-[#00ff88] animate-pulse" : s.status === "error" ? "bg-[#ff2244]" : "bg-[#ffaa00]"}`} />
							<div className="flex-1 min-w-0">
								<div className="text-[9px] font-mono text-[#c8dce8] truncate">{s.name}</div>
								<div className="text-[8px] text-[#3a5a6c]">
									{s.recordCount} records · {s.lastFetch ? new Date(s.lastFetch).toLocaleTimeString() : "never"}
								</div>
								{s.errorMessage && (
									<div className="text-[8px] text-[#ff4444] truncate">{s.errorMessage}</div>
								)}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
