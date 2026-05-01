"""
sentinel_x/security/ssrf_guard.py
SSRF protection for outbound URL validation.
Blocks requests to internal networks, metadata endpoints, and non-standard schemes.
"""
from __future__ import annotations

import ipaddress
import urllib.parse
from typing import Final

# RFC-1918 + link-local + loopback + metadata endpoint ranges
_BLOCKED_NETWORKS: Final[list] = [
    ipaddress.IPv4Network("10.0.0.0/8"),
    ipaddress.IPv4Network("172.16.0.0/12"),
    ipaddress.IPv4Network("192.168.0.0/16"),
    ipaddress.IPv4Network("127.0.0.0/8"),
    ipaddress.IPv4Network("169.254.0.0/16"),   # AWS IMDS, Azure IMDS
    ipaddress.IPv4Network("100.64.0.0/10"),    # Shared address space
    ipaddress.IPv4Network("0.0.0.0/8"),
    ipaddress.IPv6Network("::1/128"),
    ipaddress.IPv6Network("fc00::/7"),
    ipaddress.IPv6Network("fe80::/10"),
]

_ALLOWED_SCHEMES: Final[frozenset] = frozenset({"https"})  # HTTP blocked in prod

_BLOCKED_HOSTS: Final[frozenset] = frozenset({
    "metadata.google.internal",
    "metadata.internal",
    "instance-data",
    "169.254.169.254",
    "fd00:ec2::254",  # IPv6 IMDS
})


class SSRFBlockedError(ValueError):
    """Raised when a URL is blocked by SSRF guard."""


def validate_outbound_url(url: str) -> str:
    """
    Validate URL before passing to ScrapeWebsiteTool or any outbound HTTP call.
    Raises SSRFBlockedError if the URL targets internal/metadata resources.

    Args:
        url: Raw URL string (may come from agent-generated or external content)

    Returns:
        The validated URL (unchanged if safe)

    Raises:
        SSRFBlockedError: If URL is blocked
        ValueError: If URL is malformed
    """
    try:
        parsed = urllib.parse.urlparse(url)
    except Exception as exc:
        raise ValueError(f"Malformed URL: {exc}") from exc

    # Scheme check
    if parsed.scheme not in _ALLOWED_SCHEMES:
        raise SSRFBlockedError(
            f"Scheme '{parsed.scheme}' not allowed. Only HTTPS permitted."
        )

    hostname = parsed.hostname or ""

    # Direct blocked host check
    if hostname.lower() in _BLOCKED_HOSTS:
        raise SSRFBlockedError(f"Blocked host: {hostname}")

    # IP address range check (handles both IPv4 and IPv6)
    try:
        addr = ipaddress.ip_address(hostname)
        for network in _BLOCKED_NETWORKS:
            if addr in network:
                raise SSRFBlockedError(
                    f"IP {addr} is in blocked range {network}"
                )
    except ValueError:
        pass  # hostname is a domain name, not an IP — proceed to DNS (handled at infra level)

    # Port check — non-standard ports blocked
    port = parsed.port
    if port is not None and port not in {80, 443, 8080, 8443}:
        raise SSRFBlockedError(f"Non-standard port {port} blocked")

    # Reject numeric-only hostnames that might be IPs with non-standard notation
    if re.match(r"^[0-9]+$", hostname) or re.match(r"^0x[0-9a-fA-F]+$", hostname):
        raise SSRFBlockedError(f"Suspicious hostname format: {hostname}")

    return url
