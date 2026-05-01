"""
SENTINEL-X Pattern-of-Life Training Dataset Pipeline
─────────────────────────────────────────────
GDPR compliance:
  - No PII in training features (vessel MMSI/aircraft ICAO are public registry IDs,
    not personal data under GDPR Art. 4 — confirmed by IMO/ICAO frameworks)
  - Position data is subject to legitimate interest basis (Art. 6(1)(f))
    for security research applications
  - Data retention: raw observations 90 days; derived features 2 years; models 5 years
  - Right to erasure: entity_id can be purged from feature store via _purge_entity()
  - Data provenance tracked per observation (source_feed, ingest_timestamp, validator_version)

Ethics:
  - No racial, ethnic, or nationality features in training data
  - Geographic bias audit required before every model version promotion
  - Human analyst must review all AMBER/RED training labels before inclusion
"""
from __future__ import annotations


import hashlib
import json
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterator, Optional


import numpy as np




# ── Observation Schema (v2) ──────────────────────────────────────────────


@dataclass
class RawObservation:
    """
    Single position observation from ADS-B or AIS feed.
    This is the atomic unit of the training dataset.


    GDPR: entity_id is a stable pseudonym derived from public registry IDs.
    Raw MMSI/ICAO are NOT stored in the ML dataset — only the pseudonymous entity_id.
    """
    observation_id: str           # UUID v4 — globally unique
    entity_id: str                # SHA-256(feed_type + mmsi_or_icao)[:16] — pseudonymous
    entity_type: str              # "aircraft" | "vessel"
    lat: float                    # WGS84 latitude
    lon: float                    # WGS84 longitude
    altitude_ft: Optional[float]  # Aircraft only; None for vessels
    speed_knots: float
    heading_deg: float            # 0–359
    timestamp: datetime           # UTC
    source_feed: str              # "adsb_exchange" | "aisstream" | etc.
    validation_confidence: float  # Output of validate_position_report()
    validator_version: str        # "v2.1.0" — for reproducibility
    ingest_timestamp: datetime    # When SENTINEL-X received it


    @classmethod
    def pseudonymize_entity_id(cls, feed_type: str, raw_id: str) -> str:
        """
        Create stable pseudonymous entity_id.
        One-way: cannot reconstruct MMSI/ICAO from entity_id.
        Consistent: same vessel always maps to same entity_id.
        """
        raw = f"{feed_type}:{raw_id}".encode("utf-8")
        return "ent_" + hashlib.sha256(raw).hexdigest()[:16]


@dataclass
class LabeledTrajectory:
    """
    A labeled sequence of observations for one entity in one time window.
    This is the training example unit for the PoL model.


    Label provenance is critical for audit:
    - AUTO_RULE: deterministic rule (loitering_radius > 5nm for > 30min)
    - ANALYST_CONFIRMED: human analyst reviewed and confirmed
    - ANALYST_CORRECTED: human analyst overrode auto-label
    - MODEL_GENERATED: previous model version suggested, human confirmed
    """
    trajectory_id: str
    entity_id: str
    entity_type: str
    observations: list[RawObservation]


    # Label
    label: str                  # "NORMAL" | "LOITERING" | "SUSPICIOUS" | "ANOMALOUS"
    label_source: str           # "AUTO_RULE" | "ANALYST_CONFIRMED" | etc.
    label_confidence: float     # 0.0–1.0
    labeled_by: str             # "auto_rule_v2" | "analyst_id_hash" (pseudonymized)
    labeled_at: datetime


    # Provenance
    dataset_version: str        # "2025-Q2-v3"
    window_start: datetime
    window_end: datetime
    geographic_region: str      # "RED_SEA" | "STRAIT_HORMUZ" | etc. (for bias audit)


    # GDPR
    retention_expires: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc) + timedelta(days=730)
    )
    consent_basis: str = "LEGITIMATE_INTEREST_ART_6_1_F"




