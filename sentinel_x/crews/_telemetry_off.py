"""
sentinel_x/crews/_telemetry_off.py
Disable CrewAI telemetry for GDPR compliance.
Must be imported BEFORE any crewai import in every crew file.
"""
from __future__ import annotations

import os

# MUST be set BEFORE any crewai import
os.environ["OTEL_SDK_DISABLED"] = "true"
os.environ["CREWAI_TELEMETRY"] = "false"
# CrewAI ≥0.114 respects both; belt-and-suspenders.
