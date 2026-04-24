import { useEffect, useState, useCallback } from "react";

interface Toast {
	id: string;
	type: "critical" | "warning" | "info";
	title: string;
	message: string;
	timestamp: number;
}

interface NotificationToastProps {
	toasts: Toast[];
	onDismiss: (id: string) => void;
	onFlyTo?: (lat: number, lon: number) => void;
}

const TYPE_STYLES: Record<string, { bg: string; border: string; icon: string }> = {
	critical: { bg: "bg-red-950/90", border: "border-red-500/60", icon: "🚨" },
	warning:  { bg: "bg-amber-950/90", border: "border-amber-500/60", icon: "⚠️" },
	info:     { bg: "bg-cyan-950/90", border: "border-cyan-500/60", icon: "ℹ️" },
};

export default function NotificationToast({ toasts, onDismiss }: NotificationToastProps) {
	return (
		<div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 flex flex-col gap-1.5 pointer-events-auto max-w-md w-full px-4">
			{toasts.slice(0, 3).map((toast) => {
				const style = TYPE_STYLES[toast.type] || TYPE_STYLES.info;
				return (
					<div
						key={toast.id}
						className={`${style.bg} ${style.border} border backdrop-blur-md rounded-lg px-3 py-2 flex items-start gap-2 shadow-lg animate-slide-in`}
					>
						<span className="text-sm mt-0.5">{style.icon}</span>
						<div className="flex-1 min-w-0">
							<div className="font-mono text-xs font-bold text-white truncate">{toast.title}</div>
							<div className="font-mono text-[10px] text-slate-300 mt-0.5 line-clamp-2">{toast.message}</div>
						</div>
						<button
							onClick={() => onDismiss(toast.id)}
							className="text-slate-500 hover:text-white text-xs ml-1 flex-shrink-0"
						>
							✕
						</button>
					</div>
				);
			})}
		</div>
	);
}

/** Hook: detect critical events and create toasts */
export function useCriticalEventToasts(
	aircraft: Array<{ squawk?: string | null; callsign?: string | null; icao24?: string }>,
	seismicEvents: Array<{ magnitude?: number; place?: string; eventId?: string; tsunami?: boolean }>,
	disasters: Array<{ alertLevel?: string; title?: string; eventId?: string }>,
): { toasts: Toast[]; dismissToast: (id: string) => void } {
	const [toasts, setToasts] = useState<Toast[]>([]);
	const [seen, setSeen] = useState<Set<string>>(new Set());

	const dismissToast = useCallback((id: string) => {
		setToasts((prev) => prev.filter((t) => t.id !== id));
	}, []);

	// Auto-dismiss after 12s
	useEffect(() => {
		if (toasts.length === 0) return;
		const timer = setTimeout(() => {
			setToasts((prev) => prev.slice(1));
		}, 12000);
		return () => clearTimeout(timer);
	}, [toasts]);

	// Emergency squawk detection
	useEffect(() => {
		const SQUAWK_MAP: Record<string, string> = { "7500": "HIJACK", "7600": "COMMS FAILURE", "7700": "EMERGENCY" };
		for (const ac of aircraft) {
			const label = SQUAWK_MAP[ac.squawk || ""];
			if (!label) continue;
			const key = `squawk-${ac.icao24}-${ac.squawk}`;
			if (seen.has(key)) continue;
			setSeen((prev) => new Set(prev).add(key));
			setToasts((prev) => [...prev, {
				id: key,
				type: "critical",
				title: `SQUAWK ${ac.squawk} — ${label}`,
				message: `${ac.callsign || ac.icao24} declared ${label}`,
				timestamp: Date.now(),
			}]);
		}
	}, [aircraft, seen]);

	// Major earthquake
	useEffect(() => {
		for (const eq of seismicEvents) {
			if ((eq.magnitude || 0) < 5.5) continue;
			const key = `quake-${eq.eventId}`;
			if (seen.has(key)) continue;
			setSeen((prev) => new Set(prev).add(key));
			setToasts((prev) => [...prev, {
				id: key,
				type: eq.tsunami ? "critical" : "warning",
				title: `M${eq.magnitude?.toFixed(1)} EARTHQUAKE${eq.tsunami ? " ⚠ TSUNAMI" : ""}`,
				message: eq.place || "Unknown location",
				timestamp: Date.now(),
			}]);
		}
	}, [seismicEvents, seen]);

	// Red alert disasters
	useEffect(() => {
		for (const d of disasters) {
			if (d.alertLevel !== "red") continue;
			const key = `disaster-${d.eventId}`;
			if (seen.has(key)) continue;
			setSeen((prev) => new Set(prev).add(key));
			setToasts((prev) => [...prev, {
				id: key,
				type: "critical",
				title: "RED ALERT DISASTER",
				message: d.title || "Unknown event",
				timestamp: Date.now(),
			}]);
		}
	}, [disasters, seen]);

	return { toasts, dismissToast };
}
