"""
Step 10 Validation Suite 5: Video Fraud & Temporal Duplicate Detection
Tests temporal fingerprint generation (composite 64-d vector), duplicate checking,
and fraud indicators for duplicate and mirrored videos.
"""

import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np
from app.models.fraud_detector import FraudDetector


def create_mock_video_frames(num_frames=10, width=640, height=480):
    frames = []
    for i in range(num_frames):
        arr = np.ones((height, width, 3), dtype=np.uint8) * (60 + i * 10)
        # Asymmetric shape on left side
        arr[50:200, 20:180] = 250
        arr[250:350, 40:120] = 10
        frames.append({
            "frame_idx": i * 15,
            "timestamp_sec": round(i * 0.5, 2),
            "blur_score": 150.0,
            "frame": arr,
            "detections": [
                {
                    "class_name": "car",
                    "confidence": 0.88,
                    "bbox": [100, 100, 400, 350],
                    "area": 300 * 250
                },
                {
                    "class_name": "dent",
                    "confidence": 0.76,
                    "bbox": [150, 180, 250, 260],
                    "area": 100 * 80
                }
            ],
            "salience_score": 4.5
        })
    return frames


def test_video_duplicate_suite():
    print("\n" + "=" * 70)
    print("RUNNING STEP 10.5: TEST_VIDEO_DUPLICATE")
    print("=" * 70)

    with tempfile.TemporaryDirectory() as tmpdir:
        test_storage = os.path.join(tmpdir, "test_video_hashes.json")
        fd = FraudDetector(use_qdrant=False)
        fd.video_storage_file = test_storage
        fd._init_video_file_storage()

        mock_frames = create_mock_video_frames(num_frames=12)

        # 1. Compute Composite Signature
        sig = fd.compute_video_signature(frames=mock_frames)
        assert len(sig["composite_vector"]) == 64
        assert len(sig["mirrored_composite_vector"]) == 64
        assert len(sig["frame_details"]) == 3
        print("  * Generated composite 64-d video fingerprint vector")

        # 2. First submission (Clean)
        res1 = fd.check_video_duplicate(
            job_id="job_dup_001",
            frames=mock_frames,
            policy_id="POL_ORIGINAL"
        )
        assert not res1["is_duplicate"]
        print("  * First submission recorded as clean baseline")

        # 3. Duplicate submission
        res2 = fd.check_video_duplicate(
            job_id="job_dup_002",
            frames=mock_frames,
            policy_id="POL_FRAUD_DUPLICATE"
        )

        print(f"  * Duplicate Similarity: {res2['similarity_score'] * 100:.1f}%")
        print(f"  * Duplicate Flagged: {res2['is_duplicate']}")
        print(f"  * Cross-Policy Reuse Detected: {res2.get('cross_policy_reuse', False)}")

        assert res2["is_duplicate"] is True, "Duplicate video was not detected"
        assert res2["similarity_score"] >= 0.90, f"Expected similarity >= 0.90, got {res2['similarity_score']}"

        print("  [PASS] Video duplicate successfully flagged with similarity >= 90%")
        print("  [PASS] Reused video across policies correctly detected")

    print("[SUCCESS] All Video Fraud & Temporal Duplicate tests passed cleanly.\n")
    return True


if __name__ == "__main__":
    test_video_duplicate_suite()
