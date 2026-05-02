import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from sentinel_x.compliance.gdpr_eraser import GDPREraser


def test_gdpr_erasure_request_basic(tmp_path):
    eraser = GDPREraser(dataset_dir=tmp_path)
    resp = eraser.submit_erasure_request("ac_12345", "tester@example.com")
    assert isinstance(resp, dict)
    assert resp.get("status") in {"scheduled"}
