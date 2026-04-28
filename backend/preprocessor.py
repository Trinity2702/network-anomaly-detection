import numpy as np
from typing import List, Dict, Any

def _protocol_one_hot(protocol: str, feature_list: List[str]) -> Dict[str, float]:
    result = {}
    base = ["TCP", "UDP", "HTTP", "HTTPS", "DNS", "ICMP"]
    for name in base:
        keys = [f"Protocol_{name}", f"Protocol Type_{name}", f"Proto_{name}", f"ProtocolType_{name}"]
        present = 1.0 if protocol.upper() == name.upper() else 0.0
        for k in keys:
            if k in feature_list:
                result[k] = present
    return result

def preprocess_data_point(dp: Dict[str, Any], feature_list: List[str]) -> np.ndarray:
    normalized: Dict[str, Any] = {}
    for k, v in dp.items():
        if isinstance(v, (int, float)):
            normalized[k] = float(v)
        else:
            try:
                normalized[k] = float(v)
            except Exception:
                normalized[k] = v

    protocol = str(dp.get("Protocol Type", "")).upper()
    proto_one_hot = _protocol_one_hot(protocol, feature_list)

    alias_map = {
        "Packet Size": ["packet_size", "pkt_size", "size"],
        "Flow Duration": ["flow_duration", "duration"],
        "Throughput": ["throughput", "bw", "bandwidth"],
        "Packet Loss": ["packet_loss", "loss"],
        "Latency": ["latency", "rtt", "delay"],
        "Source Port": ["src_port", "source_port"],
        "Destination Port": ["dst_port", "destination_port"],
    }

    vec = []
    for feat in feature_list:
        if feat in normalized and isinstance(normalized[feat], (int, float)):
            vec.append(float(normalized[feat]))
            continue

        if feat in alias_map:
            matched = False
            for candidate in [feat] + alias_map[feat]:
                val = normalized.get(candidate)
                if isinstance(val, (int, float)):
                    vec.append(float(val))
                    matched = True
                    break
            if matched:
                continue

        if feat in proto_one_hot:
            vec.append(proto_one_hot[feat])
            continue

        vec.append(0.0)

    return np.array(vec, dtype=float)
