"""
Dataset Curation Agent: Auto-label + quality check + versioning
Builds training datasets from operational data
"""

import os
import json
import asyncio
import hashlib
from datetime import datetime
from typing import Optional, Any
from collections import Counter
import numpy as np
from langchain_groq import ChatGroq


GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")


class DatasetCuratorAgent:
    """
    Auto-generates labeled datasets from Sentinel-X observations
    - Fetches unlabeled data
    - Generates labels via Groq
    - Quality checks labels
    - Versions datasets for reproducibility
    """
    
    def __init__(self, dataset_name: str = "sentinel-x-dataset"):
        self.dataset_name = dataset_name
        self.llm = ChatGroq(
            model="llama-3.1-70b-versatile",
            temperature=0.05,
            max_tokens=2048,
            groq_api_key=GROQ_API_KEY,
            timeout=30
        )
        self.version = "v1.0"
        self.labeled_count = 0
        self.quality_score = 0.0
        self.dataset_schema = {
            "observation_id": "uuid",
            "entity_id": "string",
            "features": "dict",
            "label": "enum(normal|suspicious|anomaly)",
            "confidence": "float",
            "labeler": "string (groq_auto)",
            "timestamp": "iso8601",
            "metadata": "dict"
        }
        self.quality_history = []
    
    async def fetch_unlabeled_batch(self, limit: int = 50, data_source: str = "mock") -> list[dict]:
        """
        Fetch unlabeled observations
        data_source: "mock" | "database" | "api"
        """
        if data_source == "mock":
            # Generate synthetic data for testing
            batch = []
            for i in range(limit):
                is_anomaly = np.random.rand() > 0.8  # 20% anomalies
                batch.append({
                    "observation_id": f"obs_{datetime.now().timestamp()}_{i}",
                    "entity_id": f"entity_{i % 100}",
                    "features": {
                        "velocity": np.random.randint(100, 900) if not is_anomaly else np.random.randint(0, 100),
                        "altitude": np.random.randint(30000, 45000) if not is_anomaly else np.random.randint(0, 5000),
                        "lat": np.random.uniform(-90, 90),
                        "lon": np.random.uniform(-180, 180),
                        "course": np.random.uniform(0, 360),
                        "signal_strength": np.random.uniform(0.5, 1.0) if not is_anomaly else np.random.uniform(0, 0.3)
                    },
                    "timestamp": datetime.now().isoformat()
                })
            return batch
        
        # Placeholder for real data source
        raise NotImplementedError(f"Data source '{data_source}' not implemented")
    
    async def label_observation(self, observation: dict) -> dict:
        """
        Generate label for observation using Groq
        """
        features = observation.get("features", {})
        
        prompt = f"""Classify this aircraft observation as normal, suspicious, or anomaly:

Observation Data:
- Velocity: {features.get('velocity', 0)} knots
- Altitude: {features.get('altitude', 0)} feet
- Position: ({features.get('lat', 0):.2f}, {features.get('lon', 0):.2f})
- Course: {features.get('course', 0):.1f}°
- Signal: {features.get('signal_strength', 0):.2f}

Classification Rules:
- NORMAL: Typical aircraft behavior at cruise altitude/speed
- SUSPICIOUS: Minor deviations (low altitude, unusual course)
- ANOMALY: Major deviations (stationary, extremely low/high, weak signal)

Classify and explain:
Return JSON: {{"label": "normal"|"suspicious"|"anomaly", "confidence": 0.0-1.0, "reason": "..."}}"""
        
        try:
            response = await asyncio.to_thread(self.llm.invoke, prompt)
            
            # Extract JSON from response
            import re
            json_match = re.search(r'\{.*\}', response.content, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
            else:
                result = {
                    "label": "unknown",
                    "confidence": 0.0,
                    "reason": "Failed to parse response"
                }
            
            return {
                "observation_id": observation.get("observation_id"),
                "entity_id": observation.get("entity_id"),
                "label": result.get("label", "unknown"),
                "confidence": result.get("confidence", 0.0),
                "reason": result.get("reason", ""),
                "labeler": "groq_auto",
                "labeled_timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            return {
                "observation_id": observation.get("observation_id"),
                "entity_id": observation.get("entity_id"),
                "label": "unknown",
                "confidence": 0.0,
                "reason": f"Labeling error: {str(e)}",
                "error": str(e)
            }
    
    async def quality_check(self, labels: list[dict]) -> dict:
        """
        Quality check: Verify label consistency
        """
        if not labels:
            return {"error": "No labels to check"}
        
        # Label distribution
        label_counts = Counter()
        confidences = []
        
        for label_obj in labels:
            if "label" in label_obj and label_obj["label"] != "unknown":
                label_counts[label_obj["label"]] += 1
            if "confidence" in label_obj:
                confidences.append(label_obj["confidence"])
        
        total = sum(label_counts.values())
        if total == 0:
            return {"error": "No valid labels"}
        
        # Check for skew (>90% one class)
        max_ratio = max(label_counts.values()) / total if total > 0 else 0
        skewed = max_ratio > 0.9
        
        # Average confidence
        avg_confidence = np.mean(confidences) if confidences else 0
        
        # Quality score
        quality_score = min(1.0, avg_confidence * (1 - 0.3 * skewed))
        
        recommendation = "redo" if avg_confidence < 0.7 else "proceed" if quality_score > 0.7 else "review"
        
        return {
            "total_labeled": total,
            "label_distribution": dict(label_counts),
            "skewed": skewed,
            "avg_confidence": avg_confidence,
            "quality_score": quality_score,
            "recommendation": recommendation
        }
    
    async def create_dataset_version(self, labeled_data: list[dict]) -> dict:
        """
        Create versioned dataset with metadata
        """
        # Calculate dataset hash
        dataset_str = json.dumps(labeled_data, sort_keys=True, default=str)
        dataset_hash = hashlib.sha256(dataset_str.encode()).hexdigest()[:8]
        
        # Calculate label distribution
        label_counts = Counter()
        confidences = []
        
        for label_obj in labeled_data:
            if "label" in label_obj and label_obj["label"] != "unknown":
                label_counts[label_obj["label"]] += 1
            if "confidence" in label_obj:
                confidences.append(label_obj["confidence"])
        
        # Quality metrics
        quality_metrics = {}
        if confidences:
            quality_metrics = {
                "avg_confidence": float(np.mean(confidences)),
                "min_confidence": float(np.min(confidences)),
                "max_confidence": float(np.max(confidences)),
                "std_confidence": float(np.std(confidences))
            }
        
        dataset_version = {
            "name": self.dataset_name,
            "version": f"{self.version}_{dataset_hash}",
            "created_at": datetime.now().isoformat(),
            "total_samples": len(labeled_data),
            "schema": self.dataset_schema,
            "label_distribution": dict(label_counts),
            "quality_metrics": quality_metrics,
            "samples": labeled_data
        }
        
        return dataset_version
    
    async def curate_batch(self, batch_size: int = 50) -> dict:
        """
        End-to-end curation pipeline
        """
        # Fetch unlabeled
        unlabeled = await self.fetch_unlabeled_batch(batch_size)
        
        # Label each observation
        labeled = []
        for i, obs in enumerate(unlabeled):
            label_obj = await self.label_observation(obs)
            labeled.append(label_obj)
            
            # Rate limit to avoid Groq throttling
            if (i + 1) % 10 == 0:
                await asyncio.sleep(1)
        
        # Quality check
        quality = await self.quality_check(labeled)
        
        # Create version if quality is acceptable
        if quality.get("quality_score", 0) > 0.7:
            dataset = await self.create_dataset_version(labeled)
            self.labeled_count += len(labeled)
            self.quality_score = quality.get("quality_score", 0)
            self.quality_history.append({
                "timestamp": datetime.now().isoformat(),
                "quality_score": self.quality_score,
                "sample_count": len(labeled)
            })
            
            return {
                "status": "success",
                "dataset": dataset,
                "quality": quality
            }
        else:
            return {
                "status": "quality_check_failed",
                "quality": quality,
                "recommendation": "Retry with different parameters"
            }
    
    def get_metrics(self) -> dict:
        return {
            "dataset_name": self.dataset_name,
            "version": self.version,
            "labeled_count": self.labeled_count,
            "quality_score": self.quality_score,
            "quality_history": self.quality_history
        }


async def run_curation(agent: DatasetCuratorAgent, num_batches: int = 1) -> dict:
    """Run multiple curation batches"""
    all_datasets = []
    all_quality = []
    
    for batch_idx in range(num_batches):
        result = await agent.curate_batch(batch_size=50)
        
        if result["status"] == "success":
            all_datasets.append(result["dataset"])
            all_quality.append(result["quality"])
    
    return {
        "total_batches": num_batches,
        "successful_batches": len(all_datasets),
        "datasets": all_datasets,
        "quality": all_quality
    }