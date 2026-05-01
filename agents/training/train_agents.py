#!/usr/bin/env python3
"""
Training script for SENTINEL-X agents on Kaggle/Colab/Modal
Optimized for free GPU tiers (T4, A100)
"""

import os
import sys
import json
import asyncio
import argparse
from datetime import datetime
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from agents.classifier_agent import EntityClassifierAgent, batch_classify
from agents.anomaly_detector_agent import AnomalyDetectorAgent, batch_detect
from agents.dataset_curator_agent import DatasetCuratorAgent, run_curation


async def train_classifier(epochs: int = 3, batch_size: int = 32):
    """Train entity classifier agent"""
    print("=" * 60)
    print("TRAINING: Entity Classifier Agent")
    print("=" * 60)
    
    agent = EntityClassifierAgent(model_version="v1")
    
    # Generate synthetic training data
    train_data = []
    for i in range(100):
        is_anomaly = i % 5 == 0  # 20% anomalies
        train_data.append({
            "entity_id": f"entity_{i}",
            "velocity": 450 if not is_anomaly else 50,
            "altitude": 35000 if not is_anomaly else 2000,
            "lat_delta": 0.1 if not is_anomaly else 5.0,
            "lon_delta": 0.1 if not is_anomaly else 8.0,
            "signal_strength": 0.8 if not is_anomaly else 0.2,
            "course_history": [180, 182, 178, 181, 180] if not is_anomaly else [180, 220, 260, 300, 340]
        })
    
    print(f"\nTraining on {len(train_data)} samples...")
    
    # Train in batches
    for epoch in range(epochs):
        results = await batch_classify(agent, train_data)
        
        correct = sum(1 for r in results if r.get("class") != "unknown")
        accuracy = correct / len(results) if results else 0
        
        print(f"Epoch {epoch + 1}/{epochs}: Accuracy = {accuracy:.2%}")
    
    # Get final metrics
    metrics = agent.get_metrics()
    print(f"\nFinal Metrics:")
    print(json.dumps(metrics, indent=2))
    
    return agent, metrics


async def train_anomaly_detector(epochs: int = 3):
    """Train anomaly detection agent"""
    print("=" * 60)
    print("TRAINING: Anomaly Detector Agent")
    print("=" * 60)
    
    agent = AnomalyDetectorAgent()
    
    # Generate training data with ground truth
    train_data = []
    for i in range(100):
        is_anomaly = i % 5 == 0
        train_data.append({
            "entity_id": f"entity_{i}",
            "domain": "aircraft",
            "velocity": 450 if not is_anomaly else 30,
            "altitude": 35000 if not is_anomaly else 500,
            "lat": 40.5,
            "lon": -74.0,
            "signal_strength": 0.8 if not is_anomaly else 0.1
        })
    
    print(f"\nTraining on {len(train_data)} samples...")
    
    for epoch in range(epochs):
        results = []
        for entity in train_data:
            result = await agent.detect_ensemble(
                entity["entity_id"], 
                entity,
                ground_truth=entity.get("entity_id", "").endswith(("0", "5"))
            )
            results.append(result)
        
        # Calculate metrics
        agent.calculate_metrics()
        metrics = agent.get_metrics()
        print(f"Epoch {epoch + 1}/{epochs}: F1 = {metrics.get('f1', 0):.3f}, Precision = {metrics.get('precision', 0):.3f}")
    
    print(f"\nFinal Metrics:")
    print(json.dumps(metrics, indent=2))
    
    return agent, metrics


async def run_dataset_curation(num_batches: int = 1):
    """Run dataset curation"""
    print("=" * 60)
    print("RUNNING: Dataset Curator Agent")
    print("=" * 60)
    
    agent = DatasetCuratorAgent(dataset_name="sentinel-x-training-data")
    
    print(f"\nCurating {num_batches} batches...")
    results = await run_curation(agent, num_batches=num_batches)
    
    print(f"\nCuration Results:")
    print(json.dumps(results, indent=2))
    
    return agent, results


async def main():
    parser = argparse.ArgumentParser(description="SENTINEL-X Agent Training")
    parser.add_argument("--agent", choices=["classifier", "anomaly", "curator", "all"], 
                       default="all", help="Agent to train")
    parser.add_argument("--epochs", type=int, default=3, help="Number of training epochs")
    parser.add_argument("--batch-size", type=int, default=32, help="Batch size")
    parser.add_argument("--output", type=str, default="results/", help="Output directory")
    
    args = parser.parse_args()
    
    # Create output directory
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    results = {}
    
    # Run selected training
    if args.agent in ["classifier", "all"]:
        agent, metrics = await train_classifier(epochs=args.epochs, batch_size=args.batch_size)
        results["classifier"] = metrics
        
        # Save
        with open(output_dir / f"classifier_{timestamp}.json", "w") as f:
            json.dump(metrics, f, indent=2)
    
    if args.agent in ["anomaly", "all"]:
        agent, metrics = await train_anomaly_detector(epochs=args.epochs)
        results["anomaly"] = metrics
        
        with open(output_dir / f"anomaly_{timestamp}.json", "w") as f:
            json.dump(metrics, f, indent=2)
    
    if args.agent in ["curator", "all"]:
        agent, results_c = await run_dataset_curation(num_batches=args.epochs)
        results["curator"] = agent.get_metrics()
        
        with open(output_dir / f"curator_{timestamp}.json", "w") as f:
            json.dump(results_c, f, indent=2)
    
    # Save combined results
    with open(output_dir / f"combined_{timestamp}.json", "w") as f:
        json.dump(results, f, indent=2)
    
    print("\n" + "=" * 60)
    print("TRAINING COMPLETE")
    print(f"Results saved to: {output_dir}")
    print("=" * 60)
    
    return results


if __name__ == "__main__":
    asyncio.run(main())
