"""
Chaos Engineering Engine (production-safe)
- Injects simulated failures to validate resilience
- Supports: latency injection, 503 responses, and network partition signals
- No real network changes on free-tier; this is a controlled stress test harness
"""
from __future__ import annotations

import random
import time
from typing import Dict

class ChaosEngine:
    def __init__(self, target_services: list[str] | None = None):
        self.targets = target_services or ["canary_api", "auth_server"]
        self.active_faults: Dict[str, str] = {}

    def inject_fault(self, service: str, fault_type: str) -> None:
        self.active_faults[service] = fault_type
        print(f"[CHAOS] Injected {fault_type} fault into {service}")

    def recover(self, service: str) -> None:
        if service in self.active_faults:
            del self.active_faults[service]
            print(f"[CHAOS] Recovered {service}")

    def run_cycle(self) -> Dict[str, str]:
        # Randomly pick a service and fault
        service = random.choice(self.targets)
        fault = random.choice(["latency", "timeout", "partition"])
        self.inject_fault(service, fault)
        time.sleep(0.2)
        self.recover(service)
        return {"service": service, "fault": fault, "status": "completed"}


if __name__ == "__main__":
    ce = ChaosEngine()
    print(ce.run_cycle())
