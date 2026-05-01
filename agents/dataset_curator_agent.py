"""
Dataset Curation Agent: Auto-label + quality check + versioning
Builds training datasets from operational data
"""

from langchain_groq import ChatGroq
from datetime import datetime, timedelta
import json
import hashlib
from typing import Optional
import asyncio
import numpy as np


class DatasetCuratorAgent:
    """
    Auto-generates labeled datasets from Sentinel-X observations
    - Fetches unlabeled data
    - Generates labels via Groq
    - Quality checks labels
    - Versions datasets for reproducibility
    """
    
    def __init__(self, dataset_name: str):
        self.llm = ChatGroq(
            model="llama-3.1-70b-versatile",
            temperature=0.05,
            groq_api_key="free-groq-key"
        )
        self.dataset_name = dataset_name
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
    
    async def fetch_unlabeled_batch(self, limit: int = 50) -> list[dict]:
        """
        Fetch unlabeled observations from database
        In production: Query from Neon PGVector
        """
        # Mock data - replace with DB query
        batch = []
        for i in range(limit):
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
        return batch
    
    async def label_observation(self, observation: dict) -> dict:
        """
        Generate label for observation using Groq
        """
        prompt = f"""Classify this aircraft observation as normal, suspicious, or anomaly:


Observation Data:
- Velocity: {observation['features']['velocity']} knots
- Altitude: {observation['features']['altitude']} feet
- Position: {observation['features']['lat']:.2f}, {observation['features']['lon']:.2f}
- Course: {observation['features']['course']:.1f}°
- Signal: {observation['features']['signal_strength']:.2f}


Classify and explain:
Return JSON: {{"label": "normal"|"suspicious"|"anomaly", "confidence": 0.0-1.0, "reason": "..."}}"""
        
        try:
            response = self.llm.invoke(prompt)
            result = json.loads(response.content)
            
            return {
                "observation_id": observation["observation_id"],
                "entity_id": observation["entity_id"],
                "label": result["label"],
                "confidence": result["confidence"],
                "reason": result["reason"],
                "labeler": "groq_auto",
                "labeled_timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            return {
                "observation_id": observation["observation_id"],
                "error": str(e),
                "label": "unknown"
            }
    
    async def quality_check(self, labels: list[dict]) -> dict:
        """
        Quality check: Verify label consistency
        """
        # Check for label distribution
        label_counts = {}
        for label_obj in labels:
            if "label" in label_obj:
                label = label_obj["label"]
                label_counts[label] = label_counts.get(label, 0) + 1
        
        # Flag if distribution is too skewed (>90% one class)
        if labels:
            max_ratio = max(label_counts.values()) / len(labels)
            skewed = max_ratio > 0.9
            
            # Check confidence scores
            confidences = [
                l.get("confidence", 0) for l in labels 
                if "confidence" in l
            ]
            avg_confidence = np.mean(confidences) if confidences else 0
            
            quality_score = min(1.0, avg_confidence * (1 - skewed * 0.3))
            
            return {
                "total_labeled": len(labels),
                "label_distribution": label_counts,
                "skewed": skewed,
                "avg_confidence": avg_confidence,
                "quality_score": quality_score,
                "recommendation": (
                    "redo labeling - low confidence" if avg_confidence < 0.7
                    else "proceed - quality acceptable"
                )
            }
        
        return {"error": "No labels to check"}
    
    async def create_dataset_version(self, labeled_data: list[dict]) -> dict:
        """
        Create versioned dataset with metadata
        """
        # Calculate dataset hash
        dataset_str = json.dumps(labeled_data, sort_keys=True, default=str)
        dataset_hash = hashlib.sha256(dataset_str.encode()).hexdigest()[:8]
        
        # Metadata
        dataset_version = {
            "name": self.dataset_name,
            "version": f"{self.version}_{dataset_hash}",
            "created_at": datetime.now().isoformat(),
            "total_samples": len(labeled_data),
            "schema": self.dataset_schema,
            "label_distribution": {},
            "quality_metrics": {},
            "samples": labeled_data
        }
        
        # Calculate metrics
        for label_obj in labeled_data:
            if "label" in label_obj:
                label = label_obj["label"]
                dataset_version["label_distribution"][label] = (
                    dataset_version["label_distribution"].get(label, 0) + 1
                )
        
        # Quality metrics
        confidences = [
            l.get("confidence", 0) for l in labeled_data 
            if "confidence" in l
        ]
        if confidences:
            dataset_version["quality_metrics"] = {
                "avg_confidence": np.mean(confidences),
                "min_confidence": np.min(confidences),
                "max_confidence": np.max(confidences),
                "std_confidence": np.std(confidences)
            }
        
        return dataset_version
    
    async def curate_batch(self, batch_size: int = 50) -> dict:
        """
        End-to-end curation pipeline
        1. Fetch unlabeled
        2. Label with Groq
        3. Quality check
        4. Version dataset
        """
        # Fetch
        unlabeled = await self.fetch_unlabeled_batch(batch_size)
        
        # Label (with rate limit handling)
        labels = []
        for i, obs in enumerate(unlabeled):
            label = await self.label_observation(obs)
            labels.append(label)
            
            # Rate limit: slow down requests
            if (i + 1) % 10 == 0:
                await asyncio.sleep(1)
        
        # Quality check
        quality = await self.quality_check(labels)
        
        # Version
        if quality.get("quality_score", 0) > 0.7:
            dataset = await self.create_dataset_version(labels)
            self.labeled_count += len(labels)
            self.quality_score = quality.get("quality_score", 0)
            
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
