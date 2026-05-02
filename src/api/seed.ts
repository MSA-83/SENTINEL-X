"""
SENTINEL-X Database Seeding
Seed database with initial data
"""
import asyncio
import os
from datetime import datetime, timedelta
from typing import Optional

async def seed_threats(db_pool, count: int = 100):
    """Seed threat events"""
    import random
    
    severities = ["critical", "high", "medium", "low"]
    types = [
        "aircraft_incursion", "vessel_incident", "ais_spoofing",
        "gps_jamming", "comms_intercept", "radar_jamming"
    ]
    sources = ["ADS-B", "AIS", "SIGINT", "OSINT", "GEOINT", "RADAR"]
    locations = [
        (34.0522, -118.2437), (40.7128, -74.0060), (51.5074, -0.1278),
        (48.8566, 2.3522), (35.6762, 139.6503), (31.2304, 121.4737),
    ]
    
    threats = []
    for i in range(count):
        lat, lng = random.choice(locations)
        lat += random.uniform(-2, 2)
        lng += random.uniform(-2, 2)
        
        threats.append({
            "id": f"THREAT-{i+1:04d}",
            "title": f"Threat Event {i+1}",
            "description": f"Detected threat in region",
            "severity": random.choice(severities),
            "threat_type": random.choice(types),
            "location": f"POINT({lng} {lat})",
            "source": random.choice(sources),
            "created_at": datetime.utcnow() - timedelta(hours=random.randint(0, 168)),
        })
    
    query = """
        INSERT INTO threat_events (id, title, description, severity, threat_type, location, source, created_at)
        VALUES ($1, $2, $3, $4, $5, ST_GeomFromText($6, 4326), $7, $8)
        ON CONFLICT (id) DO NOTHING
    """
    
    async with db_pool.acquire() as conn:
        for threat in threats:
            await conn.execute(
                query,
                threat["id"], threat["title"], threat["description"],
                threat["severity"], threat["threat_type"], threat["location"],
                threat["source"], threat["created_at"]
            )
    
    return len(threats)


async def seed_entities(db_pool, count: int = 50):
    """Seed entities"""
    import random
    
    types = ["aircraft", "vessel", "facility", "signal"]
    classifications = ["unknown", "commercial", "military", "government"]
    risks = ["critical", "high", "medium", "low"]
    
    entities = []
    for i in range(count):
        entity_type = random.choice(types)
        
        if entity_type == "aircraft":
            name = f"AIRCRAFT-{i+1:04d}"
            callsign = f"FLT{random.randint(100, 999)}"
        elif entity_type == "vessel":
            name = f"VESSEL-{i+1:04d}"
            callsign = f"MMSI{random.randint(100000, 999999)}"
        else:
            name = f"ENTITY-{i+1:04d}"
            callsign = None
        
        lat = random.uniform(25, 55)
        lng = random.uniform(-130, 30)
        
        entities.append({
            "id": f"ENT-{i+1:04d}",
            "name": name,
            "callsign": callsign,
            "entity_type": entity_type,
            "classification": random.choice(classifications),
            "risk_level": random.choice(risks),
            "location": f"POINT({lng} {lat})",
            "last_seen": datetime.utcnow() - timedelta(minutes=random.randint(0, 60)),
        })
    
    query = """
        INSERT INTO entities (id, name, callsign, entity_type, classification, risk_level, location, last_seen)
        VALUES ($1, $2, $3, $4, $5, $6, ST_GeomFromText($7, 4326), $8)
        ON CONFLICT (id) DO NOTHING
    """
    
    async with db_pool.acquire() as conn:
        for entity in entities:
            await conn.execute(
                query,
                entity["id"], entity["name"], entity["callsign"],
                entity["entity_type"], entity["classification"], entity["risk_level"],
                entity["location"], entity["last_seen"]
            )
    
    return len(entities)


async def seed_cases(db_pool, count: int = 20):
    """Seed cases"""
    import random
    
    statuses = ["open", "in_progress", "resolved", "closed"]
    priorities = ["critical", "high", "medium", "low"]
    types = ["threat_investigation", "intelligence", "routine", "investigation"]
    assignees = ["John Doe", "Jane Smith", "Bob Wilson", "Alice Brown"]
    
    cases = []
    for i in range(count):
        cases.append({
            "id": f"CASE-{i+1:04d}",
            "title": f"Case {i+1}",
            "description": f"Case description {i+1}",
            "status": random.choice(statuses),
            "priority": random.choice(priorities),
            "case_type": random.choice(types),
            "assigned_to": random.choice(assignees),
            "created_at": datetime.utcnow() - timedelta(days=random.randint(0, 30)),
            "updated_at": datetime.utcnow() - timedelta(hours=random.randint(0, 24)),
        })
    
    query = """
        INSERT INTO cases (id, title, description, status, priority, case_type, assigned_to, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO NOTHING
    """
    
    async with db_pool.acquire() as conn:
        for case in cases:
            await conn.execute(
                query,
                case["id"], case["title"], case["description"],
                case["status"], case["priority"], case["case_type"],
                case["assigned_to"], case["created_at"], case["updated_at"]
            )
    
    return len(cases)


async def seed_all(db_pool, threat_count: int = 100, entity_count: int = 50, case_count: int = 20):
    """Seed all data"""
    print(f"Seeding {threat_count} threats...")
    threats = await seed_threats(db_pool, threat_count)
    
    print(f"Seeding {entity_count} entities...")
    entities = await seed_entities(db_pool, entity_count)
    
    print(f"Seeding {case_count} cases...")
    cases = await seed_cases(db_pool, case_count)
    
    return {
        "threats": threats,
        "entities": entities,
        "cases": cases,
    }


async def clear_all(db_pool):
    """Clear all data"""
    tables = ["threat_events", "entities", "cases", "alerts", "entity_history"]
    
    async with db_pool.acquire() as conn:
        for table in tables:
            await conn.execute(f"TRUNCATE TABLE {table} CASCADE")
    
    return {"cleared": tables}


if __name__ == "__main__":
    async def main():
        import asyncpg
        
        db_url = os.environ.get("DATABASE_URL", "postgresql://sentinel:sentinel@localhost:5432/sentinel")
        db_pool = await asyncpg.create_pool(db_url)
        
        result = await seed_all(db_pool)
        print(f"Seeded: {result}")
        
        await db_pool.close()
    
    asyncio.run(main())