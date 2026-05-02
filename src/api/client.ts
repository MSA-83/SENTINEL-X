"""
SENTINEL-X Frontend API Integration
Connects React frontend to PostgreSQL backend + Groq AI
"""
import os
import asyncio
import json
from datetime import datetime, timedelta
from typing import Optional

class APIConfig:
    """API Configuration"""
    BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:8000")
    GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
    
    # Supabase config
    SUPABASE_URL = os.environ.get("SUPABASE_URL")
    SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
    
    @classmethod
    def get_headers(cls, token: Optional[str] = None) -> dict:
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        if cls.SUPABASE_KEY:
            headers["apikey"] = cls.SUPABASE_KEY
            headers["Authorization"] = f"Bearer {cls.SUPABASE_KEY}"
        if token:
            headers["Authorization"] = f"Bearer {token}"
        return headers


class ThreatAPI:
    """Threat Events API"""
    
    @staticmethod
    async def get_threats(
        severity: Optional[list] = None,
        time_range: Optional[int] = None,
        bounds: Optional[dict] = None,
        limit: int = 100,
    ) -> list:
        """Fetch threat events"""
        params = {"limit": limit}
        if severity:
            params["severity"] = ",".join(severity)
        if time_range:
            params["created_after"] = (datetime.utcnow() - timedelta(hours=time_range)).isoformat()
        if bounds:
            params["min_lat"] = bounds.get("min_lat")
            params["max_lat"] = bounds.get("max_lat")
            params["min_lng"] = bounds.get("min_lng")
            params["max_lng"] = bounds.get("max_lng")
        
        # If using Supabase
        if APIConfig.SUPABASE_URL:
            return await ThreatAPI._fetch_supabase("threat_events", params)
        
        return await ThreatAPI._fetch_api("/api/threats", params)
    
    @staticmethod
    async def get_threat(id: str) -> dict:
        """Get single threat"""
        if APIConfig.SUPABASE_URL:
            return await ThreatAPI._fetch_supabase("threat_events", {"id": id}, single=True)
        return await ThreatAPI._fetch_api(f"/api/threats/{id}")
    
    @staticmethod
    async def create_threat(data: dict, token: str) -> dict:
        """Create new threat"""
        if APIConfig.SUPABASE_URL:
            return await ThreatAPI._insert_supabase("threat_events", data, token)
        return await ThreatAPI._fetch_api("/api/threats", "POST", data, token)
    
    @staticmethod
    async def update_threat(id: str, data: dict, token: str) -> dict:
        """Update threat"""
        if APIConfig.SUPABASE_URL:
            return await ThreatAPI._update_supabase("threat_events", id, data, token)
        return await ThreatAPI._fetch_api(f"/api/threats/{id}", "PUT", data, token)
    
    @staticmethod
    async def _fetch_api(endpoint: str, params: dict = None) -> list:
        """Generic API fetch"""
        import aiohttp
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{APIConfig.BASE_URL}{endpoint}",
                params=params,
                headers=APIConfig.get_headers(),
            ) as resp:
                return await resp.json()
    
    @staticmethod
    async def _fetch_supabase(table: str, params: dict, single: bool = False) -> dict:
        """Supabase direct fetch"""
        import aiohttp
        url = f"{APIConfig.SUPABASE_URL}/rest/v1/{table}"
        if single:
            url += f"?id=eq.{params.get('id')}"
        else:
            filters = []
            for k, v in params.items():
                if k == "limit":
                    url += f"?limit={v}"
                else:
                    filters.append(f"{k}=eq.{v}")
            if filters:
                url += "&" + "&".join(filters)
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=APIConfig.get_headers()) as resp:
                data = await resp.json()
                return data[0] if single else data
    
    @staticmethod
    async def _insert_supabase(table: str, data: dict, token: str) -> dict:
        """Supabase insert"""
        import aiohttp
        url = f"{APIConfig.SUPABASE_URL}/rest/v1/{table}"
        async with aiohttp.ClientSession() as session:
            async with session.post(
                url,
                json=data,
                headers=APIConfig.get_headers(token),
            ) as resp:
                return await resp.json()
    
    @staticmethod
    async def _update_supabase(table: str, id: str, data: dict, token: str) -> dict:
        """Supabase update"""
        import aiohttp
        url = f"{APIConfig.SUPABASE_URL}/rest/v1/{table}?id=eq.{id}"
        async with aiohttp.ClientSession() as session:
            async with session.patch(
                url,
                json=data,
                headers=APIConfig.get_headers(token),
            ) as resp:
                return await resp.json()


