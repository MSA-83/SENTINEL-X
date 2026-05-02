"""
STEP 1: Download all FREE datasets for Sentinel-X
Runtime: 5-10 minutes (quick mode)
Output: Parquet files ready for training
"""

import requests
import pandas as pd
import numpy as np
import json
from datetime import datetime, timedelta
from pathlib import Path
import logging
import time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ===========================================================================
# CONFIGURATION
# ===========================================================================

DATASETS_DIR = Path("datasets/raw")
DATASETS_DIR.mkdir(parents=True, exist_ok=True)

CONFIG = {
    "opensky_endpoint": "https://opensky-network.org/api/states/all",
    "opensky_rate_limit": 10,  # req/min free tier
    "kaggle_dataset": "airbus/aircraft-taxonomy",
    "groq_api_key": os.getenv("GROQ_API_KEY", ""),  # SECURITY: Environment variable
    "neon_connection": os.getenv("NEON_POSTGRES_URL", "")
}

# ===========================================================================
# DATASET 1: OpenSky Network (Real Aircraft)
# ===========================================================================

class OpenSkyDataset:
    """
    Real-time aircraft tracking data
    10k+ daily aircraft observations FREE
    """
    
    def __init__(self):
        self.endpoint = CONFIG["opensky_endpoint"]
    
    def fetch_current_state(self) -> list:
        """
        Fetch current aircraft states
        Returns: List of aircraft with position, velocity, etc.
        """
        logger.info("📡 Fetching current aircraft from OpenSky...")
        
        try:
            response = requests.get(self.endpoint, timeout=30)
            if response.status_code != 200:
                logger.error(f"OpenSky API error: {response.status_code}")
                return []
            
            data = response.json()
            states = data.get("states", [])
            
            logger.info(f"✅ Fetched {len(states)} aircraft")
            return states
        
        except Exception as e:
            logger.error(f"❌ OpenSky fetch failed: {e}")
            return []
    
    def collect_snapshot(self) -> pd.DataFrame:
        """
        Collect aircraft data snapshot
        """
        logger.info("🔄 Collecting aircraft snapshot...")
        
        states = self.fetch_current_state()
            
        # Parse into DataFrame
        all_states = []
        for state in states:
            if len(state) > 13 and state[5] is not None and state[6] is not None:
                all_states.append({
                    "icao24": state[0],
                    "callsign": state[1] if state[1] else "UNK",
                    "origin_country": state[2] if state[2] else "UNK",
                    "time_position": state[3],
                    "last_contact": state[4],
                    "lat": state[5],
                    "lon": state[6],
                    "baro_altitude": state[7],
                    "on_ground": state[8],
                    "velocity": state[9] if state[9] else 0,
                    "true_track": state[10] if state[10] else 0,
                    "vertical_rate": state[11] if state[11] else 0,
                    "sensors": state[12] if state[12] else 0,
                    "geo_altitude": state[13] if len(state) > 13 else 0,
                    "squawk": state[14] if len(state) > 14 else "UNK",
                    "spin": state[15] if len(state) > 15 else False,
                    "position_source": state[16] if len(state) > 16 else "UNK",
                    "collected_at": datetime.utcnow().isoformat()
                })
        
        df = pd.DataFrame(all_states)
        
        # Data cleaning
        if len(df) > 0:
            df = df.dropna(subset=["lat", "lon", "velocity"])
            df = df[df["lat"].between(-90, 90) & df["lon"].between(-180, 180)]
        
        logger.info(f"✅ Collected {len(df)} valid aircraft observations")
        return df
    
    def save_dataset(self, df: pd.DataFrame):
        """Save to Parquet for fast loading"""
        filepath = DATASETS_DIR / "opensky_snapshot.parquet"
        df.to_parquet(filepath, compression="snappy")
        logger.info(f"💾 Saved OpenSky data: {filepath}")
        return filepath

# ===========================================================================
# DATASET 2: Kaggle Aircraft Taxonomy
# ===========================================================================

