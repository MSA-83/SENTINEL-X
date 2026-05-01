"""
Data Mesh Abstraction Layer
- Provides domain-owned data products with versioning hooks (DVC-friendly)
- Lightweight registry for data products, ownership, and metadata
- Integrates with existing Parquet/registry for lineage
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, List, Optional

REGISTRY_PATH = Path("datasets/mesh/registry.json")
REGISTRY_PATH.parent.mkdir(parents=True, exist_ok=True)


@dataclass
class DataProduct:
    product_id: str
    name: str
    owner: str
    version: str
    sources: List[str]
    consumers: List[str]
    metadata: Dict

    def to_dict(self) -> Dict:
        return asdict(self)


class DataMeshRegistry:
    """Lightweight in-repo registry for data mesh products"""

    def __init__(self, path: Optional[Path] = None):
        self.path = path or REGISTRY_PATH
        self._registry: Dict[str, DataProduct] = {}
        self._load()

    def _load(self) -> None:
        if self.path.exists():
            with open(self.path, "r") as f:
                data = json.load(f)
            for pid, item in data.get("products", {}).items():
                self._registry[pid] = DataProduct(**item)
        else:
            self._registry = {}

    def _save(self) -> None:
        data = {"products": {p.product_id: p.to_dict() for p in self._registry.values()}}
        with open(self.path, "w") as f:
            json.dump(data, f, indent=2)

    def register_product(self, product: DataProduct) -> str:
        self._registry[product.product_id] = product
        self._save()
        return product.product_id

    def publish_product(self, product_id: str, path: str) -> bool:
        # Placeholder: in production, copy to dataset storage (Parquet/PARQUET path)
        meta = self._registry.get(product_id)
        if not meta:
            return False
        meta.metadata["published_path"] = str(Path(path).resolve())
        self._save()
        return True

    def consume_product(self, product_id: str) -> Optional[str]:
        if product_id in self._registry:
            meta = self._registry[product_id]
            return meta.metadata.get("published_path")
        return None

    def list_products(self) -> List[DataProduct]:
        return list(self._registry.values())

    def get_product(self, product_id: str) -> Optional[DataProduct]:
        return self._registry.get(product_id)


def get_registry() -> DataMeshRegistry:
    return DataMeshRegistry()
