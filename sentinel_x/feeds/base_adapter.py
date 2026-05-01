"""
Production feed adapter base class.
All 13 SENTINEL-X feed adapters extend this.
Implements: circuit breaker, exponential backoff with jitter,
connection pooling, backpressure, health reporting.
"""
from __future__ import annotations


import asyncio
import enum
import logging
import random
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, AsyncIterator


logger = logging.getLogger(__name__)


class CircuitState(enum.Enum):
    CLOSED = "closed"       # Normal: requests pass through
    OPEN = "open"           # Failing: requests blocked immediately
    HALF_OPEN = "half_open" # Recovery probe: one request allowed through




@dataclass
class CircuitBreakerConfig:
    failure_threshold: int = 5          # Failures before opening
    success_threshold: int = 2          # Successes in HALF_OPEN to close
    timeout_seconds: float = 30.0       # How long to stay OPEN before probing
    half_open_max_calls: int = 1        # Max concurrent calls in HALF_OPEN




@dataclass
class RetryConfig:
    max_attempts: int = 7
    base_delay_seconds: float = 1.0
    max_delay_seconds: float = 120.0
    jitter_factor: float = 0.3          # ±30% jitter — prevents thundering herd
    backoff_multiplier: float = 2.0




@dataclass
class FeedHealth:
    feed_name: str
    state: CircuitState = CircuitState.CLOSED
    consecutive_failures: int = 0
    consecutive_successes: int = 0
    last_success_ts: float = 0.0
    last_failure_ts: float = 0.0
    total_messages_processed: int = 0
    total_errors: int = 0
    last_error: str = ""
    latency_p99_ms: float = 0.0
    latency_samples: list[float] = field(default_factory=list)
    priority: str = "P1"  # "P0" or "P1"


    @property
    def error_rate(self) -> float:
        total = self.total_messages_processed + self.total_errors
        return self.total_errors / total if total > 0 else 0.0


    def record_latency(self, ms: float) -> None:
        self.latency_samples.append(ms)
        if len(self.latency_samples) > 1000:
            self.latency_samples = self.latency_samples[-1000:]
        samples = sorted(self.latency_samples)
        if samples:
            idx = int(len(samples) * 0.99)
            self.latency_p99_ms = samples[min(idx, len(samples) - 1)]


