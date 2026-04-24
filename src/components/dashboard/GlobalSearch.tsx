import { useState, useEffect, useRef } from "react";
import { useGlobalSearch } from "../../hooks/useEntityData";

interface GlobalSearchProps {
	visible: boolean;
	onClose: () => void;
	onSelect: (entity: any) => void;
}

const TYPE_ICONS: Record<string, string> = {
	aircraft: "✈", conflict: "⚔", seismic: "!", disaster: "⚠", vessel: "⚓",
	military: "✈", nuclear: "☢", fire: "🔥", satellite: "★",
};

export default function GlobalSearch({ visible, onClose, onSelect }: GlobalSearchProps) {
	const [term, setTerm] = useState("");
	const results = useGlobalSearch(term);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (visible) {
			inputRef.current?.focus();
			setTerm("");
		}
	}, [visible]);

	if (!visible) return null;

	return (
		<div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 w-[480px]">
			<div className="bg-[rgba(2,10,18,0.95)] border border-[rgba(0,204,255,0.2)] rounded-lg backdrop-blur-xl overflow-hidden">
				<div className="flex items-center gap-2 px-3 py-2 border-b border-[rgba(0,204,255,0.1)]">
					<span style={{ color: "#00ccff", fontSize: 12 }}>⌕</span>
					<input
						ref={inputRef}
						type="text"
						placeholder="Search aircraft, conflicts, earthquakes, disasters…"
						value={term}
						onChange={(e) => setTerm(e.target.value)}
						onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
						className="flex-1 bg-transparent text-[#c8dce8] text-xs font-mono outline-none placeholder:text-[#3a5a6c]"
					/>
					<button onClick={onClose} className="text-[#4a6a7c] hover:text-[#00ccff] text-xs">ESC</button>
				</div>
				{results.length > 0 && (
					<div className="max-h-[300px] overflow-y-auto">
						{results.map((r, i) => (
							<button
								key={i}
								className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-[rgba(0,204,255,0.08)] text-xs font-mono text-[#c8dce8] transition-colors"
								onClick={() => { onSelect({ ...r, latitude: r.lat, longitude: r.lon }); onClose(); }}
							>
								<span style={{ fontSize: 12 }}>{TYPE_ICONS[r.type] || "●"}</span>
								<span className="text-[#4a6a7c] w-16 shrink-0">{r.type.toUpperCase()}</span>
								<span className="truncate">{r.title}</span>
							</button>
						))}
					</div>
				)}
				{term.length >= 2 && results.length === 0 && (
					<div className="px-3 py-2 text-[#3a5a6c] text-xs font-mono">No results found</div>
				)}
			</div>
		</div>
	);
}
