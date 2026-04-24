import { useState, useCallback } from "react";

export interface WatchlistItem {
	id: string;
	type: string;
	label: string;
	lat?: number;
	lon?: number;
	addedAt: number;
	notes: string;
	meta?: Record<string, unknown>;
}

const LS_KEY = "sentinel-x-watchlist";

function loadWatchlist(): WatchlistItem[] {
	try {
		const raw = localStorage.getItem(LS_KEY);
		return raw ? JSON.parse(raw) : [];
	} catch {
		return [];
	}
}
function saveWatchlist(items: WatchlistItem[]) {
	localStorage.setItem(LS_KEY, JSON.stringify(items));
}

/** Hook for watchlist state — use from CommandCenter */
export function useWatchlist() {
	const [items, setItems] = useState<WatchlistItem[]>(loadWatchlist);

	const addItem = useCallback((item: Omit<WatchlistItem, "addedAt">) => {
		setItems((prev) => {
			if (prev.some((p) => p.id === item.id)) return prev;
			const next = [...prev, { ...item, addedAt: Date.now() }];
			saveWatchlist(next);
			return next;
		});
	}, []);

	const removeItem = useCallback((id: string) => {
		setItems((prev) => {
			const next = prev.filter((p) => p.id !== id);
			saveWatchlist(next);
			return next;
		});
	}, []);

	const updateNotes = useCallback((id: string, notes: string) => {
		setItems((prev) => {
			const next = prev.map((p) => (p.id === id ? { ...p, notes } : p));
			saveWatchlist(next);
			return next;
		});
	}, []);

	const clearAll = useCallback(() => {
		setItems([]);
		saveWatchlist([]);
	}, []);

	return { items, addItem, removeItem, updateNotes, clearAll };
}

/* ═══════════════════════════════════ TYPES ═══════════════════════════════════ */
const TYPE_COLORS: Record<string, string> = {
	aircraft: "#22d3ee",
	vessel: "#3b82f6",
	conflict: "#ef4444",
	fire: "#f97316",
	seismic: "#eab308",
	disaster: "#a855f7",
	cyber: "#10b981",
	jamming: "#f43f5e",
	satellite: "#6366f1",
	weather: "#64748b",
	iss: "#e879f9",
	gdelt: "#818cf8",
	social: "#fb923c",
	news: "#94a3b8",
};

const TYPE_ICONS: Record<string, string> = {
	aircraft: "✈",
	vessel: "🚢",
	conflict: "💥",
	fire: "🔥",
	seismic: "🌍",
	disaster: "⚠",
	cyber: "🛡",
	jamming: "📡",
	satellite: "🛰",
	weather: "🌤",
	iss: "🚀",
	gdelt: "📰",
	social: "💬",
	news: "📄",
};

/* ═══════════════════════════════════ PANEL ═══════════════════════════════════ */
interface WatchlistPanelProps {
	items: WatchlistItem[];
	onRemove: (id: string) => void;
	onUpdateNotes: (id: string, notes: string) => void;
	onClear: () => void;
	onFlyTo?: (lat: number, lon: number) => void;
}

