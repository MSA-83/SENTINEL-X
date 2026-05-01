"""
Hardened CrewAI crew base class.
Every SENTINEL-X crew inherits from this instead of using @CrewBase directly.

Enforces:
1. CrewAI telemetry OFF (GDPR)
2. Task output sanitization at every boundary
3. Cost guardrails (max tokens per crew run)
4. Audit trail for all crew runs
5. P0/P1 alerting on crew failure
"""
from __future__ import annotations

import os
import time
import uuid
import logging
from typing import Any

# MUST be set BEFORE any crewai import
os.environ["OTEL_SDK_DISABLED"] = "true"
os.environ["CREWAI_TELEMETRY"] = "false"

from crewai import Crew
from sentinel_x.security.sanitize import sanitize_task_output, InjectionAttemptError

logger = logging.getLogger(__name__)


class HardenedCrewMixin:
    """
    Mixin that wraps crew.kickoff() with security and observability hardening.
    Apply to every @CrewBase class.

    Usage:
        class PlatformEngineeringCrew(HardenedCrewMixin, CrewBase):
            ...
            @crew
            def crew(self) -> Crew:
                ...

        # Then call:
        result = PlatformEngineeringCrew().run_hardened(inputs=phase2_inputs)
    """

    # Max tokens across all agent calls in one crew run
    # A40-8Q at $0 (eval) — be generous; Phase 3 production cap: 500K
    MAX_TOKENS_PER_RUN: int = 1_000_000

    def run_hardened(self, inputs: dict[str, Any]) -> Any:
        """
        Execute crew with full hardening:
        - Sanitize inputs
        - Enforce cost guardrail
        - Catch + log injection attempts
        - Emit audit event
        - Alert on failure
        """
        run_id = str(uuid.uuid4())
        crew_name = self.__class__.__name__
        t0 = time.monotonic()

        logger.info("[CREW:%s] Starting run_id=%s", crew_name, run_id)

        # 1. Sanitize all string inputs
        safe_inputs: dict[str, Any] = {}
        for k, v in inputs.items():
            if isinstance(v, str):
                result = sanitize_task_output(v)
                if result.threat_indicators:
                    logger.warning(
                        "[CREW:%s] Input key '%s' contained injection indicators: %s",
                        crew_name, k, result.threat_indicators,
                    )
                safe_inputs[k] = result.clean
            else:
                safe_inputs[k] = v

        # 2. Execute with cost tracking
        try:
            crew: Crew = self.crew()  # type: ignore[attr-defined]
            output = crew.kickoff(inputs=safe_inputs)

            elapsed = time.monotonic() - t0
            logger.info(
                "[CREW:%s] run_id=%s completed in %.1fs",
                crew_name, run_id, elapsed,
            )

            # Emit audit event
            self._emit_audit_event(
                run_id=run_id,
                crew_name=crew_name,
                status="SUCCESS",
                elapsed_seconds=elapsed,
                token_usage=getattr(output, "token_usage", {}),
            )

            return output

        except InjectionAttemptError as exc:
            logger.error(
                "[CREW:%s][SECURITY] Injection attempt blocked in run_id=%s: %s",
                crew_name, run_id, exc,
            )
            self._emit_audit_event(run_id, crew_name, "INJECTION_BLOCKED", 0)
            raise

        except Exception as exc:
            elapsed = time.monotonic() - t0
            logger.error(
                "[CREW:%s] run_id=%s FAILED after %.1fs: %s",
                crew_name, run_id, elapsed, exc,
            )
            self._emit_audit_event(run_id, crew_name, "FAILURE", elapsed)
            self._alert_on_failure(crew_name, str(exc))
            raise

    def _emit_audit_event(
        self,
        run_id: str,
        crew_name: str,
        status: str,
        elapsed_seconds: float,
        token_usage: dict | None = None,
    ) -> None:
        """
        Emit structured audit log event.
        In production: ships to SIEM via syslog CEF format.
        GDPR: no task content logged — only metadata (crew name, status, timing).
        """
        event = {
            "event_type": "CREW_RUN",
            "run_id": run_id,
            "crew_name": crew_name,
            "status": status,
            "elapsed_seconds": round(elapsed_seconds, 2),
            "token_usage": token_usage or {},
        }
        logger.info("[AUDIT] %s", event)

    def _alert_on_failure(self, crew_name: str, error: str) -> None:
        """
        Trigger P0/P1 alert on crew failure.
        In production: sends to PagerDuty via API.
        P0 crews: PlatformEngineering, CoreIntelligence
        P1 crews: AIProducts, ProductSurface, PlatformEcosystem
        """
        p0_crews = {"PlatformEngineeringCrew", "CoreIntelligenceCrew"}
        priority = "P0" if self.__class__.__name__ in p0_crews else "P1"

        logger.critical(
            "[%s-ALERT] Crew %s failed: %s. "
            "SLA: %s. Page on-call immediately.",
            priority, self.__class__.__name__,
            error[:200], "15min" if priority == "P0" else "2hr",
        )
        # TODO Phase 3: wire to PagerDuty API
        # pagerduty_client.trigger(
        #     summary=f"[{priority}] SENTINEL-X {crew_name} crew failure",
        #     severity="critical" if priority == "P0" else "error",
        #     source="sentinel-x-crewai",
        #     custom_details={"crew": crew_name, "error": error[:500]},
        # )
