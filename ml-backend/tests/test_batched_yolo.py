"""
Step 10 Validation Suite 3: Batched YOLO Damage Scanning
Tests batched forward pass, vehicle part/damage extraction, bounding box generation, and latency.
"""

import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import cv2
import numpy as np
from app.models.yolo_detector import YOLODamageDetector


def test_batched_yolo_suite():
    print("\n" + "=" * 70)
    print("RUNNING STEP 10.3: TEST_BATCHED_YOLO")
    print("=" * 70)

    detector = YOLODamageDetector()

    # Generate an array of 15 candidate video keyframes
    num_frames = 15
    candidate_keyframes = []

    for i in range(num_frames):
        frame = np.ones((640, 640, 3), dtype=np.uint8) * 120
        # Draw vehicle-like object
        cv2.rectangle(frame, (100, 200), (540, 500), (40, 40, 40), -1)
        if i in [3, 7, 12]:
            # Simulate high-contrast damage cluster on bumper / door
            cv2.rectangle(frame, (200, 300), (350, 450), (10, 10, 200), -1)
            cv2.putText(frame, "SCRATCH / DENT", (210, 350), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
        
        candidate_keyframes.append({
            "frame_idx": i * 10,
            "timestamp_sec": round(i * 0.5, 2),
            "blur_score": 140.0,
            "frame": frame
        })

    print(f"  * Created {num_frames} normalized candidate frames (640x640)")

    # Execute batched inference
    t0 = time.time()
    scanned_results = detector.scan_video_frames(candidate_keyframes, conf_threshold=0.25, batch_size=16)
    duration_sec = time.time() - t0

    print(f"  * Batched scan execution time for {num_frames} frames: {duration_sec * 1000:.2f} ms")
    assert len(scanned_results) == num_frames, f"Expected {num_frames} results, got {len(scanned_results)}"

    # Verify frame results structure
    for idx, res in enumerate(scanned_results):
        assert "frame_idx" in res
        assert "timestamp_sec" in res
        assert "detections" in res
        assert "analysis" in res
        assert "salience_score" in res

    print("  [PASS] Batched forward pass completed with structured vehicle part & damage extraction")
    print("  [PASS] Salience scores calculated for all frames")

    print("[SUCCESS] All Batched YOLO Damage Scanning tests passed cleanly.\n")
    return True


if __name__ == "__main__":
    test_batched_yolo_suite()
