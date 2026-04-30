# 🚀 Network Traffic Anomaly Detection System

A full-stack real-time network traffic monitoring and anomaly detection platform using unsupervised machine learning models.

---

## 📌 Overview

This project simulates network traffic, streams it in real-time, and detects anomalies using multiple ML models.

It consists of:

- **Frontend (Next.js)** → Dashboard UI
- **Backend (FastAPI)** → Data generation, ML training, API, WebSocket

---

## 🧱 Project Structure
root/
│
├── app/ , components/ , lib/ # Frontend (Next.js)
├── backend/ # FastAPI backend
│ ├── main.py # API + WebSocket server
│ ├── data_generator.py # Generates synthetic traffic
│ ├── preprocessor.py # Data preprocessing
│ ├── models/ # ML models
│ └── requirements.txt


---

## ⚙️ How to Run Locally (Step-by-Step)

### 🔹 Step 1: Start Frontend

Open terminal in project root:

```bash
npm install
npm run dev

👉 Frontend runs at:
http://localhost:3000


### 🔹 Step 2: Start Backend

Open a new terminal

1. Create virtual environment

### Windows (PowerShell):
 py -m venv .venv
.\.venv\Scripts\Activate.ps1
### macOS/Linux:
python3 -m venv .venv
source .venv/bin/activate

2. Install dependencies
  cd backend
  pip install -r backend/requirements.txt

3. Run backend
  uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
👉 Backend runs at:
  http://localhost:8000

---

## 🔗 Frontend ↔ Backend Connection

The frontend communicates with backend using:
lib/api-client.ts

Make sure this file contains:
 const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

---


##🌐 Deployment
  Frontend: Deployed on Vercel
  Backend: Deployed on Railway

In production, set environment variable:
NEXT_PUBLIC_API_URL=https://your-backend-url

---


## ⚡ Features
🔴 Real-time traffic simulation using WebSocket
🧠 Multiple ML models:
1. Autoencoder
2. One-Class SVM
3. Isolation Forest
4. PCA
📊 Live anomaly detection dashboard
🔁 Continuous streaming and detection
🏋️ On-demand model training
📈 Training progress tracking (/train/status)
🔄 Automatic model switching
🧪 Fresh dataset generated for every training run

---

##  🔄 How the System Works
  1. Backend generates synthetic network traffic
  2. WebSocket continuously streams data
  3. Frontend receives live data
  4. Model detects anomalies in real-time
  5. Training can be triggered anytime
  6. UI updates instantly

---

##   📌 Key Components
1. Backend (FastAPI)
  - /api/detect: Receives JSON data for detection
  - /api/train/{model_type}: Triggers model training
  - /api/train/status: Checks training progress
  - /api/threshold: Sets detection threshold
  - /ws/traffic: WebSocket for real-time data
  - data_generator.py: Generates normal + attack traffic
  - preprocessor.py: Preprocesses data before ML

2. Frontend (Next.js)
  - Dashboard UI with real-time metrics
  - Anomaly detection visualizations
  - Model training controls
  - Threshold adjustment
  - Live WebSocket updates

---
  
##  ⚠️ Important Notes
-Backend must be running before frontend features work
-Click Start Analysis to begin streaming
-Train at least one model (e.g., Autoencoder)
-If model is not trained → rule-based detection is used