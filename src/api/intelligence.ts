"""
SENTINEL-X AI Intelligence System
Groq-powered threat analysis with specialized prompts
"""
import os
import asyncio
import json
from datetime import datetime, timedelta
from typing import Optional

try:
    import aiohttp
    GROQ_AVAILABLE = True
except ImportError:
    GROQ_AVAILABLE = False


SYSTEM_PROMPT = """You are SENTINEL-X AI, an advanced threat intelligence analyst assistant.

## Capabilities
You have access to the SENTINEL-X threat intelligence platform and can:
1. Analyze threat patterns across multiple data sources
2. Track and correlate entities (aircraft, vessels, facilities, signals)
3. Generate actionable intelligence reports
4. Assist with case management and investigation
5. Perform geospatial threat analysis

## Intelligence Sources
- ADS-B: Aircraft position/identification data
- AIS: Maritime vessel tracking
- SIGINT: Electronic signals intelligence  
- OSINT: Open source intelligence
- GEOINT: Geospatial/imagery intelligence
- RADAR: Ground-based radar detection

## Threat Triage Protocol
When analyzing threats, always:
1. Identify severity (Critical/High/Medium/Low)
2. Determine urgency (immediate action required?)
3. Correlate with known entities/patterns
4. Provide specific recommendations
5. Link to relevant cases if applicable

## Response Format
Provide structured intelligence in this format:
### Assessment
[Brief summary of threat]
### Severity
[Critical/High/Medium/Low with justification]
### Recommended Actions
1. [Specific action]
2. [Specific action]
### Intel Links
[Any correlated entities or patterns]"""


THREAT_ANALYSIS_PROMPT = """Analyze the following threat data and provide intelligence assessment:

{threat_data}

Focus on:
1. Threat classification and intent
2. Geographic/temporal patterns
3. Entity correlation
4. Anomaly detection
5. Threat evolution prediction"""


PATTERN_ANALYSIS_PROMPT = """Analyze recent threat patterns from the last {time_range} hours:

{pattern_data}

Identify:
1. Emerging threats
2. Geographic hotspots
3. TTP (Tactics, Techniques, Procedures) evolution
4. Actor correlation
5. Strategic implications"""


ENTITY_ANALYSIS_PROMPT = """Analyze the following tracked entity:

{entity_data}

Provide:
1. Identity assessment
2. Behavioral analysis
3. Risk scoring
4. Movement prediction
5. Link to known actors/operations"""


CASE_ANALYSIS_PROMPT = """Analyze case #{case_id}: {case_title}

Current status: {status}
Priority: {priority}
Linked entities: {linked_entities}

Provide:
1. Investigation progress assessment
2. Critical gaps analysis
3. Recommended next steps
4. Resource prioritization"""


INTELLIGENCE_REPORT_PROMPT = """Generate a structured intelligence report for the following period:

Period: {start_date} to {end_date}
Region: {region}
Threat Types: {threat_types}

Include:
1. Executive Summary
2. Threat Landscape Overview
3. Key Events
4. Patterns & Trends
5. Emerging Threats
6. Recommendations"""


class GroqIntelligence:
    """Groq AI for threat intelligence"""
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.environ.get("GROQ_API_KEY")
        self.model = "mixtral-8x7b-32768"
        self.url = "https://api.groq.com/openai/v1/chat/completions"
    
    async def _send_request(self, messages: list, temperature: float = 0.3) -> Optional[str]:
        """Send request to Groq API"""
        if not self.api_key or not GROQ_AVAILABLE:
            return None
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                self.url,
                json={
                    "model": self.model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": 2048,
                },
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
            ) as resp:
                if resp.status != 200:
                    error = await resp.text()
                    raise Exception(f"Groq API error: {error}")
                data = await resp.json()
                return data["choices"][0]["message"]["content"]
    
    async def analyze_threat(
        self,
        threat_data: dict,
        context: Optional[dict] = None
    ) -> str:
        """Analyze a single threat"""
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "system", "content": f"Context: {json.dumps(context)}" if context else ""},
            {"role": "user", "content": THREAT_ANALYSIS_PROMPT.format(threat_data=json.dumps(threat_data, indent=2))},
        ]
        return await self._send_request(messages)
    
    async def analyze_patterns(
        self,
        pattern_data: list,
        time_range: int = 24
    ) -> str:
        """Analyze threat patterns"""
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": PATTERN_ANALYSIS_PROMPT.format(
                time_range=time_range,
                pattern_data=json.dumps(pattern_data[:50], indent=2)
            )},
        ]
        return await self._send_request(messages)
    
    async def analyze_entity(
        self,
        entity_data: dict,
        history: Optional[list] = None
    ) -> str:
        """Analyze tracked entity"""
        context = {"history": history} if history else None
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "system", "content": f"Context: {json.dumps(context)}" if context else ""},
            {"role": "user", "content": ENTITY_ANALYSIS_PROMPT.format(entity_data=json.dumps(entity_data, indent=2))},
        ]
        return await self._send_request(messages)
    
    async def analyze_case(
        self,
        case_data: dict,
        linked_entities: list
    ) -> str:
        """Analyze case for investigation guidance"""
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": CASE_ANALYSIS_PROMPT.format(
                case_id=case_data.get("id"),
                case_title=case_data.get("title"),
                status=case_data.get("status"),
                priority=case_data.get("priority"),
                linked_entities=json.dumps(linked_entities, indent=2),
            )},
        ]
        return await self._send_request(messages)
    
    async def generate_report(
        self,
        start_date: datetime,
        end_date: datetime,
        region: str = "Global",
        threat_types: list = None
    ) -> str:
        """Generate intelligence report"""
        threat_types = threat_types or ["all"]
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": INTELLIGENCE_REPORT_PROMPT.format(
                start_date=start_date.isoformat(),
                end_date=end_date.isoformat(),
                region=region,
                threat_types=", ".join(threat_types),
            )},
        ]
        return await self._send_request(messages, temperature=0.5)
    
    async def chat(
        self,
        message: str,
        history: list = None,
        context: Optional[dict] = None
    ) -> str:
        """General chat with context"""
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        
        if context:
            messages.append({
                "role": "system", 
                "content": f"Current Platform State:\n{json.dumps(context, indent=2)}"
            })
        
        if history:
            for msg in history[-10:]:
                messages.append({
                    "role": msg["role"],
                    "content": msg["content"]
                })
        
        messages.append({"role": "user", "content": message})
        
        return await self._send_request(messages)


