"""
SENTINEL-X Convex Bridge
Python client to POST crew results to Convex HTTP endpoint
"""
import os
import asyncio
import json
import aiohttp
import logging
from datetime import datetime
from typing import Optional, Any
from dataclasses import dataclass, field
from enum import Enum

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ThreatSeverity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class ThreatType(str, Enum):
    AIRCRAFT_INCURSION = "aircraft_incursion"
    VESSEL_INCIDENT = "vessel_incident"
    AIS_SPOOFING = "ais_spoofing"
    GPS_JAMMING = "gps_jamming"
    COMMS_INTERCEPT = "comms_intercept"
    RADAR_JAMMING = "radar_jamming"
    ELECTRONIC_WARFARE = "electronic_warfare"
    OTHER = "other"


class EntityType(str, Enum):
    AIRCRAFT = "aircraft"
    VESSEL = "vessel"
    FACILITY = "facility"
    SIGNAL = "signal"
    PERSON = "person"
    ORGANIZATION = "organization"


@dataclass
class ThreatEvent:
    title: str
    description: str
    severity: ThreatSeverity
    threat_type: ThreatType
    location: dict
    source: str = "manual"
    status: str = "new"
    entity_ids: list = field(default_factory=list)
    case_id: Optional[str] = None


@dataclass
class Entity:
    name: str
    entity_type: EntityType
    classification: str = "unknown"
    risk_level: str = "low"
    location: Optional[dict] = None
    callsign: Optional[str] = None
    metadata: Optional[dict] = None


@dataclass
class Case:
    title: str
    description: str
    priority: str = "medium"
    case_type: str = "threat_investigation"
    status: str = "open"
    assigned_to: Optional[str] = None
    threat_ids: list = field(default_factory=list)


class ConvexBridge:
    """Bridge to Convex HTTP endpoint"""
    
    def __init__(self):
        self.url = os.environ.get("CONVEX_URL")
        self.private_key = os.environ.get("CONVEX_PRIVATE_KEY")
        self.public_url = os.environ.get("CONVEX_PUBLIC_URL")
        
        if not self.url:
            logger.warning("CONVEX_URL not set - bridge disabled")
    
    def _get_headers(self) -> dict:
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.private_key}",
        }
    
    async def post(self, action: str, payload: dict) -> dict:
        """POST to Convex action"""
        if not self.url:
            return {"success": False, "error": "CONVEX_URL not configured"}
        
        endpoint = f"{self.url}/{action}"
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    endpoint,
                    json=payload,
                    headers=self._get_headers(),
                ) as resp:
                    if resp.status == 200:
                        result = await resp.json()
                        logger.info(f"Posted {action}: {result.get('success')}")
                        return result
                    else:
                        error = await resp.text()
                        logger.error(f"Failed to post {action}: {error}")
                        return {"success": False, "error": error}
        except Exception as e:
            logger.error(f"Error posting to Convex: {e}")
            return {"success": False, "error": str(e)}
    
    async def create_threat(self, threat: ThreatEvent) -> dict:
        """Create threat event in Convex"""
        payload = {
            "title": threat.title,
            "description": threat.description,
            "severity": threat.severity.value,
            "threat_type": threat.threat_type.value,
            "location": threat.location,
            "source": threat.source,
            "status": threat.status,
            "entity_ids": threat.entity_ids,
            "case_id": threat.case_id,
            "created_at": int(datetime.utcnow().timestamp() * 1000),
            "updated_at": int(datetime.utcnow().timestamp() * 1000),
        }
        return await self.post("createThreat", payload)
    
    async def create_entity(self, entity: Entity) -> dict:
        """Create entity in Convex"""
        payload = {
            "name": entity.name,
            "entity_type": entity.entity_type.value,
            "classification": entity.classification,
            "risk_level": entity.risk_level,
            "location": entity.location,
            "callsign": entity.callsign,
            "metadata": entity.metadata,
            "first_seen": int(datetime.utcnow().timestamp() * 1000),
            "last_seen": int(datetime.utcnow().timestamp() * 1000),
            "created_at": int(datetime.utcnow().timestamp() * 1000),
            "updated_at": int(datetime.utcnow().timestamp() * 1000),
        }
        return await self.post("createEntity", payload)
    
    async def create_case(self, case: Case) -> dict:
        """Create case in Convex"""
        payload = {
            "title": case.title,
            "description": case.description,
            "priority": case.priority,
            "case_type": case.case_type,
            "status": case.status,
            "assigned_to": case.assigned_to,
            "threat_ids": case.threat_ids,
            "created_at": int(datetime.utcnow().timestamp() * 1000),
            "updated_at": int(datetime.utcnow().timestamp() * 1000),
        }
        return await self.post("createCase", payload)
    
    async def create_alert(
        self,
        title: str,
        description: str,
        severity: ThreatSeverity,
        source: str = "system",
    ) -> dict:
        """Create alert in Convex"""
        payload = {
            "title": title,
            "description": description,
            "severity": severity.value,
            "source": source,
            "status": "active",
            "created_at": int(datetime.utcnow().timestamp() * 1000),
            "updated_at": int(datetime.utcnow().timestamp() * 1000),
        }
        return await self.post("createAlert", payload)
    
    async def add_audit_log(
        self,
        action: str,
        entity_type: str,
        entity_id: str,
        actor_id: Optional[str] = None,
    ) -> dict:
        """Add audit log entry"""
        payload = {
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "actor_id": actor_id,
            "timestamp": int(datetime.utcnow().timestamp() * 1000),
        }
        return await self.post("addAuditLog", payload)
    
    async def add_ml_training_data(
        self,
        features: dict,
        label: int,
        source: str = "synthetic",
        threat_type: Optional[str] = None,
    ) -> dict:
        """Add ML training data"""
        payload = {
            "features": features,
            "label": label,
            "source": source,
            "threat_type": threat_type,
            "created_at": int(datetime.utcnow().timestamp() * 1000),
        }
        return await self.post("addMLTrainingData", payload)
    
    async def bulk_create_threats(self, threats: list[ThreatEvent]) -> dict:
        """Create multiple threats"""
        results = {"success": 0, "failed": 0, "errors": []}
        
        for threat in threats:
            result = await self.create_threat(threat)
            if result.get("success"):
                results["success"] += 1
            else:
                results["failed"] += 1
                results["errors"].append(result.get("error"))
        
        return results
    
    async def bulk_create_entities(self, entities: list[Entity]) -> dict:
        """Create multiple entities"""
        results = {"success": 0, "failed": 0, "errors": []}
        
        for entity in entities:
            result = await self.create_entity(entity)
            if result.get("success"):
                results["success"] += 1
            else:
                results["failed"] += 1
                results["errors"].append(result.get("error"))
        
        return results


