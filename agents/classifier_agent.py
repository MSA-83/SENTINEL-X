"""
Entity Classification Agent: Learns from feedback
Integrates with training pipeline for continuous improvement
"""

from langchain_groq import ChatGroq
from langchain.memory import ConversationBufferMemory
from pydantic import BaseModel, Field
from typing import Optional
import json
from datetime import datetime
import asyncio
import numpy as np
import re


class ClassificationFeedback(BaseModel):
    """Feedback structure for agent learning"""
    prediction: str
    actual: str
    confidence: float
    entity_id: str
    features: dict
    feedback_type: str  # "correct" | "incorrect" | "ambiguous"
    timestamp: datetime = Field(default_factory=datetime.now)


class EntityClassifierAgent:
    """
    Self-improving entity classifier
    - Learns from corrections
    - Updates feature importance
    - Retrains on misclassifications
    """
    
    def __init__(self, model_version: str = "v1"):
        self.llm = ChatGroq(
            model="llama-3.1-70b-versatile",
            temperature=0.05,
            groq_api_key="free-groq-key"
        )
        self.model_version = model_version
        self.feedback_buffer = []
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
    
    async def extract_features(self, entity_data: dict) -> dict:
        """
        Extract domain-specific features for classification
        """
        features = {
            "velocity": min(entity_data.get("velocity", 0) / 900, 1.0),  # Normalize to max cruise
            "altitude": min(entity_data.get("altitude", 0) / 45000, 1.0),  # Normalize to max alt
            "lat_delta": abs(entity_data.get("lat_delta", 0)),  # Degrees changed
            "lon_delta": abs(entity_data.get("lon_delta", 0)),  # Degrees changed
            "time_based": self._calc_time_anomaly(entity_data),  # 0-1
            "seasonal": self._calc_seasonal_anomaly(entity_data)
        }
        return features
    
    def _calc_time_anomaly(self, entity_data: dict) -> float:
        """Score based on time-of-day patterns"""
        hour = datetime.now().hour
        normal_hours = list(range(6, 20))  # 6am-8pm normal
        if hour in normal_hours:
            return 0.0  # Normal operating hours
        return min(1.0, (24 - hour) / 12)  # Higher anomaly at night
    
    def _calc_seasonal_anomaly(self, entity_data: dict) -> float:
        """Score based on seasonal patterns"""
        month = datetime.now().month
        entity_type = entity_data.get("domain", "unknown")
        
        seasonal_patterns = {
            "aircraft": {1: 0.8, 2: 0.7, 12: 0.9},  # Less activity winter
            "ship": {7: 0.3, 8: 0.2}  # More activity summer
        }
        
        return seasonal_patterns.get(entity_type, {}).get(month, 0.1)
    
    async def classify(self, entity_data: dict) -> dict:
        """
        Classify entity with explanation
        Returns: {"class": "normal"|"anomaly", "confidence": 0-1, "reason": "..."}
        """
        features = await self.extract_features(entity_data)
        
        # Calculate weighted anomaly score
        anomaly_score = sum(
            features[key] * self.feature_importance[key]
            for key in features
        )
        
        # Use Groq for contextual reasoning
        reasoning_prompt = f"""Analyze this entity for anomalies:


Entity: {json.dumps(entity_data)}
Extracted Features: {json.dumps(features, default=str)}
Anomaly Score: {anomaly_score:.2f}


Provide classification with reasoning:
- If score < 0.3: NORMAL
- If 0.3 ≤ score < 0.6: SUSPICIOUS
- If score ≥ 0.6: ANOMALY


Return JSON: {{"class": "normal"|"suspicious"|"anomaly", "confidence": 0.0-1.0, "reason": "..."}}"""
        
        try:
            response = self.llm.invoke(reasoning_prompt)
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
    
    async def process_feedback(self, feedback: ClassificationFeedback) -> dict:
        """
        Process feedback and adjust feature importance
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
            # Use Groq to suggest feature importance updates
            prompt = f"""This classification was incorrect:
            
Predicted: {feedback.prediction}
Actual: {feedback.actual}
Features: {json.dumps(feedback.features, default=str)}
Current Importance: {json.dumps(self.feature_importance)}


Suggest feature importance adjustments JSON:
{{"feature_name": new_importance_0_to_1, ...}}"""
            
            response = self.llm.invoke(prompt)
            try:
                updates = json.loads(response.content)
                # Apply updates (with smoothing to avoid overfit)
                for feature, new_importance in updates.items():
                    if feature in self.feature_importance:
                        # Exponential moving average
                        self.feature_importance[feature] = (
                            0.9 * self.feature_importance[feature] +
                            0.1 * new_importance
                        )
            except Exception:
                pass
        
        return {
            "status": "feedback_processed",
            "buffer_size": len(self.feedback_buffer),
            "accuracy": self.classification_metrics["accuracy"],
            "updated_importance": self.feature_importance
        }
    
    async def should_retrain(self) -> bool:
        """
        Decide if agent should trigger model retraining
        Rules:
        - Every 100 feedback items
        - If accuracy drops below 85%
        - Every 24 hours
        """
        if len(self.feedback_buffer) >= 100:
            return True
        if self.classification_metrics["accuracy"] < 0.85:
            return True
        return False