class KaggleAircraftDataset:
    """
    Labeled aircraft taxonomy from Kaggle
    50k aircraft with type classifications
    """
    
    def download_via_cli(self) -> pd.DataFrame:
        """
        Download using Kaggle CLI
        SETUP: kaggle auth (stores API key in ~/.kaggle/kaggle.json)
        """
        logger.info("📥 Downloading Kaggle aircraft taxonomy...")
        
        import subprocess
        
        # Create temp dir
        temp_dir = DATASETS_DIR / "kaggle_temp"
        temp_dir.mkdir(exist_ok=True)
        
        # Download
        result = subprocess.run([
            "kaggle", "datasets", "download",
            "-d", CONFIG["kaggle_dataset"],
            "-p", str(temp_dir),
            "--unzip"
        ], capture_output=True, text=True)
        
        if result.returncode != 0:
            logger.error(f"Kaggle download failed: {result.stderr}")
            return pd.DataFrame()
        
        logger.info(f"✅ Kaggle download complete")
        
        # Find and load CSV
        csv_files = list(temp_dir.glob("*.csv"))
        if not csv_files:
            logger.error("No CSV found in Kaggle download")
            return pd.DataFrame()
        
        df = pd.read_csv(csv_files[0])
        logger.info(f"✅ Loaded {len(df)} aircraft from Kaggle")
        return df
    
    def preprocess_taxonomy(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Clean and normalize aircraft taxonomy
        """
        logger.info("🔧 Preprocessing aircraft taxonomy...")
        
        # Expected columns: aircraft_model, manufacturer, type, num_engines, etc.
        
        # Normalize aircraft types
        if "type" in df.columns:
            type_mapping = {
                "Commercial": "commercial",
                "Cargo": "cargo",
                "Military": "military",
                "Private": "private",
                "Helicopter": "helicopter"
            }
            df["aircraft_type"] = df["type"].map(type_mapping).fillna("unknown")
        
        # Feature engineering
        if "num_engines" in df.columns:
            df["num_engines_numeric"] = pd.to_numeric(df["num_engines"], errors="coerce").fillna(2)
        if "max_range" in df.columns:
            df["max_range_km"] = pd.to_numeric(df["max_range"], errors="coerce").fillna(5000)
        if "cruise_speed" in df.columns:
            df["cruise_speed_kmh"] = pd.to_numeric(df["cruise_speed"], errors="coerce").fillna(500)
        
        logger.info(f"✅ Preprocessed {len(df)} aircraft")
        return df
    
    def save_dataset(self, df: pd.DataFrame):
        filepath = DATASETS_DIR / "kaggle_aircraft_taxonomy.parquet"
        df.to_parquet(filepath, compression="snappy")
        logger.info(f"💾 Saved Kaggle taxonomy: {filepath}")
        return filepath

# ===========================================================================
# DATASET 3: Synthetic Observations (Groq + Labels)
# ===========================================================================

class SyntheticDataset:
    """
    Generate realistic aircraft observations
    Using Groq LLM for domain knowledge
    Realistic ground truth labels
    """
    
    def __init__(self):
        from langchain_groq import ChatGroq
        try:
            self.llm = ChatGroq(
                groq_api_key=CONFIG["groq_api_key"],
                model="llama-3.1-70b-versatile",
                temperature=0.7  # Vary outputs
            )
        except:
            self.llm = None
            logger.warning("⚠️ Groq not available - using fallback")
    
    def generate_observation(self, aircraft_type: str) -> dict:
        """
        Generate single realistic observation
        SETTINGS: Include metadata for label generation
        """
        
        if self.llm:
            prompt = f"""Generate a realistic aircraft observation for training.


Aircraft type: {aircraft_type}


Return JSON:
{{
  "entity_id": "ac_XXXXX",
  "domain": "aircraft",
  "callsign": "UAL123",
  "latitude": 40.5,
  "longitude": -74.0,
  "altitude_ft": 35000,
  "velocity_knots": 450,
  "vertical_rate_fpm": 0,
  "true_track": 180,
  "signal_strength": 0.95,
  "observation_context": "normal cruise"
}}


CONSTRAINTS: Valid coordinates, realistic values, deterministic"""
            
            try:
                import asyncio
                response = asyncio.get_event_loop().run_until_complete(
                    asyncio.wait_for(self.llm.ainvoke(prompt), timeout=10)
                )
                
                import re
                json_match = re.search(r'\{.*\}', response.content, re.DOTALL)
                if json_match:
                    obs = json.loads(json_match.group())
                    return obs
            except Exception as e:
                logger.warning(f"Groq generation failed: {e}")
        
        # Fallback: return realistic default
        return {
            "entity_id": f"ac_{np.random.randint(10000, 99999)}",
            "domain": "aircraft",
            "latitude": np.random.uniform(-90, 90),
            "longitude": np.random.uniform(-180, 180),
            "altitude_ft": np.random.choice([5000, 15000, 25000, 35000, 45000]),
            "velocity_knots": np.random.uniform(100, 900),
            "signal_strength": np.random.uniform(0.3, 1.0)
        }
    
    def assign_label(self, observation: dict) -> str:
        """
        Assign ground truth label based on observation characteristics
        LOGIC:
        - ANOMALY: altitude<1000ft OR velocity>1000kt OR signal<0.1
        - SUSPICIOUS: velocity changing rapidly OR unusual location
        - NORMAL: everything else
        """
        
        alt = observation.get("altitude_ft", 35000)
        vel = observation.get("velocity_knots", 450)
        signal = observation.get("signal_strength", 0.8)
        context = observation.get("observation_context", "").lower()
        
        # Rule-based labeling (ground truth)
        if alt < 1000 and "ground" not in context:
            return "anomaly"  # Unusual low altitude
        
        if vel > 950:
            return "anomaly"  # Unrealistic speed
        
        if signal < 0.1:
            return "anomaly"  # Lost signal
        
        if "loitering" in context or "unusual" in context:
            return "suspicious"
        
        if "normal" in context or "cruise" in context:
            return "normal"
        
        # Default: suspicious if unsure
        return "suspicious"
    
    def generate_batch(self, count: int = 1000) -> pd.DataFrame:
        """
        Generate batch of synthetic observations with labels
        SETTINGS: Stratified - 70% normal, 20% suspicious, 10% anomaly
        """
        logger.info(f"🤖 Generating {count} synthetic observations...")
        
        observations = []
        
        # Stratified generation
        aircraft_types = ["commercial", "cargo", "military", "private"]
        normal_count = int(count * 0.7)
        suspicious_count = int(count * 0.2)
        anomaly_count = count - normal_count - suspicious_count
        
        # Generate normal observations
        for i in range(normal_count):
            obs = self.generate_observation(aircraft_types[i % len(aircraft_types)])
            obs["observation_context"] = "normal cruise"
            label = self.assign_label(obs)
            obs["label"] = label
            observations.append(obs)
            
            if (i + 1) % 100 == 0:
                logger.info(f"  {i+1}/{count} observations generated")
            
            time.sleep(0.1)  # Rate limit Groq
        
        # Generate suspicious observations
        for i in range(suspicious_count):
            obs = self.generate_observation(aircraft_types[i % len(aircraft_types)])
            obs["observation_context"] = "unusual trajectory"
            obs["velocity_knots"] *= np.random.uniform(0.7, 0.9)  # Slower than normal
            label = self.assign_label(obs)
            obs["label"] = label
            observations.append(obs)
        
        # Generate anomaly observations
        for i in range(anomaly_count):
            obs = self.generate_observation(aircraft_types[i % len(aircraft_types)])
            obs["observation_context"] = "anomalous behavior"
            obs["altitude_ft"] = np.random.choice([500, 1500, 50000])  # Extreme altitudes
            label = "anomaly"
            obs["label"] = label
            observations.append(obs)
        
        df = pd.DataFrame(observations)
        
        logger.info(f"✅ Generated {len(df)} observations")
        logger.info(f"   Normal: {(df['label'] == 'normal').sum()}")
        logger.info(f"   Suspicious: {(df['label'] == 'suspicious').sum()}")
        logger.info(f"   Anomaly: {(df['label'] == 'anomaly').sum()}")
        
        return df
    
    def save_dataset(self, df: pd.DataFrame):
        filepath = DATASETS_DIR / "synthetic_observations.parquet"
        df.to_parquet(filepath, compression="snappy")
        logger.info(f"💾 Saved synthetic data: {filepath}")
        return filepath

# ===========================================================================
# MAIN: ORCHESTRATE DATASET COLLECTION
# ===========================================================================

def main():
    """
    Complete dataset preparation pipeline
    Runtime: ~10 minutes (mostly waiting for OpenSky polls)
    """
    
    logger.info("=" * 70)
    logger.info("🚀 SENTINEL-X DATASET PREPARATION")
    logger.info("=" * 70)
    
    # Dataset 1: OpenSky (snapshot - runs in background)
    logger.info("\n[DATASET 1/3] OpenSky Network (Real Aircraft)")
    logger.info("-" * 70)
    opensky = OpenSkyDataset()
    
    # Quick snapshot mode (instead of 24h)
    df_opensky = opensky.collect_snapshot()
    opensky.save_dataset(df_opensky)
    logger.info(f"✅ OpenSky: {len(df_opensky)} aircraft observations")
    
    # Dataset 2: Kaggle Taxonomy
    logger.info("\n[DATASET 2/3] Kaggle Aircraft Taxonomy")
    logger.info("-" * 70)
    kaggle = KaggleAircraftDataset()
    df_kaggle_raw = kaggle.download_via_cli()
    
    if len(df_kaggle_raw) > 0:
        df_kaggle = kaggle.preprocess_taxonomy(df_kaggle_raw)
        kaggle.save_dataset(df_kaggle)
        logger.info(f"✅ Kaggle: {len(df_kaggle)} aircraft types")
    else:
        logger.warning("⚠️ Kaggle download failed - skipping")
        df_kaggle = pd.DataFrame()
    
    # Dataset 3: Synthetic Data
    logger.info("\n[DATASET 3/3] Synthetic Observations (Groq + Labels)")
    logger.info("-" * 70)
    synthetic = SyntheticDataset()
    df_synthetic = synthetic.generate_batch(count=500)  # 500 for quick test
    synthetic.save_dataset(df_synthetic)
    
    # Combine all datasets
    logger.info("\n[COMBINING] Merging all datasets...")
    logger.info("-" * 70)
    
    # Prepare DataFrames for merging
    if len(df_opensky) > 0:
        df_opensky_prepared = df_opensky[[
            "icao24", "lat", "lon", "baro_altitude", "velocity"
        ]].rename(columns={
            "icao24": "entity_id",
            "baro_altitude": "altitude",
            "velocity": "velocity"
        }).assign(source="opensky", label="unknown")
        
        dfs_to_merge = [df_opensky_prepared, df_synthetic]
    else:
        dfs_to_merge = [df_synthetic]
    
    if len(df_kaggle) > 0:
        df_kaggle_prepared = df_kaggle[["model", "manufacturer", "aircraft_type"]].rename(
            columns={"model": "entity_id"}
        ).assign(source="kaggle", label="unknown")
        dfs_to_merge.append(df_kaggle_prepared)
    
    df_combined = pd.concat(dfs_to_merge, ignore_index=True)
    
    # Save combined dataset
    processed_dir = Path("datasets/processed")
    processed_dir.mkdir(exist_ok=True)
    combined_path = processed_dir / "sentinel_training_combined.parquet"
    df_combined.to_parquet(combined_path, compression="snappy")
    
    logger.info(f"✅ Combined dataset: {len(df_combined)} records")
    logger.info(f"   Sources: {df_combined['source'].value_counts().to_dict()}")
    logger.info(f"   Label distribution: {df_combined['label'].value_counts().to_dict()}")
    
    logger.info("\n" + "=" * 70)
    logger.info("✅ DATASET PREPARATION COMPLETE")
    logger.info("=" * 70)
    logger.info(f"Output: {combined_path}")
    logger.info(f"Ready for training on Kaggle/Colab")
    
    return {
        "opensky_path": DATASETS_DIR / "opensky_snapshot.parquet",
        "kaggle_path": DATASETS_DIR / "kaggle_aircraft_taxonomy.parquet",
        "synthetic_path": DATASETS_DIR / "synthetic_observations.parquet",
        "combined_path": combined_path,
        "total_records": len(df_combined)
    }


if __name__ == "__main__":
    result = main()
    print(f"\n✅ Result: {result}")
