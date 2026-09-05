"""
Step 10 Validation Suite 4: Smart Keyframe Ranking & Selection
Tests damage salience calculation, primary/secondary ranking, visual diversity, and annotation generation.
"""

import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import cv2
import numpy as np
from app.models.yolo_detector import YOLODamageDetector


def test_keyframe_ranking_suite():
    print("\n" + "=" * 70)
    print("RUNNING STEP 10.4: TEST_KEYFRAME_RANKING")
    print("=" * 70)

    detector = YOLODamageDetector()

    # Create 6 synthetic frames
    scanned_keyframes = []
    for i in range(6):
        f = np.ones((640, 640, 3), dtype=np.uint8) * 100
        cv2.putText(f, f"Frame {i}", (50, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
        scanned_keyframes.append({
            "frame_idx": i * 15,
            "timestamp_sec": round(i * 0.5, 2),
            "blur_score": 150.0,
            "frame": f,
            "detections": [],
            "analysis": {"primary_vehicle_detected": False, "vehicle_type": None, "detected_objects": [], "damage_indicators": []},
            "salience_score": 0.0
        })

    # Frame 2: Minor scratch on Door (Score ~ 2.5)
    scanned_keyframes[2]["salience_score"] = 2.5
    scanned_keyframes[2]["detections"] = [{"class_name": "scratch", "confidence": 0.85, "bbox": [50, 50, 150, 150], "area": 10000}]

    # Frame 4: Major Dent on Front Bumper (Score ~ 5.8)
    scanned_keyframes[4]["salience_score"] = 5.8
    scanned_keyframes[4]["detections"] = [
        {"class_name": "car", "confidence": 0.94, "bbox": [150, 150, 450, 450], "area": 90000},
        {"class_name": "dent", "confidence": 0.88, "bbox": [180, 180, 300, 300], "area": 14400}
    ]

    # Frame 5: Scratch on Rear Bumper (Score ~ 3.2)
    scanned_keyframes[5]["salience_score"] = 3.2
    scanned_keyframes[5]["detections"] = [{"class_name": "scratch", "confidence": 0.90, "bbox": [480, 480, 600, 600], "area": 14400}]

    with tempfile.TemporaryDirectory() as tmpdir:
        selection = detector.select_top_keyframes(
            scanned_keyframes=scanned_keyframes,
            job_id="test_ranking_job",
            output_dir=tmpdir,
            max_keyframes=2
        )

        assert selection["primary"] is not None, "Primary keyframe was None"
        primary = selection["primary"]
        print(f"  * Primary Keyframe Frame Index: {primary['frame_idx']} (Expected: 60, i.e. candidate 4)")
        print(f"  * Primary Salience Score: {primary['salience_score']:.2f}")
        print(f"  * Primary Timestamp: {primary['timestamp_sec']}s")

        # Frame 4 (index 60) had highest score (5.8)
        assert primary["frame_idx"] == 60, f"Expected Frame index 60 as primary, got {primary['frame_idx']}"
        assert primary["salience_score"] == 5.8

        # Secondary keyframe should be frame 5 or 2 (diverse)
        assert selection["secondary"] is not None
        secondary = selection["secondary"]
        print(f"  * Secondary Keyframe Frame Index: {secondary['frame_idx']} (Salience: {secondary['salience_score']:.2f})")
        assert secondary["frame_idx"] in [30, 75]

        # Verify annotated images saved on disk
        assert os.path.exists(selection["primary_path"]), "Primary annotated keyframe file not found on disk"
        assert os.path.exists(selection["secondary_path"]), "Secondary annotated keyframe file not found on disk"
        print("  [PASS] Highest damage keyframe correctly ranked #1")
        print("  [PASS] Primary and secondary keyframes properly annotated and saved")

    print("[SUCCESS] All Keyframe Ranking & Selection tests passed cleanly.\n")
    return True


if __name__ == "__main__":
    test_keyframe_ranking_suite()