class CrewAIBridge:
    """Bridge for CrewAI workflow results"""
    
    def __init__(self):
        self.bridge = ConvexBridge()
    
    async def send_investigation_results(
        self,
        threat_findings: list[dict],
        entities_discovered: list[dict],
        recommendations: list[str],
    ) -> dict:
        """Send CrewAI investigation results to Convex"""
        results = {
            "threats_created": 0,
            "entities_created": 0,
            "alerts_created": 0,
        }
        
        # Create threats from findings
        for finding in threat_findings:
            threat = ThreatEvent(
                title=finding.get("title", "AI Investigation"),
                description=finding.get("description", ""),
                severity=ThreatSeverity(finding.get("severity", "medium")),
                threat_type=ThreatType(finding.get("type", "other")),
                location=finding.get("location", {"lat": 0, "lng": 0}),
                source="crew_ai",
            )
            
            result = await self.bridge.create_threat(threat)
            if result.get("success"):
                results["threats_created"] += 1
                
                # Create alert if critical
                if finding.get("severity") == "critical":
                    await self.bridge.create_alert(
                        title=finding.get("title"),
                        description=finding.get("description", ""),
                        severity=ThreatSeverity.CRITICAL,
                        source="crew_ai",
                    )
                    results["alerts_created"] += 1
        
        # Create entities from discovered
        for entity_data in entities_discovered:
            entity = Entity(
                name=entity_data.get("name", "Unknown"),
                entity_type=EntityType(entity_data.get("type", "aircraft")),
                classification=entity_data.get("classification", "unknown"),
                risk_level=entity_data.get("risk", "medium"),
                location=entity_data.get("location"),
                callsign=entity_data.get("callsign"),
            )
            
            result = await self.bridge.create_entity(entity)
            if result.get("success"):
                results["entities_created"] += 1
        
        # Log the investigation
        await self.bridge.add_audit_log(
            action="crew_investigation_complete",
            entity_type="investigation",
            entity_id=f"inv_{datetime.utcnow().timestamp()}",
        )
        
        return results
    
    async def send_threat_analysis(
        self,
        threat_id: str,
        analysis: dict,
        prediction: Optional[dict] = None,
    ) -> dict:
        """Send threat analysis results"""
        # Add ML training data
        features = {
            "threat_id": threat_id,
            "severity_score": analysis.get("severity_score", 0),
            "pattern_match": analysis.get("pattern_match", 0),
            "entity_correlation": analysis.get("entity_correlation", 0),
        }
        
        label = 1 if analysis.get("is_threat", True) else 0
        
        await self.bridge.add_ml_training_data(
            features=features,
            label=label,
            source="crew_ai",
            threat_type=analysis.get("type"),
        )
        
        return {"success": True, "features_added": 1}


async def main():
    """Demo usage"""
    bridge = ConvexBridge()
    
    # Test threat creation
    threat = ThreatEvent(
        title="Test Threat from Bridge",
        description="Created via Python bridge",
        severity=ThreatSeverity.HIGH,
        threat_type=ThreatType.AIRCRAFT_INCURSION,
        location={"lat": 34.0522, "lng": -118.2437},
        source="bridge",
    )
    
    result = await bridge.create_threat(threat)
    print(f"Created threat: {result}")
    
    # Test entity
    entity = Entity(
        name="TEST-AIRCRAFT-001",
        entity_type=EntityType.AIRCRAFT,
        classification="military",
        risk_level="high",
        location={"lat": 40.0, "lng": -75.0, "heading": 180, "speed": 450},
        callsign="TEST123",
    )
    
    result = await bridge.create_entity(entity)
    print(f"Created entity: {result}")


if __name__ == "__main__":
    asyncio.run(main())