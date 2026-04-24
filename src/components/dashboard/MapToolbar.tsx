import { useState, useCallback } from "react";

interface MapToolbarProps {
	onScreenshot: () => void;
	onMeasure: () => void;
	onFullscreen: () => void;
	onResetView: () => void;
	cursorCoords: { lat: number; lng: number } | null;
	isFullscreen: boolean;
	isMeasuring: boolean;
	measureDistance: number | null;
}

export default function MapToolbar({
	onScreenshot, onMeasure, onFullscreen, onResetView,
	cursorCoords, isFullscreen, isMeasuring, measureDistance,
}: MapToolbarProps) {
	const [copied, setCopied] = useState(false);

	const copyCoords = useCallback(() => {
		if (!cursorCoords) return;
		navigator.clipboard.writeText(`${cursorCoords.lat.toFixed(6)}, ${cursorCoords.lng.toFixed(6)}`);
		setCopied(true);
		setTimeout(() => setCopied(false), 1500);
	}, [cursorCoords]);

	return (
		<div className="absolute top-12 right-2 z-20 flex flex-col gap-1">
			{/* Screenshot */}
			<button
				onClick={onScreenshot}
				title="Screenshot (Ctrl+Shift+S)"
				className="w-8 h-8 bg-black/70 hover:bg-cyan-900/70 border border-slate-600/50 rounded text-xs text-slate-300 flex items-center justify-center transition-colors"
			>
				📷
			</button>

			{/* Measure */}
			<button
				onClick={onMeasure}
				title="Measure distance"
				className={`w-8 h-8 border rounded text-xs flex items-center justify-center transition-colors ${
					isMeasuring
						? "bg-cyan-900/80 border-cyan-500 text-cyan-300"
						: "bg-black/70 hover:bg-cyan-900/70 border-slate-600/50 text-slate-300"
				}`}
			>
				📏
			</button>

			{/* Fullscreen */}
			<button
				onClick={onFullscreen}
				title="Fullscreen (F)"
				className="w-8 h-8 bg-black/70 hover:bg-cyan-900/70 border border-slate-600/50 rounded text-xs text-slate-300 flex items-center justify-center transition-colors"
			>
				{isFullscreen ? "⊟" : "⊞"}
			</button>

			{/* Reset view */}
			<button
				onClick={onResetView}
				title="Reset view"
				className="w-8 h-8 bg-black/70 hover:bg-cyan-900/70 border border-slate-600/50 rounded text-xs text-slate-300 flex items-center justify-center transition-colors"
			>
				🏠
			</button>

			{/* Coordinates display */}
			{cursorCoords && (
				<button
					onClick={copyCoords}
					title="Copy coordinates"
					className="mt-1 px-1.5 py-1 bg-black/80 border border-slate-700/50 rounded text-[9px] font-mono text-slate-400 hover:text-cyan-400 transition-colors whitespace-nowrap"
				>
					{copied ? "✓ COPIED" : `${cursorCoords.lat.toFixed(4)}°, ${cursorCoords.lng.toFixed(4)}°`}
				</button>
			)}

			{/* Measure readout */}
			{isMeasuring && measureDistance !== null && (
				<div className="px-1.5 py-1 bg-cyan-950/80 border border-cyan-700/50 rounded text-[9px] font-mono text-cyan-300 whitespace-nowrap">
					{measureDistance < 1
						? `${(measureDistance * 1000).toFixed(0)}m`
						: measureDistance < 100
						? `${measureDistance.toFixed(2)}km`
						: `${measureDistance.toFixed(0)}km`}
					{measureDistance > 1.852 && (
						<span className="text-slate-500 ml-1">
							({(measureDistance / 1.852).toFixed(1)}nm)
						</span>
					)}
				</div>
			)}
		</div>
	);
}
