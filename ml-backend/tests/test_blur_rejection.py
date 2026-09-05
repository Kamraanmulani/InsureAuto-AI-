"""
Step 10 Validation Suite 2: Blur & Camera-Shake Rejection
Tests Laplacian variance filter against artificially blurred/shaken frames and crisp frames.
"""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import cv2
import numpy as np
from app.utils.video_processor import VideoProcessor


def test_blur_rejection_suite():
    print("\n" + "=" * 70)
    print("RUNNING STEP 10.2: TEST_BLUR_REJECTION")
    print("=" * 70)

    processor = VideoProcessor()

    # 1. Create a crisp high-frequency image (text, sharp high-contrast geometric lines)
    crisp_frame = np.ones((640, 640, 3), dtype=np.uint8) * 240
    for y in range(50, 600, 30):
        cv2.line(crisp_frame, (50, y), (590, y), (20, 20, 20), 3)
    cv2.putText(crisp_frame, "HIGH RESOLUTION VEHICLE PANEL IDENTIFIER", (60, 300),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 180), 2)

    crisp_score = processor.calculate_blur_score(crisp_frame)
    is_crisp_blurry = processor.is_blurry(crisp_frame, threshold=100.0)

    print(f"  * Crisp Frame Laplacian Variance Score: {crisp_score:.2f} (Threshold: 100.0)")
    assert crisp_score > 100.0, f"Crisp frame score too low: {crisp_score}"
    assert is_crisp_blurry is False, "Crisp frame was wrongly classified as blurry"
    print("  [PASS] High-frequency crisp frame retained")

    # 2. Artificially generate heavy motion-blur & Gaussian smoothing
    blurry_frame = cv2.GaussianBlur(crisp_frame, (35, 35), 0)
    kernel_size = 25
    kernel_motion_blur = np.zeros((kernel_size, kernel_size))
    kernel_motion_blur[int((kernel_size - 1) / 2), :] = np.ones(kernel_size)
    kernel_motion_blur = kernel_motion_blur / kernel_size
    heavy_blur_frame = cv2.filter2D(blurry_frame, -1, kernel_motion_blur)

    blur_score = processor.calculate_blur_score(heavy_blur_frame)
    is_heavy_blurry = processor.is_blurry(heavy_blur_frame, threshold=100.0)

    print(f"  * Artificially Blurred Frame Laplacian Variance: {blur_score:.2f} (Threshold: 100.0)")
    assert blur_score < 100.0, f"Blurred frame score too high: {blur_score}"
    assert is_heavy_blurry is True, "Blurred frame was wrongly classified as sharp"
    print("  [PASS] Artificially blurred and camera-shake frame successfully discarded")

    # 3. Test batch filter logic
    frames = [crisp_frame, heavy_blur_frame, crisp_frame, heavy_blur_frame]
    retained_frames = [f for f in frames if not processor.is_blurry(f, threshold=100.0)]
    assert len(retained_frames) == 2, f"Expected 2 retained frames, got {len(retained_frames)}"
    print(f"  [PASS] Quality filtering passed: {len(frames)} total -> {len(retained_frames)} crisp retained")

    print("[SUCCESS] All Blur & Quality Rejection tests passed cleanly.\n")
    return True


if __name__ == "__main__":
    test_blur_rejection_suite()
