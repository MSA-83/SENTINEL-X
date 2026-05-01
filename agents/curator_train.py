#!/usr/bin/env python3
"""
Dataset Curator Training Script for GitHub Actions
"""

import asyncio
import os
import json
from datetime import datetime
import sys
from pathlib import Path
import numpy as np

async def train_curator_agent():
    """Train dataset curation agent with auto-labeling"""
    
    from langchain_groq import ChatGroq
    
    print("🤖 [GITHUB ACTIONS] Dataset Curator Agent Training")
    print(f"⏰ Start: {datetime.now()}")
    
    llm = ChatGroq(
        model=os.getenv('GROQ_MODEL', 'llama-3.1-70b-versatile'),
        temperature=0.05,
        groq_api_key=os.getenv('GROQ_API_KEY')
    )
    
    # Metrics
    metrics = {
        "timestamp": datetime.now().isoformat(),
        "labeled_count": 0,
        "quality_score": 0.0,
        "avg_confidence": 0.0,
        "status": "success"
    }
    
    # Generate synthetic batch
    print("\n📊 Generating batch...")
    batch = []
    for i in range(50):
        batch.append({
            "observation_id": f"obs_{datetime.now().timestamp()}_{i}",
            "entity_id": f"entity_{i % 100}",
            "features": {
                "velocity": np.random.randint(100, 900),
                "altitude": np.random.randint(1000, 45000),
                "lat": np.random.uniform(-90, 90),
                "lon": np.random.uniform(-180, 180),
                "course": np.random.uniform(0, 360),
                "signal_strength": np.random.uniform(0, 1)
            },
            "timestamp": datetime.now().isoformat()
        })
    
    # Label observations
    print("🏷️ Labeling observations...")
    labels = []
    confidences = []
    
    for i, obs in enumerate(batch):
        prompt = f"""Classify this aircraft observation as normal, suspicious, or anomaly:


Observation Data:
- Velocity: {obs['features']['velocity']} knots
- Altitude: {obs['features']['altitude']} feet
- Position: {obs['features']['lat']:.2f}, {obs['features']['lon']:.2f}
- Course: {obs['features']['course']:.1f}°
- Signal: {obs['features']['signal_strength']:.2f}


Classify and explain:
Return JSON: {{"label": "normal"|"suspicious"|"anomaly", "confidence": 0.0-1.0, "reason": "..."}}"""
        
        try:
            response = await asyncio.to_thread(llm.invoke, prompt)
            result = json.loads(response.content)
            labels.append(result.get("label", "unknown"))
            confidences.append(result.get("confidence", 0.0))
        except Exception as e:
            print(f"⚠️ Error labeling: {e}")
            labels.append("unknown")
            confidences.append(0.0)
        
        if (i + 1) % 10 == 0:
            await asyncio.sleep(1)  # Rate limit
    
    # Quality check
    label_counts = {}
    for label in labels:
        label_counts[label] = label_counts.get(label, 0) + 1
    
    avg_confidence = np.mean(confidences) if confidences else 0
    max_ratio = max(label_counts.values()) / len(labels) if labels else 0
    skewed = max_ratio > 0.9
    
    quality_score = min(1.0, avg_confidence * (1 - skewed * 0.3))
    
    metrics["labeled_count"] = len(labels)
    metrics["quality_score"] = quality_score
    metrics["avg_confidence"] = avg_confidence
    metrics["label_distribution"] = label_counts
    
    print(f"\n✅ RESULTS:")
    print(f"  Labeled: {metrics['labeled_count']}")
    print(f"  Quality Score: {metrics['quality_score']:.2f}")
    print(f"  Avg Confidence: {metrics['avg_confidence']:.2%}")
    
    return metrics

if __name__ == "__main__":
    output_file = sys.argv[1] if len(sys.argv) > 1 else "results/curator_results.json"
    
    results = asyncio.run(train_curator_agent())
    
    Path(output_file).parent.mkdir(parents=True, exist_ok=True)
    with open(output_file, 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\n📁 Results saved: {output_file}")
