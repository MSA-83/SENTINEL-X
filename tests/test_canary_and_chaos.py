import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from deployment.canary_pipeline import CanaryPipeline
from deployment.chaos_engineering import ChaosEngine


def test_canary_basic_passes():
    canary = CanaryPipeline(baseline_url="/baseline", canary_url="/canary", max_steps=3, threshold=0.0)
    result = canary.run_canary()
    assert result.get("status") in {"canary_passed", "rolled_back"}


def test_chaos_cycle_runs():
    ce = ChaosEngine()
    cycle = ce.run_cycle()
    assert isinstance(cycle, dict)
    assert cycle.get("service") is not None
