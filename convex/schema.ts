"""
SENTINEL-X Convex Schema
All tables for threat intelligence platform
"""
import { defineSchema, defineTable } from "convex/server"
import { assert } from "convex/validators"
import { v } from "convex/values"

export default defineSchema({
  // === USERS & AUTH ===
  users: defineTable("users")
    .schema({
      name: v.string(),
      email: v.string(),
      role: v.union(
        v.literal("admin"),
        v.literal("analyst"),
        v.literal("viewer")
      ),
      avatarUrl: v.optional(v.string()),
      lastActive: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
    .index("email", ["email"])
    .index("role", ["role"]),

  // === THREAT EVENTS ===
  threatEvents: defineTable("threat_events")
    .schema({
      title: v.string(),
      description: v.string(),
      severity: v.union(
        v.literal("critical"),
        v.literal("high"),
        v.literal("medium"),
        v.literal("low")
      ),
      threatType: v.union(
        v.literal("aircraft_incursion"),
        v.literal("vessel_incident"),
        v.literal("ais_spoofing"),
        v.literal("gps_jamming"),
        v.literal("comms_intercept"),
        v.literal("radar_jamming"),
        v.literal("electronic_warfare"),
        v.literal("other")
      ),
      status: v.union(
        v.literal("new"),
        v.literal("investigating"),
        v.literal("confirmed"),
        v.literal("resolved"),
        v.literal("false_positive")
      ),
      location: v.object({
        lat: v.number(),
        lng: v.number(),
        region: v.optional(v.string()),
      }),
      source: v.union(
        v.literal("ads_b"),
        v.literal("ais"),
        v.literal("sigint"),
        v.literal("osint"),
        v.literal("geoint"),
        v.literal("radar"),
        v.literal("manual")
      ),
      entityIds: v.optional(v.array(v.string())),
      caseId: v.optional(v.string()),
      createdBy: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
    .index("severity", ["severity"])
    .index("status", ["status"])
    .index("createdAt", ["createdAt"])
    .index("location", ["location"]),

  // === ENTITIES ===
  entities: defineTable("entities")
    .schema({
      name: v.string(),
      callsign: v.optional(v.string()),
      entityType: v.union(
        v.literal("aircraft"),
        v.literal("vessel"),
        v.literal("facility"),
        v.literal("signal"),
        v.literal("person"),
        v.literal("organization")
      ),
      classification: v.union(
        v.literal("unknown"),
        v.literal("commercial"),
        v.literal("military"),
        v.literal("government"),
        v.literal("civilian")
      ),
      riskLevel: v.union(
        v.literal("critical"),
        v.literal("high"),
        v.literal("medium"),
        v.literal("low")
      ),
      location: v.optional(v.object({
        lat: v.number(),
        lng: v.number(),
        heading: v.optional(v.number()),
        speed: v.optional(v.number()),
      })),
      metadata: v.optional(v.any()),
      firstSeen: v.number(),
      lastSeen: v.number(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
    .index("entityType", ["entityType"])
    .index("riskLevel", ["riskLevel"])
    .index("lastSeen", ["lastSeen"]),

  entityHistory: defineTable("entity_history")
    .schema({
      entityId: v.string(),
      eventType: v.string(),
      location: v.optional(v.object({
        lat: v.number(),
        lng: v.number(),
      })),
      metadata: v.optional(v.any()),
      timestamp: v.number(),
    })
    .index("entityId", ["entityId"])
    .index("timestamp", ["timestamp"]),

  // === CASES ===
  cases: defineTable("cases")
    .schema({
      title: v.string(),
      description: v.string(),
      status: v.union(
        v.literal("open"),
        v.literal("in_progress"),
        v.literal("resolved"),
        v.literal("closed")
      ),
      priority: v.union(
        v.literal("critical"),
        v.literal("high"),
        v.literal("medium"),
        v.literal("low")
      ),
      caseType: v.union(
        v.literal("threat_investigation"),
        v.literal("intelligence"),
        v.literal("routine"),
        v.literal("investigation")
      ),
      assignedTo: v.optional(v.string()),
      threatIds: v.optional(v.array(v.string())),
      entityIds: v.optional(v.array(v.string())),
      createdBy: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
    .index("status", ["status"])
    .index("priority", ["priority"])
    .index("assignedTo", ["assignedTo"]),

  caseNotes: defineTable("case_notes")
    .schema({
      caseId: v.string(),
      content: v.string(),
      authorId: v.optional(v.string()),
      createdAt: v.number(),
    })
    .index("caseId", ["caseId"]),

  caseTimeline: defineTable("case_timeline")
    .schema({
      caseId: v.string(),
      action: v.string(),
      details: v.optional(v.any()),
      actorId: v.optional(v.string()),
      timestamp: v.number(),
    })
    .index("caseId", ["caseId"])
    .index("timestamp", ["timestamp"]),

  // === ALERTS ===
  alerts: defineTable("alerts")
    .schema({
      title: v.string(),
      description: v.string(),
      severity: v.union(
        v.literal("critical"),
        v.literal("high"),
        v.literal("medium"),
        v.literal("low")
      ),
      status: v.union(
        v.literal("active"),
        v.literal("acknowledged"),
        v.literal("resolved"),
        v.literal("suppressed")
      ),
      source: v.string(),
      relatedThreatId: v.optional(v.string()),
      acknowledgedBy: v.optional(v.string()),
      acknowledgedAt: v.optional(v.number()),
      resolvedBy: v.optional(v.string()),
      resolvedAt: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
    .index("status", ["status"])
    .index("severity", ["severity"]),

  alertRules: defineTable("alert_rules")
    .schema({
      name: v.string(),
      condition: v.any(),
      severity: v.union(
        v.literal("critical"),
        v.literal("high"),
        v.literal("medium"),
        v.literal("low")
      ),
      channels: v.array(v.string()),
      enabled: v.boolean(),
      cooldownMinutes: v.number(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
    .index("enabled", ["enabled"]),

  // === FILES ===
  fileAttachments: defineTable("file_attachments")
    .schema({
      filename: v.string(),
      storageId: v.string(),
      mimeType: v.string(),
      size: v.number(),
      caseId: v.optional(v.string()),
      threatId: v.optional(v.string()),
      entityId: v.optional(v.string()),
      uploadedBy: v.optional(v.string()),
      createdAt: v.number(),
    })
    .index("caseId", ["caseId"])
    .index("threatId", ["threatId"])
    .index("entityId", ["entityId"]),

  // === ANALYTICS ===
  analyticsSnapshots: defineTable("analytics_snapshots")
    .schema({
      snapshotType: v.string(),
      data: v.any(),
      createdAt: v.number(),
    })
    .index("snapshotType", ["snapshotType"])
    .index("createdAt", ["createdAt"]),

  // === REPORTS ===
  reports: defineTable("reports")
    .schema({
      title: v.string(),
      reportType: v.union(
        v.literal("daily"),
        v.literal("weekly"),
        v.literal("monthly"),
        v.literal("custom")
      ),
      content: v.any(),
      filterCriteria: v.optional(v.any()),
      generatedBy: v.optional(v.string()),
      createdAt: v.number(),
    })
    .index("reportType", ["reportType"])
    .index("createdAt", ["createdAt"]),

  // === AUDIT LOGS ===
  auditLogs: defineTable("audit_logs")
    .schema({
      action: v.string(),
      entityType: v.string(),
      entityId: v.string(),
      actorId: v.optional(v.string()),
      oldValue: v.optional(v.any()),
      newValue: v.optional(v.any()),
      timestamp: v.number(),
    })
    .index("entityType", ["entityType"])
    .index("entityId", ["entityId"])
    .index("timestamp", ["timestamp"])
    .index("actorId", ["actorId"]),

  // === ML TRAINING DATA ===
  mlTrainingData: defineTable("ml_training_data")
    .schema({
      features: v.any(),
      label: v.number(),
      source: v.union(
        v.literal("opensky"),
        v.literal("mitre"),
        v.literal("historical"),
        v.literal("synthetic")
      ),
      threatType: v.optional(v.string()),
      metadata: v.optional(v.any()),
      createdAt: v.number(),
    })
    .index("source", ["source"])
    .index("label", ["label"])
    .index("threatType", ["threatType"]),

  // === ENTITY LINKS ===
  entityLinks: defineTable("entity_links")
    .schema({
      sourceEntityId: v.string(),
      targetEntityId: v.string(),
      relationshipType: v.union(
        v.literal("related"),
        v.literal("same_group"),
        v.literal("parent"),
        v.literal("child"),
        v.literal("associated")
      ),
      confidence: v.number(),
      createdAt: v.number(),
    })
    .index("sourceEntityId", ["sourceEntityId"])
    .index("targetEntityId", ["targetEntityId"]),

  // === AI ASSISTANT ===
  aiConversations: defineTable("ai_conversations")
    .schema({
      userId: v.optional(v.string()),
      title: v.string(),
      messages: v.array(v.object({
        role: v.union(v.literal("user"), v.literal("assistant")),
        content: v.string(),
        timestamp: v.number(),
      })),
      context: v.optional(v.any()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
    .index("userId", ["userId"])
    .index("createdAt", ["createdAt"]),
})