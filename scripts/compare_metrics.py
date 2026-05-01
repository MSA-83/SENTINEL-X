#!/usr/bin/env python3
"""
Compare training metrics from multiple runs
"""

import json
import sys
from pathlib import Path

def compare_metrics(results_dir: str):
    results_path = Path(results_dir)
    if not results_path.exists():
        print(f"❌ Results directory not found: {results_dir}")
        return
    
    json_files = list(results_path.glob("*.json"))
    if not json_files:
        print(f"❌ No JSON files found in {results_dir}")
        return
    
    print(f"📊 Comparing metrics from {len(json_files)} runs:\n")
    
    for json_file in json_files:
        with open(json_file) as f:
            data = json.load(f)
        
        print(f"--- {json_file.name} ---")
        if "accuracy" in data:
            print(f"  Accuracy: {data['accuracy']:.2%}")
        if "f1" in data:
            print(f"  F1 Score: {data['f1']:.2%}")
        if "avg_loss" in data:
            print(f"  Avg Loss: {data['avg_loss']:.4f}")
        print()

if __name__ == "__main__":
    results_dir = sys.argv[1] if len(sys.argv) > 1 else "results"
    compare_metrics(results_dir)