class CaseAPI:
    """Case Management API"""
    
    @staticmethod
    async def get_cases(
        status: Optional[list] = None,
        assignee: Optional[str] = None,
        limit: int = 100,
    ) -> list:
        """Fetch cases"""
        params = {"limit": limit}
        if status:
            params["status"] = f"in.({','.join(status)})"
        if assignee:
            params["assigned_to"] = f"eq.{assignee}"
        
        if APIConfig.SUPABASE_URL:
            return await CaseAPI._fetch_supabase("cases", params)
        return await CaseAPI._fetch_api("/api/cases", params)
    
    @staticmethod
    async def get_case(id: str) -> dict:
        """Get single case"""
        if APIConfig.SUPABASE_URL:
            return await CaseAPI._fetch_supabase("cases", {"id": id}, single=True)
        return await CaseAPI._fetch_api(f"/api/cases/{id}")
    
    @staticmethod
    async def create_case(data: dict, token: str) -> dict:
        """Create new case"""
        if APIConfig.SUPABASE_URL:
            return await CaseAPI._insert_supabase("cases", data, token)
        return await CaseAPI._fetch_api("/api/cases", "POST", data, token)
    
    @staticmethod
    async def update_case(id: str, data: dict, token: str) -> dict:
        """Update case"""
        if APIConfig.SUPABASE_URL:
            return await CaseAPI._update_supabase("cases", id, data, token)
        return await CaseAPI._fetch_api(f"/api/cases/{id}", "PUT", data, token)
    
    @staticmethod
    async def add_note(case_id: str, content: str, token: str) -> dict:
        """Add note to case"""
        return await CaseAPI._insert_supabase("case_notes", {
            "case_id": case_id,
            "content": content,
        }, token)
    
    @staticmethod
    async def link_threat(case_id: str, threat_id: str, token: str) -> dict:
        """Link threat to case"""
        return await CaseAPI._insert_supabase("case_threats", {
            "case_id": case_id,
            "threat_id": threat_id,
        }, token)
    
    @staticmethod
    async def _fetch_api(endpoint: str, params: dict = None) -> list:
        import aiohttp
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{APIConfig.BASE_URL}{endpoint}",
                params=params,
                headers=APIConfig.get_headers(),
            ) as resp:
                return await resp.json()
    
    @staticmethod
    async def _fetch_supabase(table: str, params: dict, single: bool = False) -> dict:
        import aiohttp
        url = f"{APIConfig.SUPABASE_URL}/rest/v1/{table}"
        if single:
            url += f"?id=eq.{params.get('id')}"
        else:
            filters = []
            for k, v in params.items():
                if k == "limit":
                    url += f"?limit={v}"
                else:
                    filters.append(f"{k}={v}")
            if filters:
                url += "&" + "&".join(filters)
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=APIConfig.get_headers()) as resp:
                data = await resp.json()
                return data[0] if single else data
    
    @staticmethod
    async def _insert_supabase(table: str, data: dict, token: str) -> dict:
        import aiohttp
        url = f"{APIConfig.SUPABASE_URL}/rest/v1/{table}"
        async with aiohttp.ClientSession() as session:
            async with session.post(
                url,
                json=data,
                headers=APIConfig.get_headers(token),
            ) as resp:
                return await resp.json()
    
    @staticmethod
    async def _update_supabase(table: str, id: str, data: dict, token: str) -> dict:
        import aiohttp
        url = f"{APIConfig.SUPABASE_URL}/rest/v1/{table}?id=eq.{id}"
        async with aiohttp.ClientSession() as session:
            async with session.patch(
                url,
                json=data,
                headers=APIConfig.get_headers(token),
            ) as resp:
                return await resp.json()


