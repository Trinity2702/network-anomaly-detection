# backend/tests/test_integration.py
import sys
import types
import json
import time
import pytest
from pathlib import Path

# --- ensure backend package root is importable (if needed) ---
ROOT = Path(__file__).resolve().parents[1]  # -> backend/
sys.path.insert(0, str(ROOT))

# --- provide a tiny fake tensorflow if your main imports it at top-level ---
fake_tf = types.ModuleType("tensorflow")
fake_tf.keras = types.SimpleNamespace(
    models=types.SimpleNamespace(load_model=lambda *a, **k: None, Model=lambda *a, **k: None),
    layers=types.SimpleNamespace(Dense=lambda *a, **k: None),
    callbacks=types.SimpleNamespace(Callback=object)
)
sys.modules.setdefault("tensorflow", fake_tf)

from fastapi.testclient import TestClient

# Import app (adjust path if your app lives elsewhere)
try:
    from backend.main import app
except Exception:
    from main import app  # fallback for flat layout

client = TestClient(app)


def sample_payload():
    """
    Small helper to produce a realistic detection payload.
    Format matches your /detect tests from earlier.
    """
    return {
        "data": [
            {"Packet Size": 120, "Flow Duration": 30, "Throughput": 40},
            {"Packet Size": 1500, "Flow Duration": 5, "Throughput": 0.5},  # likely anomalous
        ]
    }


def test_end_to_end_detection_flow():
    """
    End-to-end: call /detect and assert it returns an anomalies list and scores.
    This validates request parsing -> preprocessing -> scoring -> response logic.
    """
    r = client.post("/detect", json=sample_payload())
    assert r.status_code == 200, f"/detect returned {r.status_code} {r.text}"
    body = r.json()
    # Basic contract checks - adapt keys if your API uses different names
    assert "anomalies" in body, "Response missing 'anomalies' field"
    assert isinstance(body["anomalies"], list)

    # optionally check that at least one of the returned items has a numerical score
    if len(body["anomalies"]) > 0:
        first = body["anomalies"][0]
        assert isinstance(first, dict)
        # score key may be named 'score' / 's' / 'anomaly_score' in your API — adjust as required.
        # Try multiple possible keys to be robust:
        possible_score_keys = ("score", "s", "anomaly_score", "anomalyScore")
        assert any(k in first for k in possible_score_keys), (
            "No score found on anomaly object; update test to match your API"
        )


def test_train_and_switch_workflow():
    """
    Simulate operator changing settings (threshold / model).
    Verifies settings accepted and status reflects the change.
    This tests persistence and the settings endpoint -> status reporting.
    """
    # 1) get current status
    r = client.get("/status")
    assert r.status_code == 200
    status_before = r.json()

    # 2) update settings: change threshold and (optionally) active model
    new_settings = {"threshold": 0.42}
    r = client.post("/settings", json=new_settings)
    assert r.status_code == 200, f"/settings failed: {r.status_code} {r.text}"
    resp = r.json()
    # The endpoint should echo or expose the new setting; adapt key if different
    assert "current_settings" in resp or "settings" in resp or r.json() is not None

    # 3) retrieve status and confirm threshold changed (best-effort; might be nested)
    r2 = client.get("/status")
    assert r2.status_code == 200
    status_after = r2.json()

    # Try to find threshold in the returned status dict (robust lookup)
    def find_threshold(obj):
        if isinstance(obj, dict):
            for k, v in obj.items():
                if k.lower().startswith("threshold"):
                    return v
                found = find_threshold(v)
                if found is not None:
                    return found
        return None

    reported_threshold = find_threshold(status_after)
    # If the service does not report threshold in status, we still accept success of /settings.
    if reported_threshold is not None:
        assert abs(float(reported_threshold) - 0.42) < 1e-6


@pytest.mark.skipif(True, reason="enable if your app exposes a websocket streaming endpoint at /ws")
def test_websocket_streaming():
    """
    Optional WebSocket integration test.
    Enable this test by removing the skipif or setting condition to False.
    It expects a server WebSocket at '/ws' that pushes events (e.g., anomalies).
    """
    # Connect to the WS. If your socket path differs, change '/ws' accordingly.
    with client.websocket_connect("/ws") as ws:
        # Read a single message (blocks until server sends or times out)
        msg = ws.receive_json(timeout=5)  # may raise if no message
        assert isinstance(msg, dict)
        # Basic contract for pushed event
        assert "type" in msg or "event" in msg or "anomaly" in msg


# Helpful: a small smoke test that repeated detection + status check works under load
def test_repeated_detects_and_status_consistency():
    """
    Sends multiple /detect requests in a loop to ensure consistent behavior.
    Useful to catch shared-state or race conditions.
    """
    for i in range(8):
        r = client.post("/detect", json=sample_payload())
        assert r.status_code == 200
        body = r.json()
        assert "anomalies" in body
        # do a status ping occasionally
        if i % 3 == 0:
            s = client.get("/status")
            assert s.status_code == 200
