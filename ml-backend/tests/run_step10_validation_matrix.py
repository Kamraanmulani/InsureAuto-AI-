"""
Master Test Runner for Step 10: Testing & Validation Matrix
Executes all 6 validation suites and outputs a consolidated test matrix.
"""

import sys
import time
from pathlib import Path

# Add ml-backend root directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from tests.test_video_ingestion import test_video_ingestion_suite
from tests.test_blur_rejection import test_blur_rejection_suite
from tests.test_batched_yolo import test_batched_yolo_suite
from tests.test_keyframe_ranking import test_keyframe_ranking_suite
from tests.test_video_duplicate import test_video_duplicate_suite
from tests.test_video_latency import test_video_latency_suite


def run_matrix():
    print("\n" + "#" * 80)
    print("INSURANCE CLAIM VALIDATOR - STEP 10: TESTING & VALIDATION MATRIX")
    print("#" * 80)

    suites = [
        ("test_video_ingestion.py", "Validate container formats, codec handling, duration checks", test_video_ingestion_suite),
        ("test_blur_rejection.py", "Laplacian variance filter against blurred/shaken frames", test_blur_rejection_suite),
        ("test_batched_yolo.py", "Batched forward pass & vehicle part/damage extraction", test_batched_yolo_suite),
        ("test_keyframe_ranking.py", "Damage salience ranking & multi-angle keyframe selection", test_keyframe_ranking_suite),
        ("test_video_duplicate.py", "Composite temporal video signature & duplicate detection", test_video_duplicate_suite),
        ("test_video_latency.py", "End-to-end processing latency benchmark (<30s CPU, <15s GPU)", test_video_latency_suite),
    ]

    results = []
    overall_start = time.time()

    for name, description, runner in suites:
        t0 = time.time()
        try:
            passed = runner()
            elapsed = time.time() - t0
            results.append((name, description, "PASS", elapsed, None))
        except Exception as e:
            elapsed = time.time() - t0
            results.append((name, description, "FAIL", elapsed, str(e)))

    overall_elapsed = time.time() - overall_start

    print("\n" + "=" * 80)
    print("STEP 10 VALIDATION MATRIX SUMMARY REPORT")
    print("=" * 80)
    print(f"{'Test Suite':<28} | {'Status':<8} | {'Duration (s)':<12} | {'Description'}")
    print("-" * 80)

    all_passed = True
    for name, desc, status, duration, err in results:
        status_str = "[PASS]" if status == "PASS" else "[FAIL]"
        print(f"{name:<28} | {status_str:<8} | {duration:<12.3f} | {desc}")
        if status != "PASS":
            all_passed = False
            print(f"   -> ERROR: {err}")

    print("-" * 80)
    print(f"Total Execution Time: {overall_elapsed:.3f} seconds")
    print(f"Result: {'ALL TESTS PASSED SUCCESSFULLY (6/6)' if all_passed else 'SOME TESTS FAILED'}")
    print("=" * 80 + "\n")

    return 0 if all_passed else 1


if __name__ == "__main__":
    exit_code = run_matrix()
    sys.exit(exit_code)
