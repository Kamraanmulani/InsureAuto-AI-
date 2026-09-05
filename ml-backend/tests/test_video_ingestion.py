"""
Step 10 Validation Suite 1: Video Ingestion & Container Validation
Tests container formats, codec handling, duration checks (>30s rejection), and corrupt file handling.
"""

import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import cv2
import numpy as np
from app.utils.video_processor import VideoProcessor


def create_synthetic_video(file_path: str, width: int = 640, height: int = 480, fps: int = 24, duration_sec: float = 3.0):
    os.makedirs(os.path.dirname(os.path.abspath(file_path)), exist_ok=True)
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(file_path, fourcc, fps, (width, height))
    total_frames = int(fps * duration_sec)
    for i in range(total_frames):
        frame = np.zeros((height, width, 3), dtype=np.uint8)
        cv2.putText(frame, f"Ingestion Frame {i}", (30, height // 2),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 120), 2)
        out.write(frame)
    out.release()


def test_video_ingestion_suite():
    print("\n" + "=" * 70)
    print("RUNNING STEP 10.1: TEST_VIDEO_INGESTION")
    print("=" * 70)

    processor = VideoProcessor(max_size_mb=50.0, max_duration_sec=30.0, min_resolution=(640, 480))

    with tempfile.TemporaryDirectory() as tmpdir:
        # 1. Test Valid MP4
        valid_path = os.path.join(tmpdir, "valid.mp4")
        create_synthetic_video(valid_path, width=640, height=480, fps=24, duration_sec=4.0)
        res_valid = processor.validate_video_file(valid_path)
        assert res_valid["is_valid"] is True, f"Valid video was rejected: {res_valid}"
        print("  [PASS] Valid MP4 accepted (640x480, 4s, 24fps)")

        # 2. Test Duration Limit (>30s)
        long_path = os.path.join(tmpdir, "too_long.mp4")
        create_synthetic_video(long_path, width=640, height=480, fps=10, duration_sec=35.0)
        res_long = processor.validate_video_file(long_path)
        assert res_long["is_valid"] is False, "Over-length video (>30s) was not rejected"
        err_msg = " ".join(res_long["errors"]).lower()
        assert "exceeds maximum" in err_msg or "duration" in err_msg
        print("  [PASS] Over-length video (>30s) correctly rejected")

        # 3. Test Unsupported Format
        fake_doc = os.path.join(tmpdir, "claim_report.pdf")
        with open(fake_doc, "w") as f:
            f.write("%PDF-1.4 Mock Document Content")
        res_doc = processor.validate_video_file(fake_doc)
        assert res_doc["is_valid"] is False, "Unsupported PDF file was not rejected"
        print("  [PASS] Non-video file extension correctly rejected")

        # 4. Test Corrupted Video
        corrupt_path = os.path.join(tmpdir, "corrupt.mp4")
        with open(corrupt_path, "wb") as f:
            f.write(b"CORRUPT_BYTES_DATA_NOT_A_VALID_CONTAINER_STREAM_HEADER")
        res_corrupt = processor.validate_video_file(corrupt_path)
        assert res_corrupt["is_valid"] is False, "Corrupt video was not rejected"
        print("  [PASS] Corrupted binary stream correctly rejected")

    print("[SUCCESS] All Video Ingestion tests passed cleanly.\n")
    return True


if __name__ == "__main__":
    test_video_ingestion_suite()
