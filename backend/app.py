import os
import json
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, HTTPException, Depends, status
from pydantic import BaseModel
from supabase import create_client, Client
from groq import AsyncGroq
import redis.asyncio as aioredis
from sentence_transformers import SentenceTransformer

app = FastAPI(title="SENTINEL-X API", version="1.0.0")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

supabase: Optional[Client] = None
groq = AsyncGroq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None
redis = None
embedding_model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")


class ObservationIn(BaseModel):
    org_id: str
    domain: str
    domainkey: str
    lat: float
    lon: float
    speed: float = 0
    confidence: float = 1.0
    metadata: dict = {}


class VectorSearchIn(BaseModel):
    org_id: str
    query: str
    top_k: int = 5
    threshold: float = 0.7


class AnalyzeIn(BaseModel):
    observation_ids: list[str]
    question: str


class QueryOut(BaseModel):
    id: str
    org_id: str
    domain: str
    domainkey: str
    lat: float
    lon: float
    observed_at: datetime
    anomaly_score: float
    is_anomaly: bool


@app.on_event("startup")
async def init_clients():
    global supabase, redis
    if SUPABASE_URL and SUPABASE_KEY:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    if REDIS_URL:
        redis = await aioredis.from_url(REDIS_URL)


@app.post("/observations", response_model=QueryOut)
async def create_observation(obs: ObservationIn):
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase not configured")

    text = f"{obs.domain}:{obs.domainkey} lat={obs.lat} lon={obs.lon}"
    embedding = embedding_model.encode(text).tolist()

    data = {
        "org_id": obs.org_id,
        "domain": obs.domain,
        "domainkey": obs.domainkey,
        "lat": obs.lat,
        "lon": obs.lon,
        "speed": obs.speed,
        "confidence": obs.confidence,
        "embedding": embedding,
        "observed_at": datetime.utcnow().isoformat(),
    }

    result = supabase.table("ml_observations").insert(data).execute()
    return result.data[0]


@app.post("/vector-search")
async def vector_search(search: VectorSearchIn):
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase not configured")

    query_embedding = embedding_model.encode(search.query).tolist()

    response = supabase.rpc(
        "match_entity_vectors",
        {
            "query_embedding": query_embedding,
            "match_count": search.top_k,
            "match_threshold": search.threshold,
            "org_id": search.org_id,
        },
    ).execute()

    return {"results": response.data}


@app.post("/analyze")
async def analyze_group(req: AnalyzeIn):
    if not groq:
        raise HTTPException(status_code=503, detail="Groq not configured")

    observations = []
    for oid in req.observation_ids:
        result = supabase.table("ml_observations").select("*").eq("id", oid).execute()
        if result.data:
            observations.append(result.data[0])

    context = json.dumps(observations[:10], indent=2, default=str)

    chat_completion = await groq.chat.completions.create(
        messages=[
            {
                "role": "system",
                "content": "You are a defense analyst. Analyze these observations for anomalies, patterns, and threats.",
            },
            {
                "role": "user",
                "content": f"Analyze these observations:\n{context}\n\nQuestion: {req.question}",
            },
        ],
        model="llama-3.1-70b-versatile",
    )

    return {"analysis": chat_completion.choices[0].message.content}


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "supabase": supabase is not None,
        "groq": groq is not None,
        "redis": redis is not None,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)