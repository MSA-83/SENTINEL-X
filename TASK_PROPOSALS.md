# Codebase issue triage: proposed tasks

## 1) Typo fix task
**Task:** Update the `/api/health` response version string from `4.0.0` to the current release (`4.0.2`).

**Why:** README and changelog identify the active version as `4.0.2`, but the runtime health payload reports `4.0.0`. This looks like a stale literal/version typo and can mislead monitoring and status dashboards.

## 2) Bug fix task
**Task:** Unify threat/fusion zone definitions so backend and frontend use one canonical source (or ensure both lists contain the same 15 zones).

**Why:** Backend `FUSION_ZONES` currently has 12 entries, while frontend `THREAT_ZONES` has 15. This can produce inconsistent analytics, zone summaries, and API vs UI behavior.

## 3) Code comment / documentation discrepancy task
**Task:** Correct stale architecture comments describing GDELT behavior ("retry + stagger") to match current implementation and changelog behavior.

**Why:** The source header still documents retry+stagger semantics, but README v4.0.2 notes retries were removed and requests are now grouped in parallel phases. Keeping this comment accurate reduces on-call confusion.

## 4) Test improvement task
**Task:** Add automated tests (e.g., Vitest) for:
- `/api/health` version contract,
- `/api/fusion/zones` expected zone count/content,
- geocoding longest-match behavior,
- parser guards for malformed/HTML responses.

**Why:** `package.json` has no `test` script and no test dependencies, so regressions in API contracts and parser resilience are currently easy to miss.
