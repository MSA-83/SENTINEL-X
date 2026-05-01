"""
sentinel_x/security/sanitize.py
Production prompt injection defense layer.
Applied at every task boundary before context propagation.
GDPR note: sanitization logs are hashed — no raw intelligence content stored.
"""
from __future__ import annotations


import hashlib
import re
import unicodedata
from dataclasses import dataclass, field
from typing import ClassVar


# Injection pattern families — extend as new TTPs emerge
_INJECTION_PATTERNS: list[re.Pattern[str]] = [
    # Role/persona hijack
    re.compile(r"(?i)(ignore\s+(previous|all|prior)\s+(instructions?|context|rules?))", re.DOTALL),
    re.compile(r"(?i)(you\s+are\s+now\s+(in\s+)?(debug|admin|root|system)\s+mode)", re.DOTALL),
    re.compile(r"(?i)(act\s+as\s+(an?\s+)?(evil|malicious|unrestricted|uncensored))", re.DOTALL),
    # Context extraction
    re.compile(r"(?i)(output\s+(your|the|all)\s+(full\s+)?(context|system\s+prompt|instructions?))", re.DOTALL),
    re.compile(r"(?i)(print\s+(the\s+)?(hidden|secret|full)\s+(prompt|context|instructions?))", re.DOTALL),
    # Data exfil
    re.compile(r"(?i)(send\s+(all\s+)?(entity\s+ids?|api\s+keys?|credentials?)\s+to)", re.DOTALL),
    re.compile(r"(?i)(exfiltrat|extract\s+all\s+data|dump\s+(database|entities|intel))", re.DOTALL),
    # HTML/XML injection in agent output
    re.compile(r"<\s*(script|iframe|object|embed|svg\s+onload)", re.IGNORECASE),
    # CRLF injection for log poisoning
    re.compile(r"(\r\n|\n)+(user:|assistant:|system:|<\|im_start\|>)", re.IGNORECASE),
    # Jailbreak delimiters
    re.compile(r"(\[INST\]|<\|system\|>|<\|user\|>|### Human:|Human:)\s*ignore", re.IGNORECASE),
]


# Unicode homoglyph normalization targets (Cyrillic/Greek lookalikes for Latin)
_CONFUSABLE_MAP: dict[str, str] = {
    "\u0430": "a",  # Cyrillic а → a
    "\u0435": "e",  # Cyrillic е → e
    "\u043e": "o",  # Cyrillic о → o
    "\u0440": "r",  # Cyrillic р → r
    "\u0441": "c",  # Cyrillic с → c
    "\u03b1": "a",  # Greek α → a
    "\u03b5": "e",  # Greek ε → e
}


@dataclass
class SanitizationResult:
    clean: str
    was_modified: bool
    threat_indicators: list[str] = field(default_factory=list)
    content_hash: str = ""  # SHA-256 of original for audit log (GDPR: no raw content)


    def raise_if_critical(self) -> None:
        """Call before passing to next agent. Raises on definitive injection attempt."""
        if len(self.threat_indicators) >= 2:
            raise InjectionAttemptError(
                f"Multi-indicator injection blocked. "
                f"Hash: {self.content_hash}. "
                f"Indicators: {self.threat_indicators}"
            )


class InjectionAttemptError(ValueError):
    """Raised when content exceeds injection confidence threshold."""


def sanitize_task_output(raw: str, *, max_len: int = 32_000) -> SanitizationResult:
    """
    Sanitize raw task output before passing as context to next CrewAI agent.


    Call at every task boundary:
        result = sanitize_task_output(previous_task.output.raw)
        result.raise_if_critical()
        safe_context = result.clean


    Args:
        raw: Raw string from previous task output
        max_len: Truncate at this length (prevents context stuffing)


    Returns:
        SanitizationResult with clean string and audit metadata
    """
    if not isinstance(raw, str):
        raw = str(raw)


    content_hash = hashlib.sha256(raw.encode("utf-8", errors="replace")).hexdigest()


    # 1. Truncate (context stuffing prevention)
    truncated = raw[:max_len]
    was_truncated = len(raw) > max_len


    # 2. Unicode normalization — catches homoglyph attacks
    normalized = unicodedata.normalize("NFKC", truncated)
    for confusable, replacement in _CONFUSABLE_MAP.items():
        normalized = normalized.replace(confusable, replacement)


    # 3. Control character strip (CRLF injection, null bytes, BOM)
    clean = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\ufeff]", "", normalized)


    # 4. Pattern match
    indicators: list[str] = []
    for pattern in _INJECTION_PATTERNS:
        if pattern.search(clean):
            indicators.append(pattern.pattern[:40])
            # Redact the match rather than blocking entirely
            # (false positive cost is too high for intelligence content)
            clean = pattern.sub("[REDACTED:POLICY]", clean)


    was_modified = (clean != raw or was_truncated)


    return SanitizationResult(
        clean=clean,
        was_modified=was_modified,
        threat_indicators=indicators,
        content_hash=content_hash,
    )


def sanitize_feed_payload(payload: dict, source_feed: str) -> dict:
    """
    Sanitize inbound feed payload before entity processing.
    Recursively sanitizes all string values.
    Preserves data types and structure.


    Args:
        payload: Raw dict from feed adapter (JSON-decoded)
        source_feed: Feed name for audit logging


    Returns:
        Sanitized dict with same structure
    """
    def _sanitize_value(v: object) -> object:
        if isinstance(v, str):
            result = sanitize_task_output(v, max_len=4096)
            return result.clean
        if isinstance(v, dict):
            return {k: _sanitize_value(vv) for k, vv in v.items()}
        if isinstance(v, list):
            return [_sanitize_value(item) for item in v]
        return v  # int, float, bool, None — safe as-is


    return {k: _sanitize_value(v) for k, v in payload.items()}
