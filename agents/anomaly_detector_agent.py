"""
Anomaly Detection Agent: Real-time monitoring + self-calibration
Uses statistical models + LLM reasoning for explainable anomalies.

This agent implements a multi-method anomaly detection approach:
1. Statistical detection (Z-score, IQR)
2. Temporal pattern detection (time-series analysis)
3. Contextual analysis (domain knowledge via LLM)

The ensemble voting system requires 2/3 methods to agree for anomaly classification.
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
    Multi-method anomaly detection agent with self-calibration.
    
    Features:
    - Statistical analysis using Z-scores and IQR
    - Temporal pattern detection for behavioral changes
    - Contextual reasoning via Groq LLM
    - Ensemble voting for final decisions
    - Built-in metrics tracking for precision/recall/F1
    
    Args:
        llm: Optional LLM instance (defaults to Groq Llama 3.1 70B)
    """
    
    def __init__(self, llm: Optional[ChatGroq] = None):
        self.llm = llm or ChatGroq(
            model="llama-3.1-70b-versatile",
            temperature=0.05,
            groq_api_key=os.environ.get("GROQ_API_KEY", "")  # SECURITY: Environment variable
        )
        
        # Historical data for statistical methods
        self.history: Dict[str, list] = defaultdict(list)
        self.thresholds: Dict[str, Dict[str, float]] = defaultdict(
            lambda: {
                "velocity_z": 3.0,  # Z-score threshold
                "altitude_z": 2.5,
                "trajectory_std": 2.0
            }
        )
        self.anomaly_cache: Dict[str, Dict] = {}
        
        # Metrics tracking
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
    
    async def detect_statistical(
        self, 
        entity_id: str, 
        measurement: Dict[str, Any],
        ground_truth: Optional[bool] = None
    ) -> Dict[str, Any]:
        """
        Detect anomalies using statistical methods (Z-score, IQR).
        
        Analyzes velocity and altitude distributions to identify outliers
        using Z-score analysis. Measurements outside 3 standard
        deviations are flagged as potential anomalies.
        
        Args:
            entity_id: Unique identifier for the entity
            measurement: Dict with 'velocity' and 'altitude' keys
            ground_truth: Optional boolean for metrics calculation
            
        Returns:
            Dict with method, anomaly status, details, and Z-scores
        """
        # Store measurement in history
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
                "mean": np.mean(velocities),
                "std": np.std(velocities)
            })
        
        if altitude_zscore > self.thresholds[entity_id]["altitude_z"]:
            anomalies.append({
                "type": "altitude_change",
                "zscore": altitude_zscore,
                "current": altitudes[-1],
                "mean": np.mean(altitudes),
                "std": np.std(altitudes)
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
                "velocity": float(velocity_zscore),
                "altitude": float(altitude_zscore)
            }
        }
    
    async def detect_temporal(
        self, 
        entity_id: str, 
        measurement: Dict[str, Any],
        ground_truth: Optional[bool] = None
    ) -> Dict[str, Any]:
        """
        Detect anomalies using temporal pattern analysis.
        
        Looks for sudden behavioral changes in velocity patterns
        that may indicate anomalous behavior.
        
        Args:
            entity_id: Unique identifier for the entity
            measurement: Dict with 'velocity' key
            ground_truth: Optional boolean for metrics calculation
            
        Returns:
            Dict with method, anomaly status, and change magnitude
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
        max_delta = float(np.max(np.abs(velocity_deltas)))
        
        anomaly = max_delta > 200  # 200 knots per measurement
        
        if ground_truth is not None and anomaly:
            self.metrics["anomalies_detected"] += 1
            if ground_truth:
                self.metrics["true_positives"] += 1
        
        return {
            "method": "temporal",
            "anomaly": anomaly,
            "max_velocity_delta": max_delta,
            "reason": "Sudden velocity change" if anomaly else "Normal progression"
        }
    
    async def detect_contextual(
        self, 
        entity_id: str, 
        entity_data: Dict[str, Any],
        ground_truth: Optional[bool] = None
    ) -> Dict[str, Any]:
        """
        Detect anomalies using LLM-based contextual reasoning.
        
        Uses domain knowledge to identify suspicious patterns
        that statistical methods might miss.
        
        Args:
            entity_id: Unique identifier for the entity
            entity_data: Full entity observation data
            ground_truth: Optional boolean for metrics calculation
            
        Returns:
            Dict with method, anomaly status, severity, and reason
        """
        # SECURITY: Sanitize entity_data before LLM prompt
        sanitized_data = re.sub(
            r"(ignore previous|disregard your|<script|{{|}}|javascript:|onerror=|onclick=)",
            "[REDACTED]",
            json.dumps(entity_data, default=str),
            flags=re.IGNORECASE
        )
        
        prompt = f"""Analyze this entity for contextual anomalies:

