/**
 * EnhancedTimeline — Full-featured time control bar with:
 * - Scrubbing slider with time ticks
 * - Speed control (0.5x → 20x)
 * - Entity count sparkline over time window
 * - Live/replay mode toggle
 * - Event markers on timeline (earthquakes, emergencies)
 */
import { useState, useCallback, useRef, useEffect, useMemo } from "react";

interface EnhancedTimelineProps {
	onTimeChange?: (timestamp: number | null) => void;
	/** Major events to mark on the timeline: { ts: timestamp, label: string, color: string } */
	events?: { ts: number; label: string; color: string }[];
	/** Entity count history for sparkline: { ts: number, count: number }[] */
	entityHistory?: { ts: number; count: number }[];
}

const RANGES = [
	{ label: "1H", hours: 1 },
	{ label: "6H", hours: 6 },
	{ label: "24H", hours: 24 },
	{ label: "3D", hours: 72 },
	{ label: "7D", hours: 168 },
] as const;

const SPEEDS = [0.5, 1, 2, 5, 10, 20] as const;

function formatZulu(ts: number, rangeHours: number): string {
	const d = new Date(ts);
	if (rangeHours <= 1) return d.toISOString().slice(11, 19) + "Z";
	if (rangeHours <= 24) return d.toISOString().slice(11, 16) + "Z";
	return d.toISOString().slice(5, 16).replace("T", " ") + "Z";
}

function formatDuration(ms: number): string {
	const sec = Math.floor(ms / 1000);
	if (sec < 60) return `${sec}s`;
	const min = Math.floor(sec / 60);
	if (min < 60) return `${min}m`;
	const hr = Math.floor(min / 60);
	return `${hr}h ${min % 60}m`;
}

/** Mini sparkline SVG */
function Sparkline({ data, width, height, color }: { data: number[]; width: number; height: number; color: string }) {
	if (data.length < 2) return null;
	const max = Math.max(...data, 1);
	const points = data
		.map((v, i) => {
			const x = (i / (data.length - 1)) * width;
			const y = height - (v / max) * (height - 2) - 1;
			return `${x},${y}`;
		})
		.join(" ");

	return (
		<svg width={width} height={height} className="shrink-0">
			<polyline
				points={points}
				fill="none"
				stroke={color}
				strokeWidth={1}
				opacity={0.6}
			/>
		</svg>
	);
}

