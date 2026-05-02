#!/usr/bin/env python3
"""
SENTINEL-X Real-Time Threat Updates
Phase 2: Server-Sent Events (SSE) for live threat streaming
Free tier: SSE (no WebSocket needed)
"""
import os
import json
import asyncio
from datetime import datetime, timedelta
from typing import Optional, Dict, Callable, List, Any
from dataclasses import dataclass, asdict
from enum import Enum
from collections import defaultdict
import secrets


class EventSeverity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class EventType(str, Enum):
    THREAT_NEW = "threat_new"
    THREAT_UPDATE = "threat_update"
    ALERT_NEW = "alert_new"
    ALERT_UPDATE = "alert_update"
    ALERT_ESCALATE = "alert_escalate"
    CASE_NEW = "case_new"
    CASE_UPDATE = "case_update"
    CASE_ASSIGN = "case_assign"
    ENTITY_NEW = "entity_new"
    ENTITY_LINK = "entity_link"
    SYSTEM_NOTICE = "system_notice"


@dataclass
class ThreatEvent:
    """Threat event for streaming"""
    id: str
    event_id: str
    event_type: str
    title: str
    severity: str
    latitude: Optional[float]
    longitude: Optional[float]
    location_name: Optional[str]
    source: str
    detected_at: datetime
    metadata: Dict


@dataclass
class AlertEvent:
    """Alert event for streaming"""
    id: str
    alert_id: str
    title: str
    severity: str
    status: str
    triggered_at: datetime
    acknowledged_by: Optional[str]
    resolved_by: Optional[str]


class EventStream:
    """Server-Sent Events (SSE) stream manager"""
    
    def __init__(self):
        self._subscribers: Dict[str, List[asyncio.Queue]] = defaultdict(list)
        self._last_event_id = 0
        self._buffer_size = 1000  # Keep last 1000 events in buffer
        self._event_buffer: List[Dict] = []
    
    def subscribe(
        self,
        event_type: str = None,
        severity_filter: List[str] = None
    ) -> asyncio.Queue:
        """Subscribe to events"""
        queue = asyncio.Queue(maxsize=100)
        
        subscription = {
            "event_type": event_type,
            "severity_filter": severity_filter or ["critical", "high", "medium", "low"]
        }
        
        # Subscribe to specific type or all
        key = event_type or "*"
        self._subscribers[key].append(queue)
        
        return queue
    
    def unsubscribe(self, event_type: str, queue: asyncio.Queue):
        """Unsubscribe from events"""
        key = event_type or "*"
        if queue in self._subscribers[key]:
            self._subscribers[key].remove(queue)
    
    async def broadcast(self, event: Dict):
        """Broadcast event to subscribers"""
        # Generate event ID
        self._last_event_id += 1
        event["event_id"] = self._last_event_id
        event["timestamp"] = datetime.now().isoformat()
        
        # Add to buffer
        self._event_buffer.append(event)
        if len(self._event_buffer) > self._buffer_size:
            self._event_buffer.pop(0)
        
        # Broadcast to subscribers
        for key, queues in self._subscribers.items():
            # Check if event matches subscription
            if key == "*" or key == event.get("type"):
                for queue in queues:
                    # Check severity filter
                    severity = event.get("severity", "").lower()
                    if severity in ["critical", "high"] or key == "*":
                        try:
                            await queue.put(event.copy())
                        except asyncio.QueueFull:
                            pass  # Drop if queue full
    
    async def emit_threat(self, threat: ThreatEvent):
        """Emit a new threat event"""
        await self.broadcast({
            "type": EventType.THREAT_NEW.value,
            "data": asdict(threat)
        })
    
    async def emit_alert(self, alert: AlertEvent, action: str = "new"):
        """Emit a new alert event"""
        if action == "escalate":
            event_type = EventType.ALERT_ESCALATE
        else:
            event_type = EventType.ALERT_NEW
        
        await self.broadcast({
            "type": event_type.value,
            "data": asdict(alert)
        })
    
    async def emit_case(self, case_id: str, title: str, action: str):
        """Emit case event"""
        event_type = {
            "new": EventType.CASE_NEW,
            "update": EventType.CASE_UPDATE,
            "assign": EventType.CASE_ASSIGN
        }.get(action, EventType.CASE_UPDATE)
        
        await self.broadcast({
            "type": event_type.value,
            "data": {
                "case_id": case_id,
                "title": title,
                "action": action
            }
        })
    
    def get_recent_events(self, limit: int = 50) -> List[Dict]:
        """Get recent events from buffer"""
        return self._event_buffer[-limit:]


