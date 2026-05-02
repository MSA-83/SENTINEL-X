#!/usr/bin/env python3
"""
SENTINEL-X Free Data Collection Pipeline
Collects free training data from OpenSky, GitHub, and MITRE ATT&CK
"""
import os
import asyncio
import json
import random
import logging
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from typing import Optional
from pathlib import Path

import aiohttp
import requests

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


# === DATA SOURCE CONFIG ===
OPENSKY_API_URL = "https://opensky-network.org/api"
GITHUB_API_URL = "https://api.github.com"
MITRE_ATTACK_URL = "https://attackcti.enterprise.mitre.org"

# === DATA CLASSES ===
@dataclass
class FlightData:
    """ADS-B flight data"""
    icao24: str
    callsign: str
    origin_country: str
    latitude: float
    longitude: float
    altitude: float
    velocity: float
    heading: float
    timestamp: int


@dataclass
class ThreatIntel:
    """Threat intelligence"""
    source: str
    title: str
    description: str
    severity: str
    tactics: list = field(default_factory=list)
    techniques: list = field(default_factory=list)
    metadata: dict = field(default_factory=dict)


@dataclass
class TrainingSample:
    """ML training sample"""
    features: dict
    label: int
    source: str
    threat_type: Optional[str] = None


# === OPENSKY COLLECTOR ===
class OpenSkyCollector:
    """Collect ADS-B flight data from OpenSky Network"""
    
    def __init__(self):
        self.timeout = aiohttp.ClientTimeout(total=30)
    
    async def get_flights_in_bounds(
        self,
        lamin: float = 25.0,
        lomin: float = -130.0,
        lamax: float = 55.0,
        lomax: float = 30.0,
    ) -> list[FlightData]:
        """Get flights in bounding box"""
        url = f"{OPENSKY_API_URL}/states/all"
        params = {
            "lamin": lamin,
            "lomin": lomin,
            "lamax": lamax,
            "lomax": lomax,
        }
        
        try:
            async with aiohttp.ClientSession(timeout=self.timeout) as session:
                async with session.get(url, params=params) as resp:
                    if resp.status != 200:
                        logger.error(f"OpenSky API error: {resp.status}")
                        return []
                    
                    data = await resp.json()
                    states = data.get("states", [])
                    
                    flights = []
                    for state in states:
                        if state:
                            flight = FlightData(
                                icao24=state[0] if len(state) > 0 else "",
                                callsign=state[1].strip() if len(state) > 1 and state[1] else "",
                                origin_country=state[2] if len(state) > 2 else "",
                                latitude=state[3] if len(state) > 3 and state[3] else 0,
                                longitude=state[4] if len(state) > 4 and state[4] else 0,
                                altitude=state[5] if len(state) > 5 and state[5] else 0,
                                velocity=state[6] if len(state) > 6 and state[6] else 0,
                                heading=state[7] if len(state) > 7 and state[7] else 0,
                                timestamp=state[8] if len(state) > 8 and state[8] else 0,
                            )
                            flights.append(flight)
                    
                    logger.info(f"Collected {len(flights)} flights from OpenSky")
                    return flights
        except Exception as e:
            logger.error(f"Error collecting OpenSky data: {e}")
            return []
    
    async def get_all_europe(self) -> list[FlightData]:
        """Get all European flights"""
        return await self.get_flights_in_bounds(
            lamin=35.0, lomin=-15.0, lamax=70.0, lomax=35.0
        )
    
    async def get_all_americas(self) -> list[FlightData]:
        """Get Americas flights"""
        return await self.get_flights_in_bounds(
            lamin=15.0, lomin=-170.0, lamax=75.0, lomax=-50.0
        )
    
    def flights_to_training_data(self, flights: list[FlightData]) -> list[TrainingSample]:
        """Convert flights to ML training data"""
        samples = []
        
        for flight in flights:
            features = {
                "altitude": flight.altitude,
                "velocity": flight.velocity,
                "heading": flight.heading,
                "is_military": 1 if self._is_military(flight.callsign) else 0,
                "is_commercial": 1 if flight.callsign else 0,
                "altitude_bin": self._altitude_bin(flight.altitude),
                "speed_bin": self._speed_bin(flight.velocity),
            }
            
            # Label: unknown callsign = potential threat
            label = 1 if not flight.callsign or flight.callsign.startswith("_") else 0
            
            samples.append(TrainingSample(
                features=features,
                label=label,
                source="opensky",
                threat_type="aircraft_incursion",
            ))
        
        return samples
    
    def _is_military(self, callsign: str) -> bool:
        """Check if callsign is military"""
        military_prefixes = ["MIL", "RAF", "USAF", "NATO", "AF"]
        return any(callsign.startswith(p) for p in military_prefixes)
    
    def _altitude_bin(self, alt: float) -> int:
        if alt < 1000: return 0
        if alt < 5000: return 1
        if alt < 10000: return 2
        if alt < 20000: return 3
        return 4
    
    def _speed_bin(self, speed: float) -> int:
        if speed < 100: return 0
        if speed < 300: return 1
        if speed < 500: return 2
        if speed < 800: return 3
        return 4