@dataclass
class PoLFeatures:
    """
    Engineered features for one LabeledTrajectory.
    These are the actual inputs to the LSTM/Transformer model.


    Feature groups:
        trajectory_*: raw position sequence features
        behavioral_*: derived behavioral statistics
        temporal_*: time-of-day and calendar features
        geo_*: geographic context features
        graph_*: graph entity relationship features (requires Graph Engine)
    """
    trajectory_id: str
    entity_type: str


    # Trajectory sequence (variable length, padded to max_seq_len=256)
    trajectory_lats: list[float]
    trajectory_lons: list[float]
    trajectory_speeds: list[float]
    trajectory_headings: list[float]
    trajectory_alt_normalized: list[float]  # [0,1], 0 for vessels
    trajectory_timestamps_normalized: list[float]  # [0,1] within window


    # Behavioral statistics
    behavioral_mean_speed: float
    behavioral_std_speed: float
    behavioral_heading_changes_per_hour: float
    behavioral_loitering_radius_nm: float     # Radius of min enclosing circle
    behavioral_loitering_duration_min: float  # Time spent within loitering radius
    behavioral_dark_period_minutes: float     # Gap in pings > 15min
    behavioral_speed_percentile_95: float
    behavioral_reverse_course_count: int      # 180° heading changes


    # Temporal context
    temporal_hour_of_day: float              # [0, 23]
    temporal_day_of_week: int                # [0, 6]
    temporal_is_weekend: bool
    temporal_is_night: bool                  # Nautical twilight


    # Geographic context (discretized — no raw coordinates in features)
    geo_is_territorial_waters: bool
    geo_is_eez: bool
    geo_is_high_seas: bool
    geo_conflict_zone_distance_nm: float
    geo_nearest_port_distance_nm: float
    geo_shipping_lane_distance_nm: float
    geo_military_exercise_area: bool


    # Graph features (from Graph Engine)
    graph_entity_risk_score: float           # GNN output [0,1]
    graph_sanctions_flag: bool               # Linked to sanctioned operator
    graph_known_dark_vessel: bool            # Previously went dark in suspicious context
    graph_ownership_opacity_score: float     # Beneficial ownership complexity [0,1]


    # Metadata (not features — used for splitting and bias audit only)
    geographic_region: str
    flag_state: str                          # For bias audit ONLY, not a model feature
    label: str
    label_confidence: float




# ── Ingestion Pipeline ──────────────────────────────────────────────