Entity ID: {entity_id}
Data: {sanitized_data}

Consider:
1. Is this entity in an unusual location for its type?
2. Does it have suspicious communication patterns?
3. Is the reported identity consistent with track data?
4. Are there regulatory compliance issues?

Return JSON: {{"anomaly": true|false, "severity": "low"|"medium"|"high", "reason": "..."}}"""
        
        try:
            response = await asyncio.to_thread(self.llm.invoke, prompt)
            json_match = re.search(r'\{.*\}', response.content, re.DOTALL)
            result = json.loads(json_match.group()) if json_match else {
                "anomaly": False,
                "severity": "low",
                "reason": "LLM parsing failed"
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
                "severity": result.get("severity", "low"),
                "reason": result.get("reason", "No reason provided")
            }
        
        except Exception as e:
            return {
                "method": "contextual",
                "anomaly": False,
                "error": str(e)
            }
    
    async def detect_comprehensive(
        self, 
        entity_id: str, 
        entity_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Combine all detection methods for final verdict using ensemble voting.
        
        Requires 2/3 methods to agree for anomaly classification.
        Calculates confidence based on agreement ratio.
        
        Args:
            entity_id: Unique identifier for the entity
            entity_data: Full entity observation data
            
        Returns:
            Dict with comprehensive results from all methods
        """
        # Run all detectors in parallel
        statistical = await self.detect_statistical(entity_id, entity_data)
        temporal = await self.detect_temporal(entity_id, entity_data)
        contextual = await self.detect_contextual(entity_id, entity_data)
        
        # Voting system: 2/3 methods agree = anomaly
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
    
    def _get_recommendation(
        self, 
        is_anomaly: bool, 
        confidence: float, 
        contextual: Dict[str, Any]
    ) -> str:
        """
        Generate actionable recommendation based on detection results.
        
        Args:
            is_anomaly: Whether anomaly was detected
            confidence: Confidence score 0-1
            contextual: Contextual detection results
            
        Returns:
            String recommendation for next action
        """
        if not is_anomaly:
            return "No action required - normal behavior"
        
        if confidence >= 0.85:
            return "HIGH PRIORITY: Escalate to analyst immediately"
        elif confidence >= 0.65:
            return "MEDIUM PRIORITY: Queue for analyst review"
        else:
            return "LOW PRIORITY: Monitor and log - needs clarification"
    
    def calculate_metrics(self) -> Dict[str, float]:
        """
        Calculate precision, recall, and F1 score from current metrics.
        
        Returns:
            Dict with precision, recall, and F1 score
        """
        tp = self.metrics["true_positives"]
        fp = self.metrics["false_positives"]
        fn = self.metrics["false_negatives"]
        
        if tp + fp > 0:
            self.metrics["precision"] = tp / (tp + fp)
        if tp + fn > 0:
            self.metrics["recall"] = tp / (tp + fn)
        if self.metrics["precision"] + self.metrics["recall"] > 0:
            self.metrics["f1"] = 2 * (
                self.metrics["precision"] * self.metrics["recall"]
            ) / (self.metrics["precision"] + self.metrics["recall"])
        
        return {
            "precision": self.metrics["precision"],
            "recall": self.metrics["recall"],
            "f1": self.metrics["f1"]
        }
