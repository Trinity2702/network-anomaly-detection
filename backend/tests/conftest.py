# backend/tests/conftest.py
import sys
from pathlib import Path

# Add the backend project folder to sys.path so tests can import modules by name
ROOT = Path(__file__).resolve().parents[1]   # -> backend/
sys.path.insert(0, str(ROOT))
