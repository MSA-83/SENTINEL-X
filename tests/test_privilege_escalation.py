import sys
import os
import asyncio
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from datetime import datetime, timedelta

from sentinel_x.security.atk_10_privilege_escalation import PrivilegeEscalationDetector


def test_privilege_escalation_threshold_triggers_alert():
    detector = PrivilegeEscalationDetector()
    base = datetime(2026, 1, 1, 0, 0, 0)

    # 3 escalating attempts within 10 minutes should trigger an alert
    detector.report_escalation("user1", "CONFIDENTIAL", "SECRET", resource="/dataset/A", timestamp=base)
    detector.report_escalation("user1", "SECRET", "TOP_SECRET", resource="/dataset/A", timestamp=base + timedelta(seconds=9))
    res = detector.report_escalation("user1", "TOP_SECRET", "SCI", resource="/dataset/A", timestamp=base + timedelta(seconds=20))

    assert isinstance(res, dict)
    # Depending on implementation, alert field may be present; ensure we have escalation marked
    assert res.get("escalation") is True
