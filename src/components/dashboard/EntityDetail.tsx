import { SQUAWK_DB, SEVERITY_COLORS } from "../../lib/constants";
import { getFreshness, getConfidence, getProvenance, getSeverity, getEntityTypeLabel } from "../../lib/badges";
import { fnv1a } from "../../lib/dedup";

interface EntityDetailProps {
	entity: Record<string, unknown> | null;
	onClose: () => void;
	onFlyTo?: (lat: number, lon: number) => void;
	onWatch?: (entity: Record<string, unknown>) => void;
}

function Field({ label, value, color, mono }: { label: string; value: unknown; color?: string; mono?: boolean }) {
	if (value === undefined || value === null || value === "") return null;
	return (
		<div className="flex items-start gap-2 py-0.5">
			<span className="text-[8px] font-mono text-slate-500 w-24 shrink-0 tracking-wider uppercase">{label}</span>
			<span className={`text-[10px] ${mono !== false ? "font-mono" : ""}`} style={{ color: color || "#c8dce8" }}>{String(value)}</span>
		</div>
	);
}

function Chip({ label, color, bgColor, border }: { label: string; color: string; bgColor?: string; border?: boolean }) {
	return (
		<span
			className="px-1.5 py-0.5 text-[7px] font-mono tracking-wider rounded inline-flex items-center gap-0.5"
			style={{
				backgroundColor: bgColor || `${color}22`,
				color,
				border: border ? `1px solid ${color}44` : undefined,
			}}
		>
			{label}
		</span>
	);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<div className="mt-2 pt-2 border-t border-slate-800/40">
			<div className="text-[7px] font-mono text-cyan-600 tracking-[0.2em] mb-1 uppercase">{title}</div>
			{children}
		</div>
	);
}

function formatCoord(lat: number, lon: number): string {
	const latDir = lat >= 0 ? "N" : "S";
	const lonDir = lon >= 0 ? "E" : "W";
	return `${Math.abs(lat).toFixed(4)}°${latDir}  ${Math.abs(lon).toFixed(4)}°${lonDir}`;
}

function formatAltitude(m: number): string {
	const ft = Math.round(m * 3.28084);
	return `${Math.round(m).toLocaleString()}m / FL${Math.round(ft / 100).toString().padStart(3, "0")} (${ft.toLocaleString()}ft)`;
}

function formatSpeed(ms: number): string {
	const kts = Math.round(ms * 1.94384);
	const kmh = Math.round(ms * 3.6);
	return `${Math.round(ms)}m/s  (${kts}kts / ${kmh}km/h)`;
}

