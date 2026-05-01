"""
Entity Classification Agent: Learns from feedback
Integrates with training pipeline for continuous improvement
"""

import os
import json
import asyncio
import re
from datetime import datetime
from typing import Optional, Any
from dataclasses import dataclass, field
from langchain_groq import ChatGroq
from langchain.memory import ConversationBufferMemory
from pydantic import BaseModel, Field
import numpy as np


GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")


@dataclass
class ClassificationFeedback(BaseModel):
    """Feedback structure for agent learning"""
    prediction: str
    actual: str
    confidence: float
    entity_id: str
    features: dict
    feedback_type: str = Field(default="")
    timestamp: datetime = Field(default_factory=datetime.now)


@dataclass
class ClassificationMetrics:
    """Track classification metrics"""
    total: int = 0
    correct: int = 0
    incorrect: int = 0
    accuracy: float = 0.0
    feedback_count: int = 0


class EntityClassifierAgent:
    """
    Self-improving entity classifier
    - Learns from corrections
    - Updates feature importance
    - Retrains on misclassifications
    """
    
    def __init__(self, model_version: str = "v1", agent_name: str = "EntityClassifier"):
        self.agent_name = agent_name
        self.model_version = model_version
        self.llm = ChatGroq(
            model="llama-3.1-70b-versatile",
            temperature=0.05,
            max_tokens=2048,
            groq_api_key=GROQ_API_KEY,
            timeout=30
        )
        self.feedback_buffer: list[ClassificationFeedback] = []
        self.feature_importance = {
            "velocity": 0.25,
            "altitude": 0.15,
            "lat_delta": 0.20,
            "lon_delta": 0.20,
            "time_based": 0.10,
            "seasonal": 0.10
        }
        self.metrics = ClassificationMetrics()
    
    async def extract_features(self, entity_data: dict) -> dict:
        """
        Extract domain-specific features for classification
        """
        features = {
            "velocity": min(entity_data.get("velocity", 0) / 900, 1.0),  # Normalize to max cruise
            "altitude": min(entity_data.get("altitude", 0) / 45000, 1.0),  # Normalize to max alt
            "lat_delta": abs(entity_data.get("lat_delta", 0)),  # Degrees changed
            "lon_delta": abs(entity_data.get("lon_delta", 0)),  # Degrees changed
            "time_based": self._calc_time_anomaly(entity_data),
            "signal_strength": entity_data.get("signal_strength", 0.5),
            "course_stability": self._calc_course_stability(entity_data)
        }
        return features
    
    def _calc_time_anomaly(self, entity_data: dict) -> float:
        """Anomaly score based on time-of-day"""
        hour = datetime.now().hour
        normal_hours = list(range(6, 20))  # 6am-8pm normal
        
        if hour in normal_hours:
            return 0.0
        return min(1.0, abs(12 - hour) / 12)  # Peak at midnight/noon
    
    def _calc_course_stability(self, entity_data: dict) -> float:
        """Measure stability of reported course"""
        course_history = entity_data.get("course_history", [])
        
        if len(course_history) < 2:
            return 0.5  # Unknown
        
        deltas = np.diff(course_history)
        stability = 1.0 - min(1.0, np.std(deltas) / 180)  # Max variation 180°
        
        return stability
    
    async def classify(self, entity_data: dict) -> dict:
        """
        Classify entity with explanation
        Returns: {"class": "normal"|"suspicious"|"anomaly", "confidence": 0-1, "reason": "..."}
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

Extracted Features (normalized 0-1): {json.dumps(features)}

Weighted Anomaly Score: {anomaly_score:.2f}

Classification Rules:
- If score < 0.30: NORMAL (typical behavior)
- If 0.30 <= score < 0.55: SUSPICIOUS (needs monitoring)
- If score >= 0.55: ANOMALY (likely threat)

Provide classification with domain reasoning:
Return valid JSON: {{"class": "normal"|"suspicious"|"anomaly", "confidence": 0.0-1.0, "reason": "..."}}"""
        
        try:
            response = await asyncio.to_thread(self.llm.invoke, reasoning_prompt)
            
            # Extract JSON from response
            json_match = re.search(r'\{.*\}', response.content, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
            else:
                # Fallback to score-based classification
                result = {
                    "class": "suspicious" if anomaly_score > 0.4 else "normal",
                    "confidence": anomaly_score,
                    "reason": "Model inference based on feature score"
                }
            
            self.metrics.total += 1
            
            return {
                "entity_id": entity_data.get("entity_id", "unknown"),
                "class": result["class"],
                "confidence": result["confidence"],
                "reason": result["reason"],
                "anomaly_score": anomaly_score,
                "features": features,
                "model_version": self.model_version
            }
            
        except Exception as e:
            return {
                "entity_id": entity_data.get("entity_id", "unknown"),
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
            self.metrics.correct += 1
        elif feedback.feedback_type == "incorrect":
            self.metrics.incorrect += 1
        
        total = self.metrics.correct + self.metrics.incorrect
        if total > 0:
            self.metrics.accuracy = self.metrics.correct / total
        
        # Adjust feature importance based on incorrect classifications
        if feedback.feedback_type == "incorrect":
            features = feedback.features
            update_prompt = f"""This classification was INCORRECT:

Predicted: {feedback.prediction}
Actual: {feedback.actual}
Features (normalized): {json.dumps(features)}

Current Feature Importance: {json.dumps(self.feature_importance)}

Which features should be MORE important to catch this error?
Return JSON: {{"feature_name": new_importance_0_to_1, ...}} (only features to increase)"""
            
            try:
                response = await asyncio.to_thread(self.llm.invoke, update_prompt)
                json_match = re.search(r'\{.*\}', response.content, re.DOTALL)
                
                if json_match:
                    updates = json.loads(json_match.group())
                    learning_rate = 0.1
                    
                    for feature, new_importance in updates.items():
                        if feature in self.feature_importance:
                            old = self.feature_importance[feature]
                            self.feature_importance[feature] = (
                                (1 - learning_rate) * old + learning_rate * new_importance
                            )
                    
                    # Renormalize to sum=1
                    total_imp = sum(self.feature_importance.values())
                    self.feature_importance = {
                        k: v/total_imp for k, v in self.feature_importance.items()
                    }
                    
                    self.metrics.feedback_count += 1
                    
            except Exception as e:
                print(f"Feature update error: {e}")
        
        return {
            "status": "feedback_processed",
            "buffer_size": len(self.feedback_buffer),
            "accuracy": self.metrics.accuracy,
            "updated_importance": self.feature_importance
        }
    
    async def should_retrain(self) -> bool:
        """
        Decide if agent should trigger model retraining
        Rules:
        - Every 100 feedback items
        - If accuracy drops below 85%
        """
        if len(self.feedback_buffer) >= 100:
            return True
        if self.metrics.accuracy < 0.85 and self.metrics.total >= 50:
            return True
        return False
    
    def get_metrics(self) -> dict:
        return {
            "model_version": self.model_version,
            "total_classified": self.metrics.total,
            "correct": self.metrics.correct,
            "incorrect": self.metrics.incorrect,
            "accuracy": self.metrics.accuracy,
            "feedback_count": self.metrics.feedback_count,
            "feature_importance": self.feature_importance
        }


async def batch_classify(agent: EntityClassifierAgent, entities: list[dict]) -> list[dict]:
    """Batch classify multiple entities"""
    results = []
    
    for entity in entities:
        result = await agent.classify(entity)
        results.append(result)
        
        # Rate limit to avoid Groq throttling
        await asyncio.sleep(0.5)
    
    return results