"""
SENTINEL-X Agent Deployment Service
FastAPI-based API for serving trained agents
"""

import os
import asyncio
from datetime import datetime
from contextlib import asynccontextmanager
from typing import Optional, Any

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import logging

# Import agents
from agents.classifier_agent import EntityClassifierAgent
from agents.anomaly_detector_agent import AnomalyDetectorAgent
from agents.dataset_curator_agent import DatasetCuratorAgent


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# Initialize agents
classifier_agent: Optional[EntityClassifierAgent] = None
anomaly_detector: Optional[AnomalyDetectorAgent] = None
dataset_curator: Optional[DatasetCuratorAgent] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize agents on startup"""
    global classifier_agent, anomaly_detector, dataset_curator
    
    logger.info("Initializing SENTINEL-X agents...")
    
    classifier_agent = EntityClassifierAgent(model_version="v1.0")
    anomaly_detector = AnomalyDetectorAgent()
    dataset_curator = DatasetCuratorAgent(dataset_name="sentinel-x-production")
    
    logger.info("Agents initialized successfully")
    
    yield
    
    logger.info("Shutting down agents...")


app = FastAPI(
    title="SENTINEL-X AI Agents",
    description="Production API for entity classification and anomaly detection",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request/Response models
class EntityData(BaseModel):
    entity_id: str
    velocity: float = 0
    altitude: float = 0
    lat: float = 0
    lon: float = 0
    signal_strength: float = 0.5
    domain: str = "aircraft"
    lat_delta: float = 0
    lon_delta: float = 0
    course_history: list[float] = []
    metadata: dict = {}


class ClassificationRequest(BaseModel):
    entity: EntityData


class AnomalyRequest(BaseModel):
    entity: EntityData
    include_contextual: bool = True


class ClassificationResponse(BaseModel):
    entity_id: str
    classification: str
    confidence: float
    reason: str
    anomaly_score: float = 0
    model_version: str
    timestamp: str


class AnomalyResponse(BaseModel):
    entity_id: str
    anomaly: bool
    confidence: float
    recommendation: str
    methods: dict
    timestamp: str


class HealthResponse(BaseModel):
    status: str
    timestamp: str
    agents_loaded: bool


# Dependency
def get_classifier():
    if classifier_agent is None:
        raise HTTPException(503, "Classifier agent not initialized")
    return classifier_agent


def get_anomaly_detector():
    if anomaly_detector is None:
        raise HTTPException(503, "Anomaly detector not initialized")
    return anomaly_detector


# Endpoints
@app.get("/", tags=["Root"])
async def root():
    return {
        "service": "SENTINEL-X AI Agents",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health():
    return HealthResponse(
        status="healthy",
        timestamp=datetime.now().isoformat(),
        agents_loaded=classifier_agent is not None
    )


@app.post("/v1/classify", response_model=ClassificationResponse, tags=["Classification"])
async def classify_entity(
    request: ClassificationRequest,
    agent: EntityClassifierAgent = Depends(get_classifier)
):
    """Classify an entity as normal, suspicious, or anomalous"""
    try:
        entity_dict = request.entity.model_dump()
        result = await agent.classify(entity_dict)
        
        return ClassificationResponse(
            entity_id=result.get("entity_id", "unknown"),
            classification=result.get("class", "unknown"),
            confidence=result.get("confidence", 0),
            reason=result.get("reason", ""),
            anomaly_score=result.get("anomaly_score", 0),
            model_version=result.get("model_version", "v1"),
            timestamp=datetime.now().isoformat()
        )
    except Exception as e:
        logger.error(f"Classification error: {e}")
        raise HTTPException(500, str(e))


@app.post("/v1/anomaly/detect", response_model=AnomalyResponse, tags=["Anomaly Detection"])
async def detect_anomaly(
    request: AnomalyRequest,
    agent: AnomalyDetectorAgent = Depends(get_anomaly_detector)
):
    """Detect anomalies using ensemble methods"""
    try:
        entity_dict = request.entity.model_dump()
        entity_id = entity_dict.get("entity_id", "unknown")
        
        result = await agent.detect_ensemble(entity_id, entity_dict)
        
        return AnomalyResponse(
            entity_id=result.get("entity_id", "unknown"),
            anomaly=result.get("anomaly", False),
            confidence=result.get("confidence", 0),
            recommendation=result.get("recommendation", ""),
            methods=result.get("methods", {}),
            timestamp=result.get("timestamp", datetime.now().isoformat())
        )
    except Exception as e:
        logger.error(f"Anomaly detection error: {e}")
        raise HTTPException(500, str(e))


@app.get("/v1/metrics", tags=["Metrics"])
async def get_metrics(
    agent: EntityClassifierAgent = Depends(get_classifier),
    anomaly: AnomalyDetectorAgent = Depends(get_anomaly_detector)
):
    """Get agent performance metrics"""
    return {
        "classifier": agent.get_metrics(),
        "anomaly_detector": anomaly.get_metrics(),
        "timestamp": datetime.now().isoformat()
    }


@app.post("/v1/feedback", tags=["Feedback"])
async def submit_feedback(
    prediction: str,
    actual: str,
    confidence: float,
    entity_id: str,
    features: dict,
    agent: EntityClassifierAgent = Depends(get_classifier)
):
    """Submit feedback to improve classifier"""
    try:
        from agents.classifier_agent import ClassificationFeedback
        
        feedback = ClassificationFeedback(
            prediction=prediction,
            actual=actual,
            confidence=confidence,
            entity_id=entity_id,
            features=features,
            feedback_type="correct" if prediction == actual else "incorrect"
        )
        
        result = await agent.process_feedback(feedback)
        
        return {
            "status": "success",
            "result": result
        }
    except Exception as e:
        logger.error(f"Feedback error: {e}")
        raise HTTPException(500, str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
