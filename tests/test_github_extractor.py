import json
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from unittest.mock import patch
import asyncio

import pytest

from sentinel_x.data_sources.github_extractor import SentinelXGitHubExtractor

class MockResponse:
    def __init__(self, json_data, status_code=200):
        self._json = json_data
        self.status_code = status_code
    def json(self):
        return self._json
    def raise_for_status(self):
        if self.status_code != 200:
            raise requests.HTTPError(self.status_code)

def test_github_extractor_basic(monkeypatch):
    # Patch requests.get to return synthetic data for issues, commits, and trees
    import requests
    def fake_get(url, headers=None, timeout=None):
        if url.endswith("/issues?state=all&per_page=100&page=1"):
            return MockResponse([
                {
                    "id": 1,
                    "number": 101,
                    "title": "Test issue",
                    "body": "body",
                    "labels": [{"name": "bug"}],
                    "created_at": "2026-01-01T00:00:00Z"
                }
            ])
        if url.endswith("/commits?per_page=100&page=1"):
            return MockResponse([
                {
                    "sha": "abcd1234",
                    "commit": {"author": {"name": "tester", "date": "2026-01-01T00:00:00Z", "message": "msg"}, "message": "msg"},
                    "html_url": "http://example.com"
                }
            ])
        if url.endswith("/git/trees/main?recursive=1"):
            return MockResponse({"tree": [{"path": "README.md", "type": "blob", "size": 123}]} )
        return MockResponse([], 404)

    monkeypatch.setattr(requests, 'get', fake_get)
    import requests
    extractor = SentinelXGitHubExtractor()

    loop = asyncio.get_event_loop()
    data = loop.run_until_complete(extractor.extract_all())
    assert 'issues' in data and isinstance(data['issues'], list)
    assert 'commits' in data and isinstance(data['commits'], list)
    assert 'files' in data and isinstance(data['files'], list)
    print("Fetched", len(data['issues']), "issues and", len(data['commits']), "commits")
