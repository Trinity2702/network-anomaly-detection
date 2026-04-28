# backend/tests/e2e/test_dashboard_e2e.py
import os
import subprocess
import time
import requests
import signal
import sys
import pytest
from pathlib import Path

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

ROOT = Path(__file__).resolve().parents[2]  # repo root or backend/..
BACKEND_PORT = int(os.environ.get("BACKEND_PORT", 8000))
FRONTEND_PORT = int(os.environ.get("FRONTEND_PORT", 3000))
BACKEND_URL = f"http://127.0.0.1:{BACKEND_PORT}"
FRONTEND_URL = f"http://127.0.0.1:{FRONTEND_PORT}"

UVICORN_CMD = ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", str(BACKEND_PORT)]

# If your Next.js app is in a sibling folder, adjust this path.
FRONTEND_DIR = ROOT  # change to ROOT/"frontend" if appropriate
FRONTEND_START_CMD = ["npm", "run", "start"]  # expects build exists; can use "dev" if needed

def wait_for(url, timeout=20.0):
    """Wait until HTTP GET to url returns 200, or timeout (seconds)."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            r = requests.get(url, timeout=2.0)
            if r.status_code == 200:
                return True
        except Exception:
            pass
        time.sleep(0.5)
    return False

@pytest.fixture(scope="session")
def services():
    """Start backend and frontend and yield control; ensure teardown."""
    procs = []

    # 1) Start backend with uvicorn
    backend_env = os.environ.copy()
    # if you need to set env vars for tests, do it here
    backend_proc = subprocess.Popen(UVICORN_CMD, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    procs.append(backend_proc)

    # 2) Start frontend (if you have Node app). If you don't, skip and assume frontend is static or served elsewhere.
    frontend_proc = None
    # If package.json exists in FRONTEND_DIR, attempt to start.
    if (FRONTEND_DIR / "package.json").exists():
        # Use `npm run start` (requires a prior build) — CI below will build before tests.
        frontend_proc = subprocess.Popen(FRONTEND_START_CMD, cwd=str(FRONTEND_DIR), stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        procs.append(frontend_proc)

    # Wait for backend & frontend
    assert wait_for(f"{BACKEND_URL}/health", timeout=20), f"Backend did not become healthy at {BACKEND_URL}/health"
    if frontend_proc:
        assert wait_for(FRONTEND_URL, timeout=30), f"Frontend not available at {FRONTEND_URL}"

    yield {"backend": BACKEND_URL, "frontend": FRONTEND_URL}

    # Teardown
    for p in procs:
        try:
            p.send_signal(signal.SIGINT)
        except Exception:
            p.terminate()
    # give processes time to exit
    time.sleep(1)

def test_dashboard_shows_anomaly_after_inject(services):
    backend = services["backend"]
    frontend = services["frontend"]

    # Prepare a payload that will be classified as anomalous by your detect logic
    payload = {
        "data": [
            {"Packet Size": 9999, "Flow Duration": 0.1, "Throughput": 10000, "Packet Loss": 0.9, "Latency": 500}
        ]
    }

    # POST to /detect or a test-only endpoint; adjust path if different
    r = requests.post(f"{backend}/detect", json=payload, timeout=5.0)
    assert r.status_code == 200, f"/detect failed: {r.status_code} {r.text}"
    body = r.json()
    assert "anomalies" in body

    # Now open frontend and check UI updates
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(frontend, timeout=15000)

        # wait for a UI element that indicates an alert — adapt selector to your app
        # Example: an element with id "alerts-count" updates
        try:
            page.wait_for_selector("#alerts-count", timeout=5000)
            alert_text = page.query_selector("#alerts-count").inner_text()
            assert int(alert_text) >= 1
        except PlaywrightTimeout:
            # If no alerts-count, try looking for a table row containing the anomaly score
            rows = page.query_selector_all(".anomaly-row")
            assert len(rows) >= 1, "No anomaly rows found in UI"

        browser.close()
