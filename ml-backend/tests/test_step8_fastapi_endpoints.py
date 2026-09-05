"""
Test Suite for Step 8: FastAPI Endpoint Integration
- Tests POST /api/analyze-claim-video (Dedicated Video Endpoint)
- Tests POST /api/analyze-claim (Unified Endpoint with Video and Image)
- Tests GET /api/annotated-image/{job_id} and GET /api/annotated-keyframe/{job_id}
- Tests GET /api/claim/{job_id} and GET /api/claims
"""

import os
import sys
import io
import cv2
import numpy as np
from pathlib import Path
from unittest.mock import patch, MagicMock

# Add project root to sys.path
root_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root_dir))

from fastapi.testclient import TestClient
from app.main import app, claims_db


def create_sample_mp4_bytes(filename="test_claim_video.mp4", duration_sec=3, fps=24, width=640, height=480):
    """Generate in-memory or on-disk MP4 video file for testing"""
    os.makedirs("data/test_videos", exist_ok=True)
    file_path = os.path.join("data/test_videos", filename)
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(file_path, fourcc, fps, (width, height))

    total_frames = int(fps * duration_sec)
    for i in range(total_frames):
        frame = np.ones((height, width, 3), dtype=np.uint8) * (80 + (i % 30))
        # Add high-contrast vehicle silhouette
        cv2.rectangle(frame, (120, 140), (520, 360), (30, 30, 30), -1)
        cv2.circle(frame, (200, 360), 35, (10, 10, 10), -1)
        cv2.circle(frame, (440, 360), 35, (10, 10, 10), -1)
        cv2.putText(frame, "SAMPLE VEHICLE DENT", (140, 240),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (240, 240, 240), 2)
        out.write(frame)

    out.release()
    with open(file_path, "rb") as f:
        data = f.read()
    return file_path, data


