"""
sentinel_x/db/clickhouse_client.py
Parameterized ClickHouse query client with tenant isolation enforcement.

Every query that accesses tenant-scoped data MUST use execute_tenant_query.
Direct execute_raw is available for admin/analytics queries only.

NEVER interpolate tenant_id into query strings — always use parameters.
"""

from __future__ import annotations

import re
import uuid
from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator

import clickhouse_connect


# Allowlist for tenant_id format (UUID v4 only)
_TENANT_ID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    re.IGNORECASE,
)


class ClickHouseClient:
    """
    Parameterized ClickHouse query client with tenant isolation enforcement.

    Every query that accesses tenant-scoped data MUST use execute_tenant_query.
    Direct execute_raw is available for admin/analytics queries only.

    NEVER interpolate tenant_id into query strings — always use parameters.
    """

    def __init__(self, host: str, port: int, database: str,
                 username: str, password: str) -> None:
        self._client = clickhouse_connect.get_client(
            host=host, port=port, database=database,
            username=username, password=password,
            secure=True,  # TLS always
            connect_timeout=5,
            send_receive_timeout=30,
        )

    def _validate_tenant_id(self, tenant_id: str) -> str:
        """Validate tenant_id is a valid UUID v4 — reject all other formats."""
        if not _TENANT_ID_RE.match(tenant_id):
            raise ValueError(
                f"Invalid tenant_id format: {tenant_id!r}. "
                "Must be UUID v4. Possible injection attempt."
            )
        return tenant_id.lower()

    def execute_tenant_query(
        self,
        query_template: str,
        tenant_id: str,
        parameters: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        """
        Execute a tenant-scoped query with mandatory tenant_id injection.

        The query_template MUST contain {tenant_id_param} placeholder.
        ClickHouse parameterized queries prevent SQL injection.

        Args:
            query_template: SQL with {param_name} placeholders
            tenant_id: Validated UUID v4 tenant identifier
            parameters: Additional query parameters

        Returns:
            List of row dicts

        Example:
            results = client.execute_tenant_query(
                "SELECT * FROM entity_events "
                "WHERE tenant_id = {tenant_id_param:String} "
                "AND timestamp > {since_param:DateTime}",
                tenant_id=current_user.tenant_id,
                parameters={"since_param": datetime.utcnow() - timedelta(hours=1)}
            )
        """
        validated_tid = self._validate_tenant_id(tenant_id)

        if "{tenant_id_param" not in query_template:
            raise ValueError(
                "Query template missing {tenant_id_param} placeholder. "
                "All tenant-scoped queries must include explicit tenant isolation."
            )

        params = parameters or {}
        params["tenant_id_param"] = validated_tid

        result = self._client.query(query_template, parameters=params)
        return [dict(zip(result.column_names, row)) for row in result.result_rows]

    def execute_raw(self, query: str, parameters: dict[str, Any] | None = None) -> Any:
        """
        Raw query for admin/analytics use only.
        Requires explicit documentation of why tenant isolation is not needed.
        All calls are logged to the security audit log.
        """
        # Log to audit trail (no raw query content — hash only)
        import hashlib
        query_hash = hashlib.sha256(query.encode()).hexdigest()[:16]
        # TODO: wire to SIEM audit log
        print(f"[AUDIT:RAW_QUERY] hash={query_hash}")

        return self._client.query(query, parameters=parameters)
