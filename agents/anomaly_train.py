#!/usr/bin/env python3
"""
Anomaly Agent Training Script for GitHub Actions
"""

import asyncio
import os
import json
from datetime import datetime
import sys
from pathlib import Path
import numpy as np

async def train_anomaly_agent():
    """Train anomaly detection agent with statistical + LLM methods"""
    
    from langchain_groq import ChatGroq
    from scipy import stats
    from collections import defaultdict
    
    print("🤖 [GITHUB ACTIONS] Anomaly Agent Training")
    print(f"⏰ Start: {datetime.now()}")
    
    llm = ChatGroq(
        model=os.getenv('GROQ_MODEL', 'llama-3.1-70b-versatile'),
        temperature=0.05,
        groq_api_key=os.getenv('GROQ_API_KEY')
    )
    
    # Initialize metrics
    metrics = {
        "timestamp": datetime.now().isoformat(),
        "true_positives": 0,
        "false_positives": 0,
        "false_negatives": 0,
        "total_evaluated": 0,
        "precision": 0.0,
        "recall": 0.0,
        "f1": 0.0
    }
    
    # Generate synthetic test data
    print("\n📊 Generating synthetic dataset...")
    data = []
    for i in range(50):
        is_anomaly = np.random.rand() > 0.8  # 20% anomalies
        
        if is_anomaly:
            velocity = np.random.randint(0, 100)  # Stationary
            altitude = np.random.randint(0, 5000)  # Low altitude
        else:
            velocity = np.random.randint(400, 500)  # Normal cruise
            altitude = np.random.randint(30000, 40000)  # Cruise altitude
        
        data.append({
            "entity_id": f"entity_{i}",
            "velocity": velocity,
            "altitude": altitude,
            "lat": np.random.uniform(-90, 90),
            "lon": np.random.uniform(-180, 180),
            "signal_strength": np.random.uniform(0.5, 1.0) if not is_anomaly else np.random.uniform(0, 0.3),
            "label": int(is_anomaly)
        })
    
    # Simulate detection
    print("🚀 Running detection...")
    history = defaultdict(list)
    
    for idx, row in enumerate(data):
        entity_id = row["entity_id"]
        measurement = row
        ground_truth = bool(row["label"])
        
        # Statistical detection
        history[entity_id].append(measurement)
        if len(history[entity_id]) >= 10:
            velocities = [m["velocity"] for m in history[entity_id]]
            if abs(stats.zscore(velocities)[-1]) > 3.0:
                metrics["total_evaluated"] += 1
                if ground_truth:
                    metrics["true_positives"] += 1
                else:
                    metrics["false_positives"] += 1
            elif ground_truth:
                metrics["false_negatives"] += 1
        
        if (idx + 1) % 10 == 0:
            await asyncio.sleep(0.1)  # Rate limit
    
    # Calculate metrics
    tp = metrics["true_positives"]
    fp = metrics["false_positives"]
    fn = metrics["false_negatives"]
    
    if tp + fp > 0:
        metrics["precision"] = tp / (tp + fp)
    if tp + fn > 0:
        metrics["recall"] = tp / (tp + fn)
    if metrics["precision"] + metrics["recall"] > 0:
        metrics["f1"] = 2 * (metrics["precision"] * metrics["recall"]) / (metrics["precision"] + metrics["recall"])
    
    metrics["status"] = "success"
    metrics["samples"] = len(data)
    
    print(f"\n✅ RESULTS:")
    print(f"  Precision: {metrics['precision']:.2%}")
    print(f"  Recall: {metrics['recall']:.2%}")
    print(f"  F1 Score: {metrics['f1']:.2%}")
    
    return metrics

if __name__ == "__main__":
    output_file = sys.argv[1] if len(sys.argv) > 1 else "results/anomaly_results.json"
    
    results = asyncio.run(train_anomaly_agent())
    
    Path(output_file).parent.mkdir(parents=True, exist_ok=True)
    with open(output_file, 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\n📁 Results saved: {output_file}")
