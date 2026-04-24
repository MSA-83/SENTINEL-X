import { useState, useCallback, useEffect } from "react";

/* ── Types ───────────────────────────────────────────────────────────── */
export interface MapBookmark {
	id: string;
	name: string;
	lat: number;
	lon: number;
	zoom: number;
	bearing: number;
	pitch: number;
	layers: Record<string, boolean>;
	createdAt: number;
	icon: string;
}

const STORAGE_KEY = "sx_bookmarks";
const ICONS = ["📍", "🎯", "⚠", "🔴", "🟢", "🏗", "🛩", "🚢", "⚡", "🔥"];

function genId() { return Math.random().toString(36).slice(2, 8); }

function loadBookmarks(): MapBookmark[] {
	try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
	catch { return []; }
}

/* ── Hook ────────────────────────────────────────────────────────────── */
export function useBookmarks() {
	const [bookmarks, setBookmarks] = useState<MapBookmark[]>(loadBookmarks);

	useEffect(() => {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
	}, [bookmarks]);

	const addBookmark = useCallback((bm: Omit<MapBookmark, "id" | "createdAt">) => {
		setBookmarks((prev) => [...prev, { ...bm, id: genId(), createdAt: Date.now() }]);
	}, []);

	const removeBookmark = useCallback((id: string) => {
		setBookmarks((prev) => prev.filter((b) => b.id !== id));
	}, []);

	const renameBookmark = useCallback((id: string, name: string) => {
		setBookmarks((prev) => prev.map((b) => (b.id === id ? { ...b, name } : b)));
	}, []);

	return { bookmarks, addBookmark, removeBookmark, renameBookmark };
}

/* ── Panel Component ─────────────────────────────────────────────────── */
interface BookmarkManagerProps {
	bookmarks: MapBookmark[];
	onAdd: (bm: Omit<MapBookmark, "id" | "createdAt">) => void;
	onRemove: (id: string) => void;
	onRename: (id: string, name: string) => void;
	onNavigate: (bm: MapBookmark) => void;
	currentView: {
		lat: number;
		lon: number;
		zoom: number;
		bearing: number;
		pitch: number;
	};
	currentLayers: Record<string, boolean>;
}

