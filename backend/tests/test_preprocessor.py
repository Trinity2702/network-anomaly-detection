# tests/test_preprocessor.py
import numpy as np
from preprocessor import preprocess_data_point

def test_preprocess_basic_numeric_and_aliases():
    # feature_list includes standard features + protocol one-hot variations
    feature_list = [
        "Packet Size", "Flow Duration", "Throughput",
        "Packet Loss", "Latency", "Protocol_TCP", "Protocol_UDP",
        "Source Port", "Destination Port"
    ]

    dp = {
        "packet_size": 200,            # alias for Packet Size
        "flow_duration": 50,           # alias for Flow Duration
        "throughput": 30,              # direct alias
        "packet_loss": 0.01,
        "latency": 12,
        "Protocol Type": "TCP",
        "src_port": 1234,
        "dst_port": 80
    }

    vec = preprocess_data_point(dp, feature_list)
    assert isinstance(vec, np.ndarray)
    assert vec.shape[0] == len(feature_list)

    # Check positions roughly:
    # Packet Size -> 200
    assert abs(vec[0] - 200.0) < 1e-6
    # Flow Duration -> 50
    assert abs(vec[1] - 50.0) < 1e-6
    # Throughput -> 30
    assert abs(vec[2] - 30.0) < 1e-6
    # Protocol_TCP should be 1.0 (index 5 in feature_list)
    assert vec[5] == 1.0
    # Protocol_UDP (not selected) should be 0.0
    assert vec[6] == 0.0

def test_preprocess_handles_missing_values_and_non_numeric():
    feature_list = ["Packet Size", "Throughput", "Protocol_TCP"]
    dp = {"Packet Size": "300", "Throughput": None, "Protocol Type": "udp"}
    vec = preprocess_data_point(dp, feature_list)
    # Packet Size parsed from string
    assert abs(vec[0] - 300.0) < 1e-6
    # Throughput missing -> 0.0
    assert vec[1] == 0.0
    # Protocol UDP mapped to Protocol_TCP -> 0
    assert vec[2] == 0.0
