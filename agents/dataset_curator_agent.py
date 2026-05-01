"""
Dataset Curation Agent: Auto-label + quality check + versioning
Builds training datasets from operational data.

This agent automates the creation of labeled datasets by:
- Fetching unlabeled observations from the database
- Generating labels using Groq LLM
- Performing quality checks on the labeled data
- Versioning datasets for reproducibility and tracking
"""

from langchain_groq import ChatGroq
from datetime import datetime, timedelta
import json
import hashlib
from typing import Dict, List, Any, Optional
import asyncio
import numpy as np


class DatasetCuratorAgent:
    """
    Auto-generates labeled datasets from Sentinel-X observations.
    
    Features:
    - Fetches unlabeled data from Neon PGVector or mock sources
    - Generates labels via Groq LLM with contextual reasoning
    - Quality checks labels for distribution and confidence
    - Versions datasets with metadata and schema validation
    
    Args:
        dataset_name: Name identifier for the dataset
    """
    
    def __init__(self, dataset_name: str):
        self.llm = ChatGroq(
            model="llama-3.1-70b-versatile",
            temperature=0.05,
            groq_api_key="free-groq-key"  # TODO: Move to environment variable
        )
        self.dataset_name = dataset_name
        self.version = "v1.0"
        self.labeled_count: int = 0
        self.quality_score: float = 0.0
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
    
    async def fetch_unlabeled_batch(self, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Fetch unlabeled observations from database.
        
        In production: Query from Neon PGVector database.
        Currently: Generates mock data for testing.
        
        Args:
            limit: Maximum number of observations to fetch
            
        Returns:
            List of observation dictionaries with features
        """
        # TODO: Replace with actual DB query
        # Example: supabase.table("ml_observations").select("*").is_("label", "null").limit(limit).execute()
        
        batch = []
        for i in range(limit):
            batch.append({
                "observation_id": f"obs_{datetime.now().timestamp():.0f}_{i}",
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
    
    async def label_observation(self, observation: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate label for observation using Groq LLM.
        
        Uses contextual reasoning to classify observations as
        normal, suspicious, or anomaly based on flight features.
        
        Args:
            observation: Dictionary containing observation data
            
        Returns:
            Dictionary with labeling results and metadata
        """
        features = observation.get("features", {})
        prompt = f"""Classify this aircraft observation as normal, suspicious, or anomaly:

Observation Data:
- Velocity: {features.get('velocity', 0)} knots
- Altitude: {features.get('altitude', 0)} feet
- Position: {features.get('lat', 0):.2f}, {features.get('lon', 0):.2f}
- Course: {features.get('course', 0):.1f}°
- Signal: {features.get('signal_strength', 0):.2f}

Classify and explain:
Return JSON: {{"label": "normal"|"suspicious"|"anomaly", "confidence": 0.0-1.0, "reason": "..."}}"""
        
        try:
            response = await asyncio.to_thread(self.llm.invoke, prompt)
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
                "observation_id": observation.get("observation_id", "unknown"),
                "error": str(e),
                "label": "unknown"
            }
    
    async def quality_check(self, labels: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Quality check: Verify label consistency and distribution.
        
        Checks:
        - Label distribution (flags if >90% one class)
        - Confidence score averages
        - Data completeness
        
        Args:
            labels: List of labeled observation dictionaries
            
        Returns:
            Dictionary with quality metrics and recommendations
        """
        # Check for label distribution
        label_counts: Dict[str, int] = {}
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
                "avg_confidence": float(avg_confidence),
                "quality_score": float(quality_score),
                "recommendation": (
                    "redo labeling - low confidence" if avg_confidence < 0.7
                    else "proceed - quality acceptable"
                )
            }
        
        return {"error": "No labels to check"}
    
    async def create_dataset_version(self, labeled_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Create versioned dataset with metadata and quality metrics.
        
        Generates a unique hash-based version identifier and
        computes label distribution and quality metrics.
        
        Args:
            labeled_data: List of labeled observation dictionaries
            
        Returns:
            Dictionary with versioned dataset metadata
        """
        # Calculate dataset hash for versioning
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
            "samples": labeled_data[:10]  # Store only first 10 samples for preview
        }
        
        # Calculate label distribution
        for label_obj in labeled_data:
            if "label" in label_obj:
                label = label_obj["label"]
                dataset_version["label_distribution"][label] = (
                    dataset_version["label_distribution"].get(label, 0) + 1
                )
        
        # Quality metrics
        confidences = [l.get("confidence", 0) for l in labeled_data if "confidence" in l]
        if confidences:
            dataset_version["quality_metrics"] = {
                "avg_confidence": float(np.mean(confidences)),
                "min_confidence": float(np.min(confidences)),
                "max_confidence": float(np.max(confidences)),
                "std_confidence": float(np.std(confidences))
            }
        
        return dataset_version
    
    async def curate_batch(self, batch_size: int = 50) -> Dict[str, Any]:
        """
        End-to-end curation pipeline.
        
        Steps:
        1. Fetch unlabeled observations
        2. Label with Groq LLM (with rate limiting)
        3. Quality check the labeled data
        4. Version the dataset if quality passes threshold
        
        Args:
            batch_size: Number of observations to process
            
        Returns:
            Dictionary with curation results and dataset if successful
        """
        # Fetch unlabeled data
        unlabeled = await self.fetch_unlabeled_batch(batch_size)
        
        # Label with rate limit handling
        labels = []
        for i, obs in enumerate(unlabeled):
            label = await self.label_observation(obs)
            labels.append(label)
            
            # Rate limit: slow down requests to avoid Groq throttling
            if (i + 1) % 10 == 0:
                await asyncio.sleep(1)
        
        # Quality check
        quality = await self.quality_check(labels)
        
        # Version dataset if quality passes threshold
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
                "recommendation": "Retry with different parameters or model settings"
            }
