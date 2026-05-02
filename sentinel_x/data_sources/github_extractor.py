"""
Sentinel-X GitHub Data Extractor (production skeleton)
- FREE data extraction from the public Sentinel-X repo
- Extract issues, commits, and code file metadata for ML features
- Returns a structured dataset suitable for ingestion into training
"""
from __future__ import annotations

import aiohttp
import asyncio
import json
from datetime import datetime
from typing import List, Dict, Optional

import requests


class SentinelXGitHubExtractor:
    def __init__(self, github_token: Optional[str] = None):
        self.base_url = "https://api.github.com/repos/MSA-83/SENTINEL-X"
        self.headers: Dict[str, str] = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "SentinelX-Data-Extractor",
        }
        if github_token:
            self.headers["Authorization"] = f"token {github_token}"

    def _get(self, url: str) -> List[Dict]:
        resp = requests.get(url, headers=self.headers, timeout=20)
        if resp.status_code != 200:
            return []
        data = resp.json()
        if isinstance(data, list):
            return data
        return data.get("items", []) if isinstance(data, dict) else []

    async def fetch_issues(self, max_pages: int = 5) -> List[Dict]:
        issues: List[Dict] = []
        for page in range(1, max_pages + 1):
            url = f"{self.base_url}/issues?state=all&per_page=100&page={page}"
            data = self._get(url)
            if not data:
                break
            for issue in data:
                issues.append({
                    "id": issue.get("id"),
                    "number": issue.get("number"),
                    "title": issue.get("title"),
                    "body": issue.get("body"),
                    "labels": [l.get("name") for l in issue.get("labels", [])],
                    "created_at": issue.get("created_at"),
                    "type": "pr" if "pull_request" in issue else "issue",
                })
            await asyncio.sleep(0.2)
        return issues

    async def fetch_commits(self, max_pages: int = 5) -> List[Dict]:
        commits: List[Dict] = []
        for page in range(1, max_pages + 1):
            url = f"{self.base_url}/commits?per_page=100&page={page}"
            data = self._get(url)
            if not data:
                break
            for c in data:
                commit = c.get("commit", {})
                commits.append({
                    "sha": c.get("sha"),
                    "author": commit.get("author", {}).get("name"),
                    "timestamp": commit.get("commit", {}).get("author", {}).get("date"),
                    "message": commit.get("commit", {}).get("message"),
                    "url": c.get("html_url"),
                })
            await asyncio.sleep(0.2)
        return commits

    async def fetch_code_files(self) -> List[Dict]:
        url = f"{self.base_url}/git/trees/main?recursive=1"
        resp = requests.get(url, headers=self.headers, timeout=20)
        if resp.status_code != 200:
            return []
        data = resp.json()
        files = []
        for item in data.get("tree", []):
            if item.get("type") == "blob":
                files.append({"path": item.get("path"), "size": item.get("size", 0)})
        return files

    async def extract_all(self) -> Dict:
        issues = await self.fetch_issues()
        commits = await self.fetch_commits()
        files = await self.fetch_code_files()
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "repo": "MSA-83/SENTINEL-X",
            "issues": issues,
            "commits": commits,
            "files": files,
            "stats": {
                "total_issues": len(issues),
                "total_commits": len(commits),
                "total_files": len(files),
            },
        }


async def main():
    ex = SentinelXGitHubExtractor()
    data = await ex.extract_all()
    with open("sentinel_x_github_data.json", "w") as f:
        json.dump(data, f, indent=2)
    print(f"Wrote sentinel_x_github_data.json with {len(data.get('issues', []))} issues")

if __name__ == "__main__":
    asyncio.run(main())
