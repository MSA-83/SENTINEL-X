/**
 * AlertRulesEngine — Custom alert condition builder
 * Users define rules like "aircraft enters zone X", "quake > M6 near city Y",
 * "fire count > 50 in region". Rules are stored in localStorage and evaluated
 * against live data. Triggered rules produce toast-style alerts.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import {
	useAircraft,
	useSeismicEvents,
	useFires,
	useConflictEvents,
	useActiveJammingAlerts,
} from "../../hooks/useEntityData";

// ==================== TYPES ====================

type RuleType = "proximity" | "threshold" | "keyword" | "zone_entry";

interface AlertRule {
	id: string;
	name: string;
	type: RuleType;
	enabled: boolean;
	createdAt: number;

	// Proximity: alert when entity appears near coordinates
	entityType?: string; // "aircraft" | "seismic" | "fire" | "conflict" | "jamming"
	lat?: number;
	lon?: number;
	radiusKm?: number;

	// Threshold: alert when a numeric field exceeds a value
	field?: string; // e.g. "magnitude", "brightness", "altitude"
	operator?: ">" | "<" | ">=" | "<=" | "==";
	value?: number;

	// Keyword: alert when entity text matches pattern
	keyword?: string;

	// Zone entry: alert when entity enters a bounding box
	bbox?: { north: number; south: number; east: number; west: number };
}

interface TriggeredAlert {
	ruleId: string;
	ruleName: string;
	message: string;
	timestamp: number;
	entityType: string;
}

const STORAGE_KEY = "sentinel-x-alert-rules";
const ALERT_HISTORY_KEY = "sentinel-x-alert-history";

// ==================== HOOKS ====================

function useAlertRules() {
	const [rules, setRules] = useState<AlertRule[]>(() => {
		try {
			const saved = localStorage.getItem(STORAGE_KEY);
			return saved ? JSON.parse(saved) : [];
		} catch { return []; }
	});

	const save = useCallback((updated: AlertRule[]) => {
		setRules(updated);
		localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
	}, []);

	const addRule = useCallback((rule: AlertRule) => save([...rules, rule]), [rules, save]);
	const removeRule = useCallback((id: string) => save(rules.filter(r => r.id !== id)), [rules, save]);
	const toggleRule = useCallback((id: string) => save(rules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r)), [rules, save]);

	return { rules, addRule, removeRule, toggleRule };
}

// Haversine distance in km
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
	const R = 6371;
	const dLat = (lat2 - lat1) * Math.PI / 180;
	const dLon = (lon2 - lon1) * Math.PI / 180;
	const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
	return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ==================== COMPONENT ====================

export default function AlertRulesEngine() {
	const { rules, addRule, removeRule, toggleRule } = useAlertRules();
	const [alerts, setAlerts] = useState<TriggeredAlert[]>(() => {
		try {
			const saved = localStorage.getItem(ALERT_HISTORY_KEY);
			return saved ? JSON.parse(saved) : [];
		} catch { return []; }
	});
	const [showForm, setShowForm] = useState(false);
	const [formTab, setFormTab] = useState<RuleType>("proximity");
	const seenRef = useRef<Set<string>>(new Set());

	// Form state
	const [formName, setFormName] = useState("");
	const [formEntity, setFormEntity] = useState("aircraft");
	const [formLat, setFormLat] = useState("");
	const [formLon, setFormLon] = useState("");
	const [formRadius, setFormRadius] = useState("100");
	const [formField, setFormField] = useState("magnitude");
	const [formOp, setFormOp] = useState<string>(">");
	const [formValue, setFormValue] = useState("");
	const [formKeyword, setFormKeyword] = useState("");
	const [formBboxN, setFormBboxN] = useState("");
	const [formBboxS, setFormBboxS] = useState("");
	const [formBboxE, setFormBboxE] = useState("");
	const [formBboxW, setFormBboxW] = useState("");

	// Live data
	const aircraft = useAircraft() ?? [];
	const seismic = useSeismicEvents() ?? [];
	const fires = useFires() ?? [];
	const conflicts = useConflictEvents() ?? [];
	const jamming = useActiveJammingAlerts() ?? [];

	// Evaluate rules against data
	useEffect(() => {
		const activeRules = rules.filter(r => r.enabled);
		if (!activeRules.length) return;

		const newAlerts: TriggeredAlert[] = [];

		const entityMap: Record<string, Record<string, unknown>[]> = {
			aircraft: aircraft as Record<string, unknown>[],
			seismic: seismic as Record<string, unknown>[],
			fire: fires as Record<string, unknown>[],
			conflict: conflicts as Record<string, unknown>[],
			jamming: jamming as Record<string, unknown>[],
		};

		for (const rule of activeRules) {
			const entities = entityMap[rule.entityType ?? "aircraft"] ?? [];

			for (const entity of entities) {
				const eLat = Number(entity.latitude ?? 0);
				const eLon = Number(entity.longitude ?? 0);
				const eId = String(entity._id ?? entity.id ?? `${eLat}-${eLon}`);
				const alertKey = `${rule.id}-${eId}`;

				if (seenRef.current.has(alertKey)) continue;

				let triggered = false;
				let message = "";

				switch (rule.type) {
					case "proximity": {
						if (rule.lat && rule.lon && rule.radiusKm) {
							const dist = haversineKm(eLat, eLon, rule.lat, rule.lon);
							if (dist <= rule.radiusKm) {
								triggered = true;
								message = `${rule.entityType} detected ${dist.toFixed(1)}km from watch point (${rule.lat.toFixed(2)}, ${rule.lon.toFixed(2)})`;
							}
						}
						break;
					}
					case "threshold": {
						if (rule.field && rule.operator && rule.value !== undefined) {
							const fieldVal = Number(entity[rule.field] ?? 0);
							const ops: Record<string, (a: number, b: number) => boolean> = {
								">": (a, b) => a > b,
								"<": (a, b) => a < b,
								">=": (a, b) => a >= b,
								"<=": (a, b) => a <= b,
								"==": (a, b) => a === b,
							};
							if (ops[rule.operator]?.(fieldVal, rule.value)) {
								triggered = true;
								message = `${rule.entityType} ${rule.field}=${fieldVal} ${rule.operator} ${rule.value}`;
							}
						}
						break;
					}
					case "keyword": {
						if (rule.keyword) {
							const text = JSON.stringify(entity).toLowerCase();
							if (text.includes(rule.keyword.toLowerCase())) {
								triggered = true;
								message = `${rule.entityType} matches keyword "${rule.keyword}"`;
							}
						}
						break;
					}
					case "zone_entry": {
						if (rule.bbox) {
							const { north, south, east, west } = rule.bbox;
							if (eLat >= south && eLat <= north && eLon >= west && eLon <= east) {
								triggered = true;
								message = `${rule.entityType} entered zone [${south.toFixed(1)}°, ${north.toFixed(1)}°] × [${west.toFixed(1)}°, ${east.toFixed(1)}°]`;
							}
						}
						break;
					}
				}

				if (triggered) {
					seenRef.current.add(alertKey);
					newAlerts.push({
						ruleId: rule.id,
						ruleName: rule.name,
						message,
						timestamp: Date.now(),
						entityType: rule.entityType ?? "unknown",
					});
				}
			}
		}

		if (newAlerts.length) {
			setAlerts(prev => {
				const updated = [...newAlerts, ...prev].slice(0, 100);
				localStorage.setItem(ALERT_HISTORY_KEY, JSON.stringify(updated));
				return updated;
			});
		}
	}, [rules, aircraft, seismic, fires, conflicts, jamming]);

	const handleCreateRule = useCallback(() => {
		const base: AlertRule = {
			id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
			name: formName || `Rule ${rules.length + 1}`,
			type: formTab,
			enabled: true,
			createdAt: Date.now(),
			entityType: formEntity,
		};

		switch (formTab) {
			case "proximity":
				base.lat = Number(formLat);
				base.lon = Number(formLon);
				base.radiusKm = Number(formRadius);
				break;
			case "threshold":
				base.field = formField;
				base.operator = formOp as AlertRule["operator"];
				base.value = Number(formValue);
				break;
			case "keyword":
				base.keyword = formKeyword;
				break;
			case "zone_entry":
				base.bbox = {
					north: Number(formBboxN),
					south: Number(formBboxS),
					east: Number(formBboxE),
					west: Number(formBboxW),
				};
				break;
		}

		addRule(base);
		setShowForm(false);
		setFormName("");
	}, [formTab, formName, formEntity, formLat, formLon, formRadius, formField, formOp, formValue, formKeyword, formBboxN, formBboxS, formBboxE, formBboxW, addRule, rules.length]);

	const clearAlerts = useCallback(() => {
		setAlerts([]);
		seenRef.current.clear();
		localStorage.removeItem(ALERT_HISTORY_KEY);
	}, []);

	const ENTITY_TYPES = ["aircraft", "seismic", "fire", "conflict", "jamming"];
	const FIELDS = ["magnitude", "brightness", "altitude", "speed", "confidence", "severity", "signalStrength"];

	return (
		<div className="flex flex-col h-full">
			{/* Header */}
			<div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/50">
				<div className="flex items-center gap-2">
					<span className="text-[10px] font-mono font-bold text-amber-400 tracking-widest">⚡ ALERT RULES ENGINE</span>
					<span className="text-[8px] font-mono text-slate-500 bg-slate-800/60 px-1.5 rounded">{rules.length} RULES</span>
				</div>
				<button
					type="button"
					onClick={() => setShowForm(!showForm)}
					className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-900/20 border border-emerald-800/30 px-2 py-0.5 rounded hover:bg-emerald-900/40"
				>
					+ NEW RULE
				</button>
			</div>

			{/* New Rule Form */}
			{showForm && (
				<div className="p-3 border-b border-slate-700/50 bg-slate-900/50">
					<input
						type="text"
						value={formName}
						onChange={e => setFormName(e.target.value)}
						placeholder="Rule name..."
						className="w-full mb-2 px-2 py-1 rounded bg-slate-800/80 border border-slate-700/50 text-[10px] font-mono text-slate-200 placeholder-slate-500"
					/>

					{/* Type selector */}
					<div className="flex gap-1 mb-2">
						{(["proximity", "threshold", "keyword", "zone_entry"] as RuleType[]).map(t => (
							<button
								key={t}
								type="button"
								onClick={() => setFormTab(t)}
								className={`flex-1 px-1 py-0.5 rounded text-[7px] font-mono font-bold tracking-wider ${
									formTab === t
										? "bg-amber-900/30 text-amber-400 border border-amber-700/30"
										: "bg-slate-800/40 text-slate-500 hover:text-slate-300 border border-transparent"
								}`}
							>
								{t === "proximity" ? "📍" : t === "threshold" ? "📊" : t === "keyword" ? "🔍" : "⬡"} {t.replace("_", " ").toUpperCase()}
							</button>
						))}
					</div>

					{/* Entity type */}
					<div className="flex items-center gap-2 mb-2">
						<span className="text-[8px] font-mono text-slate-500 w-16">ENTITY</span>
						<select
							value={formEntity}
							onChange={e => setFormEntity(e.target.value)}
							className="flex-1 px-2 py-1 rounded bg-slate-800/80 border border-slate-700/50 text-[10px] font-mono text-slate-200"
						>
							{ENTITY_TYPES.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
						</select>
					</div>

					{/* Type-specific fields */}
					{formTab === "proximity" && (
						<div className="space-y-1">
							<div className="flex gap-1">
								<input type="number" step="0.01" value={formLat} onChange={e => setFormLat(e.target.value)} placeholder="Latitude" className="flex-1 px-2 py-1 rounded bg-slate-800/80 border border-slate-700/50 text-[10px] font-mono text-slate-200 placeholder-slate-500" />
								<input type="number" step="0.01" value={formLon} onChange={e => setFormLon(e.target.value)} placeholder="Longitude" className="flex-1 px-2 py-1 rounded bg-slate-800/80 border border-slate-700/50 text-[10px] font-mono text-slate-200 placeholder-slate-500" />
							</div>
							<div className="flex items-center gap-1">
								<input type="number" value={formRadius} onChange={e => setFormRadius(e.target.value)} placeholder="Radius km" className="flex-1 px-2 py-1 rounded bg-slate-800/80 border border-slate-700/50 text-[10px] font-mono text-slate-200 placeholder-slate-500" />
								<span className="text-[8px] font-mono text-slate-500">KM</span>
							</div>
						</div>
					)}

					{formTab === "threshold" && (
						<div className="flex gap-1">
							<select value={formField} onChange={e => setFormField(e.target.value)} className="flex-1 px-2 py-1 rounded bg-slate-800/80 border border-slate-700/50 text-[10px] font-mono text-slate-200">
								{FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
							</select>
							<select value={formOp} onChange={e => setFormOp(e.target.value)} className="w-14 px-2 py-1 rounded bg-slate-800/80 border border-slate-700/50 text-[10px] font-mono text-slate-200">
								{[">", "<", ">=", "<=", "=="].map(o => <option key={o} value={o}>{o}</option>)}
							</select>
							<input type="number" step="0.1" value={formValue} onChange={e => setFormValue(e.target.value)} placeholder="Value" className="w-20 px-2 py-1 rounded bg-slate-800/80 border border-slate-700/50 text-[10px] font-mono text-slate-200 placeholder-slate-500" />
						</div>
					)}

					{formTab === "keyword" && (
						<input type="text" value={formKeyword} onChange={e => setFormKeyword(e.target.value)} placeholder="Keyword or pattern..." className="w-full px-2 py-1 rounded bg-slate-800/80 border border-slate-700/50 text-[10px] font-mono text-slate-200 placeholder-slate-500" />
					)}

					{formTab === "zone_entry" && (
						<div className="grid grid-cols-2 gap-1">
							<input type="number" step="0.1" value={formBboxN} onChange={e => setFormBboxN(e.target.value)} placeholder="North" className="px-2 py-1 rounded bg-slate-800/80 border border-slate-700/50 text-[10px] font-mono text-slate-200 placeholder-slate-500" />
							<input type="number" step="0.1" value={formBboxS} onChange={e => setFormBboxS(e.target.value)} placeholder="South" className="px-2 py-1 rounded bg-slate-800/80 border border-slate-700/50 text-[10px] font-mono text-slate-200 placeholder-slate-500" />
							<input type="number" step="0.1" value={formBboxW} onChange={e => setFormBboxW(e.target.value)} placeholder="West" className="px-2 py-1 rounded bg-slate-800/80 border border-slate-700/50 text-[10px] font-mono text-slate-200 placeholder-slate-500" />
							<input type="number" step="0.1" value={formBboxE} onChange={e => setFormBboxE(e.target.value)} placeholder="East" className="px-2 py-1 rounded bg-slate-800/80 border border-slate-700/50 text-[10px] font-mono text-slate-200 placeholder-slate-500" />
						</div>
					)}

					<button
						type="button"
						onClick={handleCreateRule}
						className="w-full mt-2 py-1 rounded text-[9px] font-mono font-bold tracking-wider bg-amber-900/30 text-amber-400 border border-amber-700/30 hover:bg-amber-900/50"
					>
						CREATE RULE
					</button>
				</div>
			)}

			{/* Active Rules */}
			<div className="flex-1 overflow-y-auto">
				{rules.length === 0 && (
					<div className="p-4 text-center text-[10px] font-mono text-slate-500">
						No rules defined. Create a rule to monitor conditions.
					</div>
				)}
				{rules.map(rule => (
					<div key={rule.id} className={`px-3 py-2 border-b border-slate-800/50 ${rule.enabled ? "" : "opacity-40"}`}>
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<button type="button" onClick={() => toggleRule(rule.id)} className={`w-4 h-4 rounded-full border-2 ${rule.enabled ? "bg-emerald-500/20 border-emerald-500" : "bg-slate-700 border-slate-600"}`}>
									{rule.enabled && <span className="block w-2 h-2 rounded-full bg-emerald-400 mx-auto" />}
								</button>
								<span className="text-[10px] font-mono font-bold text-slate-200">{rule.name}</span>
							</div>
							<button type="button" onClick={() => removeRule(rule.id)} className="text-red-500/50 hover:text-red-400 text-[10px]">✕</button>
						</div>
						<div className="mt-1 flex items-center gap-2">
							<span className="text-[7px] font-mono px-1 py-0.5 rounded bg-slate-800/80 text-slate-400">{rule.type.toUpperCase()}</span>
							<span className="text-[7px] font-mono px-1 py-0.5 rounded bg-cyan-900/30 text-cyan-400">{rule.entityType?.toUpperCase()}</span>
							<span className="text-[8px] font-mono text-slate-500">
								{rule.type === "proximity" && `${rule.radiusKm}km from (${rule.lat?.toFixed(1)}, ${rule.lon?.toFixed(1)})`}
								{rule.type === "threshold" && `${rule.field} ${rule.operator} ${rule.value}`}
								{rule.type === "keyword" && `"${rule.keyword}"`}
								{rule.type === "zone_entry" && `bbox [${rule.bbox?.south.toFixed(0)}°, ${rule.bbox?.north.toFixed(0)}°]`}
							</span>
						</div>
					</div>
				))}

				{/* Triggered Alerts History */}
				{alerts.length > 0 && (
					<>
						<div className="flex items-center justify-between px-3 py-1.5 bg-red-900/10 border-t border-red-800/30">
							<span className="text-[9px] font-mono font-bold text-red-400 tracking-widest">⚡ TRIGGERED ({alerts.length})</span>
							<button type="button" onClick={clearAlerts} className="text-[8px] font-mono text-slate-500 hover:text-red-400">CLEAR</button>
						</div>
						{alerts.slice(0, 20).map((a, i) => (
							<div key={`${a.ruleId}-${a.timestamp}-${i}`} className="px-3 py-1.5 border-b border-red-900/20 bg-red-900/5">
								<div className="flex items-center justify-between">
									<span className="text-[9px] font-mono font-bold text-red-300">{a.ruleName}</span>
									<span className="text-[7px] font-mono text-slate-500">{new Date(a.timestamp).toISOString().slice(11, 19)}Z</span>
								</div>
								<p className="text-[8px] font-mono text-slate-400 mt-0.5">{a.message}</p>
							</div>
						))}
					</>
				)}
			</div>
		</div>
	);
}
