# tests/test_data_generator.py
import math
from data_generator import generate_normal_traffic, inject_anomaly

def test_generate_normal_traffic_keys_and_ranges():
    dp = generate_normal_traffic()
    # expected keys
    expected_keys = {
        "Packet Size", "Flow Duration", "Throughput",
        "Packet Loss", "Latency", "Protocol Type",
        "Source Port", "Destination Port"
    }
    assert expected_keys.issubset(dp.keys())

    # numeric ranges (as defined in generator)
    assert 100.0 <= dp["Packet Size"] <= 1100.0
    assert 10.0 <= dp["Flow Duration"] <= 210.0
    assert 10.0 <= dp["Throughput"] <= 60.0
    assert 0.0 <= dp["Packet Loss"] <= 0.05
    assert 5.0 <= dp["Latency"] <= 55.0

    # ports and protocol basic checks
    assert isinstance(dp["Source Port"], (int, float))
    assert 1 <= int(dp["Source Port"]) <= 65535
    assert isinstance(dp["Protocol Type"], str)
    assert len(dp["Protocol Type"]) > 0

def test_inject_anomaly_keeps_bounds():
    # call many times to exercise branches
    for _ in range(100):
        dp = inject_anomaly()
        assert 1.0 <= dp["Packet Size"] <= 10000.0
        assert 0.1 <= dp["Flow Duration"] <= 10000.0
        assert 0.01 <= dp["Throughput"] <= 10000.0
        assert 0.0 <= dp["Packet Loss"] <= 1.0
        assert 0.01 <= dp["Latency"] <= 5000.0