export default function WatchlistPanel({ items, onRemove, onUpdateNotes, onClear, onFlyTo }: WatchlistPanelProps) {
	const [editId, setEditId] = useState<string | null>(null);
	const [editText, setEditText] = useState("");
	const [sortBy, setSortBy] = useState<"time" | "type">("time");

	const sorted = [...items].sort((a, b) =>
		sortBy === "time" ? b.addedAt - a.addedAt : a.type.localeCompare(b.type)
	);

	const startEdit = (item: WatchlistItem) => {
		setEditId(item.id);
		setEditText(item.notes);
	};

	const saveEdit = () => {
		if (editId) onUpdateNotes(editId, editText);
		setEditId(null);
	};

	return (
		<div className="p-3 h-full flex flex-col overflow-hidden">
			{/* Header */}
			<div className="flex items-center justify-between mb-3 shrink-0">
				<div className="flex items-center gap-2">
					<span className="text-[10px] font-mono font-bold text-cyan-400 tracking-widest">WATCHLIST</span>
					<span className="text-[8px] font-mono text-slate-500 bg-slate-800/60 rounded px-1.5 py-0.5">{items.length}</span>
				</div>
				<div className="flex items-center gap-1">
					<button
						type="button"
						onClick={() => setSortBy(sortBy === "time" ? "type" : "time")}
						className="text-[8px] font-mono text-slate-500 hover:text-cyan-400 transition-colors px-1.5 py-0.5 border border-slate-700/40 rounded"
					>
						{sortBy === "time" ? "⏱ TIME" : "◉ TYPE"}
					</button>
					{items.length > 0 && (
						<button
							type="button"
							onClick={onClear}
							className="text-[8px] font-mono text-red-500/60 hover:text-red-400 transition-colors px-1.5 py-0.5 border border-red-900/30 rounded"
						>
							CLEAR ALL
						</button>
					)}
				</div>
			</div>

			{/* Empty state */}
			{items.length === 0 && (
				<div className="flex-1 flex flex-col items-center justify-center text-center gap-2 opacity-50">
					<div className="text-2xl">📌</div>
					<div className="text-[10px] font-mono text-slate-500 max-w-[200px]">
						Click the <span className="text-cyan-400">⊕ WATCH</span> button in the entity inspector to bookmark entities for monitoring.
					</div>
				</div>
			)}

			{/* List */}
			<div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-thin">
				{sorted.map((item) => {
					const color = TYPE_COLORS[item.type] || "#64748b";
					const icon = TYPE_ICONS[item.type] || "•";
					const isEditing = editId === item.id;

					return (
						<div
							key={item.id}
							className="bg-slate-900/50 border border-slate-800/50 rounded p-2 hover:border-slate-700/60 transition-colors group"
						>
							<div className="flex items-start gap-2">
								{/* Type icon + color bar */}
								<div className="flex flex-col items-center gap-0.5 shrink-0 pt-0.5">
									<span className="text-sm">{icon}</span>
									<div className="w-0.5 h-4 rounded-full" style={{ background: color }} />
								</div>

								{/* Content */}
								<div className="flex-1 min-w-0">
									<div className="flex items-center justify-between gap-1">
										<span className="text-[10px] font-mono font-bold text-slate-300 truncate">{item.label}</span>
										<span
											className="text-[7px] font-mono px-1 py-0.5 rounded"
											style={{ color, background: `${color}15`, border: `1px solid ${color}30` }}
										>
											{item.type.toUpperCase()}
										</span>
									</div>

									{/* Notes */}
									{isEditing ? (
										<div className="mt-1 flex gap-1">
											<input
												className="flex-1 bg-slate-800/80 border border-slate-700/50 rounded px-1.5 py-0.5 text-[9px] font-mono text-slate-300 outline-none focus:border-cyan-500/50"
												value={editText}
												onChange={(e) => setEditText(e.target.value)}
												onKeyDown={(e) => e.key === "Enter" && saveEdit()}
												placeholder="Add notes..."
												autoFocus
											/>
											<button
												type="button"
												onClick={saveEdit}
												className="text-[8px] font-mono text-emerald-400 hover:text-emerald-300 px-1"
											>
												✓
											</button>
										</div>
									) : item.notes ? (
										<div
											className="text-[8px] font-mono text-slate-500 mt-0.5 cursor-pointer hover:text-slate-400"
											onClick={() => startEdit(item)}
										>
											📝 {item.notes}
										</div>
									) : null}

									{/* Meta row */}
									<div className="flex items-center gap-2 mt-1 text-[7px] font-mono text-slate-600">
										<span>{new Date(item.addedAt).toISOString().slice(0, 16).replace("T", " ")}Z</span>
										{item.lat != null && item.lon != null && (
											<span>
												{item.lat.toFixed(2)}°, {item.lon.toFixed(2)}°
											</span>
										)}
									</div>
								</div>
							</div>

							{/* Actions */}
							<div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
								{item.lat != null && item.lon != null && (
									<button
										type="button"
										onClick={() => onFlyTo?.(item.lat!, item.lon!)}
										className="text-[7px] font-mono text-cyan-500/80 hover:text-cyan-400 px-1.5 py-0.5 border border-cyan-800/30 rounded transition-colors"
									>
										FLY TO
									</button>
								)}
								{!isEditing && (
									<button
										type="button"
										onClick={() => startEdit(item)}
										className="text-[7px] font-mono text-slate-500 hover:text-slate-300 px-1.5 py-0.5 border border-slate-700/30 rounded transition-colors"
									>
										NOTE
									</button>
								)}
								<button
									type="button"
									onClick={() => onRemove(item.id)}
									className="text-[7px] font-mono text-red-500/60 hover:text-red-400 px-1.5 py-0.5 border border-red-900/30 rounded transition-colors ml-auto"
								>
									REMOVE
								</button>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
