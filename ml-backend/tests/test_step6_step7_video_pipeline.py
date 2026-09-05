"""
Test Suite for Step 6 & Step 7 of Video Implementation Plan:
- Step 6: Video Fraud & Temporal Duplicate Detection (Temporal Fingerprinting, Composite Video Signature, Editing Tools)
- Step 7: Unified Scoring & Claim Decision (YOLO aggregate, LLaVA reasoning, Metadata risk, Duplicate similarity)
"""

import os
import sys
import json
import numpy as np
from pathlib import Path

# Add project root to sys.path
root_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root_dir))

from app.models.fraud_detector import FraudDetector
from app.services.scoring_engine import ScoringEngine


def create_mock_video_frames(num_frames=10, width=640, height=480):
    """Generate synthetic keyframes simulating a walk-around inspection video"""
    frames = []
    for i in range(num_frames):
        # Vary pixel intensities slightly to simulate camera panning
        arr = np.ones((height, width, 3), dtype=np.uint8) * (60 + i * 10)
        # Asymmetric shape on left side to ensure horizontal flipping produces a distinct hash
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


def test_step6_temporal_fingerprinting():
    print("\n" + "=" * 70)
    print("TESTING STEP 6: VIDEO FRAUD & TEMPORAL DUPLICATE DETECTION")
    print("=" * 70)

    # Use file-based storage for clean deterministic testing
    test_storage = "data/test_step6_video_hashes.json"
    if os.path.exists(test_storage):
        os.remove(test_storage)

    fd = FraudDetector(use_qdrant=False)
    fd.video_storage_file = test_storage
    fd._init_video_file_storage()

    mock_frames = create_mock_video_frames(num_frames=12)

    # 1. Test Temporal Composite Signature
    print("\n[1] Testing Composite Video Signature Calculation...")
    sig = fd.compute_video_signature(frames=mock_frames)
    assert len(sig["composite_vector"]) == 64, f"Expected 64-dim vector, got {len(sig['composite_vector'])}"
    assert len(sig["mirrored_composite_vector"]) == 64
    assert len(sig["frame_details"]) == 3, f"Expected 3 temporal checkpoints (25%, 50%, 75%), got {len(sig['frame_details'])}"
    print(f"  [OK] Composite 64-d vector generated: [{sig['composite_vector'][0]:.4f}, {sig['composite_vector'][1]:.4f}, ...]")
    print(f"  [OK] Temporal checkpoints: {[c['checkpoint'] for c in sig['frame_details']]}")

    # 2. Test Baseline Submission (Clean Claim)
    print("\n[2] Testing First-time Video Submission (Baseline)...")
    res1 = fd.check_video_duplicate(
        job_id="job_001",
        frames=mock_frames,
        policy_id="POL_ALPHA"
    )
    assert not res1["is_duplicate"], "First submission should not be flagged as duplicate"
    print(f"  [OK] Duplicate Detected: {res1['is_duplicate']} (Count: {res1['duplicate_count']})")

    # 3. Test Exact Duplicate Submission
    print("\n[3] Testing Exact Duplicate Walk-Around Video Submission...")
    res2 = fd.check_video_duplicate(
        job_id="job_002",
        frames=mock_frames,
        policy_id="POL_ALPHA"
    )
    assert res2["is_duplicate"], "Identical submission should be detected as duplicate"
    assert res2["similarity_score"] >= 0.95, f"Similarity should be >= 0.95, got {res2['similarity_score']}"
    print(f"  [OK] Duplicate Flagged: {res2['is_duplicate']} (Similarity: {res2['similarity_score'] * 100:.1f}%)")

    # 4. Test Cross-Policy Duplicate Fraud
    print("\n[4] Testing Cross-Policy Reused Video Fraud...")
    res3 = fd.check_video_duplicate(
        job_id="job_003",
        frames=mock_frames,
        policy_id="POL_BETA_DIFFERENT"
    )
    assert res3["is_duplicate"]
    assert res3["cross_policy_reuse"], "Cross-policy reuse must be flagged"
    print(f"  [OK] Cross-Policy Reuse Flagged: {res3['cross_policy_reuse']} (Original: POL_ALPHA, Submitted: POL_BETA_DIFFERENT)")

    # 5. Test Mirrored / Flipped Video Detection
    print("\n[5] Testing Mirrored/Flipped Video Submission Detection...")
    mirrored_frames = []
    for item in mock_frames:
        mirrored_frames.append({
            "frame": np.fliplr(item["frame"]),
            "timestamp_sec": item["timestamp_sec"]
        })
    res4 = fd.check_video_duplicate(
        job_id="job_004",
        frames=mirrored_frames,
        policy_id="POL_GAMMA"
    )
    assert res4["is_duplicate"]
    assert res4["is_mirrored"], "Mirrored submission must be flagged as mirrored"
    print(f"  [OK] Mirrored Video Detected: {res4['is_mirrored']} (Similarity: {res4['similarity_score'] * 100:.1f}%)")

    # 6. Test Video Editing Software Detection
    print("\n[6] Testing Video Editing Tools Detection (Adobe Premiere, CapCut, InShot)...")
    edit1 = fd.check_video_editing_software({"software": "Adobe Premiere Pro 2024"})
    assert edit1["detected"]
    assert "adobe premiere" in edit1["tools"]
    print(f"  [OK] Detected: {edit1['tools']}")

    edit2 = fd.check_video_editing_software({"encoder": "CapCut Export v12.1"})
    assert edit2["detected"]
    assert "capcut" in edit2["tools"]
    print(f"  [OK] Detected: {edit2['tools']}")

    edit3 = fd.check_video_editing_software({"writing_application": "InShot Android App"})
    assert edit3["detected"]
    assert "inshot" in edit3["tools"]
    print(f"  [OK] Detected: {edit3['tools']}")

    # 7. Test Video Metadata Fraud Scoring
    print("\n[7] Testing Video Metadata Fraud Scoring...")
    meta_result = fd.calculate_video_metadata_fraud_score(
        metadata={"software": "CapCut", "created_at": "2026-03-01T10:00:00"},
        validation_result={"risk_score": 1, "errors": []},
        date_validation={"is_date_consistent": False, "date_difference_days": 18, "risk_score": 4, "notes": ["Date mismatch > 7 days"]}
    )
    assert meta_result["metadata_fraud_score"] >= 7.0
    print(f"  [OK] Calculated Metadata Fraud Score: {meta_result['metadata_fraud_score']}/10")
    print(f"  [OK] Fraud Indicators: {meta_result['fraud_indicators']}")

    # Clean test file
    if os.path.exists(test_storage):
        os.remove(test_storage)

    print("\n[SUCCESS] All Step 6 tests passed!")


