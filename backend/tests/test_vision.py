import pytest
import time
import numpy as np
import torch
from backend.app.vision.counter import LineCounter
from backend.app.vision.face_analyzer import categorize_age, FaceAnalyzer
from backend.app.vision.mivolo_engine import MiVOLOEngine
from backend.app.vision.detector import PersonDetector

def test_categorize_age():
    assert categorize_age(5) == "child"
    assert categorize_age(12) == "child"
    assert categorize_age(13) == "teen"
    assert categorize_age(19) == "teen"
    assert categorize_age(20) == "young_adult"
    assert categorize_age(35) == "young_adult"
    assert categorize_age(36) == "adult"
    assert categorize_age(50) == "adult"
    assert categorize_age(51) == "senior"
    assert categorize_age(75) == "senior"
    assert categorize_age(None) == "unknown"

def test_line_counter_horizontal_line():
    counter = LineCounter(line=(0.0, 0.5, 1.0, 0.5), in_direction="right", cooldown_sec=2)

    assert counter.check_crossing(track_id=1, cx=0.5, cy=0.2) is None
    assert counter.check_crossing(track_id=1, cx=0.5, cy=0.3) is None
    res = counter.check_crossing(track_id=1, cx=0.5, cy=0.7)
    assert res in ["in", "out"]
    res2 = counter.check_crossing(track_id=1, cx=0.5, cy=0.2)
    assert res2 is None

def test_line_counter_cooldown():
    counter = LineCounter(line=(0.5, 0.0, 0.5, 1.0), in_direction="right", cooldown_sec=1)

    counter.check_crossing(track_id=42, cx=0.2, cy=0.5)
    first_cross = counter.check_crossing(track_id=42, cx=0.8, cy=0.5)
    assert first_cross is not None
    second_cross = counter.check_crossing(track_id=42, cx=0.2, cy=0.5)
    assert second_cross is None

def test_line_counter_segment_bounds():
    counter = LineCounter(line=(0.2, 0.5, 0.8, 0.5), in_direction="right", cooldown_sec=2)

    # Outside the line segment at x=0.95
    assert counter.check_crossing(track_id=99, cx=0.95, cy=0.2) is None
    assert counter.check_crossing(track_id=99, cx=0.95, cy=0.8) is None

    # Inside the actual line segment at x=0.5
    assert counter.check_crossing(track_id=100, cx=0.5, cy=0.2) is None
    cross = counter.check_crossing(track_id=100, cx=0.5, cy=0.8)
    assert cross is not None

def test_face_analyzer_aggregation():
    analyzer = FaceAnalyzer()
    analyzer._samples[99] = [
        (25, "male", 0.85),
        (27, "male", 0.90),
        (30, "female", 0.75),
    ]
    age, age_group, gender, conf = analyzer.get_final_estimate(99)
    assert age == 27
    assert age_group == "young_adult"
    assert gender == "male"
    assert conf == 0.83

def test_face_analyzer_confidence_weighted_voting():
    analyzer = FaceAnalyzer()
    analyzer._samples[101] = [
        (22, "female", 0.40),
        (23, "female", 0.42),
        (32, "male", 0.95),
    ]
    age, age_group, gender, conf = analyzer.get_final_estimate(101)
    assert gender == "male"
    assert age == 23
    assert age_group == "young_adult"

def test_face_analyzer_empty_handling():
    analyzer = FaceAnalyzer()
    age, age_group, gender, conf = analyzer.get_final_estimate(999)
    assert age is None
    assert age_group == "unknown"
    assert gender == "unknown"
    assert conf is None

def test_person_detector_device_selection():
    detector = PersonDetector()
    expected_device = "cuda:0" if torch.cuda.is_available() else "cpu"
    assert detector.device == expected_device

def test_mivolo_engine_device_and_prediction():
    engine = MiVOLOEngine.get_instance()
    success = engine.initialize()
    assert success is True
    assert engine.is_ready is True
    expected_device = "cuda:0" if torch.cuda.is_available() else "cpu"
    assert engine.device == expected_device

    # Dual-input prediction (person crop + face crop)
    person_crop = np.zeros((120, 60, 3), dtype=np.uint8)
    face_crop = np.zeros((40, 40, 3), dtype=np.uint8)
    res = engine.predict(person_crop, face_crop)
    assert res is not None
    age, gender, conf = res
    assert 1 <= age <= 100
    assert gender in ("male", "female")
    assert 0.0 <= conf <= 1.0

def test_mivolo_engine_body_only_fallback():
    engine = MiVOLOEngine.get_instance()
    person_crop = np.zeros((150, 75, 3), dtype=np.uint8)
    # Face crop is None (e.g. person turned around / face occluded)
    res = engine.predict(person_crop, face_crop=None)
    assert res is not None
    age, gender, conf = res
    assert 1 <= age <= 100
    assert gender in ("male", "female")
