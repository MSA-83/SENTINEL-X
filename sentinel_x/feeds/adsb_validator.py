"""
ADS-B / AIS Spoofing detection and validation.
Validates position reports for plausibility and detects spoofing attempts.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

# Physics constants for plausibility checks
_MAX_AIRCRAFT_SPEED_KNOTS: float = 1200.0   # SR-71 upper bound
_MAX_VESSEL_SPEED_KNOTS: float = 80.0        # Hydrofoil upper bound
_MAX_ALTITUDE_FT: float = 65_000.0           # Commercial ceiling
_MIN_ALTITUDE_FT: float = -500.0             # Reasonable ground tolerance
_EARTH_RADIUS_NM: float = 3440.065


@dataclass(frozen=True)
class PositionReport:
    entity_id: str
    icao_hex: str
    lat: float
    lon: float
    altitude_ft: Optional[float]
    speed_knots: Optional[float]
    heading_deg: Optional[float]
    timestamp: datetime
    source_feed: str
    squawk: Optional[str] = None


@dataclass
class ValidationResult:
    valid: bool
    confidence: float           # 0.0 – 1.0
    flags: list[str]
    should_quarantine: bool     # If True: do not use for PoL training
    should_alert: bool          # If True: potential spoofing, alert analyst


def haversine_nm(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in nautical miles."""
    rlat1, rlon1, rlat2, rlon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlat = rlat2 - rlat1
    dlon = rlon2 - rlon1
    a = math.sin(dlat / 2) ** 2 + math.cos(rlat1) * math.cos(rlat2) * math.sin(dlon / 2) ** 2
    return 2 * _EARTH_RADIUS_NM * math.asin(math.sqrt(a))


def validate_position_report(
    report: PositionReport,
    previous: Optional[PositionReport] = None,
    secondary_sources: Optional[list[PositionReport]] = None,
) -> ValidationResult:
    flags: list[str] = []
    confidence = 1.0

    # ── Static range checks ──────────────────────────────────────────
    if not (-90.0 <= report.lat <= 90.0):
        flags.append(f"INVALID_LAT:{report.lat}")
        confidence -= 0.5

    if not (-180.0 <= report.lon <= 180.0):
        flags.append(f"INVALID_LON:{report.lon}")
        confidence -= 0.5

    if report.altitude_ft is not None:
        if not (_MIN_ALTITUDE_FT <= report.altitude_ft <= _MAX_ALTITUDE_FT):
            flags.append(f"IMPOSSIBLE_ALT:{report.altitude_ft}ft")
            confidence -= 0.4

    if report.speed_knots is not None:
        if report.speed_knots < 0:
            flags.append("NEGATIVE_SPEED")
            confidence -= 0.3
        elif report.speed_knots > _MAX_AIRCRAFT_SPEED_KNOTS:
            flags.append(f"IMPOSSIBLE_SPEED:{report.speed_knots}kts")
            confidence -= 0.5

    # ── Temporal velocity plausibility (requires previous report) ────────────
    if previous is not None:
        elapsed_hours = (
            report.timestamp - previous.timestamp
        ).total_seconds() / 3600.0

        if elapsed_hours > 0:
            distance_nm = haversine_nm(
                previous.lat, previous.lon,
                report.lat, report.lon
            )
            implied_speed = distance_nm / elapsed_hours

            if implied_speed > _MAX_AIRCRAFT_SPEED_KNOTS * 1.1:
                flags.append(
                    f"TELEPORTATION:{implied_speed:.0f}kts_implied "
                    f"({distance_nm:.1f}nm in {elapsed_hours*60:.1f}min)"
                )
                confidence -= 0.6

            # Altitude jump check (aircraft can't climb/descend >6000 fpm instantaneously)
            if (
                report.altitude_ft is not None
                and previous.altitude_ft is not None
                and elapsed_hours > 0
            ):
                alt_delta_ft = abs(report.altitude_ft - previous.altitude_ft)
                max_alt_change = elapsed_hours * 60 * 6000  # 6000 fpm max
                if alt_delta_ft > max_alt_change:
                    flags.append(
                        f"IMPOSSIBLE_CLIMB:{alt_delta_ft:.0f}ft "
                        f"in {elapsed_hours*60:.1f}min"
                    )
                    confidence -= 0.3

        elif elapsed_hours < 0:
            flags.append("TIMESTAMP_REGRESSION")
            confidence -= 0.4

    # ── Multi-source cross-validation ────────────────────────────────────────
    if secondary_sources:
        position_deltas: list[float] = []
        for secondary in secondary_sources:
            if abs((report.timestamp - secondary.timestamp).total_seconds()) < 60:
                delta_nm = haversine_nm(
                    report.lat, report.lon,
                    secondary.lat, secondary.lon
                )
                position_deltas.append(delta_nm)

        if position_deltas:
            max_delta = max(position_deltas)
            if max_delta > 50.0:  # 50nm discrepancy between sources → spoofing likely
                flags.append(
                    f"CROSS_SOURCE_DISCREPANCY:{max_delta:.1f}nm "
                    f"vs {len(secondary_sources)} secondary sources"
                )
                confidence -= 0.5
            elif max_delta > 5.0:
                flags.append(f"MINOR_SOURCE_DISCREPANCY:{max_delta:.1f}nm")
                confidence -= 0.1

    # ── Squawk checks ──────────────────────────────────────────────────
    if report.squawk in {"7500", "7600", "7700"}:
        flags.append(f"EMERGENCY_SQUAWK:{report.squawk}")
        # Not a validity failure, but should trigger analyst alert

    confidence = max(0.0, min(1.0, confidence))
    should_quarantine = confidence < 0.5 or any(
        "TELEPORTATION" in f or "IMPOSSIBLE" in f or "CROSS_SOURCE" in f
        for f in flags
    )

    return ValidationResult(
        valid=confidence > 0.3,
        confidence=confidence,
        flags=flags,
        should_quarantine=should_quarantine,
        should_alert=should_quarantine or report.squawk in {"7500", "7600", "7700"},
    )