def test_step7_unified_scoring_engine():
    print("\n" + "=" * 70)
    print("TESTING STEP 7: UNIFIED SCORING & CLAIM DECISION ENGINE")
    print("=" * 70)

    engine = ScoringEngine()

    # Pillar Summary 1: High quality YOLO detections
    yolo_good = {
        "total_detections": 4,
        "aggregate_damage_area_ratio": 0.12,
        "mean_confidence": 0.86,
        "primary_vehicle_detected": True,
        "vehicle_type": "car"
    }

    # Scenario A: Clean Claim -> APPROVE
    print("\n[Scenario A] Clean video, no duplicates, high consistency -> APPROVE")
    decision_a = engine.make_video_decision(
        yolo_summary=yolo_good,
        llava_analysis={"damage_score": 3.5, "severity_level": "Minor"},
        fraud_analysis={
            "duplicate_check": {"is_duplicate": False, "similarity_score": 0.10},
            "metadata_fraud": {"metadata_fraud_score": 1.0, "editing_software": {"detected": False}},
            "overall_fraud": {"overall_fraud_score": 1.5}
        },
        consistency_check={"consistency_score": 9.0, "is_consistent": True},
        date_validation={"is_date_consistent": True, "date_difference_days": 1}
    )
    print(f"  Recommendation: {decision_a['recommendation']} | Confidence: {decision_a['confidence']}")
    print(f"  Explanation: {decision_a['explanation']}")
    assert decision_a["recommendation"] == "APPROVE"
    assert decision_a["confidence"] == "HIGH"

    # Scenario B: Duplicate Video Reused Across Policies -> REJECT
    print("\n[Scenario B] Re-used walk-around video across accounts -> REJECT")
    decision_b = engine.make_video_decision(
        yolo_summary=yolo_good,
        llava_analysis={"damage_score": 4.0, "severity_level": "Moderate"},
        fraud_analysis={
            "duplicate_check": {
                "is_duplicate": True,
                "similarity_score": 0.94,
                "cross_policy_reuse": True,
                "is_mirrored": False
            },
            "metadata_fraud": {"metadata_fraud_score": 2.0, "editing_software": {"detected": False}},
            "overall_fraud": {"overall_fraud_score": 5.5}
        },
        consistency_check={"consistency_score": 8.0, "is_consistent": True}
    )
    print(f"  Recommendation: {decision_b['recommendation']} | Confidence: {decision_b['confidence']}")
    print(f"  Explanation: {decision_b['explanation']}")
    assert decision_b["recommendation"] == "REJECT"
    assert decision_b["confidence"] == "HIGH"
    assert "cross-policy" in decision_b["explanation"].lower() or "different policy" in decision_b["explanation"].lower()

    # Scenario C: Video Editing Software Detected (CapCut/Premiere) -> REJECT
    print("\n[Scenario C] Tampered video edited with CapCut -> REJECT")
    decision_c = engine.make_video_decision(
        yolo_summary=yolo_good,
        llava_analysis={"damage_score": 4.0, "severity_level": "Moderate"},
        fraud_analysis={
            "duplicate_check": {"is_duplicate": False, "similarity_score": 0.08},
            "metadata_fraud": {
                "metadata_fraud_score": 4.5,
                "editing_software": {"detected": True, "tools": ["capcut"]}
            },
            "overall_fraud": {"overall_fraud_score": 4.0}
        },
        consistency_check={"consistency_score": 8.0, "is_consistent": True}
    )
    print(f"  Recommendation: {decision_c['recommendation']} | Confidence: {decision_c['confidence']}")
    print(f"  Explanation: {decision_c['explanation']}")
    assert decision_c["recommendation"] == "REJECT"
    assert decision_c["confidence"] == "HIGH"

    # Scenario D: Severe Visual-Textual Inconsistency -> REJECT
    print("\n[Scenario D] Severe mismatch between statement and footage -> REJECT")
    decision_d = engine.make_video_decision(
        yolo_summary={"total_detections": 0, "aggregate_damage_area_ratio": 0.0, "mean_confidence": 0.0, "primary_vehicle_detected": False},
        llava_analysis={"damage_score": 1.0, "severity_level": "None"},
        fraud_analysis={
            "duplicate_check": {"is_duplicate": False, "similarity_score": 0.05},
            "metadata_fraud": {"metadata_fraud_score": 1.0, "editing_software": {"detected": False}},
            "overall_fraud": {"overall_fraud_score": 2.0}
        },
        consistency_check={"consistency_score": 2.5, "is_consistent": False}
    )
    print(f"  Recommendation: {decision_d['recommendation']} | Confidence: {decision_d['confidence']}")
    print(f"  Explanation: {decision_d['explanation']}")
    assert decision_d["recommendation"] == "REJECT"
    assert decision_d["confidence"] == "HIGH"

    # Scenario E: Timestamp Discrepancy (18 days gap) -> MANUAL_REVIEW
    print("\n[Scenario E] 18 days discrepancy between claim and recording -> MANUAL_REVIEW")
    decision_e = engine.make_video_decision(
        yolo_summary=yolo_good,
        llava_analysis={"damage_score": 5.0, "severity_level": "Moderate"},
        fraud_analysis={
            "duplicate_check": {"is_duplicate": False, "similarity_score": 0.15},
            "metadata_fraud": {"metadata_fraud_score": 3.0, "editing_software": {"detected": False}},
            "overall_fraud": {"overall_fraud_score": 3.8}
        },
        consistency_check={"consistency_score": 6.5, "is_consistent": True},
        date_validation={"is_date_consistent": False, "date_difference_days": 18}
    )
    print(f"  Recommendation: {decision_e['recommendation']} | Confidence: {decision_e['confidence']}")
    print(f"  Explanation: {decision_e['explanation']}")
    assert decision_e["recommendation"] == "MANUAL_REVIEW"

    # Scenario F: Video Detailed Report Generation
    print("\n[Scenario F] Testing generate_video_detailed_report...")
    mock_analysis_results = {
        "yolo_detection": {"detections": [{"class_name": "dent", "confidence": 0.85}]},
        "yolo_aggregate": yolo_good,
        "llava_analysis": {
            "severity_level": "Minor",
            "parsed_analysis": {
                "damaged_parts": ["rear bumper"],
                "damage_description": "Scratch and minor dent",
                "repair_or_replace": "Repair"
            }
        },
        "fraud_detection": {
            "overall_fraud": {"overall_fraud_score": 1.5, "risk_level": "LOW", "all_fraud_indicators": [], "breakdown": {}},
            "duplicate_check": {"is_duplicate": False, "similarity_score": 0.10, "duplicate_details": []},
            "metadata_fraud": {"metadata_fraud_score": 1.0, "editing_software": {"detected": False, "tools": []}}
        },
        "consistency_check": {"consistency_score": 9.0, "is_consistent": True, "consistency_response": "Matches perfectly"},
        "keyframe_selection": {
            "primary_path": "data/uploads/keyframes/job_001_primary.jpg",
            "secondary_path": None,
            "llava_mode": "SINGLE_KEYFRAME",
            "ranking": [{"rank": 1, "timestamp_sec": 2.0, "salience_score": 4.5}]
        }
    }
    report = engine.generate_video_detailed_report(mock_analysis_results, decision_a)
    assert report["claim_type"] == "VIDEO_WALK_AROUND"
    assert "video_evidence" in report
    assert "damage_assessment" in report
    assert "fraud_analysis" in report
    print(f"  [OK] Detailed Video Report generated successfully!")
    print(f"  [OK] Claim Type: {report['claim_type']}")
    print(f"  [OK] Primary Keyframe: {report['video_evidence']['primary_annotated_keyframe_url']}")
    print(f"  [OK] Decision: {report['decision']['recommendation']}")

    print("\n[SUCCESS] All Step 7 tests passed!")


if __name__ == "__main__":
    test_step6_temporal_fingerprinting()
    test_step7_unified_scoring_engine()
    print("\n" + "=" * 70)
    print("ALL TESTS FOR STEPS 6 & 7 COMPLETED SUCCESSFULLY")
    print("=" * 70 + "\n")