class EntityAPI:
    """Entity Resolution API"""
    
    @staticmethod
    async def get_entities(
        entity_type: Optional[list] = None,
        risk_level: Optional[list] = None,
        limit: int = 100,
    ) -> list:
        """Fetch entities"""
        params = {"limit": limit}
        if entity_type:
            params["type"] = f"in.({','.join(entity_type)})"
        if risk_level:
            params["risk_level"] = f"in.({','.join(risk_level)})"
        
        if APIConfig.SUPABASE_URL:
            return await EntityAPI._fetch_supabase("entities", params)
        return await EntityAPI._fetch_api("/api/entities", params)
    
    @staticmethod
    async def get_entity(id: str) -> dict:
        """Get single entity"""
        if APIConfig.SUPABASE_URL:
            return await EntityAPI._fetch_supabase("entities", {"id": id}, single=True)
        return await EntityAPI._fetch_api(f"/api/entities/{id}")
    
    @staticmethod
    async def create_entity(data: dict, token: str) -> dict:
        """Create new entity"""
        if APIConfig.SUPABASE_URL:
            return await EntityAPI._insert_supabase("entities", data, token)
        return await EntityAPI._fetch_api("/api/entities", "POST", data, token)
    
    @staticmethod
    async def get_entity_history(entity_id: str) -> list:
        """Get entity activity history"""
        if APIConfig.SUPABASE_URL:
            params = {"entity_id": f"eq.{entity_id}", "order": "created_at.desc"}
            return await EntityAPI._fetch_supabase("entity_history", params)
        return await EntityAPI._fetch_api(f"/api/entities/{entity_id}/history")
    
    @staticmethod
    async def _fetch_api(endpoint: str, params: dict = None) -> list:
        import aiohttp
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{APIConfig.BASE_URL}{endpoint}",
                params=params,
                headers=APIConfig.get_headers(),
            ) as resp:
                return await resp.json()
    
    @staticmethod
    async def _fetch_supabase(table: str, params: dict, single: bool = False) -> dict:
        import aiohttp
        url = f"{APIConfig.SUPABASE_URL}/rest/v1/{table}"
        if single:
            url += f"?id=eq.{params.get('id')}"
        else:
            filters = []
            for k, v in params.items():
                if k == "limit":
                    url += f"?limit={v}"
                else:
                    filters.append(f"{k}={v}")
            if filters:
                url += "&" + "&".join(filters)
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=APIConfig.get_headers()) as resp:
                data = await resp.json()
                return data[0] if single else data
    
    @staticmethod
    async def _insert_supabase(table: str, data: dict, token: str) -> dict:
        import aiohttp
        url = f"{APIConfig.SUPABASE_URL}/rest/v1/{table}"
        async with aiohttp.ClientSession() as session:
            async with session.post(
                url,
                json=data,
                headers=APIConfig.get_headers(token),
            ) as resp:
                return await resp.json()


class AnalyticsAPI:
    """Analytics API"""
    
    @staticmethod
    async def get_stats(time_range: int = 24) -> dict:
        """Get threat statistics"""
        params = {"time_range": time_range}
        
        if APIConfig.SUPABASE_URL:
            return await AnalyticsAPI._fetch_stats_supabase(time_range)
        return await AnalyticsAPI._fetch_api("/api/analytics/stats", params)
    
    @staticmethod
    async def get_timeline(time_range: int = 24) -> list:
        """Get threat activity timeline"""
        if APIConfig.SUPABASE_URL:
            return await AnalyticsAPI._fetch_timeline_supabase(time_range)
        return await AnalyticsAPI._fetch_api("/api/analytics/timeline", {"time_range": time_range})
    
    @staticmethod
    async def get_hotspots(limit: int = 10) -> list:
        """Get top threat hotspots"""
        if APIConfig.SUPABASE_URL:
            return await AnalyticsAPI._fetch_hotspots_supabase(limit)
        return await AnalyticsAPI._fetch_api("/api/analytics/hotspots", {"limit": limit})
    
    @staticmethod
    async def get_patterns() -> list:
        """Get threat patterns"""
        if APIConfig.SUPABASE_URL:
            return await AnalyticsAPI._fetch_patterns_supabase()
        return await AnalyticsAPI._fetch_api("/api/analytics/patterns")
    
    @staticmethod
    async def _fetch_api(endpoint: str, params: dict = None) -> dict:
        import aiohttp
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{APIConfig.BASE_URL}{endpoint}",
                params=params,
                headers=APIConfig.get_headers(),
            ) as resp:
                return await resp.json()
    
    @staticmethod
    async def _fetch_stats_supabase(time_range: int) -> dict:
        import aiohttp
        url = f"{APIConfig.SUPABASE_URL}/rest/v1/rpc/get_threat_stats"
        async with aiohttp.ClientSession() as session:
            async with session.post(
                url,
                json={"p_time_range": time_range},
                headers=APIConfig.get_headers(),
            ) as resp:
                return await resp.json()
    
    @staticmethod
    async def _fetch_timeline_supabase(time_range: int) -> list:
        import aiohttp
        url = f"{APIConfig.SUPABASE_URL}/rest/v1/rpc/get_threat_timeline"
        async with aiohttp.ClientSession() as session:
            async with session.post(
                url,
                json={"p_time_range": time_range},
                headers=APIConfig.get_headers(),
            ) as resp:
                return await resp.json()
    
    @staticmethod
    async def _fetch_hotspots_supabase(limit: int) -> list:
        import aiohttp
        url = f"{APIConfig.SUPABASE_URL}/rest/v1/rpc/get_threat_hotspots"
        async with aiohttp.ClientSession() as session:
            async with session.post(
                url,
                json={"p_limit": limit},
                headers=APIConfig.get_headers(),
            ) as resp:
                return await resp.json()
    
    @staticmethod
    async def _fetch_patterns_supabase() -> list:
        import aiohttp
        url = f"{APIConfig.SUPABASE_URL}/rest/v1/rpc/get_threat_patterns"
        async with aiohttp.ClientSession() as session:
            async with session.post(
                url,
                json={},
                headers=APIConfig.get_headers(),
            ) as resp:
                return await resp.json()


