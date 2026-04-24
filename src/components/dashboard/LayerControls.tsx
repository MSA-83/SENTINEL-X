import { LAYERS, DOMAIN_LIST, DOMAIN_COLORS } from "../../lib/constants";

interface LayerControlsProps {
	visibleLayers: Record<string, boolean>;
	onToggle: (key: string) => void;
	activeDomain: string;
	onSetDomain: (domain: string) => void;
}

export default function LayerControls({ visibleLayers, onToggle, activeDomain, onSetDomain }: LayerControlsProps) {
	const filtered = activeDomain === "ALL"
		? Object.entries(LAYERS)
		: Object.entries(LAYERS).filter(([, v]) => v.domain === activeDomain);

	return (
		<div className="flex flex-col gap-1">
			{/* Domain filter tabs */}
			<div className="flex flex-wrap gap-0.5 mb-1">
				{DOMAIN_LIST.map(d => (
					<button
						key={d}
						onClick={() => onSetDomain(d)}
						className={`px-1.5 py-0.5 text-[8px] font-mono rounded tracking-wider transition-colors ${
							activeDomain === d
								? "text-[#020a12]"
								: "text-[#4a6a7c] hover:text-[#c8dce8] bg-transparent"
						}`}
						style={activeDomain === d ? { backgroundColor: DOMAIN_COLORS[d] || "#00ccff" } : {}}
					>
						{d}
					</button>
				))}
			</div>
			{/* Layer toggles */}
			{filtered.map(([key, cfg]) => {
				const on = visibleLayers[key] !== false;
				return (
					<button
						key={key}
						onClick={() => onToggle(key)}
						className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-mono transition-all ${
							on
								? "bg-[rgba(0,204,255,0.08)] text-[#c8dce8]"
								: "text-[#3a5a6c] hover:text-[#6a8ca0]"
						}`}
					>
						<span
							className="w-2 h-2 rounded-full shrink-0"
							style={{ backgroundColor: on ? cfg.color : "transparent", border: `1px solid ${cfg.color}` }}
						/>
						<span className="tracking-[0.1em]">{cfg.icon} {cfg.label}</span>
					</button>
				);
			})}
		</div>
	);
}
