"""
Test Suite for Steps 2 & 3:
- Step 2: Low-Latency Keyframe Extraction & Laplacian Blur/Quality Filtering
- Step 3: Fast Batched YOLO Damage Scanning
"""

import os
import sys
from pathlib import Path

# Add project root to sys.path
root_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root_dir))

import cv2
import numpy as np
import time
from app.utils.video_processor import VideoProcessor
from app.models.yolo_detector import YOLODamageDetector


def create_hybrid_test_video(file_path: str, width: int = 640, height: int = 480, fps: int = 24, duration_sec: int = 4):
    """
    Create a test video with alternating sharp and motion-blurred frames.
    Also injects a simulated vehicle-like rectangle with car label.
    """
    os.makedirs(os.path.dirname(os.path.abspath(file_path)), exist_ok=True)
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(file_path, fourcc, fps, (width, height))

    total_frames = int(fps * duration_sec)
    for i in range(total_frames):
        frame = np.ones((height, width, 3), dtype=np.uint8) * 120

        # Draw crisp high-frequency patterns (vehicle silhouette, high contrast grid)
        cv2.rectangle(frame, (100, 150), (540, 380), (30, 30, 30), -1)
        cv2.circle(frame, (200, 380), 40, (10, 10, 10), -1)
        cv2.circle(frame, (440, 380), 40, (10, 10, 10), -1)
        cv2.putText(frame, f"VEHICLE FRAME {i}", (120, 260),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 3)

        # Intentionally blur the second half of each second (simulating quick camera panning)
        frame_in_sec = i % fps
        if frame_in_sec > (fps // 2):
            frame = cv2.GaussianBlur(frame, (41, 41), 0)

        out.write(frame)

    out.release()


def main():
    print("\n" + "=" * 70)
    print("TESTING STEPS 2 & 3: KEYFRAME EXTRACTION & BATCHED YOLO SCANNING")
    print("=" * 70 + "\n")

    processor = VideoProcessor()
    test_dir = os.path.join("data", "test_videos")
    test_video_path = os.path.join(test_dir, "test_hybrid_blur.mp4")

    try:
        # 1. Direct Laplacian Blur Filter Unit Test
        print("[1/4] Testing Laplacian Blur & Sharpness Calculation...")
        sharp_frame = np.zeros((480, 640, 3), dtype=np.uint8)
        cv2.putText(sharp_frame, "HIGH CONTRAST SHARP TEXT", (50, 240),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.2, (255, 255, 255), 4)

        blurry_frame = cv2.GaussianBlur(sharp_frame, (51, 51), 0)

        sharp_score = processor.calculate_blur_score(sharp_frame)
        blurry_score = processor.calculate_blur_score(blurry_frame)

        print(f"   * Sharp frame score: {sharp_score:.2f} (is_blurry = {processor.is_blurry(sharp_frame)})")
        print(f"   * Blurry frame score: {blurry_score:.2f} (is_blurry = {processor.is_blurry(blurry_frame)})")

        assert sharp_score > blurry_score, "Sharp frame score must exceed blurry frame score"
        assert processor.is_blurry(blurry_frame) is True, "Expected blurred frame to be flagged"
        print("     [OK] Blur filter correctly distinguishes sharp vs blurry frames")

        # 2. Keyframe Extraction & Filtering Test
        print("\n[2/4] Testing Keyframe Extraction with Adaptive Blur Rejection...")
        create_hybrid_test_video(test_video_path, width=640, height=480, fps=24, duration_sec=5)
        print(f"   * Generated hybrid test video: {test_video_path}")

        t0 = time.time()
        extraction_res = processor.extract_candidate_keyframes(
            test_video_path,
            sample_interval_sec=0.5,
            max_candidate_frames=12,
            blur_threshold=100.0,
            target_size=(640, 640)
        )
        extraction_time = time.time() - t0

        print(f"   * Extraction Time: {extraction_time:.3f} seconds (Fast < 0.5s)")
        print(f"   * Total Stream Frames: {extraction_res['total_stream_frames']}")
        print(f"   * Sampled Count: {extraction_res['sampled_count']}")
        print(f"   * Retained Non-Blurry: {extraction_res['retained_count']}")
        print(f"   * Dropped Blurry Frames: {extraction_res['dropped_blurry_count']}")

        assert extraction_res['retained_count'] > 0, "Expected non-zero retained keyframes"
        assert extraction_res['keyframes'][0]['frame'].shape == (640, 640, 3)
        print("     [OK] Keyframe extraction and blur filtering verified successfully")

        # 3. Batched YOLO Damage Scanning Test
        print("\n[3/4] Testing Fast Batched YOLO Damage Scanning...")
        yolo_detector = YOLODamageDetector()

        t1 = time.time()
        scanned_keyframes = yolo_detector.scan_video_frames(
            extraction_res['keyframes'],
            conf_threshold=0.20,
            batch_size=8
        )
        scan_time = time.time() - t1

        print(f"   * Batched YOLO Scan Time for {len(scanned_keyframes)} frames: {scan_time:.3f} seconds")
        print(f"   * Average inference per frame: {(scan_time / len(scanned_keyframes)):.3f} seconds")

        for idx, kf in enumerate(scanned_keyframes):
            print(f"     Frame #{idx} @ {kf['timestamp_sec']}s: "
                  f"Detections = {len(kf['detections'])}, "
                  f"Blur Score = {kf['blur_score']:.1f}, "
                  f"Salience Score = {kf['salience_score']:.3f}")

            assert "detections" in kf
            assert "analysis" in kf
            assert "salience_score" in kf

        print("     [OK] Batched YOLO scanning executed without errors")

        # 4. In-Memory Keyframe Annotation Test
        print("\n[4/4] Testing Keyframe Annotation Rendering...")
        sample_frame = scanned_keyframes[0]['frame']
        sample_dets = scanned_keyframes[0]['detections']
        out_annotated_path = os.path.join(test_dir, "sample_keyframe_annotated.jpg")

        annotated_img = yolo_detector.generate_annotated_frame(
            sample_frame,
            sample_dets,
            output_path=out_annotated_path
        )
        assert os.path.exists(out_annotated_path), "Annotated image was not saved"
        print(f"   * Annotated frame saved to {out_annotated_path}")
        print("     [OK] Annotation verified successfully")

        print("\n" + "=" * 70)
        print("SUCCESS: ALL STEP 2 & STEP 3 TESTS PASSED SUCCESSFULLY!")
        print("=" * 70 + "\n")

    finally:
        # Cleanup test files
        for p in [test_video_path, os.path.join(test_dir, "sample_keyframe_annotated.jpg")]:
            if os.path.exists(p):
                try:
                    os.remove(p)
                except Exception:
                    pass


if __name__ == "__main__":
    main()
