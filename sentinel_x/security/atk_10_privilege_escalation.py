"""
ATK-10: Privilege Escalation Detection
- Detects and logs privilege escalation attempts across agents/services
- Enforces a conservative policy: multiple escalations within a short window
- Logs to IL6 audit trail for DoD IL6 compliance
- Provides callable API for app components to report escalation events
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Set
from collections import defaultdict

from sentinel_x.security.il6_audit import FIPSAuditLogger

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("sentinel.security.atk10")

# Role hierarchy (lowest to highest). Extendable by config.
ROLE_RANK: Dict[str, int] = {
    "UNCLASSIFIED": 0,
    "CONFIDENTIAL": 1,
    "SECRET": 2,
    "TOP_SECRET": 3,
    "SCI": 4,
}


class PrivilegeEscalationDetector:
    """Detector for privilege escalation attempts across agents"""

    def __init__(
        self,
        audit_logger: Optional[FIPSAuditLogger] = None,
        escalation_window_minutes: int = 10,
        escalation_threshold: int = 2,
        allowlist: Optional[Set[str]] = None,
    ):
        self.audit_logger = audit_logger
        self.escalation_window = timedelta(minutes=escalation_window_minutes)
        self.escalation_threshold = escalation_threshold
        self.allowlist = allowlist or set()

        # Per-user escalation timestamps
        self._escalation_log: Dict[str, List[datetime]] = defaultdict(list)
        self._lock = __import__("threading").Lock()

        logger.info("✅ PrivilegeEscalationDetector initialized")

    def _role_rank(self, role: str) -> int:
        return ROLE_RANK.get(role.upper(), 0)

    def report_escalation(self,
                          user_id: str,
                          old_role: str,
                          new_role: str,
                          resource: Optional[str] = None,
                          approved: bool = False,
                          approved_by: Optional[str] = None,
                          timestamp: Optional[datetime] = None) -> Dict:
        """Report a privilege escalation event and evaluate risk.

        Returns a dict with escalation assessment and any triggered alerts.
        """
        now = timestamp or datetime.utcnow()
        old_rank = self._role_rank(old_role)
        new_rank = self._role_rank(new_role)

        is_escalation = new_rank > old_rank
        result: Dict = {
            "user_id": user_id,
            "resource": resource,
            "old_role": old_role,
            "new_role": new_role,
            "timestamp": now.isoformat(),
            "escalation": bool(is_escalation),
            "approved": approved,
            "approved_by": approved_by,
        }

        if is_escalation:
            with self._lock:
                self._escalation_log[user_id].append(now)

        # Quorum check: have we seen X escalations in the window?
        count = 0
        with self._lock:
            recent = [t for t in self._escalation_log[user_id] if now - t <= self.escalation_window]
            count = len(recent)

        alert_required = count >= self.escalation_threshold and not approved
        if alert_required:
            result["alert"] = {
                "type": "privilege_escalation_alert",
                "count": count,
                "window_minutes": int(self.escalation_window.total_seconds() / 60)
            }
            if self.audit_logger:
                self.audit_logger.log_event({
                    "event_type": "privilege_escalation_alert",
                    "user_id": user_id,
                    "resource": resource,
                    "old_role": old_role,
                    "new_role": new_role,
                    "count": count,
                    "window": int(self.escalation_window.total_seconds() / 60)
                }, agent_id="atk10_detector")
            logger.warning("ALERT: Privilege escalation threshold exceeded")

        # Always log escalation attempt (audit trail)
        if self.audit_logger:
            self.audit_logger.log_event({
                "event_type": "privilege_escalation_attempt",
                "user_id": user_id,
                "old_role": old_role,
                "new_role": new_role,
                "resource": resource,
                "approved": approved,
                "approved_by": approved_by,
                "timestamp": now.isoformat(),
                "escalation": is_escalation
            }, agent_id="atk10_detector")

        return result

    def is_whitelisted(self, user_id: str) -> bool:
        return user_id in self.allowlist

    def add_to_allowlist(self, user_id: str) -> None:
        self.allowlist.add(user_id)
        logger.info(f"✅ Added {user_id} to privilege escalation allowlist")

    def remove_from_allowlist(self, user_id: str) -> None:
        self.allowlist.discard(user_id)
        logger.info(f"✅ Removed {user_id} from privilege escalation allowlist")


if __name__ == "__main__":
    # Demo usage
    from sentinel_x.security.il6_audit import FIPSAuditLogger

    audit = FIPSAuditLogger()
    detector = PrivilegeEscalationDetector(audit_logger=audit)
    res = detector.report_escalation(
        user_id="security_admin",
        old_role="CONFIDENTIAL",
        new_role="SECRET",
        resource="/datasets/opensky",
        approved=False,
        approved_by=None
    )
    print(json.dumps(res, indent=2))
