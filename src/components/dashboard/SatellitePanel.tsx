import { SAT_PRODUCTS } from "../../lib/constants";

interface SatellitePanelProps {
	visible: boolean;
	onClose: () => void;
	activeSatLayer: string | null;
	onSelectLayer: (key: string | null) => void;
	satDate: string;
	onSetDate: (date: string) => void;
}

export default function SatellitePanel({ visible, onClose, activeSatLayer, onSelectLayer, satDate, onSetDate }: SatellitePanelProps) {
	if (!visible) return null;

	return (
		<div className="absolute top-14 right-4 z-40 w-[280px] bg-[rgba(2,10,18,0.95)] border border-[rgba(0,204,255,0.15)] rounded-lg backdrop-blur-xl overflow-hidden">
			<div className="flex items-center justify-between px-3 py-2 border-b border-[rgba(0,204,255,0.1)]">
				<span className="text-[#00ccff] text-[10px] font-mono tracking-[0.15em]">SATELLITE IMAGERY</span>
				<button onClick={onClose} className="text-[#4a6a7c] hover:text-[#00ccff] text-xs">✕</button>
			</div>
			<div className="p-2 space-y-1">
				{/* Date picker for daily layers */}
				<div className="flex items-center gap-2 mb-2 px-1">
					<span className="text-[#4a6a7c] text-[9px] font-mono">DATE:</span>
					<input
						type="date"
						value={satDate}
						onChange={(e) => onSetDate(e.target.value)}
						className="flex-1 bg-[rgba(0,204,255,0.05)] border border-[rgba(0,204,255,0.1)] rounded text-[#c8dce8] text-[10px] font-mono px-2 py-0.5 outline-none"
					/>
				</div>

				{/* None option */}
				<button
					className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs font-mono transition-colors ${!activeSatLayer ? "bg-[rgba(0,204,255,0.12)] text-[#00ccff]" : "text-[#6a8ca0] hover:bg-[rgba(0,204,255,0.05)]"}`}
					onClick={() => onSelectLayer(null)}
				>
					<span>OFF — Base Map Only</span>
					{!activeSatLayer && <span className="text-[#00ccff]">●</span>}
				</button>

				{Object.entries(SAT_PRODUCTS).map(([key, p]) => (
					<button
						key={key}
						className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs font-mono transition-colors ${activeSatLayer === key ? "bg-[rgba(0,204,255,0.12)] text-[#00ccff]" : "text-[#6a8ca0] hover:bg-[rgba(0,204,255,0.05)]"}`}
						onClick={() => onSelectLayer(key)}
					>
						<div>
							<div className="text-[10px]">{p.label}</div>
							<div className="text-[8px] text-[#3a5a6c]">{p.sub} — {p.desc}</div>
						</div>
						{activeSatLayer === key && <span className="text-[#00ccff]">●</span>}
					</button>
				))}
			</div>
		</div>
	);
}