export default function EnhancedTimeline({ onTimeChange, events = [], entityHistory = [] }: EnhancedTimelineProps) {
	const [active, setActive] = useState(false);
	const [rangeIdx, setRangeIdx] = useState(2); // 24H default
	const [playing, setPlaying] = useState(false);
	const [progress, setProgress] = useState(0); // 0..1
	const [speedIdx, setSpeedIdx] = useState(1); // 1x
	const [isLive, setIsLive] = useState(true);
	const animRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const sliderRef = useRef<HTMLDivElement>(null);

	const range = RANGES[rangeIdx];
	const rangeMs = range.hours * 3600_000;
	const speed = SPEEDS[speedIdx];
	const now = Date.now();
	const windowStart = now - rangeMs;

	const currentTs = useMemo(() => windowStart + progress * rangeMs, [windowStart, progress, rangeMs]);

	// Emit timestamp
	useEffect(() => {
		if (!active || isLive) {
			onTimeChange?.(null);
			return;
		}
		onTimeChange?.(currentTs);
	}, [active, isLive, currentTs, onTimeChange]);

	// Animation loop
	useEffect(() => {
		if (!playing || isLive) {
			if (animRef.current) clearInterval(animRef.current);
			animRef.current = null;
			return;
		}
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
	}, [playing, speed, rangeMs, isLive]);

	const reset = useCallback(() => {
		setPlaying(false);
		setProgress(0);
	}, []);

	const goLive = useCallback(() => {
		setIsLive(true);
		setPlaying(false);
		setProgress(1);
	}, []);

	const enterReplay = useCallback(() => {
		setIsLive(false);
		setProgress(0);
	}, []);

	// Time ticks for the slider
	const ticks = useMemo(() => {
		const count = Math.min(range.hours, 8);
		const step = rangeMs / count;
		const result: { pos: number; label: string }[] = [];
		for (let i = 0; i <= count; i++) {
			const ts = windowStart + i * step;
			const pos = i / count;
			result.push({ pos, label: formatZulu(ts, range.hours) });
		}
		return result;
	}, [range, rangeMs, windowStart]);

	// Events on timeline
	const eventMarkers = useMemo(() => {
		return events
			.filter((e) => e.ts >= windowStart && e.ts <= now)
			.map((e) => ({
				...e,
				pos: (e.ts - windowStart) / rangeMs,
			}));
	}, [events, windowStart, now, rangeMs]);

	// Sparkline data (bin entity history into 50 buckets)
	const sparkData = useMemo(() => {
		if (entityHistory.length === 0) return [];
		const buckets = 50;
		const binSize = rangeMs / buckets;
		const counts = new Array(buckets).fill(0);
		for (const e of entityHistory) {
			if (e.ts >= windowStart && e.ts <= now) {
				const bin = Math.min(Math.floor((e.ts - windowStart) / binSize), buckets - 1);
				counts[bin] += e.count;
			}
		}
		return counts;
	}, [entityHistory, windowStart, now, rangeMs]);

	// Handle slider click/drag
	const handleSliderClick = useCallback((e: React.MouseEvent) => {
		if (!sliderRef.current) return;
		const rect = sliderRef.current.getBoundingClientRect();
		const p = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
		setProgress(p);
		setIsLive(false);
		setPlaying(false);
	}, []);

	if (!active) {
		return (
			<button
				type="button"
				onClick={() => setActive(true)}
				className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900/80 border border-slate-700/50 rounded text-[9px] font-mono text-slate-400 hover:text-cyan-400 hover:border-cyan-800/50 transition-all"
			>
				⏱ TIMELINE
			</button>
		);
	}

	return (
		<div className="bg-slate-950/95 border border-cyan-800/40 rounded-lg backdrop-blur-sm px-3 py-2 w-[480px] max-w-[95vw]">
			{/* Top row: mode + range + speed + close */}
			<div className="flex items-center gap-2 mb-1.5">
				{/* Live / Replay toggle */}
				<button
					type="button"
					onClick={isLive ? enterReplay : goLive}
					className={`px-2 py-0.5 text-[8px] font-mono font-bold rounded tracking-wider transition-colors ${
						isLive
							? "bg-emerald-900/40 text-emerald-400 border border-emerald-700/30"
							: "bg-amber-900/40 text-amber-400 border border-amber-700/30"
					}`}
				>
					{isLive ? "● LIVE" : "◉ REPLAY"}
				</button>

				{/* Range selector */}
				<div className="flex gap-0.5">
					{RANGES.map((r, i) => (
						<button
							key={r.label}
							type="button"
							onClick={() => { setRangeIdx(i); reset(); }}
							className={`px-1.5 py-0.5 text-[7px] font-mono rounded transition-colors ${
								i === rangeIdx
									? "bg-cyan-900/50 text-cyan-300 border border-cyan-700/30"
									: "text-slate-600 hover:text-slate-400"
							}`}
						>
							{r.label}
						</button>
					))}
				</div>

				{/* Playback controls */}
				<div className="flex items-center gap-1 ml-auto">
					<button
						type="button"
						onClick={reset}
						className="text-slate-500 hover:text-slate-300 text-[10px]"
						disabled={isLive}
					>
						⟲
					</button>
					<button
						type="button"
						onClick={() => setPlaying(!playing)}
						disabled={isLive}
						className={`text-sm ${isLive ? "text-slate-700" : playing ? "text-cyan-400" : "text-slate-400 hover:text-cyan-400"}`}
					>
						{playing ? "⏸" : "▶"}
					</button>
					<button
						type="button"
						onClick={() => setSpeedIdx((s) => (s + 1) % SPEEDS.length)}
						className="text-[8px] font-mono text-slate-500 hover:text-cyan-400 min-w-[24px] text-center"
					>
						{speed}×
					</button>
				</div>

				{/* Close */}
				<button
					type="button"
					onClick={() => { setActive(false); setPlaying(false); }}
					className="text-slate-600 hover:text-red-400 text-xs ml-1"
				>
					✕
				</button>
			</div>

			{/* Sparkline */}
			{sparkData.length > 0 && (
				<div className="mb-0.5">
					<Sparkline data={sparkData} width={456} height={16} color="#06b6d4" />
				</div>
			)}

			{/* Slider track */}
			<div
				ref={sliderRef}
				className="relative h-6 cursor-pointer group"
				onClick={handleSliderClick}
			>
				{/* Background track */}
				<div className="absolute inset-x-0 top-2 h-[3px] bg-slate-700/60 rounded-full">
					{/* Progress fill */}
					<div
						className="h-full rounded-full transition-[width] duration-75"
						style={{
							width: `${(isLive ? 100 : progress * 100)}%`,
							background: isLive
								? "linear-gradient(90deg, #059669, #34d399)"
								: "linear-gradient(90deg, #0891b2, #06b6d4)",
						}}
					/>
				</div>

				{/* Event markers */}
				{eventMarkers.map((ev, i) => (
					<div
						key={i}
						className="absolute top-0 w-1 h-4 rounded-sm"
						style={{
							left: `${ev.pos * 100}%`,
							backgroundColor: ev.color,
							opacity: 0.7,
						}}
						title={`${ev.label} @ ${formatZulu(ev.ts, range.hours)}`}
					/>
				))}

				{/* Playhead */}
				{!isLive && (
					<div
						className="absolute top-0 w-2 h-5 bg-cyan-400 rounded-sm shadow-lg shadow-cyan-400/30 -translate-x-1/2 transition-[left] duration-75"
						style={{ left: `${progress * 100}%` }}
					/>
				)}

				{/* Tick labels */}
				<div className="absolute inset-x-0 top-5 flex justify-between">
					{ticks.map((t, i) => (
						<span key={i} className="text-[6px] font-mono text-slate-600" style={{ position: "absolute", left: `${t.pos * 100}%`, transform: "translateX(-50%)" }}>
							{t.label}
						</span>
					))}
				</div>
			</div>

			{/* Bottom info */}
			<div className="flex items-center justify-between mt-3 pt-0.5">
				<span className="text-[8px] font-mono text-slate-600">
					T−{formatDuration(now - currentTs)}
				</span>
				<span className="text-[9px] font-mono text-cyan-300 font-bold">
					{isLive ? formatZulu(now, range.hours) : formatZulu(currentTs, range.hours)}
				</span>
				<span className="text-[8px] font-mono text-slate-600">
					WINDOW: {range.label}
				</span>
			</div>
		</div>
	);
}
