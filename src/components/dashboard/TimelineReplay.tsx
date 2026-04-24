import { useState, useCallback, useRef, useEffect } from "react";
import { Play, Pause, RotateCcw, Clock } from "lucide-react";

interface TimelineReplayProps {
	onTimeChange?: (timestamp: number | null) => void;
}

const RANGES = [
	{ label: "1H", hours: 1 },
	{ label: "24H", hours: 24 },
	{ label: "72H", hours: 72 },
] as const;

const SPEEDS = [1, 2, 5, 10] as const;

export default function TimelineReplay({ onTimeChange }: TimelineReplayProps) {
	const [active, setActive] = useState(false);
	const [rangeIdx, setRangeIdx] = useState(1); // default 24H
	const [playing, setPlaying] = useState(false);
	const [progress, setProgress] = useState(0); // 0..1
	const [speedIdx, setSpeedIdx] = useState(0);
	const animRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const range = RANGES[rangeIdx];
	const rangeMs = range.hours * 3600_000;
	const speed = SPEEDS[speedIdx];

	const currentTs = useCallback(() => {
		const now = Date.now();
		return now - rangeMs + progress * rangeMs;
	}, [progress, rangeMs]);

	// Emit timestamp changes
	useEffect(() => {
		if (!active) {
			onTimeChange?.(null);
			return;
		}
		onTimeChange?.(currentTs());
	}, [active, progress, currentTs, onTimeChange]);

	// Animation loop
	useEffect(() => {
		if (!playing) {
			if (animRef.current) clearInterval(animRef.current);
			animRef.current = null;
			return;
		}
		// Step: 50ms per tick, each tick advances by (speed * 50ms) / rangeMs in progress
		const tickMs = 50;
		const step = (speed * tickMs) / rangeMs;
		animRef.current = setInterval(() => {
			setProgress((p) => {
				const next = p + step;
				if (next >= 1) {
					setPlaying(false);
					return 1;
				}
				return next;
			});
		}, tickMs);
		return () => {
			if (animRef.current) clearInterval(animRef.current);
		};
	}, [playing, speed, rangeMs]);

	const reset = () => {
		setPlaying(false);
		setProgress(0);
	};

	const formatTime = (p: number) => {
		const ts = Date.now() - rangeMs + p * rangeMs;
		const d = new Date(ts);
		if (range.hours <= 1) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
		if (range.hours <= 24) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
		return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
	};

	if (!active) {
		return (
			<button
				type="button"
				onClick={() => setActive(true)}
				className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900/80 border border-slate-700/50 rounded text-[9px] font-mono text-slate-400 hover:text-cyan-400 hover:border-cyan-800/50 transition-all"
			>
				<Clock className="w-3 h-3" />
				TIMELINE
			</button>
		);
	}

	return (
		<div className="flex items-center gap-2 px-3 py-1.5 bg-slate-950/95 border border-cyan-800/40 rounded backdrop-blur-sm">
			{/* Range selector */}
			<div className="flex gap-0.5">
				{RANGES.map((r, i) => (
					<button
						key={r.label}
						type="button"
						onClick={() => { setRangeIdx(i); reset(); }}
						className={`px-1.5 py-0.5 text-[8px] font-mono rounded transition-colors ${
							i === rangeIdx ? "bg-cyan-900/60 text-cyan-300 border border-cyan-700/40" : "text-slate-500 hover:text-slate-300"
						}`}
					>
						{r.label}
					</button>
				))}
			</div>

			{/* Playback controls */}
			<button type="button" onClick={reset} className="text-slate-500 hover:text-slate-300">
				<RotateCcw className="w-3 h-3" />
			</button>
			<button
				type="button"
				onClick={() => setPlaying(!playing)}
				className={`p-0.5 rounded ${playing ? "text-cyan-400" : "text-slate-400 hover:text-cyan-400"}`}
			>
				{playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
			</button>

			{/* Speed */}
			<button
				type="button"
				onClick={() => setSpeedIdx((s) => (s + 1) % SPEEDS.length)}
				className="text-[8px] font-mono text-slate-500 hover:text-cyan-400 min-w-[20px] text-center"
			>
				{speed}×
			</button>

			{/* Progress bar */}
			<div className="flex-1 min-w-[100px] relative h-4 flex items-center">
				<div className="absolute inset-x-0 h-[2px] bg-slate-700/60 rounded-full top-1/2 -translate-y-1/2">
					<div
						className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-full transition-[width] duration-75"
						style={{ width: `${progress * 100}%` }}
					/>
				</div>
				<input
					type="range"
					min={0}
					max={1}
					step={0.001}
					value={progress}
					onChange={(e) => {
						setProgress(Number(e.target.value));
						setPlaying(false);
					}}
					className="absolute inset-x-0 w-full h-4 opacity-0 cursor-pointer"
				/>
			</div>

			{/* Time display */}
			<span className="text-[9px] font-mono text-cyan-300 min-w-[70px] text-right whitespace-nowrap">
				{formatTime(progress)}
			</span>

			{/* Close */}
			<button
				type="button"
				onClick={() => { setActive(false); setPlaying(false); }}
				className="text-[9px] text-slate-600 hover:text-red-400 ml-1"
			>
				✕
			</button>
		</div>
	);
}
