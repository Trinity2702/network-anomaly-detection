import numpy as np
from typing import Dict

PROTOCOLS = ["TCP", "UDP", "HTTP", "HTTPS", "DNS", "ICMP"]

def _random_port() -> int:
    return int(np.random.randint(1, 65535))

def _random_protocol() -> str:
    return PROTOCOLS[int(np.random.randint(0, len(PROTOCOLS)))]

def generate_normal_traffic() -> Dict[str, float]:
    packet_size = float(np.random.uniform(100, 1100))
    flow_duration = float(np.random.uniform(10, 210))
    throughput = float(np.random.uniform(10, 60))
    packet_loss = float(np.random.uniform(0.0, 0.05))
    latency = float(np.random.uniform(5, 55))
    return {
        "Packet Size": packet_size,
        "Flow Duration": flow_duration,
        "Throughput": throughput,
        "Packet Loss": packet_loss,
        "Latency": latency,
        "Protocol Type": _random_protocol(),
        "Source Port": _random_port(),
        "Destination Port": _random_port(),
    }

def inject_anomaly() -> Dict[str, float]:
    anomaly_type = int(np.random.randint(0, 3))
    dp = generate_normal_traffic()
    if anomaly_type == 0:  # DDoS-like
        dp["Packet Size"] *= 0.2
        dp["Flow Duration"] *= 0.5
        dp["Throughput"] *= 3.0
        dp["Packet Loss"] = min(1.0, dp["Packet Loss"] * 5.0)
    elif anomaly_type == 1:  # Exfiltration-like
        dp["Packet Size"] *= 2.5
        dp["Flow Duration"] *= 2.0
        dp["Throughput"] *= 1.5
    else:  # Port-scan-like
        dp["Packet Size"] *= 0.5
        dp["Flow Duration"] *= 0.3
        dp["Latency"] *= 2.0

    dp["Packet Size"] = float(max(1.0, min(dp["Packet Size"], 10000.0)))
    dp["Flow Duration"] = float(max(0.1, min(dp["Flow Duration"], 10000.0)))
    dp["Throughput"] = float(max(0.01, min(dp["Throughput"], 10000.0)))
    dp["Packet Loss"] = float(max(0.0, min(dp["Packet Loss"], 1.0)))
    dp["Latency"] = float(max(0.01, min(dp["Latency"], 5000.0)))
    return dp