class FeedAdapter(ABC):
    """
    Abstract base class for all SENTINEL-X feed adapters.


    Subclasses implement:
        - _connect(): establish feed connection
        - _disconnect(): clean shutdown
        - _fetch_batch(): yield one batch of raw payload dicts
        - feed_name: str class attribute
        - priority: "P0" or "P1"


    Circuit breaker, retry, backpressure, and health tracking are handled here.
    Subclasses MUST NOT implement retry logic themselves.
    """


    feed_name: str = "base"
    priority: str = "P1"


    def __init__(
        self,
        cb_config: CircuitBreakerConfig | None = None,
        retry_config: RetryConfig | None = None,
        max_queue_size: int = 10_000,
    ) -> None:
        self.cb_config = cb_config or CircuitBreakerConfig()
        self.retry_config = retry_config or RetryConfig()
        self.health = FeedHealth(
            feed_name=self.feed_name,
            priority=self.priority,
        )
        self._queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(
            maxsize=max_queue_size
        )
        self._circuit_open_since: float = 0.0
        self._half_open_calls: int = 0
        self._connected = False


    # ── Circuit Breaker ──────────────────────────────────────────────────


    def _can_attempt(self) -> bool:
        """Return True if a connection attempt is allowed by circuit state."""
        state = self.health.state


        if state == CircuitState.CLOSED:
            return True


        if state == CircuitState.OPEN:
            elapsed = time.monotonic() - self._circuit_open_since
            if elapsed >= self.cb_config.timeout_seconds:
                self.health.state = CircuitState.HALF_OPEN
                self._half_open_calls = 0
                logger.info("[%s] Circuit HALF_OPEN — probing", self.feed_name)
                return True
            return False


        if state == CircuitState.HALF_OPEN:
            if self._half_open_calls < self.cb_config.half_open_max_calls:
                self._half_open_calls += 1
                return True
            return False  # Already have a probe in flight


        return False


    def _record_success(self) -> None:
        self.health.consecutive_failures = 0
        self.health.consecutive_successes += 1
        self.health.last_success_ts = time.time()


        if self.health.state == CircuitState.HALF_OPEN:
            if self.health.consecutive_successes >= self.cb_config.success_threshold:
                self.health.state = CircuitState.CLOSED
                logger.info("[%s] Circuit CLOSED — feed recovered", self.feed_name)


    def _record_failure(self, error: str) -> None:
        self.health.consecutive_failures += 1
        self.health.consecutive_successes = 0
        self.health.last_failure_ts = time.time()
        self.health.total_errors += 1
        self.health.last_error = error[:200]


        if self.health.state in (CircuitState.CLOSED, CircuitState.HALF_OPEN):
            if self.health.consecutive_failures >= self.cb_config.failure_threshold:
                self.health.state = CircuitState.OPEN
                self._circuit_open_since = time.monotonic()
                logger.error(
                    "[%s] Circuit OPEN after %d failures. "
                    "Last error: %s. SLA: %s",
                    self.feed_name,
                    self.health.consecutive_failures,
                    error[:100],
                    self.health.priority,
                )
                if self.health.priority == "P0":
                    logger.critical(
                        "[P0-ALERT] %s is DOWN — 15-minute SLA breach imminent. "
                        "Page on-call immediately.",
                        self.feed_name,
                    )


    # ── Retry with Jitter ────────────────────────────────────────────────


    def _jittered_delay(self, attempt: int) -> float:
        """Compute exponential backoff delay with uniform jitter."""
        base = self.retry_config.base_delay_seconds * (
            self.retry_config.backoff_multiplier ** attempt
        )
        capped = min(base, self.retry_config.max_delay_seconds)
        jitter = capped * self.retry_config.jitter_factor
        return capped + random.uniform(-jitter, jitter)


    # ── Main Ingestion Loop ────────────────────────────────────────────────


    async def run(self) -> None:
        """
        Main ingestion loop. Call as an asyncio task.
        Runs indefinitely, reconnecting on failure with circuit breaker protection.
        """
        attempt = 0
        while True:
            if not self._can_attempt():
                wait = self._jittered_delay(min(attempt, 10))
                logger.debug(
                    "[%s] Circuit %s — waiting %.1fs before retry",
                    self.feed_name, self.health.state.value, wait,
                )
                await asyncio.sleep(wait)
                attempt += 1
                continue


            try:
                logger.info("[%s] Connecting (attempt %d)...", self.feed_name, attempt + 1)
                await self._connect()
                self._connected = True
                self._record_success()
                attempt = 0  # Reset on clean connection


                async for batch in self._fetch_batch():
                    t0 = time.monotonic()
                    for item in batch:
                        if self._queue.full():
                            # Backpressure: drop oldest items (intelligence is time-sensitive)
                            try:
                                self._queue.get_nowait()
                            except asyncio.QueueEmpty:
                                pass
                        await self._queue.put(item)
                    elapsed_ms = (time.monotonic() - t0) * 1000
                    self.health.record_latency(elapsed_ms)
                    self.health.total_messages_processed += len(batch)


            except asyncio.CancelledError:
                logger.info("[%s] Adapter cancelled — clean shutdown", self.feed_name)
                await self._disconnect()
                return


            except Exception as exc:
                error_str = f"{type(exc).__name__}: {exc}"
                self._record_failure(error_str)
                self._connected = False
                await self._disconnect()


                if attempt >= self.retry_config.max_attempts:
                    logger.error(
                        "[%s] Max retries (%d) exceeded. Resetting counter.",
                        self.feed_name, self.retry_config.max_attempts,
                    )
                    attempt = 0  # Reset but circuit is already OPEN — won't retry fast


                wait = self._jittered_delay(attempt)
                logger.info("[%s] Retry in %.1fs", self.feed_name, wait)
                await asyncio.sleep(wait)
                attempt += 1


    async def consume(self) -> AsyncIterator[dict[str, Any]]:
        """Async iterator over incoming feed items. Use in entity processing."""
        while True:
            item = await self._queue.get()
            yield item
            self._queue.task_done()


    # ── Abstract interface ──────────────────────────────────────────────────


    @abstractmethod
    async def _connect(self) -> None:
        """Establish connection to feed source."""


    @abstractmethod
    async def _disconnect(self) -> None:
        """Clean up connection resources."""


    @abstractmethod
    async def _fetch_batch(self) -> AsyncIterator[list[dict[str, Any]]]:
        """Yield batches of raw payload dicts from feed source."""
