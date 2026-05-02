#!/usr/bin/env python3
"""
SENTINEL-X Database Connection & Query Helpers
Phase 2: PostgreSQL with free tier support (Supabase, Neon, etc.)
"""
import os
import json
import asyncio
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
from enum import Enum
from contextlib import asynccontextmanager

# Database library - try psycopg3 first, fallback to psycopg2
try:
    import psycopg
    import psycopg.rows
    import psycopg.pool
    PSYCOPG_VERSION = 3
except ImportError:
    try:
        import psycopg2
        import psycopg2.pool
        PSYCOPG_VERSION = 2
    except ImportError:
        PSYCOPG_VERSION = 0


class AlertSeverity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class AlertStatus(str, Enum):
    ACTIVE = "active"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"
    FALSE_POSITIVE = "false_positive"


class CaseStatus(str, Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"


class EntityType(str, Enum):
    AIRCRAFT = "aircraft"
    VESSEL = "vessel"
    PERSON = "person"
    ORGANIZATION = "organization"
    LOCATION = "location"
    EVENT = "event"
    UNKNOWN = "unknown"


@dataclass
class ThreatEvent:
    id: str
    event_id: str
    event_type: str
    title: str
    description: Optional[str]
    severity: AlertSeverity
    status: str
    latitude: Optional[float]
    longitude: Optional[float]
    location_name: Optional[str]
    region: Optional[str]
    country: Optional[str]
    source: Optional[str]
    confidence: float
    detected_at: datetime
    event_timestamp: Optional[datetime]
    ai_summary: Optional[str]
    metadata: Optional[Dict]


@dataclass
class Alert:
    id: str
    alert_id: str
    title: str
    description: Optional[str]
    severity: AlertSeverity
    status: AlertStatus
    source_type: str
    triggered_at: datetime
    acknowledged_at: Optional[datetime]
    resolved_at: Optional[datetime]
    acknowledged_by: Optional[str]
    resolved_by: Optional[str]
    notes: Optional[str]


@dataclass
class Case:
    id: str
    case_id: str
    title: str
    description: Optional[str]
    status: CaseStatus
    priority: str
    case_type: str
    assigned_to: Optional[str]
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime]


@dataclass
class Entity:
    id: str
    entity_id: str
    entity_type: EntityType
    name: str
    aliases: List[str]
    threat_level: str
    confidence: float
    current_latitude: Optional[float]
    current_longitude: Optional[float]
    current_location_name: Optional[str]
    last_seen: Optional[datetime]
    metadata: Dict
    tags: List[str]


class DatabaseConnection:
    """Async PostgreSQL connection with connection pooling"""
    
    def __init__(self, connection_string: str = None):
        self.connection_string = connection_string or os.environ.get("DATABASE_URL", "")
        self.pool = None
        self._connected = False
    
    async def connect(self) -> bool:
        """Initialize connection pool"""
        if not self.connection_string:
            return False
        
        try:
            if PSYCOPG_VERSION == 3:
                self.pool = psycopg.pool.AsyncConnectionPool(
                    minconn=1,
                    maxconn=10,
                    connstring=self.connection_string
                )
            elif PSYCOPG_VERSION == 2:
                self.pool = psycopg2.pool.ThreadedConnectionPool(
                    minconn=1,
                    maxconn=10,
                    connstring=self.connection_string
                )
            self._connected = True
            return True
        except Exception as e:
            print(f"Database connection failed: {e}")
            return False
    
    @asynccontextmanager
    async def connection(self):
        """Get a connection from the pool"""
        if PSYCOPG_VERSION == 3:
            async with self.pool.acquire() as conn:
                yield conn
        elif PSYCOPG_VERSION == 2:
            conn = self.pool.getconn()
            try:
                yield conn
            finally:
                self.pool.putconn(conn)
        else:
            raise RuntimeError("No database driver available")
    
    async def close(self):
        """Close all connections"""
        if self.pool:
            self.pool.close()
            self._connected = False


