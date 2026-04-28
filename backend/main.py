from fastapi import FastAPI, WebSocket, WebSocketDisconnect, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import pandas as pd
import numpy as np
from tensorflow import keras
import joblib
import json
import asyncio
from datetime import datetime
import os
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from sklearn import svm
from sklearn.ensemble import IsolationForest
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

from .data_generator import generate_normal_traffic, inject_anomaly
from .preprocessor import preprocess_data_point

# ----------------------------
# App and CORS
# ----------------------------
app = FastAPI(title="Network Traffic Anomaly Detection API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For dev; restrict in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------------------
# Global State
# ----------------------------
models: Dict[str, Any] = {
    "autoencoder": None,
    "one_class_svm": None,
    "isolation_forest": None,
    "pca": None,
}
feature_list: Optional[List[str]] = None
scaler: Optional[StandardScaler] = None

threshold: float = 0.15
sensitivity: float = 0.7
selected_features: List[str] = ["Packet Size", "Flow Duration", "Throughput", "Packet Loss", "Latency"]

is_generating: bool = False
connected_clients: "set[WebSocket]" = set()
generation_task: Optional[asyncio.Task] = None
active_model: str = "autoencoder"

# Training status for UI polling
training_status = {
    "running": False,
    "model_type": None,
    "epoch": 0,
    "total_epochs": 0,
    "progress": 0.0,
    "message": "",
}

# ----------------------------
# Schemas
# ----------------------------
class ModelSettings(BaseModel):
    threshold: Optional[float] = None
    sensitivity: Optional[float] = None
    features: Optional[List[str]] = None
    model_type: Optional[str] = None

class TrainingRequest(BaseModel):
    model_type: str = "autoencoder"
    epochs: int = 50
    batch_size: int = 32
    encoding_dim: int = 8
    # Other model params
    nu: float = 0.1  # One-Class SVM
    contamination: float = 0.1  # Isolation Forest
    n_components: int = 2  # PCA
    # New controls
    dataset_size: int = 3000  # fresh synthetic rows each run
    set_active_when_done: bool = False

class DetectPayload(BaseModel):
    data: List[Dict[str, Any]]

# ----------------------------
# Utils
# ----------------------------
def load_models():
    """Load models/scaler/features from disk if present (optional)."""
    global models, feature_list, scaler
    try:
        if os.path.exists("features.joblib"):
            feature_list = joblib.load("features.joblib")
        if os.path.exists("scaler.joblib"):
            scaler = joblib.load("scaler.joblib")
        if os.path.exists("autoencoder_model.h5"):
            models["autoencoder"] = keras.models.load_model("autoencoder_model.h5")
        if os.path.exists("one_class_svm.joblib"):
            models["one_class_svm"] = joblib.load("one_class_svm.joblib")
        if os.path.exists("isolation_forest.joblib"):
            models["isolation_forest"] = joblib.load("isolation_forest.joblib")
        if os.path.exists("pca.joblib"):
            models["pca"] = joblib.load("pca.joblib")
    except Exception as e:
        print(f"Error loading models: {e}")

def make_fresh_dataset(n: int) -> pd.DataFrame:
    """Generate a brand-new synthetic dataset every training run."""
    rows = []
    for _ in range(max(1, n)):
        rows.append(generate_normal_traffic())
    df = pd.DataFrame(rows)
    # We train unsupervised (normal-only); anomalies not needed to fit
    return df

def broadcast_training_started(model_type: str, total_epochs: int):
    training_status.update({
        "running": True,
        "model_type": model_type,
        "epoch": 0,
        "total_epochs": total_epochs,
        "progress": 0.0,
        "message": f"Training {model_type} started",
    })

def broadcast_training_progress(epoch: int, total_epochs: int):
    pct = (epoch / max(1, total_epochs))
    training_status.update({
        "epoch": epoch,
        "total_epochs": total_epochs,
        "progress": pct,
        "message": f"Epoch {epoch}/{total_epochs}",
    })

def broadcast_training_done(msg: str = "Training complete"):
    training_status.update({
        "running": False,
        "progress": 1.0,
        "message": msg,
    })

# ----------------------------
# Training
# ----------------------------
def train_model_task(
    model_type: str,
    epochs: int = 50,
    batch_size: int = 32,
    encoding_dim: int = 8,
    nu: float = 0.1,
    contamination: float = 0.1,
    n_components: int = 2,
    dataset_size: int = 3000,
    set_active_when_done: bool = False,
):
    global models, feature_list, scaler, threshold, active_model

    try:
        # Always create a new dataset for this training run
        print(f"Generating synthetic dataset (n={dataset_size})...")
        df = make_fresh_dataset(dataset_size)

        # Build features (numeric) and fit scaler fresh each run
        X = df.copy()
        # Keep only numeric columns for training (protocol is categorical)
        for col in list(X.columns):
            if X[col].dtype == object:
                # drop strings for training (handled at runtime via preprocessor/protocol mapping)
                X.drop(columns=[col], inplace=True)

        feature_list = list(X.columns)
        joblib.dump(feature_list, "features.joblib")

        scaler_local = StandardScaler()
        X_scaled = scaler_local.fit_transform(X)
        scaler_obj_path = "scaler.joblib"
        joblib.dump(scaler_local, scaler_obj_path)

        # Expose scaler globally after dump
        globals()["scaler"] = scaler_local

        if model_type == "autoencoder":
            # Keras callback to update progress per epoch
            class ProgressCB(keras.callbacks.Callback):
                def on_train_begin(self, logs=None):
                    broadcast_training_started("autoencoder", epochs)
                def on_epoch_end(self, epoch, logs=None):
                    broadcast_training_progress(epoch + 1, epochs)
                def on_train_end(self, logs=None):
                    pass

            input_dim = X.shape[1]
            inp = keras.Input(shape=(input_dim,))
            enc = keras.layers.Dense(encoding_dim, activation="relu")(inp)
            dec = keras.layers.Dense(input_dim, activation="sigmoid")(enc)
            autoencoder = keras.Model(inputs=inp, outputs=dec)
            autoencoder.compile(optimizer="adam", loss="mse")

            es = keras.callbacks.EarlyStopping(monitor="val_loss", patience=5, restore_best_weights=True)
            autoencoder.fit(
                X_scaled, X_scaled,
                epochs=epochs,
                batch_size=batch_size,
                validation_split=0.1,
                shuffle=True,
                callbacks=[ProgressCB(), es],
                verbose=0,
            )
            # Recompute on full set for threshold
            X_pred = autoencoder.predict(X_scaled, verbose=0)
            mse = np.mean(np.square(X_scaled - X_pred), axis=1)
            threshold = float(np.percentile(mse, 95))
            autoencoder.save("autoencoder_model.h5")
            models["autoencoder"] = autoencoder
            msg = f"Autoencoder trained. Threshold={threshold:.5f}"

        elif model_type == "one_class_svm":
            broadcast_training_started("one_class_svm", 1)
            ocsvm = svm.OneClassSVM(nu=nu, kernel="rbf", gamma="auto")
            ocsvm.fit(X_scaled)
            joblib.dump(ocsvm, "one_class_svm.joblib")
            models["one_class_svm"] = ocsvm
            broadcast_training_progress(1, 1)
            msg = "One-Class SVM trained."

        elif model_type == "isolation_forest":
            broadcast_training_started("isolation_forest", 1)
            iso = IsolationForest(contamination=contamination, random_state=42)
            iso.fit(X_scaled)
            joblib.dump(iso, "isolation_forest.joblib")
            models["isolation_forest"] = iso
            broadcast_training_progress(1, 1)
            msg = "Isolation Forest trained."

        elif model_type == "pca":
            broadcast_training_started("pca", 1)
            pca = PCA(n_components=n_components)
            pca.fit(X_scaled)
            joblib.dump(pca, "pca.joblib")
            models["pca"] = pca
            broadcast_training_progress(1, 1)
            msg = "PCA trained."

        else:
            raise ValueError(f"Unknown model type: {model_type}")

        if set_active_when_done:
            active_model = model_type

        broadcast_training_done(msg)
        print(msg)

    except Exception as e:
        print(f"Training error: {e}")
        broadcast_training_done(f"Training failed: {e}")

# ----------------------------
# Detection
# ----------------------------
def detect_anomaly(data_point: Dict[str, Any]):
    global models, feature_list, scaler, threshold, active_model

    # Rule-based fallback so you see anomalies even before training
    if "Packet Size" in data_point and "Throughput" in data_point:
        if data_point["Packet Size"] < 200 and data_point["Throughput"] > 40:
            return True, 0.9
        if data_point["Packet Size"] > 1500:
            return True, 0.8
        if data_point.get("Flow Duration", 1e9) < 10:
            return True, 0.7

    if active_model not in models or models[active_model] is None or feature_list is None:
        return False, 0.0

    try:
        vec = preprocess_data_point(data_point, feature_list).reshape(1, -1)
        if scaler is not None:
            vec = scaler.transform(vec)

        if active_model == "autoencoder":
            recon = models["autoencoder"].predict(vec, verbose=0)
            mse = float(np.mean(np.square(vec - recon)))
            return mse > threshold, mse

        if active_model == "one_class_svm":
            pred = int(models["one_class_svm"].predict(vec)[0])
            score = -float(models["one_class_svm"].decision_function(vec)[0])
            return pred == -1, score

        if active_model == "isolation_forest":
            pred = int(models["isolation_forest"].predict(vec)[0])
            score = -float(models["isolation_forest"].decision_function(vec)[0])
            return pred == -1, score

        if active_model == "pca":
            z = models["pca"].transform(vec)
            recon = models["pca"].inverse_transform(z)
            mse = float(np.mean(np.square(vec - recon)))
            return mse > threshold, mse

        return False, 0.0

    except Exception as e:
        print(f"Error in detection: {e}")
        return False, 0.0

# ----------------------------
# Streaming Generator
# ----------------------------
async def generate_traffic_data():
    global is_generating
    is_generating = True
    try:
        while is_generating and len(connected_clients) > 0:
            data_points = []
            for _ in range(5):
                # 10% chance to inject clear anomaly
                if np.random.random() < 0.1:
                    dp = inject_anomaly()
                    dp["anomaly_type"] = "Injected"
                else:
                    dp = generate_normal_traffic()
                    dp["anomaly_type"] = "Normal"
                dp["timestamp"] = datetime.now().isoformat()

                is_anom, score = detect_anomaly(dp)
                formatted = {
                    "timestamp": datetime.fromisoformat(dp["timestamp"]),
                    "packetSize": float(dp["Packet Size"]),
                    "flowDuration": float(dp["Flow Duration"]),
                    "throughput": float(dp["Throughput"]),
                    "packetLoss": float(dp["Packet Loss"]),
                    "latency": float(dp["Latency"]),
                    "protocol": dp["Protocol Type"],
                    "source": f"192.168.{np.random.randint(1,255)}.{np.random.randint(1,255)}",
                    "destination": f"10.0.{np.random.randint(1,255)}.{np.random.randint(1,255)}",
                    "sourcePort": int(dp["Source Port"]),
                    "destinationPort": int(dp["Destination Port"]),
                    "isAnomaly": bool(is_anom),
                    "anomalyScore": float(score),
                    "anomalyType": dp["anomaly_type"],
                    "modelUsed": active_model,
                }
                data_points.append(formatted)

            if data_points and connected_clients:
                payload = []
                for p in data_points:
                    cp = p.copy()
                    cp["timestamp"] = cp["timestamp"].isoformat()
                    payload.append(cp)
                for ws in list(connected_clients):
                    try:
                        await ws.send_json({"type": "traffic_data", "data": payload})
                    except Exception:
                        if ws in connected_clients:
                            connected_clients.remove(ws)

            await asyncio.sleep(1)
    finally:
        is_generating = False

# ----------------------------
# API Routes
# ----------------------------
@app.get("/")
async def root():
    return {"message": "Network Traffic Anomaly Detection API"}

@app.get("/status")
async def get_status():
    return {
        "models_loaded": {name: m is not None for name, m in models.items()},
        "active_model": active_model,
        "is_generating": is_generating,
        "threshold": threshold,
        "sensitivity": sensitivity,
        "selected_features": selected_features,
        "connected_clients": len(connected_clients),
        "training": training_status,
    }

@app.get("/train/status")
async def get_training_status():
    return training_status

@app.post("/settings")
async def update_settings(settings: ModelSettings):
    global threshold, sensitivity, selected_features, active_model
    if settings.threshold is not None:
        threshold = settings.threshold
    if settings.sensitivity is not None:
        sensitivity = settings.sensitivity
    if settings.features is not None:
        selected_features = settings.features
    if settings.model_type is not None:
        if settings.model_type in models:
            if models[settings.model_type] is not None:
                active_model = settings.model_type
            else:
                raise HTTPException(status_code=400, detail=f"Model {settings.model_type} is not trained yet")
        else:
            raise HTTPException(status_code=400, detail=f"Unknown model type: {settings.model_type}")
    return {
        "message": "Settings updated",
        "current_settings": {
            "threshold": threshold,
            "sensitivity": sensitivity,
            "selected_features": selected_features,
            "active_model": active_model,
        },
    }

@app.post("/train")
async def train_endpoint(req: TrainingRequest, background_tasks: BackgroundTasks):
    if req.model_type not in ["autoencoder", "one_class_svm", "isolation_forest", "pca"]:
        raise HTTPException(status_code=400, detail=f"Unknown model type: {req.model_type}")
    background_tasks.add_task(
        train_model_task,
        req.model_type,
        req.epochs,
        req.batch_size,
        req.encoding_dim,
        req.nu,
        req.contamination,
        req.n_components,
        req.dataset_size,
        req.set_active_when_done,
    )
    return {"message": f"{req.model_type} training started", "training": True}

@app.post("/stop")
async def stop_generation():
    global is_generating
    is_generating = False
    return {"message": "Traffic generation stopped"}

@app.post("/detect")
async def detect_endpoint(payload: DetectPayload):
    anomalies = []
    for item in payload.data:
        is_anom, score = detect_anomaly(item)
        if is_anom:
            anomalies.append({**item, "score": score, "model": active_model})
    return {"anomalies": anomalies}

# ----------------------------
# WebSocket
# ----------------------------
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    global is_generating, generation_task, connected_clients, threshold, sensitivity, selected_features, active_model

    await websocket.accept()
    connected_clients.add(websocket)

    if not is_generating:
        generation_task = asyncio.create_task(generate_traffic_data())

    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)

            if msg.get("command") == "stop":
                is_generating = False
                await websocket.send_json({"type": "command_response", "command": "stop", "status": "success"})
                if generation_task:
                    try:
                        await asyncio.wait_for(asyncio.shield(generation_task), timeout=2.0)
                    except asyncio.TimeoutError:
                        pass

            elif "settings" in msg:
                settings = msg["settings"]
                if "threshold" in settings:
                    threshold = settings["threshold"]
                if "sensitivity" in settings:
                    sensitivity = settings["sensitivity"]
                if "features" in settings:
                    selected_features = settings["features"]
                if "model_type" in settings and settings["model_type"] in models and models[settings["model_type"]] is not None:
                    active_model = settings["model_type"]

                await websocket.send_json({
                    "type": "settings_updated",
                    "settings": {
                        "threshold": threshold,
                        "sensitivity": sensitivity,
                        "selected_features": selected_features,
                        "active_model": active_model,
                    },
                })

    except WebSocketDisconnect:
        if websocket in connected_clients:
            connected_clients.remove(websocket)
        if len(connected_clients) == 0:
            is_generating = False
    except Exception as e:
        print(f"WebSocket error: {e}")
        if websocket in connected_clients:
            connected_clients.remove(websocket)

if __name__ == "__main__":
    # Run: python -m backend.main
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