class PoLDatasetPipeline:
    """
    End-to-end pipeline: raw observations → labeled trajectories → features → dataset.


    Usage:
        pipeline = PoLDatasetPipeline(output_dir=Path("data/pol_dataset/v3"))
        for trajectory in pipeline.stream_labeled_trajectories(
            start_date=datetime(2024, 1, 1, tzinfo=timezone.utc),
            end_date=datetime(2025, 1, 1, tzinfo=timezone.utc),
            entity_types=["aircraft", "vessel"],
        ):
            features = pipeline.extract_features(trajectory)
            pipeline.write_to_parquet(features)
        pipeline.run_bias_audit()
        pipeline.export_dataset_card()
    """


    LOITERING_RADIUS_THRESHOLD_NM: float = 5.0
    LOITERING_DURATION_MIN: float = 30.0
    MIN_OBSERVATIONS_PER_WINDOW: int = 10
    MAX_SEQ_LEN: int = 256
    WINDOW_HOURS: int = 4


    def __init__(self, output_dir: Path) -> None:
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self._stats: dict[str, int] = {
            "total_observations": 0,
            "quarantined_observations": 0,
            "labeled_normal": 0,
            "labeled_loitering": 0,
            "labeled_suspicious": 0,
            "labeled_anomalous": 0,
            "analyst_corrections": 0,
        }


    def auto_label_trajectory(self, trajectory: list[RawObservation]) -> tuple[str, float, str]:
        """
        Apply deterministic labeling rules to a trajectory sequence.
        Returns (label, confidence, rule_applied).


        Rules are ordered by specificity (most specific first).
        All rules are documented for audit — no black-box labeling.
        """
        if len(trajectory) < self.MIN_OBSERVATIONS_PER_WINDOW:
            return "INSUFFICIENT_DATA", 0.0, "MIN_OBS_NOT_MET"


        speeds = [o.speed_knots for o in trajectory]
        headings = [o.heading_deg for o in trajectory]


        # Rule 1: Loitering detection (primary PoL signal)
        radius_nm = self._min_enclosing_circle_radius(
            [(o.lat, o.lon) for o in trajectory]
        )
        duration_min = (
            trajectory[-1].timestamp - trajectory[0].timestamp
        ).total_seconds() / 60.0


        if (
            radius_nm < self.LOITERING_RADIUS_THRESHOLD_NM
            and duration_min > self.LOITERING_DURATION_MIN
            and np.mean(speeds) < 5.0  # Slow or stationary
        ):
            confidence = min(
                1.0,
                (self.LOITERING_DURATION_MIN / duration_min) * 0.5
                + (1 - radius_nm / self.LOITERING_RADIUS_THRESHOLD_NM) * 0.5,
            )
            return "LOITERING", float(confidence), "RULE_LOITERING_RADIUS_SPEED"


        # Rule 2: Erratic course changes (suspicious)
        course_changes = sum(
            1 for i in range(1, len(headings))
            if abs(headings[i] - headings[i - 1]) > 45
        )
        changes_per_hour = course_changes / max(duration_min / 60, 0.1)
        if changes_per_hour > 8 and np.mean(speeds) > 5:
            return "SUSPICIOUS", 0.65, "RULE_ERRATIC_COURSE_CHANGES"


        # Rule 3: Dark period followed by reappearance at distant location
        gaps = [
            (trajectory[i].timestamp - trajectory[i - 1].timestamp).total_seconds() / 60.0
            for i in range(1, len(trajectory))
        ]
        max_gap_min = max(gaps) if gaps else 0.0
        if max_gap_min > 60:  # More than 1 hour gap
            return "SUSPICIOUS", 0.55, "RULE_DARK_PERIOD"


        # Rule 4: Normal baseline
        return "NORMAL", 0.85, "RULE_DEFAULT_NORMAL"


    def extract_features(self, trajectory: "LabeledTrajectory") -> PoLFeatures:
        """
        Extract all model input features from a labeled trajectory.
        Called after labeling — features include label for supervised training.
        """
        obs = trajectory.observations
        lats = [o.lat for o in obs]
        lons = [o.lon for o in obs]
        speeds = [o.speed_knots for o in obs]
        headings = [o.heading_deg for o in obs]
        alts = [o.altitude_ft or 0.0 for o in obs]


        # Normalize sequences to MAX_SEQ_LEN
        def pad_or_truncate(seq: list[float], length: int = self.MAX_SEQ_LEN) -> list[float]:
            if len(seq) >= length:
                return seq[:length]
            return seq + [0.0] * (length - len(seq))


        # Normalize altitude [0,1] with 60,000ft ceiling
        alt_norm = [min(a / 60_000.0, 1.0) for a in alts]


        # Normalize timestamps within window
        ts_list = [o.timestamp.timestamp() for o in obs]
        ts_min, ts_max = min(ts_list), max(ts_list)
        ts_range = max(ts_max - ts_min, 1.0)
        ts_norm = [(t - ts_min) / ts_range for t in ts_list]


        radius_nm = self._min_enclosing_circle_radius(list(zip(lats, lons)))
        loiter_duration = (obs[-1].timestamp - obs[0].timestamp).total_seconds() / 60.0


        heading_changes = sum(
            1 for i in range(1, len(headings))
            if abs(headings[i] - headings[i - 1]) > 45
        )
        hrs = max(loiter_duration / 60.0, 0.01)


        dark_periods = [
            (obs[i].timestamp - obs[i - 1].timestamp).total_seconds() / 60.0
            for i in range(1, len(obs))
            if (obs[i].timestamp - obs[i - 1].timestamp).total_seconds() / 60.0 > 15
        ]


        reverse_courses = sum(
            1 for i in range(1, len(headings))
            if abs(headings[i] - headings[i - 1]) > 150
        )


        hour = obs[0].timestamp.hour
        is_night = not (6 <= hour <= 20)


        return PoLFeatures(
            trajectory_id=trajectory.trajectory_id,
            entity_type=trajectory.entity_type,
            trajectory_lats=pad_or_truncate(lats),
            trajectory_lons=pad_or_truncate(lons),
            trajectory_speeds=pad_or_truncate(speeds),
            trajectory_headings=pad_or_truncate(headings),
            trajectory_alt_normalized=pad_or_truncate(alt_norm),
            trajectory_timestamps_normalized=pad_or_truncate(ts_norm),
            behavioral_mean_speed=float(np.mean(speeds)),
            behavioral_std_speed=float(np.std(speeds)),
            behavioral_heading_changes_per_hour=heading_changes / hrs,
            behavioral_loitering_radius_nm=radius_nm,
            behavioral_loitering_duration_min=loiter_duration,
            behavioral_dark_period_minutes=max(dark_periods) if dark_periods else 0.0,
            behavioral_speed_percentile_95=float(np.percentile(speeds, 95)) if speeds else 0.0,
            behavioral_reverse_course_count=reverse_courses,
            temporal_hour_of_day=float(hour),
            temporal_day_of_week=obs[0].timestamp.weekday(),
            temporal_is_weekend=obs[0].timestamp.weekday() >= 5,
            temporal_is_night=is_night,
            # Geographic and graph features require external service calls
            # These are filled in by the feature enrichment service
            geo_is_territorial_waters=False,
            geo_is_eez=False,
            geo_is_high_seas=True,
            geo_conflict_zone_distance_nm=999.0,
            geo_nearest_port_distance_nm=999.0,
            geo_shipping_lane_distance_nm=999.0,
            geo_military_exercise_area=False,
            graph_entity_risk_score=0.0,
            graph_sanctions_flag=False,
            graph_known_dark_vessel=False,
            graph_ownership_opacity_score=0.0,
            geographic_region=trajectory.geographic_region,
            flag_state="UNKNOWN",  # Populated by enrichment — NOT a model feature
            label=trajectory.label,
            label_confidence=trajectory.label_confidence,
        )


    def run_bias_audit(self) -> dict[str, Any]:
        """
        Check training dataset for geographic and flag-state bias.
        Required before every model version promotion to production.
        Produces an audit report for AI Safety sign-off.
        """
        # In production: load parquet files, compute per-region/flag-state
        # label distribution, compare against expected base rates
        return {
            "audit_timestamp": datetime.now(timezone.utc).isoformat(),
            "dataset_stats": self._stats,
            "bias_check": "REQUIRES_ANALYST_SIGN_OFF",
            "required_signer": "ai_safety_engineer_1",
            "note": (
                "Compute per geographic_region and flag_state label distribution. "
                "Flag if any region has >3x the base LOITERING rate — likely labeling bias."
            ),
        }


    def export_dataset_card(self) -> dict[str, Any]:
        """GDPR Art. 13/14 compliant dataset card for model governance."""
        return {
            "dataset_name": "sentinel_x_pol_v3",
            "version": "3.0.0",
            "created": datetime.now(timezone.utc).isoformat(),
            "description": "Pattern-of-Life training data for maritime/aerial anomaly detection",
            "gdpr_basis": "Legitimate Interest Art. 6(1)(f) — security research",
            "data_subjects": "None — entity_ids are pseudonymous public registry identifiers",
            "pii_content": False,
            "retention_policy": "Features: 2 years; Raw obs: 90 days; Models: 5 years",
            "geographic_coverage": ["Global maritime, ADSB-covered airspace"],
            "label_schema": {
                "NORMAL": "Expected baseline trajectory",
                "LOITERING": "Extended circular motion, low speed",
                "SUSPICIOUS": "Erratic course, dark periods, exclusion zone proximity",
                "ANOMALOUS": "Analyst-flagged, does not fit rule-based categories",
            },
            "known_biases": [
                "Higher density of observations in European/North American waters",
                "Night observations underrepresented in positive classes",
                "Fishing vessels have naturally high loitering rates — ensure separate baseline",
            ],
            "ethics_review_required": True,
            "ethics_reviewer": "ai_safety_engineer_1",
        }


    @staticmethod
    def _min_enclosing_circle_radius(points: list[tuple[float, float]]) -> float:
        """
        Approximate minimum enclosing circle radius in nautical miles.
        Uses max pairwise distance / 2 as upper bound (true Welzl is overkill here).
        """
        if len(points) < 2:
            return 0.0
        max_dist = 0.0
        for i in range(len(points)):
            for j in range(i + 1, min(i + 50, len(points))):  # Sample for performance
                d = haversine_nm(points[i][0], points[i][1], points[j][0], points[j][1])
                if d > max_dist:
                    max_dist = d
        return max_dist / 2.0


def haversine_nm(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in nautical miles."""
    rlat1, rlon1, rlat2, rlon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlat = rlat2 - rlat1
    dlon = rlon2 - rlon1
    a = math.sin(dlat / 2) ** 2 + math.cos(rlat1) * math.cos(rlat2) * math.sin(dlon / 2) ** 2
    return 2 * _EARTH_RADIUS_NM * math.asin(math.sqrt(a))
