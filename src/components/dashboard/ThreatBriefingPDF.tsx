/**
 * ThreatBriefingPDF — Auto-generate a classified-style intelligence briefing
 * Renders to a new window as a printable HTML document with charts.
 */
import { useCallback, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

function utcStamp(): string {
	return new Date().toISOString().replace("T", " ").slice(0, 19) + "Z";
}

function dtg(): string {
	const d = new Date();
	const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
	const day = String(d.getUTCDate()).padStart(2, "0");
	const hr = String(d.getUTCHours()).padStart(2, "0");
	const min = String(d.getUTCMinutes()).padStart(2, "0");
	return `${day}${hr}${min}Z ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function threatLevel(score: number): { label: string; color: string } {
	if (score >= 80) return { label: "CRITICAL", color: "#ef4444" };
	if (score >= 60) return { label: "HIGH", color: "#f97316" };
	if (score >= 40) return { label: "ELEVATED", color: "#eab308" };
	if (score >= 20) return { label: "GUARDED", color: "#06b6d4" };
	return { label: "LOW", color: "#22c55e" };
}

type Rec = Record<string, unknown>;

export default function ThreatBriefingPDF() {
	const [generating, setGenerating] = useState(false);

	const aircraft = useQuery(api.entities.listAircraft) ?? [];
	const conflicts = useQuery(api.entities.listConflictEvents) ?? [];
	const seismic = useQuery(api.entities.listSeismicEvents) ?? [];
	const disasters = useQuery(api.entities.listDisasters) ?? [];
	const fires = useQuery(api.entities.listFires) ?? [];
	const jamming = useQuery(api.entities.listJammingAlerts) ?? [];
	const cyber = useQuery(api.entities.listCyberThreats) ?? [];
	const vessels = useQuery(api.entities.listVessels) ?? [];
	const news = useQuery(api.entities.listNewsItems) ?? [];
	const sources = useQuery(api.entities.listDataSourceStatus) ?? [];

	const generate = useCallback(() => {
		setGenerating(true);

		const emergencyAC = (aircraft as Rec[]).filter(a => ["7500","7600","7700"].includes(String(a.squawk ?? "")));
		const highConflicts = (conflicts as Rec[]).filter(c => ["critical","high"].includes(String(c.severity ?? "").toLowerCase()));
		const majorQuakes = (seismic as Rec[]).filter(s => Number(s.magnitude ?? 0) >= 5.0);
		const redDisasters = (disasters as Rec[]).filter(d => String(d.alertLevel ?? "").toLowerCase() === "red");
		const activeJam = (jamming as Rec[]).filter(j => j.active === true);

		let score = 0;
		score += emergencyAC.length * 15;
		score += highConflicts.length * 10;
		score += majorQuakes.length * 8;
		score += redDisasters.length * 12;
		score += activeJam.length * 10;
		score = Math.min(score, 100);
		const tl = threatLevel(score);

		// Build severity distribution for chart
		const sevCounts = { critical: 0, high: 0, medium: 0, low: 0 };
		for (const c of conflicts as Rec[]) {
			const s = String(c.severity ?? "").toLowerCase();
			if (s in sevCounts) sevCounts[s as keyof typeof sevCounts]++;
		}

		// Source health
		const srcOnline = (sources as Rec[]).filter(s => s.status === "online").length;
		const srcTotal = (sources as Rec[]).length || 1;

		// Sector breakdown
		const sectors: Record<string, number> = {};
		for (const c of conflicts as Rec[]) {
			const country = String(c.country ?? c.region ?? "Unknown");
			sectors[country] = (sectors[country] ?? 0) + 1;
		}
		const topSectors = Object.entries(sectors).sort((a, b) => b[1] - a[1]).slice(0, 8);

		// Fire regions
		const fireRegions: Record<string, number> = {};
		for (const f of fires as Rec[]) {
			const region = String(f.source ?? f.satellite ?? "Unknown");
			fireRegions[region] = (fireRegions[region] ?? 0) + 1;
		}

		const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>SENTINEL-X Threat Briefing — ${dtg()}</title>
<style>
@page { size: A4; margin: 15mm; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Courier New', monospace; background: #0f172a; color: #e2e8f0; font-size: 11px; line-height: 1.5; }
.page { max-width: 210mm; margin: 0 auto; padding: 20px; }
.banner { background: ${tl.color}22; border: 2px solid ${tl.color}; text-align: center; padding: 8px; font-size: 14px; font-weight: bold; letter-spacing: 4px; color: ${tl.color}; margin-bottom: 4px; }
.classification { background: #dc262622; border: 1px solid #dc262666; text-align: center; padding: 4px; font-size: 10px; font-weight: bold; letter-spacing: 6px; color: #ef4444; }
.header { text-align: center; padding: 16px 0; border-bottom: 1px solid #334155; }
.header h1 { font-size: 22px; letter-spacing: 6px; color: #06b6d4; margin-bottom: 4px; }
.header .subtitle { font-size: 10px; color: #64748b; letter-spacing: 2px; }
.meta-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin: 12px 0; }
.meta-box { background: #1e293b; border: 1px solid #334155; border-radius: 4px; padding: 8px; }
.meta-label { font-size: 8px; color: #64748b; letter-spacing: 2px; text-transform: uppercase; }
.meta-value { font-size: 16px; font-weight: bold; color: #06b6d4; margin-top: 2px; }
.section { margin: 16px 0; }
.section-title { font-size: 12px; font-weight: bold; color: #06b6d4; letter-spacing: 3px; border-bottom: 1px solid #334155; padding-bottom: 4px; margin-bottom: 8px; }
table { width: 100%; border-collapse: collapse; font-size: 10px; }
th { background: #1e293b; color: #06b6d4; text-align: left; padding: 4px 6px; letter-spacing: 1px; font-size: 9px; border-bottom: 1px solid #334155; }
td { padding: 3px 6px; border-bottom: 1px solid #1e293b; color: #cbd5e1; }
tr:nth-child(even) td { background: #0f172a22; }
.badge { display: inline-block; padding: 1px 6px; border-radius: 2px; font-size: 8px; font-weight: bold; letter-spacing: 1px; }
.badge-critical { background: #dc262633; color: #ef4444; border: 1px solid #dc262666; }
.badge-high { background: #ea580c33; color: #f97316; border: 1px solid #ea580c66; }
.badge-medium { background: #ca8a0433; color: #eab308; border: 1px solid #ca8a0466; }
.badge-low { background: #06b6d433; color: #22d3ee; border: 1px solid #06b6d466; }
.chart-bar { height: 14px; border-radius: 2px; display: flex; align-items: center; padding-left: 4px; font-size: 8px; font-weight: bold; margin: 2px 0; }
.threat-gauge { text-align: center; padding: 12px; }
.gauge-label { font-size: 28px; font-weight: bold; letter-spacing: 6px; }
.gauge-score { font-size: 14px; color: #64748b; }
.footer { text-align: center; border-top: 1px solid #334155; padding-top: 8px; margin-top: 20px; font-size: 8px; color: #475569; letter-spacing: 2px; }
.summary-box { background: #1e293b; border-left: 3px solid #06b6d4; padding: 8px 12px; margin: 8px 0; }
.stat-row { display: flex; justify-content: space-between; padding: 2px 0; }
@media print {
  body { background: white; color: #1e293b; }
  .banner, .classification { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .meta-box, th, .summary-box { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
</style>
</head><body>
<div class="page">
<div class="classification">TOP SECRET // SENTINEL-X // NOFORN</div>
<div class="banner">THREAT LEVEL: ${tl.label}</div>

<div class="header">
<h1>⬡ SENTINEL-X</h1>
<div class="subtitle">GLOBAL SITUATIONAL AWARENESS BRIEFING</div>
<div class="subtitle" style="margin-top:4px">DTG: ${dtg()} &nbsp;|&nbsp; GENERATED: ${utcStamp()}</div>
</div>

<!-- Summary Metrics -->
<div class="meta-grid">
<div class="meta-box"><div class="meta-label">THREAT SCORE</div><div class="meta-value" style="color:${tl.color}">${score}/100</div></div>
<div class="meta-box"><div class="meta-label">TRACKED ENTITIES</div><div class="meta-value">${aircraft.length + (vessels as Rec[]).length + conflicts.length}</div></div>
<div class="meta-box"><div class="meta-label">DATA SOURCES</div><div class="meta-value">${srcOnline}/${srcTotal} ONLINE</div></div>
<div class="meta-box"><div class="meta-label">AIRCRAFT</div><div class="meta-value">${aircraft.length}</div></div>
<div class="meta-box"><div class="meta-label">VESSELS</div><div class="meta-value">${(vessels as Rec[]).length}</div></div>
<div class="meta-box"><div class="meta-label">ACTIVE FIRES</div><div class="meta-value">${fires.length}</div></div>
</div>

<!-- Executive Summary -->
<div class="section">
<div class="section-title">1. EXECUTIVE SUMMARY</div>
<div class="summary-box">
SENTINEL-X is currently tracking <b>${aircraft.length}</b> aircraft, <b>${(vessels as Rec[]).length}</b> vessels, and <b>${conflicts.length}</b> conflict events globally.
${emergencyAC.length > 0 ? `<br/><span style="color:#ef4444">⚠ ${emergencyAC.length} aircraft broadcasting emergency squawk codes.</span>` : ""}
${activeJam.length > 0 ? `<br/><span style="color:#f97316">⚠ ${activeJam.length} active GNSS jamming zones detected.</span>` : ""}
${majorQuakes.length > 0 ? `<br/><span style="color:#eab308">⚠ ${majorQuakes.length} significant seismic events (M5.0+) in the monitoring window.</span>` : ""}
${redDisasters.length > 0 ? `<br/><span style="color:#ef4444">⚠ ${redDisasters.length} red-alert disasters requiring immediate attention.</span>` : ""}
<br/>Current operational threat level is assessed at <b style="color:${tl.color}">${tl.label}</b> (score: ${score}/100).
</div>
</div>

<!-- Emergency Aircraft -->
${emergencyAC.length > 0 ? `
<div class="section">
<div class="section-title">2. EMERGENCY AIRCRAFT</div>
<table>
<tr><th>CALLSIGN</th><th>SQUAWK</th><th>ALT</th><th>SPEED</th><th>POSITION</th></tr>
${emergencyAC.map(a => `<tr>
<td>${a.callsign ?? a.icao24 ?? "N/A"}</td>
<td><span class="badge badge-critical">${a.squawk}</span></td>
<td>${a.altitude ?? "N/A"} ft</td>
<td>${a.velocity ?? "N/A"} kts</td>
<td>${Number(a.latitude ?? 0).toFixed(2)}°, ${Number(a.longitude ?? 0).toFixed(2)}°</td>
</tr>`).join("")}
</table>
</div>` : ""}

<!-- Conflict Zones -->
<div class="section">
<div class="section-title">${emergencyAC.length > 0 ? "3" : "2"}. CONFLICT ZONE ANALYSIS</div>
<div style="display:flex;gap:12px;margin-bottom:8px;">
<div style="flex:1">
${Object.entries(sevCounts).map(([k, v]) => {
	const colors: Record<string, string> = { critical: "#ef4444", high: "#f97316", medium: "#eab308", low: "#22d3ee" };
	const maxW = Math.max(...Object.values(sevCounts), 1);
	const pct = (v / maxW) * 100;
	return `<div class="stat-row"><span style="color:${colors[k]};text-transform:uppercase;font-size:9px;">${k}</span><span style="font-weight:bold">${v}</span></div>
<div class="chart-bar" style="background:${colors[k]}33;width:${Math.max(pct, 5)}%;color:${colors[k]}">${v}</div>`;
}).join("")}
</div>
</div>
${topSectors.length > 0 ? `
<table>
<tr><th>SECTOR / REGION</th><th>EVENTS</th></tr>
${topSectors.map(([region, count]) => `<tr><td>${region}</td><td>${count}</td></tr>`).join("")}
</table>` : ""}
</div>

<!-- Seismic Activity -->
${majorQuakes.length > 0 ? `
<div class="section">
<div class="section-title">SEISMIC ACTIVITY (M5.0+)</div>
<table>
<tr><th>MAGNITUDE</th><th>LOCATION</th><th>DEPTH</th><th>TIME</th></tr>
${majorQuakes.slice(0, 10).map(s => `<tr>
<td><b style="color:#eab308">M${Number(s.magnitude ?? 0).toFixed(1)}</b></td>
<td>${s.place ?? "Unknown"}</td>
<td>${s.depth ?? "N/A"} km</td>
<td>${s.time ? new Date(Number(s.time)).toISOString().slice(0, 19) + "Z" : "N/A"}</td>
</tr>`).join("")}
</table>
</div>` : ""}

<!-- GNSS Jamming -->
${activeJam.length > 0 ? `
<div class="section">
<div class="section-title">ELECTRONIC WARFARE — GNSS JAMMING</div>
<table>
<tr><th>REGION</th><th>TYPE</th><th>SEVERITY</th><th>POSITION</th></tr>
${activeJam.map(j => `<tr>
<td>${j.region ?? "Unknown"}</td>
<td>${j.type ?? "jamming"}</td>
<td><span class="badge badge-${String(j.severity ?? "medium").toLowerCase()}">${String(j.severity ?? "medium").toUpperCase()}</span></td>
<td>${Number(j.latitude ?? 0).toFixed(2)}°, ${Number(j.longitude ?? 0).toFixed(2)}°</td>
</tr>`).join("")}
</table>
</div>` : ""}

<!-- Cyber Threats -->
${cyber.length > 0 ? `
<div class="section">
<div class="section-title">CYBER THREAT INDICATORS</div>
<table>
<tr><th>TYPE</th><th>INDICATOR</th><th>SOURCE</th><th>SEVERITY</th></tr>
${(cyber as Rec[]).slice(0, 10).map(c => `<tr>
<td>${c.threatType ?? c.type ?? "N/A"}</td>
<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis">${c.indicator ?? c.iocValue ?? "N/A"}</td>
<td>${c.source ?? "N/A"}</td>
<td><span class="badge badge-${String(c.severity ?? "medium").toLowerCase()}">${String(c.severity ?? "MEDIUM").toUpperCase()}</span></td>
</tr>`).join("")}
</table>
</div>` : ""}

<!-- OSINT Headlines -->
${news.length > 0 ? `
<div class="section">
<div class="section-title">OSINT — KEY HEADLINES</div>
${(news as Rec[]).slice(0, 8).map(n => `
<div style="margin:4px 0;padding:4px 0;border-bottom:1px solid #1e293b;">
<div style="font-size:10px;color:#e2e8f0;">${n.title ?? "Untitled"}</div>
<div style="font-size:8px;color:#64748b;">${n.sourceName ?? ""} — ${n.publishedAt ?? ""}</div>
</div>`).join("")}
</div>` : ""}

<!-- Data Source Health -->
<div class="section">
<div class="section-title">COLLECTION POSTURE — DATA SOURCE STATUS</div>
<table>
<tr><th>SOURCE</th><th>STATUS</th><th>LAST CHECK</th></tr>
${(sources as Rec[]).map(s => `<tr>
<td>${s.name ?? s.source ?? "Unknown"}</td>
<td><span class="badge badge-${s.status === "online" ? "low" : "critical"}">${String(s.status ?? "unknown").toUpperCase()}</span></td>
<td>${s.lastCheck ? new Date(Number(s.lastCheck)).toISOString().slice(0, 19) + "Z" : "N/A"}</td>
</tr>`).join("")}
</table>
</div>

<div class="footer">
SENTINEL-X GLOBAL SITUATIONAL AWARENESS PLATFORM<br/>
THIS DOCUMENT IS AUTO-GENERATED — DTG: ${dtg()}<br/>
CLASSIFICATION: TOP SECRET // SENTINEL-X // NOFORN<br/>
DISTRIBUTION: AUTHORIZED PERSONNEL ONLY
</div>

<div class="classification" style="margin-top:8px">TOP SECRET // SENTINEL-X // NOFORN</div>
</div>
</body></html>`;

		const w = window.open("", "_blank");
		if (w) {
			w.document.write(html);
			w.document.close();
			// Auto-trigger print dialog after load
			w.onload = () => setTimeout(() => w.print(), 500);
		}

		setGenerating(false);
	}, [aircraft, conflicts, seismic, disasters, fires, jamming, cyber, vessels, news, sources]);

	return (
		<div className="space-y-2">
			<div className="text-[8px] font-mono text-slate-500 leading-relaxed">
				Generate a classified-style PDF threat briefing from all current SENTINEL-X data. Opens in a new tab with print dialog.
			</div>
			<button
				type="button"
				onClick={generate}
				disabled={generating}
				className="w-full py-2 rounded bg-gradient-to-r from-red-900/40 to-amber-900/40 border border-red-700/30 text-[10px] font-mono font-bold tracking-widest text-red-400 hover:from-red-900/60 hover:to-amber-900/60 transition-all disabled:opacity-50"
			>
				{generating ? "GENERATING..." : "📄 GENERATE THREAT BRIEFING"}
			</button>
			<div className="text-[7px] font-mono text-slate-600 text-center">
				TOP SECRET // SENTINEL-X // NOFORN
			</div>
		</div>
	);
}
