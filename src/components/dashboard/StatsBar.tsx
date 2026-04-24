import {
	useAircraft, useConflictEvents, useJammingAlerts, useFires,
	useVessels, useSatellitePositions, useSeismicEvents,
	useDisasters, useSocialPosts, useCyberIntel, useGdeltEvents,
} from "../../hooks/useEntityData";
import { MIL_CALLSIGN_RE } from "../../lib/constants";

export default function StatsBar() {
	const aircraft = useAircraft();
	const conflicts = useConflictEvents();
	const jamming = useJammingAlerts();
	const fires = useFires();
	const vessels = useVessels();
	const satellites = useSatellitePositions();
	const seismic = useSeismicEvents();
	const disasters = useDisasters();
	const social = useSocialPosts();
	const cyberIntel = useCyberIntel();
	const gdelt = useGdeltEvents();
	const militaryCount = aircraft.filter(ac => ac.isMilitary || MIL_CALLSIGN_RE.test(ac.callsign)).length;

	const stats = [
		{ label: "AIRCRAFT", value: aircraft.length, color: "#00ccff" },
		{ label: "MIL AIR", value: militaryCount, color: "#ff3355" },
		{ label: "VESSELS", value: vessels.length, color: "#00ff88" },
		{ label: "FIRES", value: fires.length, color: "#ff5500" },
		{ label: "SEISMIC", value: seismic.length, color: "#ffee00" },
		{ label: "CONFLICT", value: conflicts.length + gdelt.filter(e => e.category === "conflict").length, color: "#ff2200" },
		{ label: "DISASTERS", value: disasters.length, color: "#ff8c00" },
		{ label: "GNSS JAM", value: jamming.length, color: "#ff6633" },
		{ label: "CYBER", value: cyberIntel.length, color: "#66ffcc" },
		{ label: "SATELLITES", value: satellites.length, color: "#ffcc00" },
		{ label: "SOCIAL", value: social.length, color: "#ff44aa" },
		{ label: "GDELT", value: gdelt.length, color: "#9966ff" },
	];

	return (
		<div className="flex flex-wrap gap-x-3 gap-y-0.5 px-3 py-1.5 bg-[rgba(2,10,18,0.9)] border-b border-[rgba(0,204,255,0.1)]">
			{stats.map((s) => (
				<div key={s.label} className="flex items-center gap-1">
					<div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
					<span className="text-[9px] font-mono tracking-[0.1em] text-[#4a6a7c]">{s.label}</span>
					<span className="text-[10px] font-mono text-[#c8dce8]" style={{ color: s.value > 0 ? s.color : undefined }}>{s.value}</span>
				</div>
			))}
		</div>
	);
}