export default function BookmarkManager({
	bookmarks, onAdd, onRemove, onRename, onNavigate, currentView, currentLayers,
}: BookmarkManagerProps) {
	const [newName, setNewName] = useState("");
	const [newIcon, setNewIcon] = useState("📍");
	const [showForm, setShowForm] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editName, setEditName] = useState("");

	const handleSave = useCallback(() => {
		if (!newName.trim()) return;
		onAdd({
			name: newName.trim(),
			icon: newIcon,
			...currentView,
			layers: { ...currentLayers },
		});
		setNewName("");
		setShowForm(false);
	}, [newName, newIcon, currentView, currentLayers, onAdd]);

	const handleRename = useCallback((id: string) => {
		if (editName.trim()) {
			onRename(id, editName.trim());
		}
		setEditingId(null);
	}, [editName, onRename]);

	const timeSince = (ts: number) => {
		const mins = Math.floor((Date.now() - ts) / 60000);
		if (mins < 60) return `${mins}m ago`;
		const hrs = Math.floor(mins / 60);
		if (hrs < 24) return `${hrs}h ago`;
		return `${Math.floor(hrs / 24)}d ago`;
	};

	return (
		<div className="flex flex-col h-full font-mono text-[10px]">
			{/* Header */}
			<div className="flex items-center justify-between px-3 py-2 border-b border-cyan-900/30">
				<span className="text-cyan-400 tracking-widest">📍 BOOKMARKS</span>
				<button
					onClick={() => setShowForm(!showForm)}
					className={`px-2 py-0.5 rounded text-[9px] tracking-wider transition-all ${
						showForm
							? "bg-cyan-600/30 border border-cyan-500 text-cyan-300"
							: "bg-slate-800/50 border border-slate-600/40 text-slate-400 hover:border-cyan-700"
					}`}
				>
					+ SAVE VIEW
				</button>
			</div>

			{/* Save form */}
			{showForm && (
				<div className="p-2 border-b border-cyan-900/20 space-y-2 bg-slate-800/30">
					<div className="flex items-center gap-2">
						<span className="text-slate-500 w-8">NAME</span>
						<input
							type="text"
							value={newName}
							onChange={(e) => setNewName(e.target.value)}
							onKeyDown={(e) => e.key === "Enter" && handleSave()}
							placeholder="e.g. Taiwan Strait"
							maxLength={30}
							className="flex-1 bg-slate-900 border border-slate-600/50 rounded px-2 py-1
							           text-cyan-300 text-[10px] focus:outline-none focus:border-cyan-500"
							autoFocus
						/>
					</div>
					<div className="flex items-center gap-2">
						<span className="text-slate-500 w-8">ICON</span>
						<div className="flex gap-1 flex-wrap">
							{ICONS.map((ic) => (
								<button
									key={ic}
									onClick={() => setNewIcon(ic)}
									className={`w-6 h-6 flex items-center justify-center rounded text-sm transition-all ${
										newIcon === ic
											? "bg-cyan-800/50 border border-cyan-500"
											: "bg-slate-800/30 border border-slate-700/30 hover:border-cyan-800"
									}`}
								>
									{ic}
								</button>
							))}
						</div>
					</div>
					<div className="text-slate-500 text-[9px]">
						📐 {currentView.lat.toFixed(2)}°, {currentView.lon.toFixed(2)}° @ z{currentView.zoom.toFixed(1)}
					</div>
					<button
						onClick={handleSave}
						disabled={!newName.trim()}
						className="w-full py-1.5 bg-cyan-900/40 border border-cyan-700/50 rounded
						           text-cyan-300 tracking-widest hover:bg-cyan-800/50 disabled:opacity-30"
					>
						💾 SAVE BOOKMARK
					</button>
				</div>
			)}

			{/* Bookmark list */}
			<div className="flex-1 overflow-y-auto">
				{bookmarks.length === 0 && (
					<div className="text-slate-600 text-center py-8">
						No saved views yet.<br />
						Click "+ SAVE VIEW" to bookmark the current map position.
					</div>
				)}
				{bookmarks.map((bm) => (
					<div
						key={bm.id}
						className="flex items-center gap-2 px-3 py-2 border-b border-slate-800/50
						           hover:bg-slate-800/30 group cursor-pointer"
						onClick={() => onNavigate(bm)}
					>
						<span className="text-sm">{bm.icon}</span>
						<div className="flex-1 min-w-0">
							{editingId === bm.id ? (
								<input
									type="text"
									value={editName}
									onChange={(e) => setEditName(e.target.value)}
									onBlur={() => handleRename(bm.id)}
									onKeyDown={(e) => e.key === "Enter" && handleRename(bm.id)}
									className="bg-slate-900 border border-cyan-600 rounded px-1 py-0.5 text-cyan-300 text-[10px] w-full"
									autoFocus
									onClick={(e) => e.stopPropagation()}
								/>
							) : (
								<>
									<div className="text-cyan-300 truncate">{bm.name}</div>
									<div className="text-slate-500 text-[8px]">
										{bm.lat.toFixed(2)}°, {bm.lon.toFixed(2)}° · z{bm.zoom.toFixed(0)} · {timeSince(bm.createdAt)}
									</div>
								</>
							)}
						</div>
						<div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
							<button
								onClick={(e) => {
									e.stopPropagation();
									setEditingId(bm.id);
									setEditName(bm.name);
								}}
								className="text-slate-500 hover:text-cyan-400 text-[9px]"
								title="Rename"
							>
								✎
							</button>
							<button
								onClick={(e) => {
									e.stopPropagation();
									onRemove(bm.id);
								}}
								className="text-slate-500 hover:text-red-400 text-[9px]"
								title="Delete"
							>
								✕
							</button>
						</div>
					</div>
				))}
			</div>

			{/* Footer stats */}
			<div className="px-3 py-1.5 border-t border-cyan-900/30 text-slate-500 text-[9px] tracking-wider">
				{bookmarks.length} SAVED VIEW{bookmarks.length !== 1 ? "S" : ""}
			</div>
		</div>
	);
}
