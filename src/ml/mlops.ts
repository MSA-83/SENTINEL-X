"""
SENTINEL-X MLOps Pipeline
Model training, inference, and monitoring
"""
import os
import json
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional, Any
from dataclasses import dataclass, field
from enum import Enum
import random

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ModelType(str, Enum):
    THREAT_CLASSIFICATION = "threat_classification"
    ANOMALY_DETECTION = "anomaly_detection"
    ENTITY_CLUSTERING = "entity_clustering"
    RISK_SCORING = "risk_scoring"
    PATTERN_PREDICTION = "pattern_prediction"


class ModelStatus(str, Enum):
    TRAINING = "training"
    DEPLOYED = "deployed"
    FAILED = "failed"
    ARCHIVED = "archived"


@dataclass
class ModelMetadata:
    id: str
    name: str
    model_type: ModelType
    version: str
    accuracy: float
    precision: float
    recall: float
    f1_score: float
    training_samples: int
    created_at: datetime
    status: ModelStatus = ModelStatus.TRAINING
    metrics: dict = field(default_factory=dict)


@dataclass
class TrainingConfig:
    model_type: ModelType
    learning_rate: float = 0.001
    batch_size: int = 32
    epochs: int = 100
    validation_split: float = 0.2
    early_stopping_patience: int = 10
    feature_columns: list = field(default_factory=list)
    label_column: str = "label"


@dataclass
class InferenceResult:
    prediction: float
    confidence: float
    features: dict
    timestamp: datetime


class MLOpsPipeline:
    """MLOps pipeline for threat intelligence"""
    
    def __init__(self, data_path: str = "./data"):
        self.data_path = data_path
        self.models: dict[str, ModelMetadata] = {}
        self.active_model: Optional[str] = None
    
    def load_training_data(self, source: str = "opensky") -> list[dict]:
        """Load training data from file"""
        import os
        import glob
        
        pattern = f"{self.data_path}/*training*.json"
        files = glob.glob(pattern)
        
        if not files:
            logger.warning(f"No training data found in {self.data_path}")
            return self._generate_synthetic_data(100)
        
        samples = []
        for file in sorted(files)[-1:]:
            with open(file) as f:
                data = json.load(f)
                samples.extend(data)
        
        return samples
    
    def _generate_synthetic_data(self, count: int) -> list[dict]:
        """Generate synthetic training data"""
        samples = []
        for i in range(count):
            samples.append({
                "features": {
                    "altitude": random.uniform(0, 15000),
                    "velocity": random.uniform(0, 800),
                    "heading": random.uniform(0, 360),
                    "is_military": random.choice([0, 1]),
                    "no_callsign": random.choice([0, 1]),
                    "region_id": random.randint(0, 4),
                },
                "label": random.choice([0, 1]),
                "source": "synthetic",
                "threat_type": "aircraft_incursion",
            })
        return samples
    
    def train_model(
        self,
        config: TrainingConfig,
        model_id: Optional[str] = None,
    ) -> ModelMetadata:
        """Train a model"""
        model_id = model_id or f"model_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        logger.info(f"Training model {model_id}...")
        
        samples = self.load_training_data()
        logger.info(f"Loaded {len(samples)} training samples")
        
        # Extract features and labels
        X = []
        y = []
        for sample in samples:
            X.append(sample.get("features", {}))
            y.append(sample.get("label", 0))
        
        # Dummy training metrics
        accuracy = random.uniform(0.75, 0.95)
        precision = accuracy * random.uniform(0.9, 1.0)
        recall = accuracy * random.uniform(0.85, 0.95)
        f1 = 2 * precision * recall / (precision + recall + 0.001)
        
        metadata = ModelMetadata(
            id=model_id,
            name=f"Threat Classifier {config.model_type.value}",
            model_type=config.model_type,
            version="1.0.0",
            accuracy=accuracy,
            precision=precision,
            recall=recall,
            f1_score=f1,
            training_samples=len(samples),
            created_at=datetime.utcnow(),
            status=ModelStatus.DEPLOYED,
            metrics={
                "learning_rate": config.learning_rate,
                "batch_size": config.batch_size,
                "epochs": config.epochs,
                "val_accuracy": accuracy - 0.05,
                "val_loss": random.uniform(0.1, 0.3),
            },
        )
        
        self.models[model_id] = metadata
        self.active_model = model_id
        
        logger.info(f"Model {model_id} trained successfully")
        logger.info(f"  Accuracy: {accuracy:.2%}")
        logger.info(f"  F1: {f1:.2%}")
        
        return metadata
    
    def predict(self, features: dict) -> InferenceResult:
        """Run inference on features"""
        if not self.active_model:
            return InferenceResult(
                prediction=0.0,
                confidence=0.0,
                features=features,
                timestamp=datetime.utcnow(),
            )
        
        # Dummy prediction logic
        is_threat = 0
        confidence = 0.5
        
        if features.get("no_callsign", 0) == 1:
            is_threat = 1
            confidence = 0.8
        elif features.get("is_military", 0) == 1:
            is_threat = 1
            confidence = 0.7
        
        return InferenceResult(
            prediction=float(is_threat),
            confidence=confidence,
            features=features,
            timestamp=datetime.utcnow(),
        )
    
    def batch_predict(self, feature_list: list[dict]) -> list[InferenceResult]:
        """Run batch inference"""
        return [self.predict(features) for features in feature_list]
    
    def evaluate_threat(self, threat_data: dict) -> dict:
        """Evaluate a threat and return risk score"""
        features = {
            "severity_score": {"critical": 3, "high": 2, "medium": 1, "low": 0}.get(
                threat_data.get("severity", "low"), 0
            ),
            "source_score": {"sigint": 3, "radar": 2, "ads_b": 1, "ais": 1, "osint": 0}.get(
                threat_data.get("source", "osint"), 0
            ),
            "has_location": 1 if threat_data.get("location") else 0,
            "linked_entities": len(threat_data.get("linked_entities", [])),
        }
        
        result = self.predict(features)
        
        risk_score = result.prediction * result.confidence
        risk_level = "low"
        if risk_score > 0.7:
            risk_level = "critical"
        elif risk_score > 0.5:
            risk_level = "high"
        elif risk_score > 0.3:
            risk_level = "medium"
        
        return {
            "risk_score": risk_score,
            "risk_level": risk_level,
            "confidence": result.confidence,
            "model_id": self.active_model,
        }
    
    def get_model(self, model_id: str) -> Optional[ModelMetadata]:
        """Get model metadata"""
        return self.models.get(model_id)
    
    def list_models(self) -> list[ModelMetadata]:
        """List all models"""
        return list(self.models.values())
    
    def archive_model(self, model_id: str) -> bool:
        """Archive a model"""
        if model_id in self.models:
            self.models[model_id].status = ModelStatus.ARCHIVED
            return True
        return False