# === GITHUB COLLECTOR ===
class GitHubCollector:
    """Collect threat intelligence from GitHub"""
    
    def __init__(self, token: Optional[str] = None):
        self.token = token or os.environ.get("GITHUB_TOKEN")
        self.headers = {
            "Accept": "application/vnd.github.v3+json",
        }
        if self.token:
            self.headers["Authorization"] = f"token {self.token}"
    
    def get_emergency_events(self) -> list[ThreatIntel]:
        """Get emergency events from official sources"""
        events = []
        
        repos = [
            "CSSEGISandData/COVID-19",
            "OWASP/CheatSheetSeries",
            "mitre/cti",
            "threatgrid/threat-intel",
        ]
        
        for repo in repos:
            try:
                url = f"{GITHUB_API_URL}/repos/{repo}/events"
                resp = requests.get(url, headers=self.headers, timeout=10)
                
                if resp.status_code == 200:
                    data = resp.json()
                    for event in data[:10]:
                        event_type = event.get("type", "")
                        
                        if event_type in ["IssuesEvent", "PushEvent"]:
                            intel = ThreatIntel(
                                source="github",
                                title=f"{repo}: {event_type}",
                                description=event.get("actor", {}).get("login", ""),
                                severity="medium",
                                metadata={"repo": repo, "event": event_type},
                            )
                            events.append(intel)
            except Exception as e:
                logger.error(f"Error collecting from {repo}: {e}")
        
        logger.info(f"Collected {len(events)} events from GitHub")
        return events
    
    def get_mitre_techniques(self) -> list[ThreatIntel]:
        """Get MITRE ATT&CK techniques"""
        techniques = []
        
        try:
            # Use MITRE ATT&CK STIX data
            url = f"{MITRE_ATTACK_URL}/attack_search/package.json"
            resp = requests.get(url, timeout=30)
            
            if resp.status_code == 200:
                data = resp.json()
                objects = data.get("objects", [])
                
                for obj in objects:
                    if obj.get("type") == "attack-pattern":
                        name = obj.get("name", "")
                        external = obj.get("external_references", [])
                        
                        severity = "high"
                        if any(x.get("source_name") == "mitre-attack" for x in external):
                            severity = "medium"
                        
                        intel = ThreatIntel(
                            source="mitre",
                            title=name,
                            description=obj.get("description", ""),
                            severity=severity,
                            metadata={"id": obj.get("id")},
                        )
                        techniques.append(intel)
        except Exception as e:
            logger.error(f"Error collecting MITRE data: {e}")
        
        # Fallback: use known techniques
        known_techniques = [
            {"name": "T1566 - Phishing", "severity": "high"},
            {"name": "T1059 - Command and Scripting Interpreter", "severity": "high"},
            {"name": "T1003 - OS Credential Dumping", "severity": "critical"},
            {"name": "T1486 - Data Encrypted for Impact", "severity": "critical"},
            {"name": "T1053 - Scheduled Task/Job", "severity": "medium"},
            {"name": "T1021 - Remote Services", "severity": "high"},
        ]
        
        for tech in known_techniques:
            techniques.append(ThreatIntel(
                source="mitre", 
                title=tech["name"],
                description=f"MITRE ATT&CK technique",
                severity=tech["severity"],
            ))
        
        logger.info(f"Collected {len(techniques)} techniques from MITRE")
        return techniques
    
    def intel_to_training_data(self, intel_list: list[ThreatIntel]) -> list[TrainingSample]:
        """Convert threat intel to ML training data"""
        samples = []
        
        severity_map = {"low": 0, "medium": 1, "high": 2, "critical": 3}
        
        for intel in intel_list:
            features = {
                "source": intel.source,
                "has_tactics": len(intel.tactics) > 0,
                "has_techniques": len(intel.techniques) > 0,
                "severity_score": severity_map.get(intel.severity, 0),
            }
            
            label = 1 if intel.severity in ["high", "critical"] else 0
            
            samples.append(TrainingSample(
                features=features,
                label=label,
                source=intel.source,
            ))
        
        return samples


