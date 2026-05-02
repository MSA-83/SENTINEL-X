"""
SENTINEL-X Alert System
Real-time alert management and notifications
"""
import os
import asyncio
import json
from datetime import datetime, timedelta
from typing import Optional, Callable, Any
from dataclasses import dataclass, field
from enum import Enum
from enum import Enum

class AlertSeverity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

class AlertStatus(str, Enum):
    ACTIVE = "active"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"
    SUPPRESSED = "suppressed"

class AlertChannel(str, Enum):
    EMAIL = "email"
    SMS = "sms"
    PUSH = "push"
    WEBHOOK = "webhook"
    SSE = "sse"


@dataclass
class Alert:
    id: str
    title: str
    description: str
    severity: AlertSeverity
    source: str
    timestamp: datetime
    status: AlertStatus = AlertStatus.ACTIVE
    acknowledged_by: Optional[str] = None
    acknowledged_at: Optional[datetime] = None
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    metadata: dict = field(default_factory=dict)
    channels: list = field(default_factory=list)


@dataclass
class AlertRule:
    id: str
    name: str
    condition: dict  # {"field": "severity", "operator": "eq", "value": "critical"}
    severity: AlertSeverity
    channels: list
    enabled: bool = True
    cooldown_minutes: int = 15
    last_triggered: Optional[datetime] = None


class AlertManager:
    """Manage alerts and notifications"""
    
    def __init__(self):
        self.alerts: dict[str, Alert] = {}
        self.rules: dict[str, AlertRule] = {}
        self.listeners: list[Callable] = []
        self.handlers: dict[AlertChannel, Callable] = {
            AlertChannel.EMAIL: self._handle_email,
            AlertChannel.SMS: self._handle_sms,
            AlertChannel.PUSH: self._handle_push,
            AlertChannel.WEBHOOK: self._handle_webhook,
            AlertChannel.SSE: self._handle_sse,
        }
    
    async def create_alert(
        self,
        title: str,
        description: str,
        severity: AlertSeverity,
        source: str,
        metadata: Optional[dict] = None,
    ) -> Alert:
        """Create new alert"""
        alert = Alert(
            id=f"ALERT-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{len(self.alerts) + 1}",
            title=title,
            description=description,
            severity=severity,
            source=source,
            timestamp=datetime.utcnow(),
            metadata=metadata or {},
        )
        
        self.alerts[alert.id] = alert
        await self._process_alert(alert)
        
        return alert
    
    async def _process_alert(self, alert: Alert):
        """Process alert through rules and channels"""
        for rule in self.rules.values():
            if not rule.enabled:
                continue
            if self._matches_rule(alert, rule):
                if await self._check_cooldown(rule):
                    for channel in rule.channels:
                        handler = self.handlers.get(channel)
                        if handler:
                            await handler(alert)
                    rule.last_triggered = datetime.utcnow()
        
        for listener in self.listeners:
            try:
                await listener(alert)
            except Exception as e:
                print(f"Listener error: {e}")
    
    def _matches_rule(self, alert: Alert, rule: AlertRule) -> bool:
        """Check if alert matches rule condition"""
        condition = rule.condition
        field = condition.get("field")
        operator = condition.get("operator")
        value = condition.get("value")
        
        alert_value = getattr(alert, field, None)
        if not alert_value:
            return False
        
        if operator == "eq":
            return alert_value == value
        elif operator == "ne":
            return alert_value != value
        elif operator == "in":
            return alert_value in value
        elif operator == "gt":
            return alert_value > value
        elif operator == "lt":
            return alert_value < value
        
        return False
    
    async def _check_cooldown(self, rule: AlertRule) -> bool:
        """Check if rule is in cooldown"""
        if not rule.last_triggered:
            return True
        
        elapsed = datetime.utcnow() - rule.last_triggered
        return elapsed.total_seconds() > rule.cooldown_minutes * 60
    
    async def acknowledge_alert(self, alert_id: str, user: str) -> Alert:
        """Acknowledge alert"""
        alert = self.alerts.get(alert_id)
        if not alert:
            raise ValueError(f"Alert not found: {alert_id}")
        
        alert.status = AlertStatus.ACKNOWLEDGED
        alert.acknowledged_by = user
        alert.acknowledged_at = datetime.utcnow()
        
        return alert
    
    async def resolve_alert(self, alert_id: str, user: str) -> Alert:
        """Resolve alert"""
        alert = self.alerts.get(alert_id)
        if not alert:
            raise ValueError(f"Alert not found: {alert_id}")
        
        alert.status = AlertStatus.RESOLVED
        alert.resolved_by = user
        alert.resolved_at = datetime.utcnow()
        
        return alert
    
    def get_active_alerts(self) -> list[Alert]:
        """Get all active alerts"""
        return [
            a for a in self.alerts.values()
            if a.status == AlertStatus.ACTIVE
        ]
    
    def get_alerts_by_severity(self, severity: AlertSeverity) -> list[Alert]:
        """Get alerts by severity"""
        return [
            a for a in self.alerts.values()
            if a.severity == severity and a.status == AlertStatus.ACTIVE
        ]
    
    def add_listener(self, callback: Callable):
        """Add alert listener"""
        self.listeners.append(callback)
    
    def add_rule(self, rule: AlertRule):
        """Add alert rule"""
        self.rules[rule.id] = rule
    
    async def _handle_email(self, alert: Alert):
        """Send email notification"""
        # Integrate with email service
        print(f"Email alert: {alert.title}")
    
    async def _handle_sms(self, alert: Alert):
        """Send SMS notification"""
        # Integrate with SMS service
        print(f"SMS alert: {alert.title}")
    
    async def _handle_push(self, alert: Alert):
        """Send push notification"""
        # Integrate with push service
        print(f"Push alert: {alert.title}")
    
    async def _handle_webhook(self, alert: Alert):
        """Send webhook notification"""
        # Integrate with webhook
        print(f"Webhook alert: {alert.title}")
    
    async def _handle_sse(self, alert: Alert):
        """Send SSE notification"""
        # SSE handled by listeners
        pass


