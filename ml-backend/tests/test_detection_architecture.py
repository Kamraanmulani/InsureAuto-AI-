import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import unittest
from app.models.yolo_detector import VehicleDetector, DamageDetector, DamageSeverityEstimator
from app.services.scoring_engine import ScoringEngine

class TestDetectionArchitecture(unittest.TestCase):
    def test_vehicle_detection_does_not_produce_damage_score(self):
        detector = VehicleDetector.__new__(VehicleDetector)
        detector.relevant_classes = ['car', 'truck', 'bus', 'motorcycle', 'bicycle']
        
        mock_detections = [
            {"class_name": "car", "confidence": 0.95, "bbox": [10, 10, 200, 200], "area": 36100},
            {"class_name": "truck", "confidence": 0.90, "bbox": [210, 10, 400, 200], "area": 36100}
        ]
        
        score = detector.get_damage_score_from_detections(mock_detections)
        self.assertEqual(score, 0.0)

    def test_damage_detector_unavailable_by_default(self):
        damage_detector = DamageDetector()
        result = damage_detector.detect_damage("dummy_path.jpg")
        
        self.assertFalse(result["available"])
        self.assertEqual(result["status"], "MODEL_UNAVAILABLE")
        self.assertIn("Vehicle detected. Dedicated damage model unavailable.", result["message"])
        self.assertEqual(result["detected_damage_regions"], [])

    def test_damage_severity_estimator_without_damage(self):
        estimator = DamageSeverityEstimator()
        result = estimator.estimate_severity([])
        
        self.assertFalse(result["available"])
        self.assertEqual(result["status"], "MODEL_UNAVAILABLE")
        self.assertEqual(result["score"], 0.0)

    def test_vehicle_localization_separate_from_damage_scoring(self):
        engine = ScoringEngine()
        
        decision = engine.make_decision(
            damage_score=0.0,
            fraud_score=2.0,
            consistency_score=8.0,
            metadata_validation={"is_valid": True}
        )
        
        self.assertEqual(decision["scores"]["damage"], 0.0)
        self.assertIn("Damage severity: Minor (0.0/10)", decision["explanation"])

if __name__ == "__main__":
    unittest.main()