class PollingEngine:
    """Fallback polling engine for clients without SSE support"""
    
    def __init__(self, db_queries=None):
        self.db = db_queries
        self._last_checks: Dict[str, datetime] = {}
        self._poll_interval = 5  # seconds
    
    async def check_for_updates(
        self,
        last_check: datetime,
        event_types: List[str] = None
    ) -> Dict[str, List]:
        """Check for new events since last check"""
        results = {
            "threats": [],
            "alerts": [],
            "cases": [],
            "entities": []
        }
        
        if not self.db:
            return results
        
        # Check new threats
        if "threats" in (event_types or ["threats", "all"]):
            threats = await self.db.get_threat_events(
                limit=10,
                detected_at=last_check
            )
            results["threats"] = threats
        
        # Check new alerts
        if "alerts" in (event_types or ["alerts", "all"]):
            alerts = await self.db.get_alerts(
                limit=10,
                triggered_at=last_check
            )
            results["alerts"] = alerts
        
        # Check case updates
        if "cases" in (event_types or ["cases", "all"]):
            cases = await self.db.get_cases(
                limit=10,
                updated_at=last_check
            )
            results["cases"] = cases
        
        return results
    
    async def start_polling(
        self,
        callback: Callable,
        event_types: List[str] = None,
        interval: int = None
    ):
        """Start polling loop"""
        interval = interval or self._poll_interval
        
        while True:
            now = datetime.now()
            last_check = self._last_checks.get("last", now - timedelta(minutes=5))
            
            updates = await self.check_for_updates(last_check, event_types)
            
            if any(updates.values()):
                await callback(updates)
            
            self._last_checks["last"] = now
            await asyncio.sleep(interval)


class NotificationService:
    """Service for sending notifications"""
    
    def __init__(self, event_stream: EventStream = None):
        self.event_stream = event_stream or EventStream()
        self._notification_queue = asyncio.Queue()
    
    async def notify(self, message: str, severity: str = "info"):
        """Send notification"""
        await self.event_stream.broadcast({
            "type": EventType.SYSTEM_NOTICE.value,
            "data": {
                "message": message,
                "severity": severity
            }
        })
    
    async def notify_critical_threat(self, threat: ThreatEvent):
        """Notify about critical threat"""
        await self.event_stream.broadcast({
            "type": EventType.THREAT_NEW.value,
            "data": asdict(threat),
            "priority": "critical"
        })
    
    async def notify_alert_escalation(self, alert: AlertEvent, new_severity: str):
        """Notify about alert escalation"""
        await self.event_stream.broadcast({
            "type": EventType.ALERT_ESCALATE.value,
            "data": asdict(alert),
            "old_severity": alert.severity,
            "new_severity": new_severity
        })


# SSE Endpoint Generator for FastAPI
def create_sse_endpoint(event_stream: EventStream):
    """Create SSE endpoint for FastAPI"""
    
    async def sse(request):
        """SSE endpoint handler"""
        # Get query params for filtering
        severity_filter = request.query_params.get("severity", "critical,high,medium,low").split(",")
        event_type = request.query_params.get("type")
        
        # Create queue
        queue = event_stream.subscribe(event_type, severity_filter)
        
        # Return SSE response
        async def generator():
            try:
                while True:
                    event = await queue.get()
                    
                    # Format as SSE
                    data = json.dumps(event)
                    yield f"data: {data}\n\n"
            except asyncio.CancelledError:
                pass
            finally:
                event_stream.unsubscribe(event_type or "*", queue)
        
        return generator()


# Webhook handler for external integrations
async def handle_webhook(
    webhook_url: str,
    payload: Dict
) -> bool:
    """Send webhook to external URL"""
    if not webhook_url:
        return False
    
    import aiohttp
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                webhook_url,
                json=payload,
                timeout=aiohttp.ClientTimeout(total=10)
            ) as resp:
                return resp.status in (200, 201)
    except Exception:
        return False


# Example usage
async def example():
    # Initialize
    stream = EventStream()
    notifier = NotificationService(stream)
    
    # Subscribe to critical threats
    queue = stream.subscribe("threat_new", ["critical", "high"])
    
    # Simulate emitting a threat
    threat = ThreatEvent(
        id="threat-001",
        event_id="EVT-2024-001",
        event_type="military_activity",
        title="Unknown military aircraft detected",
        severity="critical",
        latitude=40.7128,
        longitude=-74.0060,
        location_name="New York Area",
        source="ADS-B",
        detected_at=datetime.now()
    )
    
    await stream.emit_threat(threat)
    
    # Receive event
    event = await asyncio.wait_for(queue.get(), timeout=1)
    print(f"Received: {event}")
    
    # Get recent events
    recent = stream.get_recent_events()
    print(f"Recent events: {len(recent)}")


if __name__ == "__main__":
    import asyncio
    asyncio.run(example())