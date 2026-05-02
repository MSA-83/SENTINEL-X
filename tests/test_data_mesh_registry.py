import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import json
from pathlib import Path
import tempfile

from sentinel_x.data_mesh.abstraction_layer import DataMeshRegistry, DataProduct


def test_registry_registration_and_publish(tmp_path: Path):
    registry_path = tmp_path / "registry.json"
    reg = DataMeshRegistry(path=registry_path)

    prod = DataProduct(
        product_id="air.telemetry.v1",
        name="AircraftTelemetry",
        owner="ml-team",
        version="v1.0",
        sources=["opensky", "synthetic"],
        consumers=["ml", "analytics"],
        metadata={"published": False},
    )

    pid = reg.register_product(prod)
    assert pid == prod.product_id

    all_prods = reg.list_products()
    assert len(all_prods) >= 1

    fetched = reg.get_product(prod.product_id)
    assert fetched is not None and fetched.product_id == prod.product_id

    # Publish to a dummy path
    ok = reg.publish_product(prod.product_id, "/tmp/path/telemetry.parquet")
    assert ok is True
    published = reg.consume_product(prod.product_id)
    assert published is None or isinstance(published, str)

    # Export registry JSON string and validate contains product_id
    registry_json = reg.export_registry()
    data = json.loads(registry_json)
    assert prod.product_id in data.get("products", {})
