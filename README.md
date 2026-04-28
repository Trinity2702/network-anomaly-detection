Project structure and how to run

Frontend (Next.js) — ./ (root)
- Start: npm install && npm run dev
- Opens at: http://localhost:3000

Backend (FastAPI) — ./backend/
- Create venv:
  macOS/Linux: python3 -m venv .venv && source .venv/bin/activate
  Windows (PowerShell): py -m venv .venv; .\\.venv\\Scripts\\Activate.ps1
- Install deps: pip install -r backend/requirements.txt
- Start (from project root or backend folder):
  python -m backend.main
  or
  uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

What changed (matches your requirements)
- Fresh dataset per training run: Backend now generates a brand-new synthetic dataset each time you click Train (no CSV needed).
- Real-time data: The WebSocket stream continuously generates new traffic data; anomaly detection runs live on each data point.
- Visible training progress: /train/status updates every epoch (autoencoder) — the UI polls and shows progress.
- Model selection: You can select any model. If it isn’t trained, the UI automatically starts training and switches when done.
- Separate backend folder: Code is under backend/.

Tips
- If anomalies don’t show immediately, start the stream (Start Analysis) and also train at least one model (e.g., Autoencoder). Rule-based detection still highlights obvious anomalies while models train.
- Change API base URL in lib/api-client.ts if your backend runs elsewhere.