# === SYNTHETIC DATA GENERATOR ===
class SyntheticDataGenerator:
    """Generate synthetic threat training data"""
    
    REGIONS = [
        {"name": "Eastern Mediterranean", "lat": 35.0, "lng": 32.0},
        {"name": "South China Sea", "lat": 15.0, "lng": 120.0},
        {"name": "Baltic Sea", "lat": 55.0, "lng": 15.0},
        {"name": "Persian Gulf", "lat": 27.0, "lng": 52.0},
        {"name": "Caribbean", "lat": 20.0, "lng": -75.0},
    ]
    
    THREAT_TYPES = [
        "aircraft_incursion",
        "vessel_incident",
        "ais_spoofing",
        "gps_jamming",
        "comms_intercept",
    ]
    
    def generate_aircraft_threats(self, count: int = 100) -> list[TrainingSample]:
        """Generate synthetic aircraft threat data"""
        samples = []
        
        for _ in range(count):
            region = random.choice(self.REGIONS)
            
            features = {
                "latitude": region["lat"] + random.uniform(-2, 2),
                "longitude": region["lng"] + random.uniform(-2, 2),
                "altitude": random.uniform(0, 15000),
                "velocity": random.uniform(0, 800),
                "heading": random.uniform(0, 360),
                "no_callsign": random.choice([True, False]),
                "high_altitude": random.choice([True, False]),
                "high_speed": random.choice([True, False]),
            }
            
            # Label based on anomalies
            label = 0
            if features["no_callsign"]:
                label = 1
            elif features["high_altitude"] and features["high_speed"]:
                label = 1
            
            samples.append(TrainingSample(
                features=features,
                label=label,
                source="synthetic",
                threat_type="aircraft_incursion",
            ))
        
        return samples
    
    def generate_vessel_threats(self, count: int = 50) -> list[TrainingSample]:
        """Generate synthetic vessel threat data"""
        samples = []
        
        for _ in range(count):
            region = random.choice(self.REGIONS)
            
            features = {
                "latitude": region["lat"] + random.uniform(-2, 2),
                "longitude": region["lng"] + random.uniform(-2, 2),
                "speed": random.uniform(0, 30),
                "heading_change": random.uniform(0, 180),
                "ais_mismatch": random.choice([True, False]),
            }
            
            label = 1 if features["ais_mismatch"] else 0
            
            samples.append(TrainingSample(
                features=features,
                label=label,
                source="synthetic",
                threat_type="vessel_incident",
            ))
        
        return samples
    
    def generate_signal_threats(self, count: int = 50) -> list[TrainingSample]:
        """Generate synthetic signal threat data"""
        samples = []
        
        for _ in range(count):
            region = random.choice(self.REGIONS)
            
            features = {
                "latitude": region["lat"] + random.uniform(-2, 2),
                "longitude": region["lng"] + random.uniform(-2, 2),
                "frequency": random.uniform(1, 30),  # GHz
                "signal_strength": random.uniform(-120, -30),
                "encrypted": random.choice([True, False]),
            }
            
            label = 1 if features["signal_strength"] > -50 else 0
            
            samples.append(TrainingSample(
                features=features,
                label=label,
                source="synthetic",
                threat_type="comms_intercept",
            ))
        
        return samples


