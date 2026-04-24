import { useEffect, useState } from "react";

const SHORTCUTS: { key: string; label: string; desc: string }[] = [
	{ key: "?", label: "?", desc: "Toggle this help overlay" },
	{ key: "Escape", label: "ESC", desc: "Close panel / deselect entity" },
	{ key: "f", label: "F", desc: "Toggle fullscreen" },
	{ key: "r", label: "R", desc: "Reset map view" },
	{ key: "m", label: "M", desc: "Toggle measure mode" },
	{ key: "t", label: "T", desc: "Toggle aircraft trails" },
	{ key: "s", label: "S", desc: "Take screenshot" },
	{ key: "1", label: "1", desc: "ALERTS tab" },
	{ key: "2", label: "2", desc: "THREATS tab" },
	{ key: "3", label: "3", desc: "ANALYTICS tab" },
	{ key: "4", label: "4", desc: "OSINT tab" },
	{ key: "5", label: "5", desc: "FEEDS tab" },
	{ key: "6", label: "6", desc: "SAT imagery tab" },
	{ key: "7", label: "7", desc: "WATCHLIST tab" },
	{ key: "8", label: "8", desc: "GEOFENCE zones" },
	{ key: "9", label: "9", desc: "SITREP generator" },
	{ key: "0", label: "0", desc: "EXPORT tab" },
];

interface KeyboardShortcutsProps {
	onAction: (action: string) => void;
}

export default function KeyboardShortcuts({ onAction }: KeyboardShortcutsProps) {
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		function handleKey(e: KeyboardEvent) {
			// Don't fire when typing in inputs
			const tag = (e.target as HTMLElement)?.tagName;
			if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

			if (e.key === "?") {
				setVisible((v) => !v);
				return;
			}
			if (e.key === "Escape") {
				if (visible) { setVisible(false); return; }
				onAction("escape");
				return;
			}
			if (e.key === "f" || e.key === "F") { onAction("fullscreen"); return; }
			if (e.key === "r" || e.key === "R") { onAction("reset"); return; }
			if (e.key === "m" || e.key === "M") { onAction("measure"); return; }
			if (e.key === "t" || e.key === "T") { onAction("trails"); return; }
			if (e.key === "s" || e.key === "S") { onAction("screenshot"); return; }
			if ((e.key >= "1" && e.key <= "9") || e.key === "0") { onAction(`tab-${e.key}`); return; }
		}
		window.addEventListener("keydown", handleKey);
		return () => window.removeEventListener("keydown", handleKey);
	}, [visible, onAction]);

	if (!visible) return null;

	return (
		<div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setVisible(false)}>
			<div
				className="bg-slate-900/95 border border-slate-700/60 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="flex items-center justify-between mb-4">
					<h2 className="text-sm font-mono font-bold text-cyan-400 tracking-wider">⌨ KEYBOARD SHORTCUTS</h2>
					<button type="button" onClick={() => setVisible(false)} className="text-slate-500 hover:text-slate-300 text-sm">✕</button>
				</div>
				<div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
					{SHORTCUTS.map((s) => (
						<div key={s.key} className="flex items-center gap-2">
							<kbd className="inline-flex items-center justify-center min-w-[24px] h-5 px-1 bg-slate-800 border border-slate-600/50 rounded text-[9px] font-mono font-bold text-slate-300">
								{s.label}
							</kbd>
							<span className="text-[10px] text-slate-400">{s.desc}</span>
						</div>
					))}
				</div>
				<div className="mt-4 pt-3 border-t border-slate-700/40 text-[10px] font-mono text-slate-600 text-center">
					Press ? to toggle • ESC to close
				</div>
			</div>
		</div>
	);
}
