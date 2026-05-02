"""
End-to-End DEMO: Ingest data from free sources, register data products in the data mesh,
train a lightweight model on free-tier tooling, and prepare artifacts for hosting.

This demo is intentionally lightweight and self-contained to illustrate the end-to-end flow
using only 100% free tooling in Sentinel-X.
Note: Minor patch to retrigger PR automation in CI.
"""

import asyncio
import json
import os
from datetime import datetime
from pathlib import Path

from sentinel_x.data_mesh.abstraction_layer import DataMeshRegistry, DataProduct
from sentinel_x.data_sources.public_data_sources import PublicDatasetFetcher
from sentinel_x.datasets.public_data_sources import (
    PublicDatasetFetcher as SynFetcher,  # alias
)
from sentinel_x.training.multi_modal_anomaly_detector import SyntheticDataset


def ensure_dirs():
    Path("demos").mkdir(exist_ok=True)
    Path("datasets/processed").mkdir(parents=True, exist_ok=True)


async def run_demo():
    ensure_dirs()
    # 1) Fetch public/synthetic data (synthetic + small real-like samples)
    fetcher = PublicDatasetFetcher()
    data = await fetcher.extract_all()

    # 2) Build a data product in the Data Mesh Registry
    registry = DataMeshRegistry()
    prod = DataProduct(
        product_id="demo.sentinel.x.training.v1",
        name="DemoSentinelTrainingData",
        owner="demo",
        version="v1.0",
        sources=["synthetic", "opensky"],
        consumers=["ml", "analytics"],
        metadata={"created_at": datetime.utcnow().isoformat(),
                  "published": False},
    )
    registry.register_product(prod)
    registry.publish_product(
        prod.product_id, "/datasets/processed/demo_training.parquet"
    )

    # 3) Prepare a tiny synthetic training dataset and save
    synth = SyntheticDataset()
    df = synth.generate_batch(count=200)
    demo_path = Path("datasets/processed/demo_training.parquet")
    df.to_parquet(demo_path, compression="snappy")
    print("Demo: prepared demo_training.parquet")

    # 4) Run a tiny training pass if PyTorch is available (best effort)
    try:
        import torch

        if torch.cuda.is_available():
            device = "cuda"
        else:
            device = "cpu"
        print(f"Demo: training try on {device}")
        # We simply call the SyntheticDataset to simulate a training step
        _ = synth.generate_batch(count=50)
    except Exception as e:
        print(f"Demo: PyTorch not available or training failed: {e}")

    print("Demo complete. Artifacts saved under datasets/processed/")


if __name__ == "__main__":
    asyncio.run(run_demo())
