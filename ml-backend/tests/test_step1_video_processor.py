"""
Test Suite for Step 1: Video Ingestion & Fast Validation Pipeline
Validates format checking, resolution constraints, duration limits, metadata extraction,
and accident date verification.
"""

import os
import sys
from pathlib import Path

# Add ml-backend root directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import cv2
import numpy as np
from datetime import datetime, timedelta
from app.utils.video_processor import VideoProcessor


def create_synthetic_video(file_path: str, width: int, height: int, fps: int, duration_sec: int):
    """Generate a clean synthetic MP4 video clip for testing"""
    os.makedirs(os.path.dirname(os.path.abspath(file_path)), exist_ok=True)
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(file_path, fourcc, fps, (width, height))
    
    total_frames = int(fps * duration_sec)
    for i in range(total_frames):
        # Create a dynamic moving test pattern frame
        frame = np.zeros((height, width, 3), dtype=np.uint8)
        color = (int((i * 10) % 255), 180, 100)
        cv2.putText(frame, f"Test Frame {i}/{total_frames}", (50, height // 2),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)
        out.write(frame)
    
    out.release()


def main():
    print("\n" + "=" * 70)
    print("TESTING STEP 1: VIDEO INGESTION & FAST VALIDATION PIPELINE")
    print("=" * 70 + "\n")

    processor = VideoProcessor(
        max_size_mb=50.0,
        max_duration_sec=30.0,
        min_resolution=(640, 480)
    )

    test_dir = os.path.join("data", "test_videos")
    os.makedirs(test_dir, exist_ok=True)

    valid_video = os.path.join(test_dir, "sample_valid.mp4")
    low_res_video = os.path.join(test_dir, "sample_low_res.mp4")
    unsupported_file = os.path.join(test_dir, "sample_doc.pdf")

    try:
        # 1. Create test artifacts
        print("[1/5] Generating test video artifacts...")
        create_synthetic_video(valid_video, width=640, height=480, fps=24, duration_sec=4)
        print(f"   * Created valid video: {valid_video} (640x480, 4s, 24fps)")

        create_synthetic_video(low_res_video, width=320, height=240, fps=24, duration_sec=2)
        print(f"   * Created low-resolution video: {low_res_video} (320x240, 2s)")

        with open(unsupported_file, "w") as f:
            f.write("Not a video")
        print(f"   * Created invalid format file: {unsupported_file}\n")

        # 2. Test Format & Resolution Validation
        print("[2/5] Testing Format & Resolution Validation...")
        
        # Test 2a: Valid video
        res_valid = processor.validate_video_file(valid_video)
        print(f"   * Valid video check: is_valid = {res_valid['is_valid']}")
        assert res_valid['is_valid'] is True, "Expected valid video to pass validation"
        assert len(res_valid['errors']) == 0, f"Unexpected errors: {res_valid['errors']}"
        print("     [OK] Passed (Duration: {}s, Resolution: {}x{}, FPS: {})".format(
            res_valid['properties']['duration_seconds'],
            res_valid['properties']['width'],
            res_valid['properties']['height'],
            res_valid['properties']['fps']
        ))

        # Test 2b: Low resolution rejection
        res_low_res = processor.validate_video_file(low_res_video)
        print(f"   * Low resolution check: is_valid = {res_low_res['is_valid']}")
        assert res_low_res['is_valid'] is False, "Expected low-res video to be rejected"
        print(f"     [OK] Correctly rejected: {res_low_res['errors']}")

        # Test 2c: Unsupported format rejection
        res_unsupported = processor.validate_video_file(unsupported_file)
        print(f"   * Unsupported format check: is_valid = {res_unsupported['is_valid']}")
        assert res_unsupported['is_valid'] is False, "Expected unsupported format to be rejected"
        print(f"     [OK] Correctly rejected: {res_unsupported['errors']}")

        # 3. Test Metadata Extraction
        print("\n[3/5] Testing Metadata Extraction...")
        metadata = processor.extract_video_metadata(valid_video)
        print(f"   * Extracted metadata:")
        print(f"     - File Name: {metadata['file_name']}")
        print(f"     - Duration: {metadata['duration_seconds']}s")
        print(f"     - FPS: {metadata['fps']}")
        print(f"     - Frame Count: {metadata['frame_count']}")
        print(f"     - Resolution: {metadata['width']}x{metadata['height']} ({metadata['aspect_ratio']})")
        print(f"     - Codec: {metadata['codec']}")
        print(f"     - Size: {metadata['file_size_mb']} MB")
        print(f"     - Created At: {metadata['created_at']}")
        
        assert metadata['width'] == 640
        assert metadata['height'] == 480
        assert metadata['fps'] == 24.0
        assert metadata['has_video_stream'] is True
        print("     [OK] Metadata extraction verified successfully")

        # 4. Test Claim Date Verification
        print("\n[4/5] Testing Accident Date Verification...")
        today = datetime.now().date()

        # Case 4a: Consistent date (e.g. today or 2 days ago)
        claim_date_consistent = (today - timedelta(days=2)).strftime("%Y-%m-%d")
        date_res1 = processor.validate_video_date(metadata, claim_date_consistent)
        print(f"   * Consistent Date Test ({claim_date_consistent}):")
        print(f"     is_date_consistent = {date_res1['is_date_consistent']}, risk_score = {date_res1['risk_score']}")
        print(f"     Notes: {date_res1['notes']}")
        assert date_res1['is_date_consistent'] is True
        assert date_res1['risk_score'] == 0
        print("     [OK] Consistent date passed with zero risk")

        # Case 4b: Inconsistent date (e.g. 30 days ago)
        claim_date_inconsistent = (today - timedelta(days=30)).strftime("%Y-%m-%d")
        date_res2 = processor.validate_video_date(metadata, claim_date_inconsistent)
        print(f"   * Inconsistent Date Test ({claim_date_inconsistent}):")
        print(f"     is_date_consistent = {date_res2['is_date_consistent']}, risk_score = {date_res2['risk_score']}")
        print(f"     Notes: {date_res2['notes']}")
        assert date_res2['is_date_consistent'] is False
        assert date_res2['risk_score'] > 0
        print("     [OK] Inconsistent date correctly flagged with risk penalty")

        # 5. Test Unified Summary
        print("\n[5/5] Testing Unified get_video_summary()...")
        summary = processor.get_video_summary(valid_video, claim_date_consistent)
        assert summary['validation']['is_valid'] is True
        assert summary['metadata']['has_video_stream'] is True
        assert summary['date_validation']['is_date_consistent'] is True
        print("     [OK] Unified summary successfully executed")

        print("\n" + "=" * 70)
        print("SUCCESS: ALL STEP 1 TESTS PASSED SUCCESSFULLY!")
        print("=" * 70 + "\n")

    finally:
        # Cleanup test files
        for f in [valid_video, low_res_video, unsupported_file]:
            if os.path.exists(f):
                try:
                    os.remove(f)
                except Exception:
                    pass


if __name__ == "__main__":
    main()