class AlertWebhook:
    """Webhook handler for external alerts"""
    
    def __init__(self, alert_manager: AlertManager):
        self.alert_manager = alert_manager
    
    async def receive(self, payload: dict) -> Alert:
        """Receive alert from webhook"""
        return await self.alert_manager.create_alert(
            title=payload.get("title", "External Alert"),
            description=payload.get("description", ""),
            severity=AlertSeverity(payload.get("severity", "medium")),
            source=payload.get("source", "webhook"),
            metadata=payload,
        )


class AlertFilter:
    """Filter alerts based on criteria"""
    
    @staticmethod
    def filter_by_time(alerts: list[Alert], hours: int) -> list[Alert]:
        """Filter alerts from last N hours"""
        cutoff = datetime.utcnow() - timedelta(hours=hours)
        return [a for a in alerts if a.timestamp >= cutoff]
    
    @staticmethod
    def filter_by_status(alerts: list[Alert], status: AlertStatus) -> list[Alert]:
        """Filter by status"""
        return [a for a in alerts if a.status == status]
    
    @staticmethod
    def filter_by_severity(alerts: list[Alert], severity: AlertSeverity) -> list[Alert]:
        """Filter by severity"""
        return [a for a in alerts if a.severity == severity]


async def main():
    """Demo"""
    manager = AlertManager()
    
    alert = await manager.create_alert(
        title="Critical Threat Detected",
        description="Unknown aircraft in restricted airspace",
        severity=AlertSeverity.CRITICAL,
        source="ADS-B",
    )
    
    print(f"Created alert: {alert.id}")
    
    active = manager.get_active_alerts()
    print(f"Active alerts: {len(active)}")
    
    critical = manager.get_alerts_by_severity(AlertSeverity.CRITICAL)
    print(f"Critical alerts: {len(critical)}")


if __name__ == "__main__":
    asyncio.run(main())