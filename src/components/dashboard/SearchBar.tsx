import { useState, useCallback, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";
import { useGlobalSearch } from "../../hooks/useEntityData";

interface SearchBarProps {
	onResultSelect?: (lat: number, lon: number) => void;
}

export default function SearchBar({ onResultSelect }: SearchBarProps) {
	const [query, setQuery] = useState("");
	const [open, setOpen] = useState(false);
	const results = useGlobalSearch(query);
	const ref = useRef<HTMLDivElement>(null);

	// Close on outside click
	useEffect(() => {
		const handler = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, []);

	const handleSelect = useCallback(
		(lat?: number, lon?: number) => {
			if (lat !== undefined && lon !== undefined) {
				onResultSelect?.(lat, lon);
			}
			setOpen(false);
			setQuery("");
		},
		[onResultSelect],
	);

	return (
		<div ref={ref} className="absolute top-3 left-1/2 -translate-x-1/2 z-20 w-[280px] max-w-[calc(100vw-320px)]">
			<div className="relative">
				<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
				<input
					type="text"
					placeholder="Search entities (callsign, MMSI, location...)"
					value={query}
					onChange={(e) => {
						setQuery(e.target.value);
						setOpen(e.target.value.length >= 2);
					}}
					onFocus={() => query.length >= 2 && setOpen(true)}
					className="w-full bg-slate-950/95 border border-slate-700/60 rounded px-8 py-1.5 text-[10px] font-mono text-slate-200 placeholder:text-slate-600 outline-none focus:border-cyan-700/60 focus:ring-1 focus:ring-cyan-900/30 backdrop-blur-sm"
				/>
				{query && (
					<button type="button" onClick={() => { setQuery(""); setOpen(false); }} className="absolute right-2.5 top-1/2 -translate-y-1/2">
						<X className="w-3 h-3 text-slate-500 hover:text-slate-300" />
					</button>
				)}
			</div>

			{open && results.length > 0 && (
				<div className="absolute top-full left-0 right-0 mt-0.5 bg-slate-950/98 border border-slate-700/60 rounded-b max-h-[220px] overflow-y-auto backdrop-blur-sm">
					{results.map((r: { type: string; id: string; title: string; lat?: number; lon?: number }, i: number) => (
						<button
							key={`${r.type}-${r.id}-${i}`}
							type="button"
							onClick={() => handleSelect(r.lat, r.lon)}
							className="w-full flex items-center gap-2 px-3 py-1.5 text-left border-b border-slate-800/40 hover:bg-cyan-950/20 transition-colors"
						>
							<span className="text-[10px] flex-1 truncate text-slate-200 font-mono">{r.title}</span>
							<span className="text-[7px] text-slate-500 shrink-0">{r.type.toUpperCase()}</span>
						</button>
					))}
				</div>
			)}

			{open && query.length >= 2 && results.length === 0 && (
				<div className="absolute top-full left-0 right-0 mt-0.5 bg-slate-950/98 border border-slate-700/60 rounded-b px-3 py-2 text-[9px] text-slate-500 font-mono text-center">
					No entities found
				</div>
			)}
		</div>
	);
}