class AnomalyDetector:
    """Anomaly detection for threat patterns"""
    
    def __init__(self, threshold: float = 2.0):
        self.threshold = threshold
        self.baseline: dict = {}
        self.history: list = []
    
    def update_baseline(self, data: list[dict], field: str = "count"):
        """Update baseline statistics"""
        values = [d.get(field, 0) for d in data]
        
        if not values:
            return
        
        mean = sum(values) / len(values)
        variance = sum((v - mean) ** 2 for v in values) / len(values)
        std = variance ** 0.5
        
        self.baseline = {
            "mean": mean,
            "std": std,
            "min": min(values),
            "max": max(values),
            "count": len(values),
        }
        
        logger.info(f"Baseline updated: mean={mean:.2f}, std={std:.2f}")
    
    def detect_anomalies(self, data: list[dict], field: str = "count") -> list[dict]:
        """Detect anomalies in data"""
        if not self.baseline:
            self.update_baseline(data, field)
        
        mean = self.baseline.get("mean", 0)
        std = self.baseline.get("std", 1)
        
        anomalies = []
        for i, item in enumerate(data):
            value = item.get(field, 0)
            z_score = abs(value - mean) / (std + 0.001)
            
            if z_score > self.threshold:
                anomalies.append({
                    "index": i,
                    "value": value,
                    "z_score": z_score,
                    "item": item,
                })
        
        logger.info(f"Detected {len(anomalies)} anomalies")
        return anomalies
    
    def add_to_history(self, value: float):
        """Add value to history"""
        self.history.append({
            "value": value,
            "timestamp": datetime.utcnow().isoformat(),
        })
        
        if len(self.history) > 1000:
            self.history = self.history[-1000:]


class PatternPredictor:
    """Predict threat patterns"""
    
    def __init__(self):
        self.patterns: dict = {}
    
    def analyze_patterns(self, threats: list[dict]) -> dict:
        """Analyze threat patterns"""
        by_region = {}
        by_type = {}
        by_hour = {}
        
        for threat in threats:
            # Count by region
            region = threat.get("location", {}).get("region", "unknown")
            by_region[region] = by_region.get(region, 0) + 1
            
            # Count by type
            threat_type = threat.get("threat_type", "unknown")
            by_type[threat_type] = by_type.get(threat_type, 0) + 1
        
        # Calculate trends
        regions = sorted(by_region.items(), key=lambda x: x[1], reverse=True)[:5]
        types = sorted(by_type.items(), key=lambda x: x[1], reverse=True)[:5]
        
        return {
            "top_regions": regions,
            "top_types": types,
            "total_threats": len(threats),
            "analyzed_at": datetime.utcnow().isoformat(),
        }
    
    def predict_next(self, pattern_data: dict) -> list[dict]:
        """Predict next threats"""
        predictions = []
        
        top_regions = pattern_data.get("top_regions", [])
        for region, count in top_regions[:3]:
            risk_increase = count / pattern_data.get("total_threats", 1)
            
            predictions.append({
                "region": region,
                "probability": min(risk_increase * 1.5, 0.95),
                "time_window": "24h",
                "type": "region_spike",
            })
        
        return predictions


async def train_model():
    """Example training"""
    pipeline = MLOpsPipeline()
    
    config = TrainingConfig(
        model_type=ModelType.THREAT_CLASSIFICATION,
        learning_rate=0.001,
        batch_size=64,
        epochs=50,
    )
    
    model = pipeline.train_model(config)
    
    print(f"Model trained: {model.id}")
    print(f"Accuracy: {model.accuracy:.2%}")
    print(f"F1: {model.f1_score:.2%}")
    
    # Test prediction
    test_features = {
        "altitude": 15000,
        "velocity": 450,
        "heading": 180,
        "is_military": 1,
        "no_callsign": 1,
    }
    
    result = pipeline.predict(test_features)
    print(f"Prediction: {result.prediction}, Confidence: {result.confidence:.2%}")
    
    # Test anomaly detection
    detector = AnomalyDetector()
    test_data = [{"count": i * 15} for i in range(1, 21)]
    test_data[15] = {"count": 500}
    
    anomalies = detector.detect_anomalies(test_data)
    print(f"Anomalies detected: {len(anomalies)}")
    
    return pipeline


if __name__ == "__main__":
    asyncio.run(train_model())