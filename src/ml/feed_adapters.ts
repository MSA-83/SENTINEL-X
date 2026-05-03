"""
SENTINEL-X Feed Adapters
Data ingestion from various threat intel sources
"""
import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Optional, Any, Callable
from dataclasses import dataclass, field
from enum import Enum

import aiohttp

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class FeedStatus(str, Enum):
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    ERROR = "error"
    PROCESSING = "processing"


@dataclass
class FeedConfig:
    name: str
    url: str
    auth_type: str = "none"  # none, api_key, basic, oauth
    auth_token: Optional[str] = None
    poll_interval: int = 60  # seconds
    enabled: bool = True


@dataclass
class FeedEvent:
    source: str
    event_type: str
    title: str
    description: str
    severity: str
    location: dict
    timestamp: datetime
    raw_data: dict = field(default_factory=dict)


class BaseFeedAdapter:
    """Base feed adapter"""
    
    def __init__(self, config: FeedConfig):
        self.config = config
        self.status = FeedStatus.DISCONNECTED
        self.last_event_time: Optional[datetime] = None
        self.events_processed: int = 0
    
    async def connect(self) -> bool:
        """Connect to feed"""
        raise NotImplementedError
    
    async def disconnect(self):
        """Disconnect from feed"""
        pass
    
    async def fetch_events(self) -> list[FeedEvent]:
        """Fetch new events"""
        raise NotImplementedError
    
    async def on_event(self, event: FeedEvent, callback: Callable):
        """Process new event"""
        await callback(event)
        self.events_processed += 1
        self.last_event_time = event.timestamp


class OpenSkyAdapter(BaseFeedAdapter):
    """OpenSky Network ADS-B adapter"""
    
    def __init__(self, config: FeedConfig):
        super().__init__(config)
        self.session: Optional[aiohttp.ClientSession] = None
    
    async def connect(self) -> bool:
        """Connect to OpenSky"""
        try:
            self.session = aiohttp.ClientSession()
            self.status = FeedStatus.CONNECTED
            logger.info(f"Connected to OpenSky: {self.config.name}")
            return True
        except Exception as e:
            logger.error(f"OpenSky connection failed: {e}")
            self.status = FeedStatus.ERROR
            return False
    
    async def disconnect(self):
        """Disconnect"""
        if self.session:
            await self.session.close()
            self.status = FeedStatus.DISCONNECTED
    
    async def fetch_events(self) -> list[FeedEvent]:
        """Fetch OpenSky states"""
        if not self.session:
            return []
        
        events = []
        try:
            # Get all states in a bounding box
            params = {
                "lamin": 25.0,
                "lomin": -130.0,
                "lamax": 55.0,
                "lomax": 30.0,
            }
            
            async with self.session.get(
                "https://opensky-network.org/api/states/all",
                params=params,
            ) as resp:
                if resp.status != 200:
                    return []
                
                data = await resp.json()
                states = data.get("states", [])
                
                # Filter for interesting aircraft
                for state in states:
                    if not state or len(state) < 10:
                        continue
                    
                    icao24 = state[0]
                    callsign = state[1].strip() if state[1] else ""
                    country = state[2]
                    lat = state[3]
                    lon = state[4]
                    
                    # Skip commercial flights
                    if callsign and not callsign.startswith("_"):
                        continue
                    
                    # Create event for unknown callsigns
                    if lat and lon:
                        event = FeedEvent(
                            source="opensky",
                            event_type="aircraft_detected",
                            title=f"Unknown Aircraft: {icao24}",
                            description=f"Aircraft {icao24} from {country} with no callsign",
                            severity="medium",
                            location={"lat": lat, "lng": lon},
                            timestamp=datetime.utcnow(),
                            raw_data={"icao24": icao24, "callsign": callsign},
                        )
                        events.append(event)
                
                logger.info(f"OpenSky: {len(events)} events")
        except Exception as e:
            logger.error(f"OpenSky fetch error: {e}")
        
        return events


class AISAdapter(BaseFeedAdapter):
    """AIS maritime adapter"""
    
    def __init__(self, config: FeedConfig):
        super().__init__(config)
        self.session: Optional[aiohttp.ClientSession] = None
    
    async def connect(self) -> bool:
        """Connect to AIS feed"""
        try:
            self.session = aiohttp.ClientSession()
            self.status = FeedStatus.CONNECTED
            logger.info(f"Connected to AIS: {self.config.name}")
            return True
        except Exception as e:
            logger.error(f"AIS connection failed: {e}")
            self.status = FeedStatus.ERROR
            return False
    
    async def fetch_events(self) -> list[FeedEvent]:
        """Fetch AIS vessels"""
        if not self.session:
            return []
        
        events = []
        
        try:
            # Use MarineTraffic API (or similar)
            async with self.session.get(
                "https://api.marinetraffic.com/api/v1/rta",
                params={
                    "key": self.config.auth_token,
                    "msg_type": "A",
                },
            ) as resp:
                if resp.status != 200:
                    return []
                
                data = await resp.json()
                vessels = data.get("data", [])
                
                for vessel in vessels:
                    # Look for anomalies
                    if vessel.get("SOG", 0) > 30:  # High speed
                        event = FeedEvent(
                            source="ais",
                            event_type="high_speed_vessel",
                            title=f"High Speed Vessel: {vessel.get('MMSI')}",
                            description=f"Vessel {vessel.get('MMSI')} travelling at {vessel.get('SOG')} knots",
                            severity="high",
                            location={
                                "lat": vessel.get("LAT"),
                                "lng": vessel.get("LON"),
                            },
                            timestamp=datetime.utcnow(),
                            raw_data=vessel,
                        )
                        events.append(event)
        except Exception as e:
            logger.error(f"AIS fetch error: {e}")
        
        return events