# === MAIN PIPELINE ===
class DataCollectionPipeline:
    """Main data collection pipeline"""
    
    def __init__(self, output_dir: str = "./data"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        
        self.opensky = OpenSkyCollector()
        self.github = GitHubCollector()
        self.synthetic = SyntheticDataGenerator()
    
    async def collect_opensky(self, region: str = "europe") -> list[TrainingSample]:
        """Collect from OpenSky"""
        if region == "europe":
            flights = await self.opensky.get_all_europe()
        else:
            flights = await self.opensky.get_all_americas()
        
        return self.opensky.flights_to_training_data(flights)
    
    def collect_github(self) -> list[TrainingSample]:
        """Collect from GitHub"""
        events = self.github.get_emergency_events()
        return self.github.intel_to_training_data(events)
    
    def collect_mitre(self) -> list[TrainingSample]:
        """Collect from MITRE"""
        techniques = self.github.get_mitre_techniques()
        return self.github.intel_to_training_data(techniques)
    
    def generate_synthetic(self) -> list[TrainingSample]:
        """Generate synthetic data"""
        samples = []
        samples.extend(self.synthetic.generate_aircraft_threats(100))
        samples.extend(self.synthetic.generate_vessel_threats(50))
        samples.extend(self.synthetic.generate_signal_threats(50))
        return samples
    
    async def run_full_collection(self) -> dict:
        """Run full pipeline"""
        results = {"sources": {}, "total": 0}
        
        # Collect from all sources
        logger.info("Collecting from OpenSky...")
        opensky_samples = await self.collect_opensky()
        results["sources"]["opensky"] = len(opensky_samples)
        
        logger.info("Collecting from GitHub...")
        github_samples = self.collect_github()
        results["sources"]["github"] = len(github_samples)
        
        logger.info("Collecting from MITRE...")
        mitre_samples = self.collect_mitre()
        results["sources"]["mitre"] = len(mitre_samples)
        
        logger.info("Generating synthetic data...")
        synthetic_samples = self.generate_synthetic()
        results["sources"]["synthetic"] = len(synthetic_samples)
        
        # Combine all samples
        all_samples = (
            opensky_samples + 
            github_samples + 
            mitre_samples + 
            synthetic_samples
        )
        results["total"] = len(all_samples)
        
        # Save to file
        output_file = self.output_dir / f"training_data_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        with open(output_file, "w") as f:
            json.dump([
                {
                    "features": s.features,
                    "label": s.label,
                    "source": s.source,
                    "threat_type": s.threat_type,
                }
                for s in all_samples
            ], f, indent=2)
        
        logger.info(f"Saved {len(all_samples)} samples to {output_file}")
        
        # Also save summary
        results["output_file"] = str(output_file)
        
        return results


async def main():
    """Main entry point"""
    pipeline = DataCollectionPipeline()
    
    results = await pipeline.run_full_collection()
    
    print(f"\n=== Collection Complete ===")
    print(f"Total samples: {results['total']}")
    for source, count in results["sources"].items():
        print(f"  {source}: {count}")
    print(f"Output: {results['output_file']}")


if __name__ == "__main__":
    asyncio.run(main())