class ThreatCorrelator:
    """AI-powered threat correlation"""
    
    def __init__(self, groq: GroqIntelligence):
        self.groq = groq
    
    async def correlate_threats(self, threats: list) -> dict:
        """Find correlations between threats"""
        if len(threats) < 2:
            return {"correlations": [], "clusters": []}
        
        prompt = f"""Analyze these {len(threats)} threats and find correlations:

{json.dumps(threats[:20], indent=2)}

Identify:
1. Spatial clusters (geographic proximity)
2. Temporal patterns (time-based)
3. Entity links (shared entities)
4. TTP matches (similar tactics)

Return JSON with:
{{
  "clusters": [{{"center": [lat,lng], "threat_ids": [], "type": ""}}],
  "correlations": [{{"threat_id_1": "", "threat_id_2": "", "type": ""}}],
  "summary": ""
}}"""
        
        messages = [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": prompt}]
        result = await self.groq._send_request(messages)
        
        if result:
            try:
                return json.loads(result)
            except json.JSONDecodeError:
                return {"correlations": [], "clusters": [], "summary": result}
        
        return {"correlations": [], "clusters": [], "summary": ""}
    
    async def predict_threats(
        self,
        historical_threats: list,
        region: str = None
    ) -> list:
        """Predict future threats based on patterns"""
        prompt = f"""Based on historical threat data, predict likely future threats:

Historical Data ({len(historical_threats)} events):
{json.dumps(historical_threats[-50:], indent=2)}

{f"Target Region: {region}" if region else ""}

Predict:
1. Likely locations (coordinates)
2. Likely times
3. Likely threat types
4. Confidence scores

Return JSON array of predictions:
[{{"location": {{"lat": 0, "lng": 0}}, "time_window": "", "type": "", "confidence": 0.0}}]"""
        
        messages = [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": prompt}]
        result = await self.groq._send_request(messages)
        
        if result:
            try:
                return json.loads(result)
            except json.JSONDecodeError:
                return []
        
        return []


class IntelGenerator:
    """Intelligence report generation"""
    
    def __init__(self, groq: GroqIntelligence):
        self.groq = groq
    
    async def daily_brief(self, threats: list, date: datetime) -> str:
        """Generate daily intelligence brief"""
        critical = [t for t in threats if t.get("severity") == "critical"]
        high = [t for t in threats if t.get("severity") == "high"]
        
        prompt = f"""Generate daily intelligence brief for {date.strftime('%Y-%m-%d')}.

Summary Statistics:
- Total Threats: {len(threats)}
- Critical: {len(critical)}
- High: {len(high)}

Format as:
### DAILY THREAT BRIEF - {date.strftime('%Y-%m-%d')}

#### Executive Summary
[2-3 sentences on overall threat landscape]

#### Critical Incidents
{[f"- {t.get('title', 'Unknown')}" for t in critical[:5]]}

#### Areas of Concern
[Top 3 geographic areas with elevated threat activity]

#### Recommendations
1. [Priority action]
2. [Priority action]

#### Notable Trends
[Any significant changes from previous periods]"""
        
        messages = [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": prompt}]
        return await self.groq._send_request(messages)
    
    async def watchlist_report(self, entities: list) -> str:
        """Generate entity watchlist report"""
        aircraft = [e for e in entities if e.get("type") == "aircraft"]
        vessels = [e for e in entities if e.get("type") == "vessel"]
        
        prompt = f"""Generate entity watchlist report:

Aircraft of Interest: {len(aircraft)}
- {chr(10).join([f"- {a.get('name')} ({a.get('callsign', 'N/A')}) - {a.get('risk_level')}" for a in aircraft[:5]])}

Vessels of Interest: {len(vessels)}
- {chr(10).join([f"- {v.get('name')} ({v.get('callsign', 'N/A')}) - {v.get('risk_level')}" for v in vessels[:5]])}

Provide:
1. Priority watchlist (top 5 entities)
2. Behavioral concerns
3. Recommended tracking actions"""
        
        messages = [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": prompt}]
        return await self.groq._send_request(messages)


async def main():
    """Demo"""
    groq = GroqIntelligence()
    
    test_threat = {
        "id": "TEST-001",
        "title": "Unknown Aircraft Incursion",
        "severity": "critical",
        "location": {"lat": 34.0522, "lng": -118.2437},
        "type": "aircraft_incursion",
    }
    
    result = await groq.analyze_threat(test_threat)
    print("Threat Analysis:")
    print(result)
    
    result = await groq.chat("What's the current threat landscape?")
    print("\nChat Response:")
    print(result)


if __name__ == "__main__":
    asyncio.run(main())