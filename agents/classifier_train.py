#!/usr/bin/env python3
"""
GitHub Actions Training Script
Designed for 55-minute runtime limit
"""

import asyncio
import os
import json
from datetime import datetime
import sys
from pathlib import Path
import numpy as np

async def train_classifier_agent():
    """
    Fast training for GitHub Actions
    - 50 samples (completable in 10 min)
    - Metrics-focused
    - Auto-save results
    """
    
    from langchain_groq import ChatGroq
    import pandas as pd
    from sklearn.model_selection import train_test_split
    
    print("🤖 [GITHUB ACTIONS] Classifier Agent Training")
    print(f"⏰ Start: {datetime.now()}")
    print(f"🔑 Groq Model: {os.getenv('GROQ_MODEL', 'llama-3.1-70b-versatile')}")
    
    # Initialize
    llm = ChatGroq(
        model=os.getenv('GROQ_MODEL', 'llama-3.1-70b-versatile'),
        temperature=0.05,
        groq_api_key=os.getenv('GROQ_API_KEY')
    )
    
    # Generate quick dataset (50 samples)
    print("\n📊 Generating dataset...")
    data = {
        "velocity": [np.random.randint(100, 900) for _ in range(50)],
        "altitude": [np.random.randint(1000, 45000) for _ in range(50)],
        "signal": [np.random.uniform(0, 1) for _ in range(50)],
        "label": [np.random.choice(["normal", "suspicious", "anomaly"]) for _ in range(50)]
    }
    
    df = pd.DataFrame(data)
    train, test = train_test_split(df, test_size=0.2, random_state=42)
    
    # Train metrics
    metrics = {
        "timestamp": datetime.now().isoformat(),
        "samples": len(train),
        "accuracy": 0.0,
        "groq_model": os.getenv('GROQ_MODEL'),
        "runtime_seconds": 0,
        "cost_estimate": 0.0
    }
    
    # Quick training loop
    start_time = datetime.now()
    correct = 0
    
    for idx, row in train.iterrows():
        # Simple classification via Groq
        prompt = f"Classify: velocity={row['velocity']}, signal={row['signal']}. Output: normal|suspicious|anomaly"
        
        try:
            response = await asyncio.to_thread(
                llm.invoke,
                prompt
            )
            
            prediction = response.content.strip().lower().split()[-1]
            if prediction == row['label']:
                correct += 1
        
        except Exception as e:
            print(f"⚠️ Error: {e}")
        
        # Rate limit
        await asyncio.sleep(0.5)
    
    metrics["accuracy"] = correct / len(train)
    metrics["runtime_seconds"] = (datetime.now() - start_time).total_seconds()
    
    # Estimate costs (Groq free = $0)
    metrics["cost_estimate"] = 0.0
    metrics["status"] = "success"
    
    print(f"\n✅ RESULTS:")
    print(f"  Accuracy: {metrics['accuracy']:.2%}")
    print(f"  Runtime: {metrics['runtime_seconds']:.1f}s")
    
    return metrics

# Main
if __name__ == "__main__":
    output_file = sys.argv[1] if len(sys.argv) > 1 else "results/classifier_results.json"
    
    results = asyncio.run(train_classifier_agent())
    
    # Save
    Path(output_file).parent.mkdir(parents=True, exist_ok=True)
    with open(output_file, 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\n📁 Results saved: {output_file}")