class FeedManager:
    """Manage multiple feed adapters"""
    
    def __init__(self):
        self.adapters: dict[str, BaseFeedAdapter] = {}
        self.running = False
        self.tasks: list[asyncio.Task] = []
    
    def register_adapter(self, name: str, adapter: BaseFeedAdapter):
        """Register a feed adapter"""
        self.adapters[name] = adapter
        logger.info(f"Registered adapter: {name}")
    
    async def start(self, callback: Callable[[FeedEvent], Any]):
        """Start all adapters"""
        self.running = True
        
        for name, adapter in self.adapters.items():
            if adapter.config.enabled:
                connected = await adapter.connect()
                if connected:
                    # Start polling
                    task = asyncio.create_task(
                        self._poll_adapter(name, adapter, callback)
                    )
                    self.tasks.append(task)
        
        logger.info(f"Started {len(self.tasks)} feed adapters")
    
    async def _poll_adapter(
        self,
        name: str,
        adapter: BaseFeedAdapter,
        callback: Callable[[FeedEvent], Any],
    ):
        """Poll adapter for events"""
        while self.running:
            try:
                adapter.status = FeedStatus.PROCESSING
                events = await adapter.fetch_events()
                
                for event in events:
                    await adapter.on_event(event, callback)
                
                await asyncio.sleep(adapter.config.poll_interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Adapter {name} error: {e}")
                await asyncio.sleep(adapter.config.poll_interval * 2)
    
    async def stop(self):
        """Stop all adapters"""
        self.running = False
        
        for task in self.tasks:
            task.cancel()
        
        for adapter in self.adapters.values():
            await adapter.disconnect()
        
        self.tasks.clear()
        logger.info("Stopped all feed adapters")


class FeedProcessor:
    """Process and normalize feed events"""
    
    def __init__(self):
        self.transformers: dict = {
            "opensky": self._transform_opensky,
            "ais": self._transform_ais,
            "sigint": self._transform_sigint,
            "radar": self._transform_radar,
        }
    
    def process_event(self, event: FeedEvent) -> dict:
        """Process and normalize event"""
        transformer = self.transformers.get(event.source, self._transform_default)
        return transformer(event)
    
    def _transform_opensky(self, event: FeedEvent) -> dict:
        """Transform OpenSky event"""
        return {
            "title": event.title,
            "description": event.description,
            "severity": event.severity,
            "threat_type": "aircraft_incursion",
            "location": event.location,
            "source": "ads_b",
            "metadata": {
                "icao24": event.raw_data.get("icao24"),
                "callsign": event.raw_data.get("callsign"),
            },
        }
    
    def _transform_ais(self, event: FeedEvent) -> dict:
        """Transform AIS event"""
        return {
            "title": event.title,
            "description": event.description,
            "severity": event.severity,
            "threat_type": "vessel_incident",
            "location": event.location,
            "source": "ais",
            "metadata": {
                "mmsi": event.raw_data.get("MMSI"),
                "sog": event.raw_data.get("SOG"),
            },
        }
    
    def _transform_sigint(self, event: FeedEvent) -> dict:
        """Transform SIGINT event"""
        return {
            "title": event.title,
            "description": event.description,
            "severity": event.severity,
            "threat_type": "comms_intercept",
            "location": event.location,
            "source": "sigint",
            "metadata": event.raw_data,
        }
    
    def _transform_radar(self, event: FeedEvent) -> dict:
        """Transform radar event"""
        return {
            "title": event.title,
            "description": event.description,
            "severity": event.severity,
            "threat_type": "radar_jamming",
            "location": event.location,
            "source": "radar",
            "metadata": event.raw_data,
        }
    
    def _transform_default(self, event: FeedEvent) -> dict:
        """Default transform"""
        return {
            "title": event.title,
            "description": event.description,
            "severity": event.severity,
            "threat_type": "other",
            "location": event.location,
            "source": event.source,
            "metadata": event.raw_data,
        }


async def main():
    """Demo"""
    # Create adapters
    opensky_config = FeedConfig(
        name="opensky",
        url="https://opensky-network.org/api",
        poll_interval=30,
    )
    
    opensky = OpenSkyAdapter(opensky_config)
    
    # Create manager
    manager = FeedManager()
    manager.register_adapter("opensky", opensky)
    
    # Event handler
    async def on_event(event: FeedEvent):
        processor = FeedProcessor()
        normalized = processor.process_event(event)
        print(f"Event: {json.dumps(normalized, indent=2)}")
    
    # Start collecting
    await manager.start(on_event)
    
    # Run for 30 seconds
    await asyncio.sleep(30)
    
    # Stop
    await manager.stop()
    
    print(f"Total events processed: {opensky.events_processed}")


if __name__ == "__main__":
    asyncio.run(main())