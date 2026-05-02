"""
Automated PR creator for End-to-End Demo (feature/end-to-end-demo -> main).
This is a lightweight helper that uses the GitHub REST API and a token
provided via environment variables. It creates a PR with a detailed body based
on the current patch set.
"""
from __future__ import annotations

import os
import sys
import json
import requests

OWNER = "MSA-83"
REPO = "SENTINEL-X"
HEAD_BRANCH = "feature/end-to-end-demo"
BASE_BRANCH = "main"

TITLE = "End-to-End Demo: Free-Tier Data Ingest → Data Mesh Registry → Synthetic Training Artifacts"
BODY = """
## Summary
- This PR introduces a complete end-to-end demo for Sentinel-X that uses 100% free-tier tooling to demonstrate data ingestion, data mesh data products, synthetic training data, and a lightweight ML artifact workflow.
- The PR includes new data extractors, data mesh registry improvements, cross-region orchestration scaffolds, ML skeletons, and a demo script.

## Included changes
- Demos: demos/demo_end_to_end.py
- Data sources: sentinel_x/data_sources/github_extractor.py, sentinel_x/datasets/public_data_sources.py
- Data mesh: sentinel_x/data_mesh/abstraction_layer.py
- Cross-region: distributed_hierarchy.py
- ML skeletons: training/multi_modal_anomaly_detector.py
- Canary/Chaos scaffolds: deployment/canary_pipeline.py, deployment/chaos_engineering.py
- ATK-10 privilege escalation: sentinel_x/security/atk_10_privilege_escalation.py
- GDPR/IL6: sentinel_x/compliance/gdpr_eraser.py, sentinel_x/security/il6_audit.py
- Tests: tests/test_*.py
- CI: .github/workflows/ci.yml
- Architecture: ARCHITECTURE.md

## Testing & Review
- Local: run tests, run demo_end_to_end.py
- CI: verify PR checks, tests

## Security
- PR creation uses GITHUB_TOKEN (provided by CI). Do not reuse pasted tokens here.

"""

def main():
  token = os.getenv("GITHUB_TOKEN") or os.getenv("GH_TOKEN")
  if not token:
    print("No GitHub token found in GITHUB_TOKEN or GH_TOKEN environment variables.")
    print("Please supply a token with repo scope as a secret in your CI or environment.")
    sys.exit(0)  # exit gracefully; the PR can be created by CI later

  headers = {
    "Authorization": f"token {token}",
    "Accept": "application/vnd.github+json",
  }

  url = f"https://api.github.com/repos/{OWNER}/{REPO}/pulls"

  # Check if PR already exists
  params = {"state": "open", "head": f"{OWNER}:{HEAD_BRANCH}", "base": BASE_BRANCH}
  resp = requests.get(url, headers=headers, params=params)
  if resp.ok:
    data = resp.json()
    if isinstance(data, list) and len(data) > 0:
      pr_url = data[0].get("html_url")
      print(f"PR already exists: {pr_url}")
      return

  payload = {
    "title": TITLE,
    "head": HEAD_BRANCH,
    "base": BASE_BRANCH,
    "body": BODY
  }

  r = requests.post(url, headers=headers, data=json.dumps(payload))
  if r.ok:
    pr = r.json()
    print(f"PR created: {pr.get('html_url')}")
  else:
    print(f"Failed to create PR: {r.status_code} - {r.text}")

if __name__ == "__main__":
  main()