class SentinelDBQueries:
    """SENTINEL-X PostgreSQL query helpers"""
    
    def __init__(self, db: DatabaseConnection):
        self.db = db
    
    # ==================== THREAT EVENTS ====================
    
    async def create_threat_event(self, event: Dict) -> ThreatEvent:
        """Create a new threat event"""
        query = """
            INSERT INTO threat_events (
                event_id, event_type, title, description,
                severity, status, latitude, longitude,
                location_name, region, country, source,
                confidence, event_timestamp, metadata
            ) VALUES (
                %(event_id)s, %(event_type)s, %(title)s, %(description)s,
                %(severity)s, %(status)s, %(latitude)s, %(longitude)s,
                %(location_name)s, %(region)s, %(country)s, %(source)s,
                %(confidence)s, %(event_timestamp)s, %(metadata)s
            ) RETURNING id, event_id, event_type, title, description,
                       severity, status, latitude, longitude, location_name,
                       region, country, source, confidence, detected_at,
                       event_timestamp, ai_summary, metadata;
        """
        
        async with self.db.connection() as conn:
            row = await asyncio.to_thread(
                conn.execute, query, event
            ).fetchone()
            return ThreatEvent(**dict(row)) if row else None
    
    async def get_threat_events(
        self,
        severity: Optional[str] = None,
        status: Optional[str] = None,
        region: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[ThreatEvent]:
        """Get threat events with filters"""
        conditions = []
        params = {"limit": limit, "offset": offset}
        
        if severity:
            conditions.append("severity = %(severity)s")
            params["severity"] = severity
        if status:
            conditions.append("status = %(status)s")
            params["status"] = status
        if region:
            conditions.append("region = %(region)s")
            params["region"] = region
        
        where = " AND ".join(conditions) if conditions else "TRUE"
        
        query = f"""
            SELECT id, event_id, event_type, title, description,
                   severity, status, latitude, longitude, location_name,
                   region, country, source, confidence, detected_at,
                   event_timestamp, ai_summary, metadata
            FROM threat_events
            WHERE {where}
            ORDER BY detected_at DESC
            LIMIT %(limit)s OFFSET %(offset)s;
        """
        
        async with self.db.connection() as conn:
            rows = await asyncio.to_thread(
                conn.execute, query, params
            ).fetchall()
            return [ThreatEvent(**dict(row)) for row in rows]
    
    async def get_threat_event_by_id(self, event_id: str) -> Optional[ThreatEvent]:
        """Get single threat event by ID"""
        query = """
            SELECT id, event_id, event_type, title, description,
                   severity, status, latitude, longitude, location_name,
                   region, country, source, confidence, detected_at,
                   event_timestamp, ai_summary, metadata
            FROM threat_events
            WHERE id = %(event_id)s OR event_id = %(event_id)s;
        """
        
        async with self.db.connection() as conn:
            row = await asyncio.to_thread(
                conn.execute, query, {"event_id": event_id}
            ).fetchone()
            return ThreatEvent(**dict(row)) if row else None
    
    # ==================== ALERTS ====================
    
    async def create_alert(self, alert: Dict) -> Alert:
        """Create a new alert"""
        query = """
            INSERT INTO alerts (
                alert_id, rule_id, title, description, severity,
                source_type, source_event, latitude, longitude,
                location_name, triggered_by
            ) VALUES (
                %(alert_id)s, %(rule_id)s, %(title)s, %(description)s, %(severity)s,
                %(source_type)s, %(source_event)s, %(latitude)s, %(longitude)s,
                %(location_name)s, %(triggered_by)s
            ) RETURNING *;
        """
        
        async with self.db.connection() as conn:
            row = await asyncio.to_thread(
                conn.execute, query, alert
            ).fetchone()
            return Alert(**dict(row)) if row else None
    
    async def get_alerts(
        self,
        severity: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 100
    ) -> List[Alert]:
        """Get alerts with filters"""
        conditions = []
        params = {"limit": limit}
        
        if severity:
            conditions.append("severity = %(severity)s")
            params["severity"] = severity
        if status:
            conditions.append("status = %(status)s")
            params["status"] = status
        
        where = " AND ".join(conditions) if conditions else "TRUE"
        
        query = f"""
            SELECT id, alert_id, title, description, severity, status,
                   source_type, triggered_at, acknowledged_at, resolved_at,
                   acknowledged_by, resolved_by, notes
            FROM alerts
            WHERE {where}
            ORDER BY triggered_at DESC
            LIMIT %(limit)s;
        """
        
        async with self.db.connection() as conn:
            rows = await asyncio.to_thread(
                conn.execute, query, params
            ).fetchall()
            return [Alert(**dict(row)) for row in rows]
    
    async def acknowledge_alert(self, alert_id: str, user_id: str) -> bool:
        """Acknowledge an alert"""
        query = """
            UPDATE alerts
            SET status = 'acknowledged',
                acknowledged_by = %(user_id)s,
                acknowledged_at = NOW()
            WHERE id = %(alert_id)s;
        """
        
        async with self.db.connection() as conn:
            await asyncio.to_thread(
                conn.execute, query, {"alert_id": alert_id, "user_id": user_id}
            )
            return True
    
    async def resolve_alert(
        self, alert_id: str, user_id: str, notes: str = None
    ) -> bool:
        """Resolve an alert"""
        query = """
            UPDATE alerts
            SET status = 'resolved',
                resolved_by = %(user_id)s,
                resolved_at = NOW(),
                resolution_notes = %(notes)s
            WHERE id = %(alert_id)s;
        """
        
        async with self.db.connection() as conn:
            await asyncio.to_thread(
                conn.execute, query, {"alert_id": alert_id, "user_id": user_id, "notes": notes}
            )
            return True
    
    # ==================== CASES ====================
    
    async def create_case(self, case: Dict) -> Case:
        """Create a new case"""
        query = """
            INSERT INTO cases (
                case_id, title, description, status, priority,
                case_type, assigned_to, assigned_by, assigned_at,
                linked_events, linked_alerts, tags
            ) VALUES (
                %(case_id)s, %(title)s, %(description)s, %(status)s, %(priority)s,
                %(case_type)s, %(assigned_to)s, %(assigned_by)s, NOW(),
                %(linked_events)s, %(linked_alerts)s, %(tags)s
            ) RETURNING *;
        """
        
        async with self.db.connection() as conn:
            row = await asyncio.to_thread(
                conn.execute, query, case
            ).fetchone()
            return Case(**dict(row)) if row else None
    
    async def get_cases(
        self,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        assigned_to: Optional[str] = None,
        limit: int = 100
    ) -> List[Case]:
        """Get cases with filters"""
        conditions = []
        params = {"limit": limit}
        
        if status:
            conditions.append("status = %(status)s")
            params["status"] = status
        if priority:
            conditions.append("priority = %(priority)s")
            params["priority"] = priority
        if assigned_to:
            conditions.append("assigned_to = %(assigned_to)s")
            params["assigned_to"] = assigned_to
        
        where = " AND ".join(conditions) if conditions else "TRUE"
        
        query = f"""
            SELECT id, case_id, title, description, status, priority,
                   case_type, assigned_to, created_at, updated_at, resolved_at
            FROM cases
            WHERE {where}
            ORDER BY created_at DESC
            LIMIT %(limit)s;
        """
        
        async with self.db.connection() as conn:
            rows = await asyncio.to_thread(
                conn.execute, query, params
            ).fetchall()
            return [Case(**dict(row)) for row in rows]
    
    async def add_case_timeline(
        self, case_id: str, action_type: str, title: str,
        user_id: str, description: str = None
    ) -> bool:
        """Add entry to case timeline"""
        query = """
            INSERT INTO case_timeline (
                case_id, action_type, title, description, user_id
            ) VALUES (
                %(case_id)s, %(action_type)s, %(title)s, %(description)s, %(user_id)s
            );
        """
        
        async with self.db.connection() as conn:
            await asyncio.to_thread(
                conn.execute, query, {
                    "case_id": case_id,
                    "action_type": action_type,
                    "title": title,
                    "description": description,
                    "user_id": user_id
                }
            )
            return True
    
    async def get_case_timeline(self, case_id: str) -> List[Dict]:
        """Get case timeline"""
        query = """
            SELECT id, action_type, title, description, user_id, created_at
            FROM case_timeline
            WHERE case_id = %(case_id)s
            ORDER BY created_at DESC;
        """
        
        async with self.db.connection() as conn:
            rows = await asyncio.to_thread(
                conn.execute, query, {"case_id": case_id}
            ).fetchall()
            return [dict(row) for row in rows]
    
    # ==================== ENTITIES ====================
    
    async def create_entity(self, entity: Dict) -> Entity:
        """Create a new entity"""
        query = """
            INSERT INTO entities (
                entity_id, entity_type, name, aliases, description,
                threat_level, confidence, current_latitude, current_longitude,
                current_location_name, last_seen, metadata, tags
            ) VALUES (
                %(entity_id)s, %(entity_type)s, %(name)s, %(aliases)s, %(description)s,
                %(threat_level)s, %(confidence)s, %(current_latitude)s, %(current_longitude)s,
                %(current_location_name)s, %(last_seen)s, %(metadata)s, %(tags)s
            ) RETURNING *;
        """
        
        async with self.db.connection() as conn:
            row = await asyncio.to_thread(
                conn.execute, query, entity
            ).fetchone()
            return Entity(**dict(row)) if row else None
    
    async def get_entities(
        self,
        entity_type: Optional[str] = None,
        threat_level: Optional[str] = None,
        limit: int = 100
    ) -> List[Entity]:
        """Get entities with filters"""
        conditions = []
        params = {"limit": limit}
        
        if entity_type:
            conditions.append("entity_type = %(entity_type)s")
            params["entity_type"] = entity_type
        if threat_level:
            conditions.append("threat_level = %(threat_level)s")
            params["threat_level"] = threat_level
        
        where = " AND ".join(conditions) if conditions else "TRUE"
        
        query = f"""
            SELECT id, entity_id, entity_type, name, aliases, threat_level,
                   confidence, current_latitude, current_longitude,
                   current_location_name, last_seen, metadata, tags
            FROM entities
            WHERE {where}
            ORDER BY confidence DESC
            LIMIT %(limit)s;
        """
        
        async with self.db.connection() as conn:
            rows = await asyncio.to_thread(
                conn.execute, query, params
            ).fetchall()
            return [Entity(**dict(row)) for row in rows]
    
    async def link_entities(
        self, source_id: str, target_id: str,
        link_type: str, user_id: str
    ) -> bool:
        """Link two entities"""
        query = """
            INSERT INTO entity_links (
                source_entity_id, target_entity_id, link_type, linked_by
            ) VALUES (
                %(source_id)s, %(target_id)s, %(link_type)s, %(user_id)s
            );
        """
        
        async with self.db.connection() as conn:
            await asyncio.to_thread(
                conn.execute, query, {
                    "source_id": source_id,
                    "target_id": target_id,
                    "link_type": link_type,
                    "user_id": user_id
                }
            )
            return True
    
    # ==================== FILES ====================
    
    async def create_attachment(self, file: Dict) -> str:
        """Create file attachment record"""
        query = """
            INSERT INTO file_attachments (
                filename, original_filename, mime_type, file_size,
                file_hash, storage_provider, storage_path, download_url,
                entity_id, event_id, case_id, report_id, uploaded_by
            ) VALUES (
                %(filename)s, %(original_filename)s, %(mime_type)s, %(file_size)s,
                %(file_hash)s, %(storage_provider)s, %(storage_path)s, %(download_url)s,
                %(entity_id)s, %(event_id)s, %(case_id)s, %(report_id)s, %(uploaded_by)s
            ) RETURNING id;
        """
        
        async with self.db.connection() as conn:
            row = await asyncio.to_thread(
                conn.execute, query, file
            ).fetchone()
            return str(row[0]) if row else None
    
    async def get_attachments(
        self,
        entity_id: Optional[str] = None,
        case_id: Optional[str] = None,
        event_id: Optional[str] = None
    ) -> List[Dict]:
        """Get file attachments"""
        conditions = []
        params = {}
        
        if entity_id:
            conditions.append("entity_id = %(entity_id)s")
            params["entity_id"] = entity_id
        if case_id:
            conditions.append("case_id = %(case_id)s")
            params["case_id"] = case_id
        if event_id:
            conditions.append("event_id = %(event_id)s")
            params["event_id"] = event_id
        
        where = " OR ".join(conditions) if conditions else "FALSE"
        
        query = f"""
            SELECT id, filename, original_filename, mime_type, file_size,
                   download_url, uploaded_by, created_at
            FROM file_attachments
            WHERE {where}
            ORDER BY created_at DESC;
        """
        
        async with self.db.connection() as conn:
            rows = await asyncio.to_thread(
                conn.execute, query, params
            ).fetchall()
            return [dict(row) for row in rows]
    
    # ==================== ANALYTICS ====================
    
    async def get_analytics_snapshot(
        self, snapshot_type: str = "daily"
    ) -> Optional[Dict]:
        """Get latest analytics snapshot"""
        query = """
            SELECT * FROM analytics_snapshots
            WHERE snapshot_type = %(type)s
            ORDER BY period_end DESC
            LIMIT 1;
        """
        
        async with self.db.connection() as conn:
            row = await asyncio.to_thread(
                conn.execute, query, {"type": snapshot_type}
            ).fetchone()
            return dict(row) if row else None
    
    async def get_threat_trends(self, days: int = 30) -> List[Dict]:
        """Get threat event trends"""
        query = """
            SELECT DATE_TRUNC('day', detected_at) as date,
                   severity, COUNT(*) as count
            FROM threat_events
            WHERE detected_at >= NOW() - INTERVAL '%(days)s days'
            GROUP BY DATE_TRUNC('day', detected_at), severity
            ORDER BY date DESC;
        """
        
        async with self.db.connection() as conn:
            rows = await asyncio.to_thread(
                conn.execute, query, {"days": days}
            ).fetchall()
            return [{"date": str(r[0]), "severity": r[1], "count": r[2]} for r in rows]
    
    # ==================== SEARCH ====================
    
    async def full_text_search(
        self, query: str, limit: int = 50
    ) -> Dict[str, List]:
        """Full-text search across all entities"""
        search_pattern = f"%{query}%"
        
        results = {
            "events": [],
            "alerts": [],
            "cases": [],
            "entities": [],
            "reports": []
        }
        
        # Search events
        event_query = """
            SELECT id, event_id, title, severity, detected_at
            FROM threat_events
            WHERE title ILIKE %(pattern)s OR description ILIKE %(pattern)s
            ORDER BY detected_at DESC LIMIT %(limit)s;
        """
        
        # Search alerts
        alert_query = """
            SELECT id, alert_id, title, severity, triggered_at
            FROM alerts
            WHERE title ILIKE %(pattern)s OR description ILIKE %(pattern)s
            ORDER BY triggered_at DESC LIMIT %(limit)s;
        """
        
        # Search cases
        case_query = """
            SELECT id, case_id, title, status, created_at
            FROM cases
            WHERE title ILIKE %(pattern)s OR description ILIKE %(pattern)s
            ORDER BY created_at DESC LIMIT %(limit)s;
        """
        
        # Search entities
        entity_query = """
            SELECT id, entity_id, name, entity_type, threat_level
            FROM entities
            WHERE name ILIKE %(pattern)s OR aliases && ARRAY[%(pattern)s]
            ORDER BY confidence DESC LIMIT %(limit)s;
        """
        
        params = {"pattern": search_pattern, "limit": limit}
        
        async with self.db.connection() as conn:
            for q, key in [
                (event_query, "events"),
                (alert_query, "alerts"),
                (case_query, "cases"),
                (entity_query, "entities")
            ]:
                rows = await asyncio.to_thread(
                    conn.execute, q, params
                ).fetchall()
                results[key] = [dict(r) for r in rows]
        
        return results
    
    # ==================== AUDIT ====================
    
    async def log_audit(
        self, action: str, entity_type: str, entity_id: str,
        user_id: str, user_email: str, changes: Dict = None
    ) -> bool:
        """Log an audit entry"""
        query = """
            INSERT INTO audit_logs (
                action, entity_type, entity_id,
                user_id, user_email, changes, ip_address
            ) VALUES (
                %(action)s, %(entity_type)s, %(entity_id)s,
                %(user_id)s, %(user_email)s, %(changes)s, %(ip_address)s
            );
        """
        
        async with self.db.connection() as conn:
            await asyncio.to_thread(
                conn.execute, query, {
                    "action": action,
                    "entity_type": entity_type,
                    "entity_id": entity_id,
                    "user_id": user_id,
                    "user_email": user_email,
                    "changes": json.dumps(changes) if changes else None,
                    "ip_address": None  # Would be from request context
                }
            )
            return True


async def main():
    """Demo usage"""
    db = DatabaseConnection()
    
    if not await db.connect():
        print("Database not connected (Set DATABASE_URL)")
        return
    
    queries = SentinelDBQueries(db)
    
    # Example: Get recent critical alerts
    alerts = await queries.get_alerts(severity="critical", limit=10)
    print(f"Found {len(alerts)} critical alerts")
    
    # Example: Full-text search
    results = await queries.full_text_search("military")
    for key, items in results.items():
        print(f"  {key}: {len(items)} matches")
    
    await db.close()


if __name__ == "__main__":
    asyncio.run(main())