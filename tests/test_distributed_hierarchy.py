import sys
import os
import asyncio
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from agents.orchestrator.distributed_hierarchy import DistributedHierarchy


def test_distributed_hierarchy_consensus_round():
    dh = DistributedHierarchy()

    async def run():
        ok = await dh.simulate_consensus_round("value-A")
        assert ok is True

    asyncio.run(run())