def run_tests():
    print("\n" + "=" * 70)
    print("TESTING STEP 8: FASTAPI ENDPOINT INTEGRATION")
    print("=" * 70 + "\n")

    client = TestClient(app)

    # 1. Test Server Discovery Endpoints
    print("[1] Testing Root and Health Endpoints...")
    res_root = client.get("/")
    assert res_root.status_code == 200
    root_data = res_root.json()
    assert "/api/analyze-claim-video" in root_data["endpoints"].values()
    print("  [OK] Root endpoint registered: /api/analyze-claim-video")

    res_health = client.get("/health")
    assert res_health.status_code == 200
    assert res_health.json()["status"] == "healthy"
    print("  [OK] Health endpoint: status = healthy")

    # 2. Test Input Validation Failures
    print("\n[2] Testing Input Validation & Error Handling...")
    # Too short description (< 10 chars)
    dummy_file = ("test.mp4", io.BytesIO(b"dummy video content"), "video/mp4")
    res_short = client.post(
        "/api/analyze-claim-video",
        files={"video": dummy_file},
        data={
            "claim_date": "2026-09-01",
            "claim_description": "Dent",
            "claim_location": "Delhi",
            "policy_id": "POL_TEST"
        }
    )
    assert res_short.status_code == 400
    print("  [OK] Successfully rejected short claim description (< 10 chars)")

    # 3. Create Sample Video
    print("\n[3] Generating Sample Walk-Around Video...")
    sample_path, sample_bytes = create_sample_mp4_bytes("api_test_sample.mp4", duration_sec=3)
    print(f"  [OK] Sample video created: {sample_path} ({len(sample_bytes)} bytes)")

    # 4. Test Dedicated Endpoint: POST /api/analyze-claim-video
    print("\n[4] Testing POST /api/analyze-claim-video (Dedicated Video Endpoint)...")
    
    # Mock Ollama call to keep unit test self-contained without requiring local Ollama server running
    mock_llava_response = {
        "raw_response": "Damaged rear bumper with moderate dent.",
        "parsed_analysis": {
            "damaged_parts": ["rear bumper"],
            "damage_description": "Noticeable dent and abrasion on bumper",
            "severity_assessment": "Moderate damage to rear impact zone",
            "repair_or_replace": "Repair"
        },
        "severity_level": "Moderate",
        "damage_score": 5.0,
        "mode": "SINGLE_KEYFRAME",
        "primary_timestamp": 1.0,
        "composite_path": None
    }

    mock_consistency_response = {
        "is_consistent": True,
        "consistency_score": 8.5,
        "consistency_response": "Claimant statement accurately matches visual video evidence."
    }

    with patch("app.services.detection_service.LLaVADamageAnalyzer.analyze_damage_from_video_keyframe", return_value=mock_llava_response), \
         patch("app.services.detection_service.LLaVADamageAnalyzer.check_consistency", return_value=mock_consistency_response):

        res_video = client.post(
            "/api/analyze-claim-video",
            files={"video": ("walkaround.mp4", io.BytesIO(sample_bytes), "video/mp4")},
            data={
                "claim_date": "2026-09-04",
                "claim_description": "Rear-end collision at intersection resulting in deep bumper dent.",
                "claim_location": "Mumbai",
                "policy_id": "POL_98765"
            }
        )

        assert res_video.status_code == 200, f"Expected 200, got {res_video.status_code}: {res_video.text}"
        res_data = res_video.json()

        assert res_data["success"] is True
        job_id = res_data["job_id"]
        assert "primary_annotated_keyframe_url" in res_data
        assert "keyframe_timeline" in res_data
        assert "report" in res_data
        assert "decision" in res_data

        print(f"  [OK] Video claim processed successfully! Job ID: {job_id}")
        print(f"  [OK] Primary Keyframe URL: {res_data['primary_annotated_keyframe_url']}")
        print(f"  [OK] Keyframe Timeline Checkpoints: {len(res_data['keyframe_timeline'])} frames ranked")
        print(f"  [OK] Final Recommendation: {res_data['decision']['recommendation']} ({res_data['decision']['confidence']} confidence)")

        # 5. Test GET /api/annotated-image/{job_id}
        print("\n[5] Testing GET /api/annotated-image/{job_id}...")
        res_img = client.get(res_data["primary_annotated_keyframe_url"])
        assert res_img.status_code == 200
        assert res_img.headers["content-type"] == "image/jpeg"
        print(f"  [OK] Annotated primary keyframe served with content-type: {res_img.headers['content-type']}")

        # 6. Test GET /api/claim/{job_id}
        print("\n[6] Testing GET /api/claim/{job_id}...")
        res_claim = client.get(f"/api/claim/{job_id}")
        assert res_claim.status_code == 200
        claim_obj = res_claim.json()
        assert claim_obj["claim_type"] == "VIDEO_WALK_AROUND"
        assert claim_obj["claim_info"]["policy_id"] == "POL_98765"
        print(f"  [OK] Claim record retrieved from database: type = {claim_obj['claim_type']}")

        # 7. Test GET /api/claims
        print("\n[7] Testing GET /api/claims...")
        res_list = client.get("/api/claims")
        assert res_list.status_code == 200
        claims_list = res_list.json()
        assert claims_list["total"] >= 1
        found_claim = any(c["job_id"] == job_id for c in claims_list["claims"])
        assert found_claim
        print(f"  [OK] Claims list returned {claims_list['total']} claims with new video claim included")

        # 8. Test Unified Endpoint: POST /api/analyze-claim with video file
        print("\n[8] Testing Unified POST /api/analyze-claim (Routing video through unified endpoint)...")
        res_unified = client.post(
            "/api/analyze-claim",
            files={"video": ("unified_walkaround.mp4", io.BytesIO(sample_bytes), "video/mp4")},
            data={
                "claim_date": "2026-09-04",
                "claim_description": "Accident on highway, walk-around video of passenger side impact.",
                "claim_location": "Bangalore",
                "policy_id": "POL_UNIFIED_01"
            }
        )
        assert res_unified.status_code == 200
        unified_data = res_unified.json()
        assert unified_data["success"] is True
        assert "primary_annotated_keyframe_url" in unified_data
        print(f"  [OK] Unified /api/analyze-claim routed video successfully! Job ID: {unified_data['job_id']}")

    print("\n" + "=" * 70)
    print("ALL STEP 8 FASTAPI TESTS COMPLETED SUCCESSFULLY!")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    run_tests()
