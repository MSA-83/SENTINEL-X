"""
Canary Deployment Pipeline
- Manages canary release between baseline and canary endpoints
- Simple traffic shifting with monitoring hooks
- Rollback on threshold violation
"""
from __future__ import annotations

import random
import time
from typing import Dict

class CanaryPipeline:
    def __init__(self, baseline_url: str, canary_url: str, max_steps: int = 5, threshold: float = 0.01):
        self.baseline_url = baseline_url
        self.canary_url = canary_url
        self.max_steps = max_steps
        self.threshold = threshold
        self.canary_ratio = 0.0

    def _simulate_latency(self) -> float:
        return random.uniform(0.05, 0.25)

    def push_canary(self, step: int) -> Dict:
        ratio = (step + 1) / self.max_steps
        self.canary_ratio = ratio
        latency = self._simulate_latency()
        success = random.random() > self.threshold
        ok = success and latency < 0.3
        return {
            "step": step,
            "canary_ratio": ratio,
            "latency": latency,
            "success": ok,
        }

    def monitor(self) -> Dict:
        # Simulated monitoring metrics
        return {
            "error_rate": random.uniform(0.0, 0.02),
            "latency_p99": random.uniform(0.15, 0.50),
            "throughput": random.randint(800, 1500),
        }

    def rollback(self) -> None:
        self.canary_ratio = 0.0
        print("[CANARY] Rollback to baseline initiated")

    def run_canary(self) -> Dict:
        for step in range(self.max_steps):
            res = self.push_canary(step)
            if not res["success"]:
                self.rollback()
                return {"status": "rolled_back", "step": step, "details": res}
            time.sleep(0.2)  # simulate monitoring delay
        return {"status": "canary_passed", "final_ratio": self.canary_ratio}


if __name__ == "__main__":
    cp = CanaryPipeline(baseline_url="https://baseline.example/api", canary_url="https://canary.example/api")
    result = cp.run_canary()
    print(result)
