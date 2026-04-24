import { useCallback } from "react";
import {
	useAircraft, useConflictEvents, useFires, useVessels,
	useSeismicEvents, useDisasters, useCyberThreats, useGdeltEvents,
} from "../../hooks/useEntityData";

function toCSV(headers: string[], rows: string[][]): string {
	const escape = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
	return [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
}

function downloadCSV(filename: string, csv: string) {
	const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
	const link = document.createElement("a");
	link.href = URL.createObjectURL(blob);
	link.download = filename;
	link.click();
	URL.revokeObjectURL(link.href);
}

interface ExportEntry {
	label: string;
	icon: string;
	count: number;
	exportFn: () => void;
}

export default function ExportPanel() {
	const aircraft = useAircraft();
	const conflicts = useConflictEvents();
	const fires = useFires();
	const vessels = useVessels();
	const seismic = useSeismicEvents();
	const disasters = useDisasters();
	const cyber = useCyberThreats();
	const gdelt = useGdeltEvents();

	const ts = () => new Date().toISOString().slice(0, 10);

	const exportAircraft = useCallback(() => {
		const csv = toCSV(
			["icao24", "callsign", "origin_country", "latitude", "longitude", "altitude", "velocity", "heading", "squawk", "on_ground"],
			aircraft.map((a: Record<string, unknown>) => [
				String(a.icao24 ?? ""), String(a.callsign ?? ""), String(a.originCountry ?? ""),
				String(a.latitude ?? ""), String(a.longitude ?? ""), String(a.altitude ?? ""),
				String(a.velocity ?? ""), String(a.heading ?? ""), String(a.squawk ?? ""), String(a.onGround ?? ""),
			]),
		);
		downloadCSV(`sentinel-x-aircraft-${ts()}.csv`, csv);
	}, [aircraft]);

	const exportConflicts = useCallback(() => {
		const csv = toCSV(
			["location", "event_type", "severity", "fatalities", "latitude", "longitude", "date", "source"],
			conflicts.map((c: Record<string, unknown>) => [
				String(c.location ?? ""), String(c.eventType ?? ""), String(c.severity ?? ""),
				String(c.fatalities ?? ""), String(c.latitude ?? ""), String(c.longitude ?? ""),
				String(c.eventDate ?? ""), String(c.source ?? ""),
			]),
		);
		downloadCSV(`sentinel-x-conflicts-${ts()}.csv`, csv);
	}, [conflicts]);

	const exportFires = useCallback(() => {
		const csv = toCSV(
			["latitude", "longitude", "brightness", "confidence", "satellite", "acq_date"],
			fires.map((f: Record<string, unknown>) => [
				String(f.latitude ?? ""), String(f.longitude ?? ""), String(f.brightness ?? ""),
				String(f.confidence ?? ""), String(f.satellite ?? ""), String(f.acqDate ?? ""),
			]),
		);
		downloadCSV(`sentinel-x-fires-${ts()}.csv`, csv);
	}, [fires]);

	const exportSeismic = useCallback(() => {
		const csv = toCSV(
			["place", "magnitude", "depth", "latitude", "longitude", "time", "tsunami"],
			seismic.map((s: Record<string, unknown>) => [
				String(s.place ?? ""), String(s.magnitude ?? ""), String(s.depth ?? ""),
				String(s.latitude ?? ""), String(s.longitude ?? ""), String(s.time ?? ""), String(s.tsunami ?? ""),
			]),
		);
		downloadCSV(`sentinel-x-seismic-${ts()}.csv`, csv);
	}, [seismic]);

	const entries: ExportEntry[] = [
		{ label: "Aircraft", icon: "✈", count: aircraft.length, exportFn: exportAircraft },
		{ label: "Conflicts", icon: "⚔", count: conflicts.length, exportFn: exportConflicts },
		{ label: "Fires", icon: "🔥", count: fires.length, exportFn: exportFires },
		{ label: "Vessels", icon: "⚓", count: vessels.length, exportFn: () => downloadCSV(`sentinel-x-vessels-${ts()}.csv`, toCSV(["name", "mmsi", "lat", "lon", "type", "flag"], vessels.map((v: Record<string, unknown>) => [String(v.name ?? ""), String(v.mmsi ?? ""), String(v.latitude ?? ""), String(v.longitude ?? ""), String(v.type ?? ""), String(v.flag ?? "")]))) },
		{ label: "Seismic", icon: "!", count: seismic.length, exportFn: exportSeismic },
		{ label: "Disasters", icon: "⚠", count: disasters.length, exportFn: () => downloadCSV(`sentinel-x-disasters-${ts()}.csv`, toCSV(["title", "alertLevel", "type", "lat", "lon"], disasters.map((d: Record<string, unknown>) => [String(d.title ?? ""), String(d.alertLevel ?? ""), String(d.type ?? ""), String(d.latitude ?? ""), String(d.longitude ?? "")]))) },
		{ label: "Cyber", icon: "🔒", count: cyber.length, exportFn: () => downloadCSV(`sentinel-x-cyber-${ts()}.csv`, toCSV(["type", "indicator", "source", "severity"], cyber.map((c: Record<string, unknown>) => [String(c.type ?? ""), String(c.indicator ?? ""), String(c.source ?? ""), String(c.severity ?? "")]))) },
		{ label: "GDELT", icon: "🌐", count: gdelt.length, exportFn: () => downloadCSV(`sentinel-x-gdelt-${ts()}.csv`, toCSV(["title", "category", "lat", "lon", "url"], gdelt.map((g: Record<string, unknown>) => [String(g.title ?? ""), String(g.category ?? ""), String(g.latitude ?? ""), String(g.longitude ?? ""), String(g.url ?? "")]))) },
	];

	const exportAll = useCallback(() => {
		entries.forEach((e) => { if (e.count > 0) e.exportFn(); });
	}, [entries]);

	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between">
				<span className="text-[10px] font-mono text-slate-400 tracking-wider">DATA EXPORT</span>
				<button
					onClick={exportAll}
					className="text-[9px] font-mono text-cyan-400 hover:text-cyan-300 border border-cyan-800/40 rounded px-1.5 py-0.5"
				>
					⬇ EXPORT ALL
				</button>
			</div>
			<div className="grid grid-cols-2 gap-1">
				{entries.map((e) => (
					<button
						key={e.label}
						onClick={e.exportFn}
						disabled={e.count === 0}
						className="flex items-center gap-1.5 p-1.5 rounded border border-slate-700/30 bg-black/30 hover:bg-slate-800/50 disabled:opacity-30 disabled:cursor-not-allowed text-left transition-colors"
					>
						<span className="text-sm">{e.icon}</span>
						<div className="min-w-0">
							<div className="text-[10px] font-mono text-slate-300 truncate">{e.label}</div>
							<div className="text-[8px] font-mono text-slate-500">{e.count} records</div>
						</div>
					</button>
				))}
			</div>
		</div>
	);
}
