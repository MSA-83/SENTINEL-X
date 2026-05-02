"""
Public Data Sources Extractor (FREE): Kaggle-like synthetic data, OpenSky trajectories, MITRE ATT&CK, GitHub events
This module provides deterministic synthetic generators to be used in environments without external access or to seed pipelines for testing.
"""
from __future__ import annotations

import asyncio
import json
import random
import pandas as pd
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Optional


class PublicDatasetFetcher:
    def __init__(self, work_dir: Optional[str] = None):
        self.work_dir = Path(work_dir or "datasets/public")
        self.work_dir.mkdir(parents=True, exist_ok=True)

    async def fetch_kaggle_aircraft_data(self, size: int = 5000) -> pd.DataFrame:
        # Synthetic Kaggle-like aircraft taxonomy
        models = [f"A320neo-{i%10}" for i in range(size)]
        manufacturers = ["Airbus", "Boeing", "Bombardier", "Embraer"]
        types = ["Commercial", "Cargo", "Military", "Private"]
        data = {
            "model": models,
            "manufacturer": [manufacturers[i % len(manufacturers)] for i in range(size)],
            "type": [types[i % len(types)] for i in range(size)],
            "num_engines": [random.choice([2, 4, 1, 3]) for _ in range(size)],
            "cruise_speed": [random.randint(420, 880) for _ in range(size)],
        }
        df = pd.DataFrame(data)
        path = self.work_dir / "kaggle_aircraft_taxonomy_synthetic.parquet"
        df.to_parquet(path, compression="snappy")
        return df

    async def fetch_opensky_trajectories(self, count: int = 1000) -> List[Dict]:
        trajectories = []
        now = datetime.utcnow()
        for i in range(count):
            t = now - timedelta(seconds=i*60)
            trajectories.append({
                "callsign": f"NL{1000+i}",
                "lat": random.uniform(-90, 90),
                "lon": random.uniform(-180, 180),
                "altitude": random.randint(1000, 45000),
                "velocity": random.randint(100, 900),
                "timestamp": t.isoformat()
            })
        return trajectories

    async def fetch_faa_flight_data(self) -> Dict:
        # Synthetic FAA-like dataset
        return {
            "routes": [{"origin": "JFK", "dest": "LAX", "count": 123}],
            "aircraft": [{"tail": "N12345", "type": "A320"}]
        }

    async def fetch_mitre_attack_tactics(self) -> Dict:
        # Minimal synthetic MITRE ATT&CK mapping
        return {
            "tactics": [{"id": "TA0001", "name": "Initial Access"}, {"id": "TA0002", "name": "Execution"}],
            "techniques": [{"id": "T1001", "name": "Data Obfuscation"}]
        }

    async def fetch_github_public_events(self) -> List[Dict]:
        # Synthetic GitHub-style events
        events = [{"type": "PushEvent", "repo": {"name": "MSA-83/SENTINEL-X"}, "created_at": datetime.utcnow().isoformat()} for _ in range(10)]
        return events

    async def extract_all(self) -> Dict:
        kaggle_df = await self.fetch_kaggle_aircraft_data(size=1000)
        opensky = await self.fetch_opensky_trajectories(200)
        faa = await self.fetch_faa_flight_data()
        mitre = await self.fetch_mitre_attack_tactics()
        gh = await self.fetch_github_public_events()
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "sources": {
                "kaggle_synthetic": len(kaggle_df),
                "opensky_trajectories": len(opensky),
                "faa_flight_data": 1,
                "mitre_attack": 1,
                "github_events": len(gh),
            },
            "kaggle": kaggle_df,
            "opensky": opensky,
            "faa": faa,
            "mitre": mitre,
            "github": gh,
        }

if __name__ == "__main__":
    import asyncio
    f = PublicDatasetFetcher()
    asyncio.run(f.extract_all())