function timeAgo(ts: number): string {
	const diff = Date.now() - ts;
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins}m ago`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
	return `${Math.floor(hrs / 24)}d ago`;
}

function getCardinal(deg: number): string {
	const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
	return dirs[Math.round(deg / 22.5) % 16];
}

export default function EntityDetail({ entity, onClose, onFlyTo, onWatch }: EntityDetailProps) {
	if (!entity) return null;

	const t = (entity._type || entity._layerType || entity._layerId || "unknown") as string;
	const squawkInfo = entity.squawk && entity.squawk !== "N/A" ? SQUAWK_DB[entity.squawk as string] : null;

	const isAircraft = ["aircraft", "military", "squawk", "aircraft-civilian", "aircraft-military", "aircraft-squawk"].includes(t);
	const isVessel = ["vessel", "vessels"].includes(t);
	const isSeismic = t === "seismic";
	const isConflict = ["conflict", "conflicts"].includes(t);
	const isDisaster = ["disaster", "disasters"].includes(t);
	const isFire = ["fire", "fires"].includes(t);
	const isSocial = t === "social";
	const isGNSS = ["gnss", "jamming-centers", "jamming-center"].includes(t);
	const isCyber = t === "cyber";
	const isWeather = t === "weather";
	const isSatellite = ["satellite", "satpos"].includes(t);
	const isISS = t === "iss";
	const isGdelt = t === "gdelt";
	const isNews = t === "news";

	const title = (entity.callsign || entity.name || entity.place || entity.title || entity.alertId || entity.mmsi || entity.eventId || "ENTITY") as string;
	const sevColor = SEVERITY_COLORS[(entity.severity as string)] || "#6a8ca0";

	const lat = Number(entity.latitude || entity.lat || 0);
	const lon = Number(entity.longitude || entity.lon || entity.lng || 0);
	const hasCoords = lat !== 0 || lon !== 0;

	const isMil = entity.isMilitary === true || entity.isMilitary === "true";
	const isEmerg = entity.isEmergency === true || entity.isEmergency === "true";
	const isJammed = entity.jammingFlag === true || entity.jammingFlag === "true";

	// Badge data
	const freshness = getFreshness(entity.timestamp as number | undefined);
	const confidence = getConfidence(entity.confidence as number | undefined);
	const provenance = getProvenance(entity.provenance as string | undefined);
	const severity = getSeverity(entity.severity as string | undefined);
	const entityType = getEntityTypeLabel(t);
	const hash = fnv1a({ id: entity._id || entity.eventId || entity.icao24 || entity.mmsi, source: entity.source });

	// Type label override for aircraft
	const typeLabel = isAircraft ? (isEmerg ? "EMERGENCY" : isMil ? "MIL AIR" : isJammed ? "JAMMED" : "AIRCRAFT")
		: entityType.label;
	const typeColor = isAircraft ? (isEmerg || isJammed ? "#ef4444" : isMil ? "#f97316" : "#00ccff") : entityType.color;

	return (
		<div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 w-[480px] max-w-[95vw] bg-slate-950/95 border border-slate-700/60 rounded-lg backdrop-blur-xl overflow-hidden shadow-2xl shadow-black/50">
			{/* Header bar */}
			<div className="flex items-center justify-between px-3 py-2 border-b border-slate-800/60" style={{ borderTopColor: typeColor, borderTopWidth: 2 }}>
				<div className="flex items-center gap-2 flex-1 min-w-0">
					<span className="text-[11px] font-mono font-bold tracking-wider truncate" style={{ color: typeColor }}>{title}</span>
					<Chip label={typeLabel} color={typeColor} border />
					{squawkInfo && <Chip label={`SQ ${entity.squawk} ${squawkInfo.label}`} color={SEVERITY_COLORS[squawkInfo.severity]} border />}
				</div>
				<div className="flex items-center gap-1 ml-2 shrink-0">
					{hasCoords && onFlyTo && (
						<button onClick={() => onFlyTo(lat, lon)} className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-cyan-900/30 border border-cyan-700/30 text-cyan-400 hover:bg-cyan-800/40 transition-colors" title="Fly to location">
							⊕ FLY TO
						</button>
					)}
					{onWatch && (
						<button onClick={() => onWatch(entity)} className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-amber-900/30 border border-amber-700/30 text-amber-400 hover:bg-amber-800/40 transition-colors" title="Add to watchlist">
							📌 WATCH
						</button>
					)}
					<button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-sm ml-1 transition-colors">✕</button>
				</div>
			</div>

			{/* ═══ BADGE ROW — Freshness / Confidence / Provenance / Severity ═══ */}
			<div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-slate-800/40 bg-black/20 flex-wrap">
				{/* Severity */}
				{severity.label !== "INFO" && (
					<Chip label={severity.label} color={severity.color} bgColor={severity.bgColor} border />
				)}
				{/* Freshness */}
				<Chip label={`⏱ ${freshness.label}`} color={freshness.color} bgColor={freshness.bgColor} />
				{/* Confidence */}
				<Chip label={`◎ ${confidence.label}`} color={confidence.color} bgColor={confidence.bgColor} />
				{/* Provenance */}
				<Chip label={provenance.shortLabel} color={provenance.color} bgColor={provenance.bgColor} />
				{provenance.isInferred && <Chip label="⚠ INFERRED" color="#ffaa00" bgColor="#ffaa0022" />}
				{/* Hash */}
				<span className="text-[7px] font-mono text-slate-600 ml-auto">#{hash}</span>
			</div>

			{/* Content */}
			<div className="p-3 space-y-0 max-h-[380px] overflow-y-auto scrollbar-thin">
				{/* Coordinates */}
				{hasCoords && (
					<div className="flex items-center gap-3 py-1 mb-1">
						<span className="text-[9px] font-mono text-emerald-400 tracking-wider">{formatCoord(lat, lon)}</span>
						{provenance.isInferred && <span className="text-[8px] font-mono text-amber-500">~ approx</span>}
					</div>
				)}

				{isAircraft && (
					<>
						<Section title="Identification">
							<Field label="ICAO HEX" value={entity.icao24} />
							<Field label="CALLSIGN" value={entity.callsign} />
							<Field label="ORIGIN" value={entity.originCountry} />
							{isMil && <Field label="CLASSIFICATION" value="MILITARY" color="#f97316" />}
						</Section>
						<Section title="Kinematics">
							<Field label="ALTITUDE" value={entity.baroAltitude ? formatAltitude(Number(entity.baroAltitude)) : entity.altitude ? formatAltitude(Number(entity.altitude)) : undefined} />
							<Field label="VELOCITY" value={entity.velocity ? formatSpeed(Number(entity.velocity)) : undefined} />
							<Field label="HEADING" value={entity.heading ? `${Math.round(Number(entity.heading))}° ${getCardinal(Number(entity.heading))}` : undefined} />
							<Field label="VERT RATE" value={entity.verticalRate ? `${Number(entity.verticalRate) > 0 ? "↑" : "↓"} ${Math.abs(Number(entity.verticalRate)).toFixed(1)} m/s` : undefined} />
						</Section>
						<Section title="Transponder">
							<Field label="SQUAWK" value={entity.squawk !== "N/A" ? entity.squawk : undefined} color={squawkInfo ? SEVERITY_COLORS[squawkInfo.severity] : undefined} />
							{squawkInfo && <Field label="SQUAWK DECODE" value={squawkInfo.label} color={SEVERITY_COLORS[squawkInfo.severity]} />}
							{isJammed && <Field label="⚠ GNSS STATUS" value="INTERFERENCE DETECTED" color="#ef4444" />}
						</Section>
					</>
				)}

				{isVessel && (
					<>
						<Section title="Identification">
							<Field label="MMSI" value={entity.mmsi} />
							<Field label="NAME" value={entity.name} />
							<Field label="TYPE" value={entity.shipType} />
							<Field label="FLAG" value={entity.flag} />
							<Field label="DESTINATION" value={entity.destination} />
						</Section>
						<Section title="Navigation">
							<Field label="SPEED" value={entity.speed ? `${entity.speed} kn` : undefined} />
							<Field label="COURSE" value={entity.course ? `${Number(entity.course as number).toFixed(1)}° ${getCardinal(Number(entity.course))}` : undefined} />
						</Section>
					</>
				)}

				{isSeismic && (
					<>
						<Section title="Event Details">
							<Field label="PLACE" value={entity.place} />
							<Field label="MAGNITUDE" value={entity.magnitude ? `M${Number(entity.magnitude).toFixed(1)} (${entity.magType || "ml"})` : undefined}
								color={Number(entity.magnitude) >= 6 ? "#ff2244" : Number(entity.magnitude) >= 4 ? "#ffaa00" : "#ffee00"} />
							<Field label="DEPTH" value={entity.depth ? `${Number(entity.depth).toFixed(1)} km` : undefined} />
						</Section>
						<Section title="Impact">
							<Field label="TSUNAMI" value={entity.tsunami === true || entity.tsunami === "true" ? "⚠ TSUNAMI WARNING" : "No warning"} color={entity.tsunami === true || entity.tsunami === "true" ? "#ff2244" : "#6a8ca0"} />
						</Section>
					</>
				)}

				{isConflict && (
					<>
						<Section title="Event Details">
							<Field label="EVENT TYPE" value={entity.eventType} />
							<Field label="SUB-TYPE" value={entity.subEventType} />
							<Field label="LOCATION" value={entity.title || entity.location} />
							<Field label="COUNTRY" value={entity.country} />
							<Field label="REGION" value={entity.region} />
						</Section>
						<Section title="Assessment">
							<Field label="SEVERITY" value={(entity.severity as string)?.toUpperCase()} color={sevColor} />
							<Field label="FATALITIES" value={entity.fatalities ? `${entity.fatalities} reported` : undefined} color={Number(entity.fatalities) > 0 ? "#ff2244" : undefined} />
							<Field label="ACTORS" value={entity.actor1} />
							<Field label="SOURCE" value={entity.source} />
						</Section>
					</>
				)}

				{isDisaster && (
					<>
						<Section title="Disaster Details">
							<Field label="TYPE" value={entity.eventType} />
							<Field label="ALERT" value={(entity.alertLevel as string)?.toUpperCase()} color={entity.alertLevel === "red" ? "#ff2244" : entity.alertLevel === "orange" ? "#ff6b00" : "#ffaa00"} />
							<Field label="COUNTRY" value={entity.country} />
							<Field label="DESCRIPTION" value={(entity.description as string)?.slice(0, 200)} mono={false} />
						</Section>
					</>
				)}

				{isFire && (
					<>
						<Section title="Fire Details">
							<Field label="BRIGHTNESS" value={entity.brightness ? `${Number(entity.brightness).toFixed(1)} K` : undefined} color={Number(entity.brightness) > 400 ? "#ff2244" : "#ff4400"} />
							<Field label="FRP" value={entity.frp ? `${Number(entity.frp).toFixed(1)} MW` : undefined} />
							<Field label="CONFIDENCE" value={entity.confidence ? `${entity.confidence}%` : undefined} />
							<Field label="SATELLITE" value={entity.satellite} />
						</Section>
					</>
				)}

				{isCyber && (
					<>
						<Section title="Threat Details">
							<Field label="THREAT TYPE" value={entity.threatType || entity.type} />
							<Field label="SOURCE" value={entity.sourceName || entity.source} />
							<Field label="INDICATOR" value={entity.indicator || entity.ioc} />
							<Field label="CVE" value={entity.cve} />
						</Section>
					</>
				)}

				{isGNSS && (
					<>
						<Section title="Jamming Details">
							<Field label="ALERT ID" value={entity.alertId} />
							<Field label="REGION" value={entity.region} />
							<Field label="RADIUS" value={entity.radius ? `${entity.radius} nm` : undefined} />
							<Field label="AFFECTED" value={entity.affectedAircraft ? `${entity.affectedAircraft} aircraft` : undefined} color={Number(entity.affectedAircraft) > 5 ? "#ff2244" : undefined} />
						</Section>
					</>
				)}

				{isSocial && (
					<>
						<Section title="Post Details">
							<Field label="SUBREDDIT" value={entity.subreddit} />
							<Field label="TITLE" value={entity.title} mono={false} />
							<Field label="AUTHOR" value={entity.author} />
							<Field label="SCORE" value={entity.score} />
							<Field label="COMMENTS" value={entity.numComments || entity.comments} />
						</Section>
					</>
				)}

				{isWeather && (
					<>
						<Section title="Conditions">
							<Field label="STATION" value={entity.name || entity.station} />
							<Field label="TEMP" value={entity.temp ? `${Number(entity.temp).toFixed(1)}°C` : undefined} />
							<Field label="WIND" value={entity.windSpeed ? `${entity.windSpeed} m/s @ ${entity.windDeg || 0}°` : undefined} />
							<Field label="HUMIDITY" value={entity.humidity ? `${entity.humidity}%` : undefined} />
							<Field label="PRESSURE" value={entity.pressure ? `${entity.pressure} hPa` : undefined} />
						</Section>
					</>
				)}

				{isGdelt && (
					<>
						<Section title="GDELT Event">
							<Field label="CATEGORY" value={entity.category} />
							<Field label="TITLE" value={entity.title} mono={false} />
							<Field label="SOURCE" value={entity.sourceName || entity.domain} />
						</Section>
					</>
				)}

				{isNews && (
					<>
						<Section title="News Item">
							<Field label="TITLE" value={entity.title} mono={false} />
							<Field label="SOURCE" value={entity.sourceName || entity.source} />
							<Field label="CATEGORY" value={entity.category} />
						</Section>
					</>
				)}

				{!!(isSatellite || isISS) && (
					<>
						<Section title="Orbital Data">
							<Field label="NAME" value={entity.name || entity.satName || entity.satname} />
							<Field label="NORAD ID" value={entity.satId || entity.satid || entity.noradId} />
							<Field label="ALTITUDE" value={entity.altitude || entity.satalt ? `${Number(entity.altitude || entity.satalt).toFixed(1)} km` : undefined} />
							<Field label="VELOCITY" value={entity.velocity ? `${Number(entity.velocity).toFixed(2)} km/s` : undefined} />
							<Field label="INCLINATION" value={entity.inclination ? `${entity.inclination}°` : undefined} />
						</Section>
					</>
				)}

				{/* Timestamps */}
				{!!(entity._creationTime || entity.timestamp || entity.detectedAt) && (
					<Section title="Temporal">
						{!!entity._creationTime && <Field label="INGESTED" value={new Date(Number(entity._creationTime)).toISOString().replace("T", " ").slice(0, 19) + "Z"} />}
						{!!entity.timestamp && <Field label="TIMESTAMP" value={typeof entity.timestamp === "number" ? timeAgo(entity.timestamp as number) + " (" + new Date(entity.timestamp as number).toISOString().slice(11, 19) + "Z)" : String(entity.timestamp)} />}
						{!!entity.detectedAt && <Field label="DETECTED" value={timeAgo(Number(entity.detectedAt))} />}
					</Section>
				)}

				{/* Provenance detail */}
				<Section title="Provenance">
					<Field label="SOURCE" value={entity.source} />
					<Field label="PROVENANCE" value={provenance.label} color={provenance.color} />
					<Field label="CONFIDENCE" value={`${confidence.value}% (${confidence.level})`} color={confidence.color} />
					<Field label="FRESHNESS" value={`${freshness.label} (${freshness.level})`} color={freshness.color} />
					<Field label="FNV-1a HASH" value={`#${hash}`} />
				</Section>

				{/* Raw JSON */}
				<details className="mt-2 pt-2 border-t border-slate-800/30">
					<summary className="text-[7px] font-mono text-slate-600 tracking-wider cursor-pointer hover:text-slate-400 transition-colors">
						▸ RAW METADATA ({Object.keys(entity).filter(k => !k.startsWith("_")).length} fields)
					</summary>
					<pre className="text-[8px] font-mono text-slate-600 whitespace-pre-wrap break-all max-h-[150px] overflow-y-auto mt-1 p-1 bg-black/30 rounded">
						{JSON.stringify(entity, null, 2)}
					</pre>
				</details>
			</div>

			{/* Action bar with badges summary */}
			<div className="flex items-center gap-1.5 px-3 py-1.5 border-t border-slate-800/60 bg-black/30">
				{hasCoords && (
					<span className="text-[8px] font-mono text-slate-600">{lat.toFixed(4)}, {lon.toFixed(4)}</span>
				)}
				<span className="flex-1" />
				{hasCoords && onFlyTo && (
					<button onClick={() => onFlyTo(lat, lon)} className="text-[8px] font-mono px-2 py-0.5 rounded text-slate-600 border border-slate-700/30 hover:text-slate-400 transition-colors">
						⊕ CENTER
					</button>
				)}
			</div>
		</div>
	);
}
