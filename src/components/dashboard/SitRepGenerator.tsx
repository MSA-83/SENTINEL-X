import { useCallback, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

function utcNow(): string {
	return new Date().toISOString().replace("T", " ").slice(0, 19) + "Z";
}

function severityColor(s: string): string {
	const m: Record<string, string> = { critical: "#ef4444", high: "#f97316", medium: "#eab308", low: "#22d3ee" };
	return m[s?.toLowerCase()] ?? "#94a3b8";
}

export default function SitRepGenerator() {
	const [generating, setGenerating] = useState(false);

	// Pull all entity data for the report
	const aircraft = useQuery(api.entities.listAircraft) ?? [];
	const conflicts = useQuery(api.entities.listConflictEvents) ?? [];
	const seismic = useQuery(api.entities.listSeismicEvents) ?? [];
	const disasters = useQuery(api.entities.listDisasters) ?? [];
	const fires = useQuery(api.entities.listFires) ?? [];
	const jammingAlerts = useQuery(api.entities.listJammingAlerts) ?? [];
	const cyberThreats = useQuery(api.entities.listCyberThreats) ?? [];
	const stats = useQuery(api.entities.getStats) ?? [];
	const sources = useQuery(api.entities.listDataSourceStatus) ?? [];

	const generateReport = useCallback(() => {
		setGenerating(true);

		const emergencyAircraft = aircraft.filter((a: Record<string, unknown>) =>
			["7500", "7600", "7700"].includes(String(a.squawk ?? ""))
		);
		const highConflicts = conflicts.filter((c: Record<string, unknown>) =>
			["critical", "high"].includes(String(c.severity ?? "").toLowerCase())
		);
		const majorSeismic = seismic.filter((s: Record<string, unknown>) =>
			Number(s.magnitude ?? 0) >= 5.0
		);
		const activeDisasters = disasters.filter((d: Record<string, unknown>) =>
			String(d.alertLevel ?? "").toLowerCase() === "red"
		);
		const activeJamming = jammingAlerts.filter((j: Record<string, unknown>) =>
			j.active === true
		);

		// Calculate threat level
		let threatScore = 0;
		threatScore += emergencyAircraft.length * 15;
		threatScore += highConflicts.length * 10;
		threatScore += majorSeismic.length * 8;
		threatScore += activeDisasters.length * 12;
		threatScore += activeJamming.length * 10;
		threatScore += cyberThreats.length * 3;
		threatScore = Math.min(threatScore, 100);

		const threatLevel =
			threatScore >= 80 ? "SEVERE" :
			threatScore >= 60 ? "HIGH" :
			threatScore >= 40 ? "ELEVATED" :
			threatScore >= 20 ? "GUARDED" : "LOW";

		const activeSources = sources.filter((s: Record<string, unknown>) => s.status === "active").length;
		const degradedSources = sources.filter((s: Record<string, unknown>) => s.status === "degraded").length;
		const errorSources = sources.filter((s: Record<string, unknown>) => s.status === "error").length;

		const statsMap: Record<string, number> = {};
		for (const s of stats) {
			const rec = s as Record<string, unknown>;
			statsMap[String(rec.label ?? "")] = Number(rec.value ?? 0);
		}

		const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>SENTINEL-X SITREP ${utcNow()}</title>
<style>
	* { margin: 0; padding: 0; box-sizing: border-box; }
	body { font-family: 'Courier New', monospace; background: #0a0e1a; color: #cbd5e1; font-size: 11px; line-height: 1.5; }
	.page { max-width: 800px; margin: 0 auto; padding: 24px; }
	.header { text-align: center; border: 1px solid #334155; padding: 16px; margin-bottom: 16px; }
	.header h1 { font-size: 18px; color: #22d3ee; letter-spacing: 4px; }
	.header .classification { font-size: 10px; color: #ef4444; letter-spacing: 6px; margin-top: 4px; }
	.header .time { font-size: 10px; color: #64748b; margin-top: 8px; }
	.threat-banner { text-align: center; padding: 12px; margin-bottom: 16px; border: 2px solid; font-size: 14px; font-weight: bold; letter-spacing: 3px; }
	.section { margin-bottom: 16px; border: 1px solid #1e293b; }
	.section-title { background: #1e293b; padding: 6px 12px; font-size: 11px; color: #22d3ee; letter-spacing: 2px; }
	.section-body { padding: 10px 12px; }
	table { width: 100%; border-collapse: collapse; font-size: 10px; }
	th { text-align: left; color: #64748b; padding: 3px 6px; border-bottom: 1px solid #1e293b; }
	td { padding: 3px 6px; border-bottom: 1px solid #0f172a; }
	.badge { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 9px; font-weight: bold; }
	.stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
	.stat-box { text-align: center; padding: 8px; border: 1px solid #1e293b; }
	.stat-value { font-size: 20px; color: #22d3ee; font-weight: bold; }
	.stat-label { font-size: 8px; color: #64748b; letter-spacing: 1px; margin-top: 2px; }
	.footer { text-align: center; margin-top: 24px; padding-top: 12px; border-top: 1px solid #1e293b; color: #334155; font-size: 9px; }
	@media print { body { background: #fff; color: #000; } .header, .section { border-color: #999; } .section-title { background: #eee; color: #000; } th { color: #666; } td { border-color: #ddd; } .stat-value { color: #0284c7; } }
</style>
</head>
<body>
<div class="page">
	<div class="header">
		<div class="classification">TOP SECRET // SENTINEL-X // NOFORN</div>
		<h1>■ SITUATIONAL AWARENESS REPORT</h1>
		<div class="time">Generated: ${utcNow()} | Classification: TS//SCI</div>
	</div>

	<div class="threat-banner" style="border-color: ${severityColor(threatLevel.toLowerCase())}; color: ${severityColor(threatLevel.toLowerCase())};">
		GLOBAL THREAT LEVEL: ${threatLevel} (${threatScore}/100)
	</div>

	<div class="section">
		<div class="section-title">▸ EXECUTIVE SUMMARY</div>
		<div class="section-body">
			<div class="stat-grid">
				<div class="stat-box">
					<div class="stat-value">${aircraft.length}</div>
					<div class="stat-label">AIRCRAFT TRACKED</div>
				</div>
				<div class="stat-box">
					<div class="stat-value">${conflicts.length}</div>
					<div class="stat-label">CONFLICT EVENTS</div>
				</div>
				<div class="stat-box">
					<div class="stat-value">${fires.length}</div>
					<div class="stat-label">ACTIVE FIRES</div>
				</div>
				<div class="stat-box">
					<div class="stat-value">${seismic.length}</div>
					<div class="stat-label">SEISMIC EVENTS</div>
				</div>
			</div>
		</div>
	</div>

	${emergencyAircraft.length > 0 ? `
	<div class="section">
		<div class="section-title" style="background: #450a0a; color: #ef4444;">▸ ⚠ EMERGENCY SQUAWKS</div>
		<div class="section-body">
			<table>
				<tr><th>CALLSIGN</th><th>ICAO24</th><th>SQUAWK</th><th>ALT</th><th>SPEED</th></tr>
				${emergencyAircraft.map((a: Record<string, unknown>) => `
				<tr>
					<td style="color:#ef4444;font-weight:bold">${a.callsign ?? "UNKNOWN"}</td>
					<td>${a.icao24 ?? "—"}</td>
					<td><span class="badge" style="background:#7f1d1d;color:#fca5a5">${a.squawk}</span></td>
					<td>${a.altitude ? Number(a.altitude).toLocaleString() + " ft" : "—"}</td>
					<td>${a.velocity ?? "—"} kts</td>
				</tr>`).join("")}
			</table>
		</div>
	</div>` : ""}

	${highConflicts.length > 0 ? `
	<div class="section">
		<div class="section-title">▸ HIGH-PRIORITY CONFLICT EVENTS (${highConflicts.length})</div>
		<div class="section-body">
			<table>
				<tr><th>EVENT</th><th>TYPE</th><th>SEVERITY</th><th>LOCATION</th><th>SOURCE</th></tr>
				${highConflicts.slice(0, 15).map((c: Record<string, unknown>) => `
				<tr>
					<td>${String(c.event ?? "").slice(0, 40)}</td>
					<td>${c.eventType ?? "—"}</td>
					<td><span class="badge" style="background:${severityColor(String(c.severity))}33;color:${severityColor(String(c.severity))}">${String(c.severity).toUpperCase()}</span></td>
					<td>${c.country ?? "—"}</td>
					<td>${c.source ?? "—"}</td>
				</tr>`).join("")}
			</table>
		</div>
	</div>` : ""}

	${majorSeismic.length > 0 ? `
	<div class="section">
		<div class="section-title">▸ SIGNIFICANT SEISMIC ACTIVITY (M5.0+)</div>
		<div class="section-body">
			<table>
				<tr><th>LOCATION</th><th>MAGNITUDE</th><th>DEPTH</th><th>TSUNAMI</th></tr>
				${majorSeismic.slice(0, 10).map((s: Record<string, unknown>) => `
				<tr>
					<td>${s.place ?? "Unknown"}</td>
					<td style="color:#f59e0b;font-weight:bold">M${Number(s.magnitude).toFixed(1)}</td>
					<td>${s.depth ? Number(s.depth).toFixed(0) + " km" : "—"}</td>
					<td>${s.tsunami ? "⚠ YES" : "No"}</td>
				</tr>`).join("")}
			</table>
		</div>
	</div>` : ""}

	${activeDisasters.length > 0 ? `
	<div class="section">
		<div class="section-title" style="background:#450a0a;color:#ef4444;">▸ RED-ALERT DISASTERS</div>
		<div class="section-body">
			<table>
				<tr><th>EVENT</th><th>TYPE</th><th>AFFECTED</th></tr>
				${activeDisasters.slice(0, 10).map((d: Record<string, unknown>) => `
				<tr>
					<td style="color:#ef4444">${d.title ?? "Unknown"}</td>
					<td>${d.eventType ?? "—"}</td>
					<td>${d.affectedCountries ?? "—"}</td>
				</tr>`).join("")}
			</table>
		</div>
	</div>` : ""}

	${activeJamming.length > 0 ? `
	<div class="section">
		<div class="section-title">▸ GNSS JAMMING / SPOOFING ALERTS</div>
		<div class="section-body">
			<table>
				<tr><th>REGION</th><th>TYPE</th><th>CONFIDENCE</th></tr>
				${activeJamming.map((j: Record<string, unknown>) => `
				<tr>
					<td>${j.region ?? "Unknown"}</td>
					<td>${j.type ?? "—"}</td>
					<td>${j.confidence ?? "—"}%</td>
				</tr>`).join("")}
			</table>
		</div>
	</div>` : ""}

	<div class="section">
		<div class="section-title">▸ DATA SOURCE STATUS</div>
		<div class="section-body">
			<div style="font-size:10px;margin-bottom:6px;">
				<span style="color:#22c55e">● ${activeSources} Active</span> &nbsp;
				<span style="color:#eab308">● ${degradedSources} Degraded</span> &nbsp;
				<span style="color:#ef4444">● ${errorSources} Error</span>
			</div>
			<table>
				<tr><th>SOURCE</th><th>STATUS</th><th>LAST UPDATE</th><th>RECORDS</th></tr>
				${sources.slice(0, 20).map((s: Record<string, unknown>) => `
				<tr>
					<td>${s.name ?? s.sourceId ?? "—"}</td>
					<td style="color:${s.status === "active" ? "#22c55e" : s.status === "degraded" ? "#eab308" : "#ef4444"}">${String(s.status ?? "—").toUpperCase()}</td>
					<td>${s.lastSuccess ? new Date(Number(s.lastSuccess)).toISOString().slice(0, 19) + "Z" : "—"}</td>
					<td>${s.recordCount ?? "—"}</td>
				</tr>`).join("")}
			</table>
		</div>
	</div>

	<div class="footer">
		SENTINEL-X GLOBAL SITUATIONAL AWARENESS PLATFORM<br>
		Report ID: SITREP-${Date.now().toString(36).toUpperCase()} | AUTO-GENERATED | DO NOT FORWARD
	</div>
</div>
</body>
</html>`;

		// Open in new tab for print
		const blob = new Blob([html], { type: "text/html" });
		const url = URL.createObjectURL(blob);
		const w = window.open(url, "_blank");
		if (w) {
			w.onload = () => setTimeout(() => w.print(), 500);
		}

		setGenerating(false);
	}, [aircraft, conflicts, seismic, disasters, fires, jammingAlerts, cyberThreats, stats, sources]);

	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between">
				<span className="text-[10px] font-mono text-slate-400 tracking-wider">SITREP GENERATOR</span>
			</div>

			<button
				onClick={generateReport}
				disabled={generating}
				className="w-full py-2 bg-slate-800/60 hover:bg-slate-700/60 border border-slate-600/40 rounded text-[10px] font-mono text-cyan-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
			>
				{generating ? (
					<>
						<span className="animate-spin">◌</span> GENERATING...
					</>
				) : (
					<>
						📋 GENERATE SITUATIONAL REPORT
					</>
				)}
			</button>

			<div className="text-[8px] font-mono text-slate-600 text-center">
				Opens formatted SITREP in new tab • Print to PDF supported
			</div>

			<div className="border-t border-slate-700/20 pt-2 space-y-1">
				<div className="text-[8px] font-mono text-slate-500">Report includes:</div>
				<div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[8px] font-mono text-slate-600">
					<span>• Threat assessment</span>
					<span>• Emergency squawks</span>
					<span>• Conflict events</span>
					<span>• Seismic activity</span>
					<span>• Disaster alerts</span>
					<span>• GNSS jamming</span>
					<span>• Source health</span>
					<span>• Statistics</span>
				</div>
			</div>
		</div>
	);
}
