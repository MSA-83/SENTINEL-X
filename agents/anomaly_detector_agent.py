"""
Anomaly Detection Agent: Real-time monitoring + self-calibration
Uses statistical models + LLM reasoning for explainable anomalies
"""

from langchain_groq import ChatGroq
import numpy as np
from scipy import stats
from collections import defaultdict
from datetime import datetime, timedelta
import json
import asyncio
import re


class AnomalyDetectorAgent:
    """
    Multi-method anomaly detection:
    1. Statistical (Z-score, IQR)
    2. Temporal (time-series patterns)
    3. Contextual (domain knowledge via LLM)
    """
    
    def __init__(self):
        self.llm = ChatGroq(
            model="llama-3.1-70b-versatile",
            temperature=0.05,
            groq_api_key="free-groq-key"
        )
        
        # Historical data for statistical methods
        self.history = defaultdict(list)  # entity_id -> [measurements]
        self.thresholds = defaultdict(lambda: {
            "velocity_z": 3.0,  # Z-score threshold
            "altitude_z": 2.5,
            "trajectory_std": 2.0
        })
        self.anomaly_cache = {}
        
        # Metrics initialization
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
        
    async def detect_statistical(self, entity_id: str, 
                                  measurement: dict,
                                  ground_truth: bool = None) -> dict:
        """
        Statistical anomaly detection using Z-scores
        """
        # Store measurement
        self.history[entity_id].append(measurement)
        
        # Keep only last 100 measurements
        if len(self.history[entity_id]) > 100:
            self.history[entity_id] = self.history[entity_id][-100:]
        
        # Need at least 10 historical points
        if len(self.history[entity_id]) < 10:
            return {
                "method": "statistical",
                "anomaly": False,
                "reason": "Insufficient history"
            }
        
        # Extract time series
        velocities = [m["velocity"] for m in self.history[entity_id]]
        altitudes = [m["altitude"] for m in self.history[entity_id]]
        
        # Calculate Z-scores
        velocity_zscore = abs(stats.zscore(velocities)[-1])
        altitude_zscore = abs(stats.zscore(altitudes)[-1])
        
        # Check thresholds
        anomalies = []
        if velocity_zscore > self.thresholds[entity_id]["velocity_z"]:
            anomalies.append({
                "type": "velocity_spike",
                "zscore": velocity_zscore,
                "current": velocities[-1],
                "mean": np.mean(velocities)
            })
        
        if altitude_zscore > self.thresholds[entity_id]["altitude_z"]:
            anomalies.append({
                "type": "altitude_change",
                "zscore": altitude_zscore,
                "current": altitudes[-1],
                "mean": np.mean(altitudes)
            })
        
        # Track metrics if ground truth available
        if ground_truth is not None:
            self.metrics["total_evaluated"] += 1
            if anomalies:
                self.metrics["anomalies_detected"] += 1
                if ground_truth:
                    self.metrics["true_positives"] += 1
                else:
                    self.metrics["false_positives"] += 1
            elif ground_truth:
                self.metrics["false_negatives"] += 1
        
        return {
            "method": "statistical",
            "anomaly": len(anomalies) > 0,
            "anomalies": anomalies,
            "zscores": {
                "velocity": velocity_zscore,
                "altitude": altitude_zscore
            }
        }
    
    async def detect_temporal(self, entity_id: str, 
                              measurement: dict,
                              ground_truth: bool = None) -> dict:
        """
        Temporal pattern detection
        Look for sudden behavioral changes
        """
        if len(self.history[entity_id]) < 5:
            return {
                "method": "temporal",
                "anomaly": False,
                "reason": "Insufficient history"
            }
        
        recent = self.history[entity_id][-5:]
        velocities = [m["velocity"] for m in recent]
        
        # Detect sharp changes
        velocity_deltas = np.diff(velocities)
        max_delta = np.max(np.abs(velocity_deltas))
        
        anomaly = max_delta > 200  # 200 knots per measurement
        
        if ground_truth is not None and anomaly:
            self.metrics["anomalies_detected"] += 1
            if ground_truth:
                self.metrics["true_positives"] += 1
        
        return {
            "method": "temporal",
            "anomaly": anomaly,
            "max_velocity_delta": float(max_delta),
            "reason": "Sudden velocity change" if anomaly else "Normal progression"
        }
    
    async def detect_contextual(self, entity_id: str, 
                               entity_data: dict,
                               ground_truth: bool = None) -> dict:
        """
        Contextual anomaly detection using LLM reasoning
        Consider domain-specific rules
        """
        
        prompt = f"""Analyze this entity for contextual anomalies:


Entity ID: {entity_id}
Data: {json.dumps(entity_data, default=str)}


Consider:
1. Is this entity in an unusual location for its type?
2. Does it have suspicious communication patterns?
3. Is the reported identity consistent with track data?
4. Are there regulatory compliance issues?


Return JSON: {{"anomaly": true|false, "severity": "low"|"medium"|"high", "reason": "..."}}"""
        
        try:
            response = self.llm.invoke(prompt)
            json_match = re.search(r'\{.*\}', response.content, re.DOTALL)
            result = json.loads(json_match.group()) if json_match else {
                "anomaly": False,
                "severity": "low"
            }
            
            if ground_truth is not None:
                if result["anomaly"] == ground_truth:
                    self.metrics["true_positives"] += 1
                else:
                    if result["anomaly"]:
                        self.metrics["false_positives"] += 1
                    else:
                        self.metrics["false_negatives"] += 1
            
            return {
                "method": "contextual",
                "anomaly": result["anomaly"],
                "severity": result["severity"],
                "reason": result["reason"]
            }
        
        except Exception as e:
            return {
                "method": "contextual",
                "anomaly": False,
                "error": str(e)
            }
    
    async def detect_comprehensive(self, entity_id: str, 
                                   entity_data: dict) -> dict:
        """
        Combine all detection methods for final verdict
        """
        # Run all detectors in parallel
        statistical = await self.detect_statistical(
            entity_id, entity_data
        )
        temporal = await self.detect_temporal(
            entity_id, entity_data
        )
        contextual = await self.detect_contextual(
            entity_id, entity_data
        )
        
        # Voting system
        anomaly_votes = sum([
            statistical.get("anomaly", False),
            temporal.get("anomaly", False),
            contextual.get("anomaly", False)
        ])
        
        # Decision: 2/3 methods agree = anomaly
        is_anomaly = anomaly_votes >= 2
        
        # Calculate confidence
        confidence = anomaly_votes / 3.0
        
        return {
            "entity_id": entity_id,
            "anomaly": is_anomaly,
            "confidence": confidence,
            "methods": {
                "statistical": statistical,
                "temporal": temporal,
                "contextual": contextual
            },
            "timestamp": datetime.now().isoformat(),
            "recommendation": self._get_recommendation(
                is_anomaly, confidence, contextual
            )
        }
    
    def _get_recommendation(self, is_anomaly: bool, 
                            confidence: float, 
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
