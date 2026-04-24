import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const schema = defineSchema({
	...authTables,

	// ==================== CORE TABLES ====================

	aircraft: defineTable({
		icao24: v.string(),
		callsign: v.string(),
		originCountry: v.string(),
		longitude: v.number(),
		latitude: v.number(),
		baroAltitude: v.number(),
		geoAltitude: v.number(),
		velocity: v.number(),
		heading: v.number(),
		verticalRate: v.number(),
		onGround: v.boolean(),
		squawk: v.optional(v.string()),
		category: v.optional(v.string()),
		jammingFlag: v.boolean(),
		isMilitary: v.optional(v.boolean()),
		lastUpdate: v.number(),
		source: v.optional(v.string()),
	})
		.index("by_icao24", ["icao24"])
		.index("by_jamming", ["jammingFlag"])
		.index("by_lastUpdate", ["lastUpdate"]),

	conflictEvents: defineTable({
		eventId: v.string(),
		eventDate: v.string(),
		eventType: v.string(),
		subEventType: v.string(),
		actor1: v.string(),
		actor2: v.optional(v.string()),
		country: v.string(),
		region: v.string(),
		location: v.string(),
		latitude: v.number(),
		longitude: v.number(),
		fatalities: v.number(),
		notes: v.string(),
		source: v.string(),
		severity: v.string(),
		timestamp: v.number(),
	})
		.index("by_eventId", ["eventId"])
		.index("by_country", ["country"])
		.index("by_severity", ["severity"])
		.index("by_timestamp", ["timestamp"]),

	jammingAlerts: defineTable({
		alertId: v.string(),
		h3Index: v.string(),
		centerLat: v.number(),
		centerLon: v.number(),
		radius: v.number(),
		affectedAircraft: v.number(),
		avgCn0Drop: v.number(),
		maxCn0Drop: v.number(),
		severity: v.string(),
		status: v.string(),
		detectedAt: v.number(),
		resolvedAt: v.optional(v.number()),
		region: v.string(),
		notes: v.optional(v.string()),
	})
		.index("by_alertId", ["alertId"])
		.index("by_status", ["status"])
		.index("by_severity", ["severity"])
		.index("by_detectedAt", ["detectedAt"]),

	satelliteScenes: defineTable({
		sceneId: v.string(),
		satellite: v.string(),
		acquisitionDate: v.string(),
		cloudCover: v.number(),
		bbox: v.object({
			minLon: v.number(),
			minLat: v.number(),
			maxLon: v.number(),
			maxLat: v.number(),
		}),
		centerLat: v.number(),
		centerLon: v.number(),
		resolution: v.number(),
		processingLevel: v.string(),
		thumbnailUrl: v.optional(v.string()),
		downloadUrl: v.optional(v.string()),
		status: v.string(),
		timestamp: v.number(),
	})
		.index("by_sceneId", ["sceneId"])
		.index("by_satellite", ["satellite"])
		.index("by_timestamp", ["timestamp"]),

	systemAlerts: defineTable({
		type: v.string(),
		severity: v.string(),
		title: v.string(),
		message: v.string(),
		source: v.string(),
		latitude: v.optional(v.number()),
		longitude: v.optional(v.number()),
		entityRef: v.optional(v.string()),
		acknowledged: v.boolean(),
		timestamp: v.number(),
	})
		.index("by_type", ["type"])
		.index("by_severity", ["severity"])
		.index("by_acknowledged", ["acknowledged"])
		.index("by_timestamp", ["timestamp"]),

	platformStats: defineTable({
		key: v.string(),
		value: v.number(),
		updatedAt: v.number(),
	}).index("by_key", ["key"]),

	// ==================== LIVE DATA TABLES ====================

	fires: defineTable({
		sourceId: v.string(),
		latitude: v.number(),
		longitude: v.number(),
		brightness: v.number(),
		confidence: v.string(),
		frp: v.number(),
		satellite: v.string(),
		acqDate: v.string(),
		dayNight: v.string(),
		timestamp: v.number(),
	})
		.index("by_sourceId", ["sourceId"])
		.index("by_timestamp", ["timestamp"]),

	vessels: defineTable({
		mmsi: v.string(),
		name: v.string(),
		latitude: v.number(),
		longitude: v.number(),
		speed: v.number(),
		course: v.number(),
		shipType: v.string(),
		flag: v.string(),
		destination: v.string(),
		source: v.string(),
		timestamp: v.number(),
	})
		.index("by_mmsi", ["mmsi"])
		.index("by_source", ["source"])
		.index("by_timestamp", ["timestamp"]),

	newsItems: defineTable({
		title: v.string(),
		description: v.string(),
		url: v.string(),
		sourceName: v.string(),
		publishedAt: v.string(),
		category: v.string(),
		latitude: v.optional(v.number()),
		longitude: v.optional(v.number()),
		imageUrl: v.optional(v.string()),
		timestamp: v.number(),
	})
		.index("by_category", ["category"])
		.index("by_timestamp", ["timestamp"]),

	cyberThreats: defineTable({
		threatId: v.string(),
		type: v.string(),
		latitude: v.number(),
		longitude: v.number(),
		ip: v.string(),
		port: v.optional(v.number()),
		service: v.string(),
		severity: v.string(),
		description: v.string(),
		source: v.string(),
		timestamp: v.number(),
	})
		.index("by_threatId", ["threatId"])
		.index("by_source", ["source"])
		.index("by_severity", ["severity"])
		.index("by_timestamp", ["timestamp"]),

	weatherData: defineTable({
		locationId: v.string(),
		name: v.string(),
		latitude: v.number(),
		longitude: v.number(),
		temp: v.number(),
		humidity: v.number(),
		windSpeed: v.number(),
		windDeg: v.number(),
		pressure: v.number(),
		visibility: v.number(),
		description: v.string(),
		icon: v.string(),
		timestamp: v.number(),
	})
		.index("by_locationId", ["locationId"])
		.index("by_timestamp", ["timestamp"]),

	satellitePositions: defineTable({
		satId: v.string(),
		satName: v.string(),
		latitude: v.number(),
		longitude: v.number(),
		altitude: v.number(),
		velocity: v.number(),
		timestamp: v.number(),
	})
		.index("by_satId", ["satId"])
		.index("by_timestamp", ["timestamp"]),

	dataSourceStatus: defineTable({
		sourceId: v.string(),
		name: v.string(),
		status: v.string(),
		lastFetch: v.number(),
		recordCount: v.number(),
		errorMessage: v.optional(v.string()),
	}).index("by_sourceId", ["sourceId"]),

	// ==================== NEW: REFERENCE REPO FEATURES ====================

	/** USGS Earthquake events — Seismic layer */
	seismicEvents: defineTable({
		eventId: v.string(),
		latitude: v.number(),
		longitude: v.number(),
		depth: v.number(),
		magnitude: v.number(),
		magType: v.string(),
		place: v.string(),
		time: v.number(),
		tsunami: v.boolean(),
		severity: v.string(),
		url: v.string(),
		timestamp: v.number(),
	})
		.index("by_eventId", ["eventId"])
		.index("by_magnitude", ["magnitude"])
		.index("by_timestamp", ["timestamp"]),

	/** GDACS + ReliefWeb — Disasters layer */
	disasters: defineTable({
		eventId: v.string(),
		title: v.string(),
		eventType: v.string(), // EQ, TC, FL, VO, TS, DR, EP
		latitude: v.number(),
		longitude: v.number(),
		severity: v.string(),
		alertLevel: v.string(), // green, orange, red
		country: v.string(),
		description: v.string(),
		source: v.string(), // "gdacs" | "reliefweb"
		url: v.optional(v.string()),
		fromDate: v.string(),
		timestamp: v.number(),
	})
		.index("by_eventId", ["eventId"])
		.index("by_eventType", ["eventType"])
		.index("by_severity", ["severity"])
		.index("by_timestamp", ["timestamp"]),

	/** Reddit OSINT — Social intelligence layer */
	socialPosts: defineTable({
		postId: v.string(),
		subreddit: v.string(),
		title: v.string(),
		url: v.string(),
		author: v.string(),
		score: v.number(),
		numComments: v.number(),
		permalink: v.string(),
		thumbnail: v.optional(v.string()),
		latitude: v.optional(v.number()),
		longitude: v.optional(v.number()),
		provenance: v.string(), // "direct-api" | "geocoded-inferred" | "no-location"
		confidence: v.number(),
		timestamp: v.number(),
	})
		.index("by_postId", ["postId"])
		.index("by_subreddit", ["subreddit"])
		.index("by_timestamp", ["timestamp"]),

	/** CISA KEV + OTX + URLhaus + ThreatFox — Enhanced cyber intel */
	cyberIntel: defineTable({
		intelId: v.string(),
		type: v.string(), // "kev" | "otx" | "urlhaus" | "threatfox"
		title: v.string(),
		description: v.string(),
		severity: v.string(),
		source: v.string(),
		sourceUrl: v.optional(v.string()),
		indicator: v.optional(v.string()), // CVE, IOC, URL
		tags: v.optional(v.array(v.string())),
		timestamp: v.number(),
	})
		.index("by_intelId", ["intelId"])
		.index("by_type", ["type"])
		.index("by_severity", ["severity"])
		.index("by_timestamp", ["timestamp"]),

	/** GDELT — Multi-category OSINT events */
	gdeltEvents: defineTable({
		eventId: v.string(),
		title: v.string(),
		category: v.string(), // "conflict" | "maritime" | "nuclear" | "cyber"
		latitude: v.number(),
		longitude: v.number(),
		sourceUrl: v.string(),
		sourceName: v.string(),
		confidence: v.number(),
		provenance: v.string(),
		severity: v.string(),
		timestamp: v.number(),
	})
		.index("by_eventId", ["eventId"])
		.index("by_category", ["category"])
		.index("by_timestamp", ["timestamp"]),

	/** ISS — Live orbital position (wheretheiss.at, free) */
	issPosition: defineTable({
		latitude: v.number(),
		longitude: v.number(),
		altitude: v.number(),
		velocity: v.number(),
		visibility: v.string(),
		timestamp: v.number(),
	}).index("by_timestamp", ["timestamp"]),

	/** Threat Zones — Pre-computed fusion threat scoring (12 global hotspots) */
	threatZones: defineTable({
		name: v.string(),
		latitude: v.number(),
		longitude: v.number(),
		radius: v.number(),
		baseScore: v.number(),
		type: v.string(),
		currentScore: v.number(),
		activeEvents: v.number(),
		lastUpdated: v.number(),
	}).index("by_name", ["name"]),

	// ==================== CASE MANAGEMENT ====================

	cases: defineTable({
		caseId: v.string(),
		title: v.string(),
		description: v.string(),
		status: v.string(), // "open" | "investigating" | "escalated" | "resolved" | "closed"
		priority: v.string(), // "critical" | "high" | "medium" | "low"
		assignee: v.optional(v.string()),
		createdBy: v.string(),
		domain: v.string(),
		tags: v.array(v.string()),
		linkedEntities: v.array(v.string()), // entity IDs
		linkedAlerts: v.array(v.string()), // alert IDs
		latitude: v.optional(v.number()),
		longitude: v.optional(v.number()),
		createdAt: v.number(),
		updatedAt: v.number(),
		resolvedAt: v.optional(v.number()),
	})
		.index("by_caseId", ["caseId"])
		.index("by_status", ["status"])
		.index("by_priority", ["priority"])
		.index("by_assignee", ["assignee"])
		.index("by_createdAt", ["createdAt"]),

	caseNotes: defineTable({
		caseId: v.string(),
		author: v.string(),
		content: v.string(),
		type: v.string(), // "note" | "status_change" | "evidence" | "assignment"
		metadata: v.optional(v.string()), // JSON string for extra data
		timestamp: v.number(),
	})
		.index("by_caseId", ["caseId"])
		.index("by_timestamp", ["timestamp"]),

	caseEvidence: defineTable({
		caseId: v.string(),
		title: v.string(),
		type: v.string(), // "screenshot" | "document" | "log" | "entity_snapshot" | "link"
		content: v.string(), // URL or text content
		addedBy: v.string(),
		timestamp: v.number(),
	})
		.index("by_caseId", ["caseId"])
		.index("by_timestamp", ["timestamp"]),

	// ==================== KNOWLEDGE GRAPH ====================

	kgNodes: defineTable({
		nodeId: v.string(),
		type: v.string(), // "person" | "organization" | "vessel" | "aircraft" | "facility" | "event" | "location" | "network"
		label: v.string(),
		properties: v.string(), // JSON string
		domain: v.string(),
		latitude: v.optional(v.number()),
		longitude: v.optional(v.number()),
		riskScore: v.optional(v.number()),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_nodeId", ["nodeId"])
		.index("by_type", ["type"])
		.index("by_label", ["label"])
		.index("by_domain", ["domain"]),

	kgEdges: defineTable({
		edgeId: v.string(),
		sourceNodeId: v.string(),
		targetNodeId: v.string(),
		relationship: v.string(), // "owns" | "visited" | "linked_to" | "transmitted_to" | "observed_near" | "sanctioned_by" | "operates" | "crewed_by"
		confidence: v.number(),
		properties: v.optional(v.string()),
		source: v.string(), // data source
		firstSeen: v.number(),
		lastSeen: v.number(),
	})
		.index("by_edgeId", ["edgeId"])
		.index("by_sourceNodeId", ["sourceNodeId"])
		.index("by_targetNodeId", ["targetNodeId"])
		.index("by_relationship", ["relationship"]),

	// ==================== WORKSPACES ====================

	workspaces: defineTable({
		workspaceId: v.string(),
		name: v.string(),
		description: v.string(),
		type: v.string(), // "mission" | "investigation" | "monitoring" | "exercise"
		status: v.string(), // "active" | "archived" | "planning"
		ownerId: v.string(),
		members: v.array(v.string()),
		layers: v.array(v.string()), // active layer IDs
		aoi: v.optional(v.string()), // area of interest GeoJSON
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_workspaceId", ["workspaceId"])
		.index("by_status", ["status"])
		.index("by_ownerId", ["ownerId"]),

	// ==================== AUDIT LOG ====================

	auditLog: defineTable({
		action: v.string(), // "login" | "logout" | "create" | "update" | "delete" | "export" | "search" | "view"
		actor: v.string(),
		resource: v.string(), // "case" | "entity" | "alert" | "workspace" | "user" | "source"
		resourceId: v.optional(v.string()),
		details: v.optional(v.string()),
		ipAddress: v.optional(v.string()),
		timestamp: v.number(),
	})
		.index("by_actor", ["actor"])
		.index("by_resource", ["resource"])
		.index("by_timestamp", ["timestamp"]),

	// ==================== USERS EXTENDED ====================

	userProfiles: defineTable({
		userId: v.string(),
		displayName: v.string(),
		role: v.string(), // "super_admin" | "admin" | "analyst" | "operator" | "viewer" | "executive"
		department: v.optional(v.string()),
		clearanceLevel: v.optional(v.string()),
		isActive: v.boolean(),
		lastLogin: v.optional(v.number()),
		preferences: v.optional(v.string()), // JSON
		createdAt: v.number(),
	})
		.index("by_userId", ["userId"])
		.index("by_role", ["role"]),

	// ==================== AI COPILOT ====================

	copilotSessions: defineTable({
		sessionId: v.string(),
		userId: v.string(),
		messages: v.string(), // JSON array of messages
		context: v.optional(v.string()), // current view context
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_sessionId", ["sessionId"])
		.index("by_userId", ["userId"]),
});

export default schema;
