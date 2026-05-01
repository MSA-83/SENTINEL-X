#!/usr/bin/env python3
"""
Push improved models to Hugging Face Hub
"""

import json
import os
from pathlib import Path

def push_to_hub(results_dir: str):
    results_path = Path(results_dir)
    if not results_path.exists():
        print(f"❌ Results directory not found: {results_dir}")
        return
    
    # Mock push logic - replace with actual HF Hub upload
    print(f"🚀 Pushing models from {results_dir} to Hugging Face Hub...")
    
    json_files = list(results_path.glob("*.json"))
    for json_file in json_files:
        with open(json_file) as f:
            data = json.load(f)
        
        # Check if metrics improved (mock logic)
        if data.get("accuracy", 0) > 0.9 or data.get("f1", 0) > 0.9:
            print(f"  ✅ Pushing {json_file.stem} (improved metrics)")
            # Actual push: os.system(f"huggingface-cli upload sentinel-x-{json_file.stem} {json_file}")
        else:
            print(f"  ⏭️ Skipping {json_file.stem} (metrics not improved)")

if __name__ == "__main__":
    results_dir = sys.argv[1] if len(sys.argv) > 1 else "results"
    push_to_hub(results_dir)