class GroqAI:
    """Groq AI Integration"""
    
    @staticmethod
    async def query(prompt: str, context: Optional[dict] = None) -> str:
        """Send query to Groq"""
        if not APIConfig.GROQ_API_KEY:
            return "GROQ_API_KEY not configured"
        
        import aiohttp
        
        messages = [
            {
                "role": "system",
                "content": """You are SENTINEL-X AI Assistant, a threat intelligence analysis assistant.
You have access to:
- threat_events table: Contains all detected threats with severity, location, type
- entities table: Tracked aircraft, vessels, facilities with classification
- cases table: Investigation cases with status, priority, assignments
- analytics: Threat statistics and patterns

Provide actionable intelligence analysis. Be specific with numbers and recommendations."""
            }
        ]
        
        if context:
            messages.append({
                "role": "system",
                "content": f"Current context: {json.dumps(context)}"
            })
        
        messages.append({"role": "user", "content": prompt})
        
        url = "https://api.groq.com/openai/v1/chat/completions"
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                url,
                json={
                    "model": "mixtral-8x7b-32768",
                    "messages": messages,
                    "temperature": 0.3,
                    "max_tokens": 1024,
                },
                headers={
                    "Authorization": f"Bearer {APIConfig.GROQ_API_KEY}",
                    "Content-Type": "application/json",
                },
            ) as resp:
                if resp.status != 200:
                    return f"Error: {resp.status}"
                data = await resp.json()
                return data["choices"][0]["message"]["content"]
    
    @staticmethod
    async def analyze_threats(threats: list) -> str:
        """Analyze threats with AI"""
        critical = [t for t in threats if t.get("severity") == "critical"]
        high = [t for t in threats if t.get("severity") == "high"]
        
        prompt = f"""Analyze these threat statistics:
- Critical: {len(critical)}
- High: {len(high)}

Provide a brief intelligence assessment and recommendations."""
        
        return await GroqAI.query(prompt, {"threats": threats})


class RealtimeSSE:
    """Server-Sent Events for real-time updates"""
    
    @staticmethod
    async def stream_threats():
        """Stream threats via SSE"""
        import aiohttp
        
        if APIConfig.SUPABASE_URL:
            url = f"{APIConfig.SUPABASE_URL}/realtime/v1/realtime"
        else:
            url = f"{APIConfig.BASE_URL}/api/realtime/threats"
        
        async with aiohttp.ClientSession() as session:
            async with session.get(
                url,
                headers=APIConfig.get_headers(),
            ) as resp:
                async for line in resp.content:
                    if line:
                        yield line.decode()


async def main():
    """Demo usage"""
    # Get threats
    threats = await ThreatAPI.get_threats(severity=["critical", "high"], time_range=24)
    print(f"Found {len(threats)} threats")
    
    # Get cases
    cases = await CaseAPI.get_cases(status=["open", "in_progress"])
    print(f"Found {len(cases)} open cases")
    
    # Get entities
    entities = await EntityAPI.get_entities(entity_type=["aircraft", "vessel"])
    print(f"Found {len(entities)} entities")
    
    # Get analytics
    stats = await AnalyticsAPI.get_stats(time_range=24)
    print(f"Stats: {stats}")


if __name__ == "__main__":
    asyncio.run(main())