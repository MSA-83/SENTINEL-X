"""
Entity Classification Agent: Learns from feedback
Integrates with training pipeline for continuous improvement

This agent classifies entities (aircraft, vessels) as normal, suspicious, or anomalous
using a combination of feature extraction, weighted scoring, and LLM reasoning.
"""

from langchain_groq import ChatGroq
from langchain.memory import ConversationBufferMemory
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional
import json
from datetime import datetime
import asyncio
import numpy as np
import re


class ClassificationFeedback(BaseModel):
    """Feedback structure for agent learning and model improvement"""
    prediction: str
    actual: str
    confidence: float
    entity_id: str
    features: Dict[str, Any]
    feedback_type: str  # "correct" | "incorrect" | "ambiguous"
    timestamp: datetime = Field(default_factory=datetime.now)


import os

class EntityClassifierAgent:
    """
    Self-improving entity classifier that learns from corrections.
    
    Features:
    - Learns from feedback to adjust feature importance weights
    - Uses Groq LLM for contextual reasoning
    - Maintains accuracy metrics and retraining triggers
    - Supports continuous improvement via feedback loops
    
    Args:
        model_version: Version identifier for the model/agent
    """
    
    def __init__(self, model_version: str = "v1"):
        self.llm = ChatGroq(
            model="llama-3.1-70b-versatile",  # Free Groq model
            temperature=0.05,  # Low temperature for consistent classification
            groq_api_key=os.environ.get("GROQ_API_KEY", "")  # SECURITY: Environment variable
        )
        self.model_version = model_version
        self.feedback_buffer: list[ClassificationFeedback] = []
        self.feature_importance = {
            "velocity": 0.25,
            "altitude": 0.15,
            "lat_delta": 0.20,
            "lon_delta": 0.20,
            "time_based": 0.10,
            "seasonal": 0.10
        }
        self.classification_metrics = {
            "total": 0,
            "correct": 0,
            "incorrect": 0,
            "accuracy": 0.0
        }
    
    async def extract_features(self, entity_data: Dict[str, Any]) -> Dict[str, float]:
        """
        Extract domain-specific features from entity data for classification.
        
        Features extracted:
        - velocity: Normalized to max cruise speed (900 knots)
        - altitude: Normalized to max altitude (45000 ft)
        - lat_delta: Change in latitude (degrees)
        - lon_delta: Change in longitude (degrees)
        - time_based: Time-of-day anomaly score (0-1)
        - seasonal: Seasonal pattern score based on entity type
        
        Args:
            entity_data: Dictionary containing entity observation data
            
        Returns:
            Dictionary of extracted features with values normalized 0-1
        """
        features = {
            "velocity": min(entity_data.get("velocity", 0) / 900, 1.0),
            "altitude": min(entity_data.get("altitude", 0) / 45000, 1.0),
            "lat_delta": abs(entity_data.get("lat_delta", 0)),
            "lon_delta": abs(entity_data.get("lon_delta", 0)),
            "time_based": self._calc_time_anomaly(entity_data),
            "seasonal": self._calc_seasonal_anomaly(entity_data)
        }
        return features
    
    def _calc_time_anomaly(self, entity_data: Dict[str, Any]) -> float:
        """
        Calculate anomaly score based on time-of-day patterns.
        
        Normal hours: 6 AM to 8 PM (lower anomaly score)
        Night hours: Higher anomaly score peaking at midnight
        
        Returns:
            Float between 0.0 (normal) and 1.0 (peak anomaly)
        """
        hour = datetime.now().hour
        normal_hours = list(range(6, 20))  # 6am-8pm normal
        
        if hour in normal_hours:
            return 0.0  # Normal operating hours
        
        # Higher anomaly score at night (peaks at midnight)
        return min(1.0, abs(12 - hour) / 12)
    
    def _calc_seasonal_anomaly(self, entity_data: Dict[str, Any]) -> float:
        """
        Calculate anomaly score based on seasonal patterns for entity type.
        
        Aircraft: Less activity in winter months (higher anomaly)
        Ships: More activity in summer months (lower anomaly)
        
        Args:
            entity_data: Dictionary containing entity data with 'domain' field
            
        Returns:
            Float between 0.0 and 1.0 representing seasonal anomaly
        """
        month = datetime.now().month
        entity_type = entity_data.get("domain", "unknown")
        
        seasonal_patterns = {
            "aircraft": {1: 0.8, 2: 0.7, 12: 0.9},  # Less activity winter
            "ship": {7: 0.3, 8: 0.2}  # More activity summer
        }
        
        return seasonal_patterns.get(entity_type, {}).get(month, 0.1)
    
    async def classify(self, entity_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Classify entity with explanation and confidence scoring.
        
        Uses weighted feature scoring combined with Groq LLM reasoning
        to classify entities as normal, suspicious, or anomaly.
        
        Args:
            entity_data: Dictionary containing entity observation data
            
        Returns:
            Dictionary with classification results including:
            - entity_id: The entity identifier
            - class: Classification result (normal/suspicious/anomaly)
            - confidence: Confidence score 0-1
            - reason: Explanation from LLM
            - anomaly_score: Weighted feature score
            - features: Extracted features
            - model_version: Version of the classifier
        """
        features = await self.extract_features(entity_data)
        
        # Calculate weighted anomaly score
        anomaly_score = sum(
            features[key] * self.feature_importance[key]
            for key in features
        )
        
        # SECURITY: Sanitize entity_data before LLM prompt to prevent injection
        sanitized_data = re.sub(
            r"(ignore previous|disregard your|<script|{{|}}|javascript:|onerror=|onclick=)",
            "[REDACTED]",
            json.dumps(entity_data, default=str),
            flags=re.IGNORECASE
        )
        
        # Use Groq for contextual reasoning
        reasoning_prompt = f"""Analyze this entity for anomalies:

Entity: {sanitized_data}
Extracted Features: {json.dumps(features, default=str)}
Anomaly Score: {anomaly_score:.2f}

Provide classification with reasoning:
- If score < 0.3: NORMAL
- If 0.3 ≤ score < 0.6: SUSPICIOUS
- If score ≥ 0.6: ANOMALY

Return JSON: {{"class": "normal"|"suspicious"|"anomaly", "confidence": 0.0-1.0, "reason": "..."}}"""
        
        try:
            response = await asyncio.to_thread(self.llm.invoke, reasoning_prompt)
            result = json.loads(response.content)
            
            self.classification_metrics["total"] += 1
            
            return {
                "entity_id": entity_data.get("entity_id"),
                "class": result["class"],
                "confidence": result["confidence"],
                "reason": result["reason"],
                "anomaly_score": anomaly_score,
                "features": features,
                "model_version": self.model_version
            }
        except Exception as e:
            return {
                "entity_id": entity_data.get("entity_id"),
                "class": "unknown",
                "confidence": 0.0,
                "reason": f"Classification error: {str(e)}",
                "error": str(e)
            }
    
    async def process_feedback(self, feedback: ClassificationFeedback) -> Dict[str, Any]:
        """
        Process feedback and adjust feature importance weights.
        
        Updates accuracy metrics and adjusts feature importance based on
        incorrect predictions using LLM-suggested adjustments.
        
        Args:
            feedback: ClassificationFeedback object containing prediction details
            
        Returns:
            Dictionary with processing status and updated metrics
        """
        self.feedback_buffer.append(feedback)
        
        # Update metrics
        if feedback.feedback_type == "correct":
            self.classification_metrics["correct"] += 1
        elif feedback.feedback_type == "incorrect":
            self.classification_metrics["incorrect"] += 1
        
        # Recalculate accuracy
        total = (self.classification_metrics["correct"] + 
                self.classification_metrics["incorrect"])
        if total > 0:
            self.classification_metrics["accuracy"] = (
                self.classification_metrics["correct"] / total
            )
        
        # Adjust feature importance based on feedback
        if feedback.feedback_type == "incorrect":
            await self._adjust_feature_importance(feedback)
        
        return {
            "status": "feedback_processed",
            "buffer_size": len(self.feedback_buffer),
            "accuracy": self.classification_metrics["accuracy"],
            "updated_importance": self.feature_importance
        }
    
    async def _adjust_feature_importance(self, feedback: ClassificationFeedback) -> None:
        """
        Use Groq to suggest feature importance adjustments.
        
        Applies exponential moving average to smoothly update weights
        and renormalizes to ensure sum equals 1.0.
        
        Args:
            feedback: ClassificationFeedback with incorrect prediction details
        """
        prompt = f"""This classification was incorrect:

Predicted: {feedback.prediction}
Actual: {feedback.actual}
Features: {json.dumps(feedback.features, default=str)}
Current Importance: {json.dumps(self.feature_importance)}

Suggest feature importance adjustments as JSON:
{{"feature_name": new_importance_0_to_1, ...}}"""
        
        try:
            response = await asyncio.to_thread(self.llm.invoke, prompt)
            updates = json.loads(response.content)
            
            # Apply updates with smoothing to avoid overfitting
            learning_rate = 0.1
            for feature, new_importance in updates.items():
                if feature in self.feature_importance:
                    old_value = self.feature_importance[feature]
                    self.feature_importance[feature] = (
                        (1 - learning_rate) * old_value +
                        learning_rate * new_importance
                    )
            
            # Renormalize to sum = 1.0
            total_imp = sum(self.feature_importance.values())
            self.feature_importance = {
                k: v / total_imp for k, v in self.feature_importance.items()
            }
        except Exception:
            pass  # TODO: Add proper error logging
    
    async def should_retrain(self) -> bool:
        """
        Decide if agent should trigger model retraining.
        
        Retraining triggers:
        - Every 100 feedback items collected
        - If accuracy drops below 85%
        - Every 24 hours (implemented via external scheduler)
        
        Returns:
            True if retraining is recommended, False otherwise
        """
        if len(self.feedback_buffer) >= 100:
            return True
        if self.classification_metrics["accuracy"] < 0.85:
            return True
        return False
