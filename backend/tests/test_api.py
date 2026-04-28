# tests/test_api.py
import sys
import types
import json
import pytest

# Create a lightweight fake tensorflow module to avoid heavy TF dependency on import
fake_tf = types.ModuleType("tensorflow")
# minimal keras namespace used during import (we don't actually train in tests)
fake_tf.keras = types.SimpleNamespace(
    models=types.SimpleNamespace(load_model=lambda *a, **k: None, Model=lambda *a, **k: None),
    layers=types.SimpleNamespace(Dense=lambda *a, **k: None),
    callbacks=types.SimpleNamespace(Callback=object)
)
sys.modules.setdefault("tensorflow", fake_tf)


@pytest.fixture(scope="module")
def client():
    # Import the app after inserting fake tensorflow
    # Import the backend FastAPI app. Adjust import path if your package name differs.
    try:
        from backend.main import app
    except Exception:
        # fallback if package is flat: try top-level main
        from main import app
    from fastapi.testclient import TestClient
    return TestClient(app)


def test_root_status(client):
    r = client.get("/")
    assert r.status_code == 200
    assert "message" in r.json()

def test_status_endpoint_fields(client):
    r = client.get("/status")
    assert r.status_code == 200
    j = r.json()
    # check presence of keys we rely on
    assert "models_loaded" in j
    assert "active_model" in j
    assert "is_generating" in j
    assert "threshold" in j

def test_detect_rule_based_anomaly(client):
    # This payload should trigger the rule-based fallback in detect_anomaly
    payload = {
        "data": [
            {"Packet Size": 100, "Throughput": 50},     # small packet + high throughput => anomaly
            {"Packet Size": 2000, "Throughput": 1}      # large packet => anomaly per rules
        ]
    }
    r = client.post("/detect", json=payload)
    assert r.status_code == 200
    j = r.json()
    # should return anomalies (list)
    assert "anomalies" in j
    # since both items match fallback rules, expect at least one anomaly
    assert isinstance(j["anomalies"], list)
    assert len(j["anomalies"]) >= 1

def test_update_settings_and_retrieve(client):
    # change threshold and model_type (model_type may be untrained, so if invalid will return 400)
    new_settings = {"threshold": 0.5}
    r = client.post("/settings", json=new_settings)
    assert r.status_code == 200
    j = r.json()
    assert j["current_settings"]["threshold"] == 0.5
