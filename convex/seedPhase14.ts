import { mutation } from "./_generated/server";

/** Phase 14 seed data — Cases, Knowledge Graph, Workspaces, Audit Log, User Profiles */
export const seedAll = mutation({
	args: {},
	handler: async (ctx) => {
		const now = Date.now();

		// ==================== USER PROFILES ====================
		const profiles = [
			{ userId: "usr-001", displayName: "Cmdr. Alex Hartwell", role: "super_admin", department: "Command", clearanceLevel: "TOP SECRET" },
			{ userId: "usr-002", displayName: "Lt. Sarah Chen", role: "analyst", department: "Intelligence", clearanceLevel: "SECRET" },
			{ userId: "usr-003", displayName: "Sgt. Marcus Rivera", role: "operator", department: "Operations", clearanceLevel: "SECRET" },
			{ userId: "usr-004", displayName: "Dr. Yuki Tanaka", role: "analyst", department: "Cyber", clearanceLevel: "TOP SECRET" },
			{ userId: "usr-005", displayName: "Col. James Bishop", role: "executive", department: "Executive", clearanceLevel: "TOP SECRET" },
			{ userId: "usr-006", displayName: "Cpl. Ava Mitchell", role: "operator", department: "Maritime", clearanceLevel: "CONFIDENTIAL" },
			{ userId: "usr-007", displayName: "Maj. Dmitri Volkov", role: "admin", department: "SIGINT", clearanceLevel: "TOP SECRET" },
			{ userId: "usr-008", displayName: "Ens. Priya Sharma", role: "viewer", department: "Liaison", clearanceLevel: "UNCLASSIFIED" },
		];
		for (const p of profiles) {
			const existing = await ctx.db.query("userProfiles").withIndex("by_userId", (q) => q.eq("userId", p.userId)).first();
			if (!existing) {
				await ctx.db.insert("userProfiles", { ...p, isActive: true, createdAt: now - Math.random() * 30 * 86400000 });
			}
		}

		// ==================== CASES ====================
		const cases = [
			{
				caseId: "CASE-DARKFLEET-001",
				title: "Dark Fleet AIS Gaps — Eastern Mediterranean",
				description: "Multiple vessels detected going dark near Tartus, Syria. Possible sanctions evasion or covert logistics operation. Three tankers and one cargo vessel identified with intermittent AIS signals over 72-hour window.",
				status: "investigating",
				priority: "critical",
				assignee: "Lt. Sarah Chen",
				domain: "maritime",
				tags: ["dark-fleet", "sanctions", "syria", "ais-gap"],
				latitude: 34.88,
				longitude: 35.89,
			},
			{
				caseId: "CASE-SIGINT-002",
				title: "GPS Jamming Cluster — Eastern Ukraine",
				description: "Concentrated GPS/GNSS jamming activity detected affecting 47 commercial aircraft in the Kharkiv-Donetsk corridor. Pattern suggests electronic warfare escalation. Correlates with increased military callsign activity.",
				status: "escalated",
				priority: "critical",
				assignee: "Maj. Dmitri Volkov",
				domain: "sigint",
				tags: ["gnss-jamming", "ukraine", "electronic-warfare", "aviation-safety"],
				latitude: 49.0,
				longitude: 37.8,
			},
			{
				caseId: "CASE-CYBER-003",
				title: "Coordinated DDoS Campaign — European Energy Grid",
				description: "Multiple distributed denial of service attacks targeting SCADA endpoints across European energy infrastructure. IOCs match known APT28 TTPs. 12 facilities affected across 4 countries.",
				status: "investigating",
				priority: "high",
				assignee: "Dr. Yuki Tanaka",
				domain: "cyber",
				tags: ["ddos", "scada", "energy", "apt28", "critical-infrastructure"],
				latitude: 50.1,
				longitude: 8.7,
			},
			{
				caseId: "CASE-NUCLEAR-004",
				title: "Unusual Activity — Yongbyon Nuclear Complex",
				description: "Satellite imagery analysis reveals increased vehicle activity and steam emissions at the Yongbyon 5MWe reactor site. Correlates with recent SIGINT intercepts indicating potential reprocessing activity.",
				status: "open",
				priority: "high",
				assignee: "Lt. Sarah Chen",
				domain: "nuclear",
				tags: ["nuclear", "north-korea", "satellite-imagery", "proliferation"],
				latitude: 39.8,
				longitude: 125.75,
			},
			{
				caseId: "CASE-MARITIME-005",
				title: "Suspicious Vessel Rendezvous — Red Sea",
				description: "Two flagless vessels detected conducting ship-to-ship transfer operations 40nm south of the Bab al-Mandeb strait. Activity coincides with known smuggling corridor. One vessel matches database entry for previously sanctioned tanker.",
				status: "open",
				priority: "medium",
				assignee: "Cpl. Ava Mitchell",
				domain: "maritime",
				tags: ["ship-to-ship", "red-sea", "smuggling", "sanctions"],
				latitude: 12.5,
				longitude: 43.3,
			},
			{
				caseId: "CASE-CONFLICT-006",
				title: "Cross-Border Incident — Kashmir LOC",
				description: "GDELT reports and social media indicate escalation along the Line of Control. Artillery exchanges confirmed by seismic sensors. OSINT reports 3 civilian casualties.",
				status: "resolved",
				priority: "high",
				assignee: "Sgt. Marcus Rivera",
				domain: "conflict",
				tags: ["kashmir", "india", "pakistan", "border-incident"],
				latitude: 34.1,
				longitude: 74.5,
				resolvedAt: now - 86400000,
			},
		];
		for (const c of cases) {
			const existing = await ctx.db.query("cases").withIndex("by_caseId", (q) => q.eq("caseId", c.caseId)).first();
			if (!existing) {
				await ctx.db.insert("cases", {
					...c,
					createdBy: "System",
					linkedEntities: [],
					linkedAlerts: [],
					createdAt: now - Math.random() * 7 * 86400000,
					updatedAt: now - Math.random() * 3600000,
				});
				// Add creation note
				await ctx.db.insert("caseNotes", {
					caseId: c.caseId,
					author: "System",
					content: `Case created: ${c.title}`,
					type: "status_change",
					timestamp: now - Math.random() * 7 * 86400000,
				});
				// Add investigation notes for some cases
				if (c.status !== "open") {
					await ctx.db.insert("caseNotes", {
						caseId: c.caseId,
						author: c.assignee ?? "Analyst",
						content: `Investigation commenced. Initial assessment: ${c.description.slice(0, 100)}...`,
						type: "note",
						timestamp: now - Math.random() * 3 * 86400000,
					});
				}
			}
		}

		// ==================== KNOWLEDGE GRAPH NODES ====================
		const nodes = [
			{ nodeId: "N-VESSEL-001", type: "vessel", label: "MT Shadow Runner", domain: "maritime", latitude: 34.5, longitude: 35.5, riskScore: 85, properties: JSON.stringify({ mmsi: "352001234", flag: "Panama", deadweight: 45000, type: "Crude Oil Tanker", sanctioned: true }) },
			{ nodeId: "N-VESSEL-002", type: "vessel", label: "MV Arctic Phoenix", domain: "maritime", latitude: 35.0, longitude: 36.2, riskScore: 72, properties: JSON.stringify({ mmsi: "210998765", flag: "Greece", deadweight: 32000, type: "Cargo", previousNames: ["Northwind", "Star Atlas"] }) },
			{ nodeId: "N-ORG-001", type: "organization", label: "Petroline Global Trading", domain: "maritime", riskScore: 90, properties: JSON.stringify({ country: "UAE", sector: "Oil Trading", sanctionedSince: "2024-03", aliases: ["PGT Holdings", "Petro Global Ltd"] }) },
			{ nodeId: "N-ORG-002", type: "organization", label: "Aero Defense Systems", domain: "conflict", riskScore: 65, properties: JSON.stringify({ country: "Belarus", sector: "Defense", exports: ["radar", "EW systems", "UAV components"] }) },
			{ nodeId: "N-PERSON-001", type: "person", label: "Viktor Kovalenko", domain: "maritime", riskScore: 78, properties: JSON.stringify({ nationality: "Russian", role: "Beneficial Owner", aliases: ["V. Koval", "Viktor K."], sanctioned: true }) },
			{ nodeId: "N-PERSON-002", type: "person", label: "Hassan Al-Rashid", domain: "conflict", riskScore: 60, properties: JSON.stringify({ nationality: "Syrian", role: "Procurement Agent", active: true }) },
			{ nodeId: "N-AIRCRAFT-001", type: "aircraft", label: "IL-76 RA-78830", domain: "aviation", latitude: 55.9, longitude: 37.4, riskScore: 70, properties: JSON.stringify({ type: "IL-76TD", registration: "RA-78830", operator: "Volga-Dnepr Airlines", military: true }) },
			{ nodeId: "N-FACILITY-001", type: "facility", label: "Tartus Naval Facility", domain: "infrastructure", latitude: 34.89, longitude: 35.89, riskScore: 80, properties: JSON.stringify({ type: "Naval Base", country: "Syria", operator: "Russian Navy", capacity: "12 vessels" }) },
			{ nodeId: "N-FACILITY-002", type: "facility", label: "Yongbyon Nuclear Complex", domain: "nuclear", latitude: 39.8, longitude: 125.75, riskScore: 95, properties: JSON.stringify({ type: "Nuclear Facility", country: "DPRK", reactors: ["5MWe", "IRT-2000"], status: "Active" }) },
			{ nodeId: "N-NETWORK-001", type: "network", label: "Dark Fleet Logistics Network", domain: "maritime", riskScore: 88, properties: JSON.stringify({ type: "Sanctions Evasion", members: 14, active_vessels: 8, estimated_value: "$2.3B" }) },
			{ nodeId: "N-EVENT-001", type: "event", label: "Ship-to-Ship Transfer #487", domain: "maritime", latitude: 12.5, longitude: 43.3, riskScore: 75, properties: JSON.stringify({ date: "2026-04-12", duration: "4.5 hours", vessels: 2 }) },
			{ nodeId: "N-LOCATION-001", type: "location", label: "Bab al-Mandeb Strait", domain: "maritime", latitude: 12.6, longitude: 43.3, properties: JSON.stringify({ type: "Chokepoint", traffic: "~30,000 vessels/year", strategic: true }) },
		];
		for (const n of nodes) {
			const existing = await ctx.db.query("kgNodes").withIndex("by_nodeId", (q) => q.eq("nodeId", n.nodeId)).first();
			if (!existing) {
				await ctx.db.insert("kgNodes", {
					...n,
					riskScore: n.riskScore ?? undefined,
					latitude: n.latitude ?? undefined,
					longitude: n.longitude ?? undefined,
					createdAt: now - Math.random() * 30 * 86400000,
					updatedAt: now - Math.random() * 86400000,
				});
			}
		}

		// ==================== KNOWLEDGE GRAPH EDGES ====================
		const edges = [
			{ edgeId: "E-001", sourceNodeId: "N-PERSON-001", targetNodeId: "N-ORG-001", relationship: "owns", confidence: 0.92, source: "OFAC SDN List" },
			{ edgeId: "E-002", sourceNodeId: "N-ORG-001", targetNodeId: "N-VESSEL-001", relationship: "operates", confidence: 0.87, source: "Lloyd's Register" },
			{ edgeId: "E-003", sourceNodeId: "N-VESSEL-001", targetNodeId: "N-FACILITY-001", relationship: "visited", confidence: 0.95, source: "AIS Track History" },
			{ edgeId: "E-004", sourceNodeId: "N-VESSEL-001", targetNodeId: "N-VESSEL-002", relationship: "observed_near", confidence: 0.78, source: "Satellite Imagery" },
			{ edgeId: "E-005", sourceNodeId: "N-PERSON-002", targetNodeId: "N-ORG-002", relationship: "linked_to", confidence: 0.71, source: "SIGINT Report" },
			{ edgeId: "E-006", sourceNodeId: "N-ORG-002", targetNodeId: "N-AIRCRAFT-001", relationship: "operates", confidence: 0.65, source: "Flight Records" },
			{ edgeId: "E-007", sourceNodeId: "N-VESSEL-001", targetNodeId: "N-NETWORK-001", relationship: "linked_to", confidence: 0.89, source: "Analyst Assessment" },
			{ edgeId: "E-008", sourceNodeId: "N-VESSEL-002", targetNodeId: "N-NETWORK-001", relationship: "linked_to", confidence: 0.82, source: "Pattern Analysis" },
			{ edgeId: "E-009", sourceNodeId: "N-VESSEL-001", targetNodeId: "N-EVENT-001", relationship: "linked_to", confidence: 0.94, source: "AIS Correlation" },
			{ edgeId: "E-010", sourceNodeId: "N-VESSEL-002", targetNodeId: "N-EVENT-001", relationship: "linked_to", confidence: 0.91, source: "AIS Correlation" },
			{ edgeId: "E-011", sourceNodeId: "N-EVENT-001", targetNodeId: "N-LOCATION-001", relationship: "observed_near", confidence: 0.99, source: "Geospatial" },
			{ edgeId: "E-012", sourceNodeId: "N-ORG-001", targetNodeId: "N-PERSON-001", relationship: "linked_to", confidence: 0.85, source: "Corporate Registry" },
			{ edgeId: "E-013", sourceNodeId: "N-PERSON-001", targetNodeId: "N-FACILITY-001", relationship: "visited", confidence: 0.62, source: "Travel Intel" },
			{ edgeId: "E-014", sourceNodeId: "N-FACILITY-002", targetNodeId: "N-ORG-002", relationship: "linked_to", confidence: 0.55, source: "OSINT Analysis" },
		];
		for (const e of edges) {
			const existing = await ctx.db.query("kgEdges").withIndex("by_edgeId", (q) => q.eq("edgeId", e.edgeId)).first();
			if (!existing) {
				await ctx.db.insert("kgEdges", {
					...e,
					properties: undefined,
					firstSeen: now - Math.random() * 60 * 86400000,
					lastSeen: now - Math.random() * 86400000,
				});
			}
		}

		// ==================== WORKSPACES ====================
		const workspaces = [
			{ workspaceId: "WS-MEDSEA-OPS", name: "Mediterranean Maritime Watch", description: "24/7 monitoring of Eastern Mediterranean shipping lanes, with focus on sanctions evasion and dark fleet activity.", type: "monitoring", layers: ["ships", "fishing", "satellites", "conflict"] },
			{ workspaceId: "WS-UKRAINE-OPS", name: "Ukraine Theater Operations", description: "Multi-domain situational awareness for the Ukraine conflict zone including air, ground, cyber, and SIGINT.", type: "mission", layers: ["aircraft", "military", "conflict", "gnss", "cyber"] },
			{ workspaceId: "WS-INDOPAC", name: "Indo-Pacific Watch", description: "Strategic monitoring of South China Sea, Taiwan Strait, and Korean Peninsula.", type: "monitoring", layers: ["ships", "aircraft", "military", "satellites", "conflict"] },
			{ workspaceId: "WS-CYBER-HUNT", name: "Cyber Threat Hunt — SCADA", description: "Active investigation into coordinated attacks on European energy SCADA systems.", type: "investigation", layers: ["cyber"] },
		];
		for (const w of workspaces) {
			const existing = await ctx.db.query("workspaces").withIndex("by_workspaceId", (q) => q.eq("workspaceId", w.workspaceId)).first();
			if (!existing) {
				await ctx.db.insert("workspaces", {
					...w,
					status: "active",
					ownerId: "analyst",
					members: ["analyst"],
					createdAt: now - Math.random() * 14 * 86400000,
					updatedAt: now - Math.random() * 86400000,
				});
			}
		}

		// ==================== AUDIT LOG ENTRIES ====================
		const auditEntries = [
			{ action: "login", actor: "Cmdr. Alex Hartwell", resource: "session", details: "Login from 10.0.1.15" },
			{ action: "create", actor: "Lt. Sarah Chen", resource: "case", resourceId: "CASE-DARKFLEET-001", details: "Created case: Dark Fleet AIS Gaps" },
			{ action: "view", actor: "Col. James Bishop", resource: "executive_summary", details: "Viewed executive dashboard" },
			{ action: "export", actor: "Lt. Sarah Chen", resource: "report", details: "Exported Mediterranean SITREP to PDF" },
			{ action: "update", actor: "Dr. Yuki Tanaka", resource: "case", resourceId: "CASE-CYBER-003", details: "Added 3 IOC indicators to case" },
			{ action: "search", actor: "Sgt. Marcus Rivera", resource: "entity", details: "Searched: 'MT Shadow Runner'" },
			{ action: "create", actor: "Maj. Dmitri Volkov", resource: "workspace", resourceId: "WS-UKRAINE-OPS", details: "Created workspace: Ukraine Theater Operations" },
			{ action: "login", actor: "Dr. Yuki Tanaka", resource: "session", details: "Login from 10.0.2.30" },
		];
		for (const a of auditEntries) {
			await ctx.db.insert("auditLog", {
				...a,
				resourceId: (a as { resourceId?: string }).resourceId ?? undefined,
				timestamp: now - Math.random() * 24 * 3600000,
			});
		}

		return { success: true, message: "Phase 14 seed data loaded successfully" };
	},
});
