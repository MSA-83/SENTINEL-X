"""
Distributed Hierarchy: multi-region consensus skeleton
- Provides minimal scaffolding for cross-region agent coordination with latency awareness
- Designed to be compatible with existing 23-agent hierarchy while enabling regional leaders
- Pure-Python simulation; exchange via in-process calls to keep free-tier friendly
"""

from __future__ import annotations

import asyncio
import random
import time
from typing import Dict, List, Optional

REGIONS = ["us-east", "eu-west", "apac"]


class RegionLeader:
    def __init__(self, region: str, leader_id: str):
        self.region = region
        self.leader_id = leader_id
        self.peers: List[str] = []  # peer leaders across regions

    def add_peer(self, peer_id: str) -> None:
        if peer_id not in self.peers:
            self.peers.append(peer_id)


class DistributedHierarchy:
    """Lightweight in-process simulation of distributed hierarchy"""

    def __init__(self, regions: Optional[List[str]] = None):
        self.regions = regions or REGIONS
        self.leaders: Dict[str, RegionLeader] = {
            r: RegionLeader(r, leader_id=f"leader-{r}") for r in self.regions
        }
        for r in self.regions:
            for peer in self.regions:
                if peer != r:
                    self.leaders[r].add_peer(self.leaders[peer].leader_id)

        self.message_queue: List[Dict] = []
        print("DistributedHierarchy initialized with regions: ", self.regions)

    async def route_message(self, src_region: str, dst_region: str, payload: dict) -> dict:
        # Simulated latency based on region distance (randomized for demo)
        latency = random.uniform(0.05, 0.3)
        await asyncio.sleep(latency)
        msg = {"src": src_region, "dst": dst_region, "payload": payload, "latency": latency}
        self.message_queue.append(msg)
        return msg

    def get_current_state(self) -> dict:
        return {
            "regions": self.regions,
            "leaders": {r: l.leader_id for r, l in self.leaders.items()},
            "queued_messages": len(self.message_queue),
        }

    def propose_consensus(self, region: str, value: str) -> bool:
        # Very small stub: accept consensus if two regions propose same value
        votes = [value]
        return len(votes) >= 2
