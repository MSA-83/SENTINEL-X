"""
Anomaly Detection Agent: Real-time monitoring + self-calibration
Uses statistical models + LLM reasoning for explainable anomalies
"""

import os
import json
import asyncio
from datetime import datetime
from typing import Optional
from collections import defaultdict
import numpy as np
from scipy import stats
from langchain_groq import ChatGroq


GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")


class AnomalyDetectorAgent:
    """
    Multi-method anomaly detection:
    1. Statistical (Z-score, IQR)
    2. Temporal (time-series patterns)
    3. Contextual (domain knowledge via LLM)
    """
    
    def __init__(self, agent_name: str = "AnomalyDetector"):
        self.agent_name = agent_name
        self.llm = ChatGroq(
            model="llama-3.1-70b-versatile",
            temperature=0.05,
            max_tokens=2048,
            groq_api_key=GROQ_API_KEY,
            timeout=30
        )
        
        # Historical data for statistical methods
        self.history: dict[str, list[dict]] = defaultdict(list)
        self.thresholds = {
            "velocity_z": 3.0,
            "altitude_z": 2.5,
            "trajectory_std": 2.0,
            "velocity_delta_threshold": 200  # knots
        }
        
        # Metrics
        self.metrics = {
            "total_evaluated": 0,
            "anomalies_detected": 0,
            "true_positives": 0,
            "false_positives": 0,
            "false_negatives": 0,
            "precision": 0.0,
            "recall": 0.0,
            "f1": 0.0
        }
    
    async def detect_statistical(self, entity_id: str, measurement: dict, 
                            ground_truth: Optional[bool] = None) -> dict:
        """
        Statistical anomaly detection using Z-scores
        """
        self.history[entity_id].append(measurement)
        
        # Keep only last 100 measurements
        if len(self.history[entity_id]) > 100:
            self.history[entity_id] = self.history[entity_id][-100:]
        
        # Need minimum 10 points for statistical analysis
        if len(self.history[entity_id]) < 10:
            return {
                "method": "statistical",
                "anomaly": False,
                "reason": "Insufficient history for statistical analysis"
            }
        
        velocities = [m.get("velocity", 0) for m in self.history[entity_id]]
        altitudes = [m.get("altitude", 0) for m in self.history[entity_id]]
        
        # Calculate Z-scores
        if len(velocities) >= 10:
            velocity_z = abs(stats.zscore(velocities)[-1])
            altitude_z = abs(stats.zscore(altitudes)[-1]) if len(set(altitudes)) > 1 else 0
        else:
            velocity_z = 0
            altitude_z = 0
        
        # IQR method for outliers
        q1_v, q3_v = np.percentile(velocities, [25, 75])
        iqr_v = q3_v - q1_v
        velocity_outlier = abs(velocities[-1] - np.median(velocities)) > 1.5 * iqr_v if iqr_v > 0 else False
        
        # Decision
        is_anomaly = velocity_z > self.thresholds["velocity_z"] or \
                     altitude_z > self.thresholds["altitude_z"] or \
                     velocity_outlier
        
        # Update metrics if ground truth provided
        if ground_truth is not None:
            self.metrics["total_evaluated"] += 1
            if is_anomaly:
                self.metrics["anomalies_detected"] += 1
                if ground_truth:
                    self.metrics["true_positives"] += 1
                else:
                    self.metrics["false_positives"] += 1
            elif ground_truth:
                self.metrics["false_negatives"] += 1
        
        return {
            "method": "statistical",
            "anomaly": is_anomaly,
            "velocity_zscore": velocity_z,
            "altitude_zscore": altitude_z,
            "velocity_outlier": velocity_outlier,
            "confidence": min(1.0, max(velocity_z, altitude_z) / 5.0)
        }
    
    async def detect_temporal(self, entity_id: str, measurement: dict,
                           ground_truth: Optional[bool] = None) -> dict:
        """
        Temporal pattern detection
        - Sudden velocity changes
        """
        if len(self.history[entity_id]) < 5:
            return {
                "method": "temporal",
                "anomaly": False,
                "reason": "Insufficient history for temporal analysis"
            }
        
        recent = self.history[entity_id][-5:]
        velocities = [m.get("velocity", 0) for m in recent]
        deltas = np.diff(velocities)
        max_delta = np.max(np.abs(deltas))
        
        is_anomaly = max_delta > self.thresholds["velocity_delta_threshold"]
        
        return {
            "method": "temporal",
            "anomaly": is_anomaly,
            "max_delta": float(max_delta),
            "reason": "Sudden velocity change" if is_anomaly else "Normal progression"
        }
    
    async def detect_contextual(self, entity_id: str, entity_data: dict,
                               ground_truth: Optional[bool] = None) -> dict:
        """
        Contextual anomaly detection using LLM reasoning
        """
        prompt = f"""Analyze this entity for contextual anomalies:

Entity ID: {entity_id}
Type: {entity_data.get('domain', 'aircraft')}
Velocity: {entity_data.get('velocity')} knots
Altitude: {entity_data.get('altitude')} ft
Position: ({entity_data.get('lat', 0):.2f}, {entity_data.get('lon', 0):.2f})
Signal: {entity_data.get('signal_strength', 0.5):.2f}

Contextual analysis questions:
1. Is this unusual location for its entity type?
2. Is position consistent with reported identity?
3. Are there regulatory compliance issues?
4. Signal strength anomalies?

Return JSON: {{"anomaly": true|false, "severity": "low"|"medium"|"high", "reason": "..."}}"""
        
        try:
            response = await asyncio.to_thread(self.llm.invoke, prompt)
            
            # Extract JSON
            import re
            json_match = re.search(r'\{.*\}', response.content, re.DOTALL)
            result = json.loads(json_match.group()) if json_match else {
                "anomaly": False,
                "severity": "low"
            }
            
            # Update metrics if ground truth provided
            if ground_truth is not None:
                if result.get("anomaly", False) == ground_truth:
                    self.metrics["true_positives"] += 1
                elif result.get("anomaly", False):
                    self.metrics["false_positives"] += 1
                else:
                    self.metrics["false_negatives"] += 1
            
            return {
                "method": "contextual",
                "anomaly": result.get("anomaly", False),
                "severity": result.get("severity", "low"),
                "reason": result.get("reason", "Analysis complete")
            }
            
        except Exception as e:
            return {
                "method": "contextual",
                "anomaly": False,
                "error": str(e)
            }
    
    async def detect_ensemble(self, entity_id: str, entity_data: dict,
                            ground_truth: Optional[bool] = None) -> dict:
        """
        Ensemble: Combine all three detection methods
        Voting system: 2/3 agree = anomaly
        """
        stat = await self.detect_statistical(entity_id, entity_data, ground_truth)
        temp = await self.detect_temporal(entity_id, entity_data, ground_truth)
        ctx = await self.detect_contextual(entity_id, entity_data, ground_truth)
        
        # Voting
        votes = sum([
            stat.get("anomaly", False),
            temp.get("anomaly", False),
            ctx.get("anomaly", False)
        ])
        
        is_anomaly = votes >= 2
        confidence = votes / 3.0
        
        return {
            "entity_id": entity_id,
            "anomaly": is_anomaly,
            "confidence": confidence,
            "methods": {
                "statistical": stat,
                "temporal": temp,
                "contextual": ctx
            },
            "votes": votes,
            "timestamp": datetime.now().isoformat(),
            "recommendation": self._get_recommendation(is_anomaly, confidence, ctx)
        }
    
    def _get_recommendation(self, is_anomaly: bool, confidence: float, 
                          contextual: dict) -> str:
        """Generate actionable recommendation"""
        if not is_anomaly:
            return "No action required - normal behavior"
        if confidence >= 0.85:
            return "HIGH PRIORITY: Escalate to analyst immediately"
        elif confidence >= 0.65:
            return "MEDIUM PRIORITY: Queue for analyst review"
        else:
            return "LOW PRIORITY: Monitor and log - needs clarification"
    
    def calculate_metrics(self) -> dict:
        """Calculate precision, recall, F1"""
        tp = self.metrics["true_positives"]
        fp = self.metrics["false_positives"]
        fn = self.metrics["false_negatives"]
        
        if tp + fp > 0:
            self.metrics["precision"] = tp / (tp + fp)
        if tp + fn > 0:
            self.metrics["recall"] = tp / (tp + fn)
        if self.metrics["precision"] + self.metrics["recall"] > 0:
            self.metrics["f1"] = 2 * (
                self.metrics["precision"] * self.metrics["recall"] /
                (self.metrics["precision"] + self.metrics["recall"])
            )
        
        return self.metrics
    
    def get_metrics(self) -> dict:
        return {
            "agent_name": self.agent_name,
            **self.metrics
        }


async def batch_detect(agent: AnomalyDetectorAgent, entities: list[dict]) -> list[dict]:
    """Batch anomaly detection"""
    results = []
    
    for entity in entities:
        entity_id = entity.get("entity_id", "unknown")
        result = await agent.detect_ensemble(entity_id, entity)
        results.append(result)
        
        # Rate limit
        await asyncio.sleep(0.5)
    
    return results