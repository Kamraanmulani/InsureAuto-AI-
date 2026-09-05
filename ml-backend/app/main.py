from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from app.services.preprocessing import PreprocessingService
from app.services.detection_service import DetectionService
from app.services.scoring_engine import ScoringEngine
from app.utils.video_processor import VideoProcessor
import shutil
import os
import uuid
import uvicorn
from typing import Optional, Dict, Any
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = FastAPI(
    title="Insurance Claim Validation API",
    description="AI-powered insurance claim validation using VLMs for Image and Walk-Around Video Evidence",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
preprocessing_service = PreprocessingService()
detection_service = DetectionService()
scoring_engine = ScoringEngine()
video_processor = VideoProcessor()

# Allowed video extensions
VIDEO_EXTENSIONS = ('.mp4', '.mov', '.avi', '.mkv', '.webm')

# Store processed claims in memory (for prototype)
claims_db = {}


@app.get("/")
async def root():
    return {
        "message": "Insurance Claim Validation API",
        "status": "online",
        "version": "1.0.0",
        "endpoints": {
            "analyze_claim": "/api/analyze-claim",
            "analyze_claim_video": "/api/analyze-claim-video",
            "get_claim": "/api/claim/{job_id}",
            "list_claims": "/api/claims",
            "annotated_image": "/api/annotated-image/{job_id}",
            "health": "/health"
        }
    }


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "services": {
            "preprocessing": "[OK]",
            "video_processor": "[OK]",
            "yolo_detection": "[OK]",
            "llava_analysis": "[OK]",
            "fraud_detection": "[OK]",
            "scoring_engine": "[OK]"
        }
    }


async def _process_video_claim(
    video: UploadFile,
    claim_date: str,
    claim_description: str,
    claim_location: str,
    policy_id: str
) -> Dict[str, Any]:
    """
    Internal handler for walk-around video claim processing pipeline (Steps 1 through 7).
    """
    if not claim_description or len(claim_description) < 10:
        raise HTTPException(
            status_code=400,
            detail="Claim description must be at least 10 characters"
        )

    job_id = str(uuid.uuid4())
    os.makedirs("data/uploads", exist_ok=True)
    os.makedirs("data/uploads/keyframes", exist_ok=True)
    temp_video_path = f"data/uploads/{job_id}_{video.filename}"

    try:
        # Save uploaded video binary stream
        with open(temp_video_path, "wb") as buffer:
            shutil.copyfileobj(video.file, buffer)

        print(f"\n{'='*70}")
        print(f"[VIDEO CLAIM] Processing video claim {job_id}: {claim_description[:50]}...")
        print(f"{'='*70}\n")

        # Step 1: Video Ingestion & Fast Validation
        print("[Step 1/7] Ingesting and validating video stream...")
        video_summary = video_processor.get_video_summary(temp_video_path, claim_date=claim_date)
        validation = video_summary.get("validation", {})
        metadata = video_summary.get("metadata", {})
        date_validation = video_summary.get("date_validation")

        if not validation.get("is_valid", False):
            errors = validation.get("errors", ["Video file validation failed"])
            raise HTTPException(
                status_code=400,
                detail={"message": "Video validation failed", "errors": errors}
            )
        print(f"[OK] Step 1 complete: {metadata.get('duration_seconds')}s, {metadata.get('width')}x{metadata.get('height')}")

        # Step 2: Low-Latency Keyframe Extraction & Quality/Blur Filtering
        print("[Step 2/7] Extracting candidate keyframes & filtering blur...")
        extraction_result = video_processor.extract_candidate_keyframes(temp_video_path)
        candidate_keyframes = extraction_result.get("keyframes", [])

        if not candidate_keyframes:
            raise HTTPException(
                status_code=400,
                detail="No non-blurry keyframes could be extracted from the video stream"
            )
        print(f"[OK] Step 2 complete: retained {len(candidate_keyframes)} sharp candidate frames "
              f"(dropped {extraction_result.get('dropped_blurry_count', 0)} blurry)")

        # Step 3: Fast Batched YOLO Damage Scanning
        print(f"[Step 3/7] Scanning {len(candidate_keyframes)} candidate keyframes with batched YOLO...")
        scanned_keyframes = detection_service.yolo_detector.scan_video_frames(candidate_keyframes)
        print(f"[OK] Step 3 complete: batch inference completed")

        # Steps 4, 5, 6: Ranking, Single-Inference LLaVA, Video Fraud Detection
        print("[Steps 4-6/7] Running keyframe selection, VLM reasoning, and temporal fraud checks...")
        analysis_result = await detection_service.complete_video_claim_analysis(
            scanned_keyframes=scanned_keyframes,
            job_id=job_id,
            claim_description=claim_description,
            metadata=metadata,
            validation_result=validation,
            video_path=temp_video_path,
            policy_id=policy_id,
            date_validation=date_validation
        )
        print("[OK] Steps 4-6 complete")

        # Step 7: Unified Decision Engine
        print("[Step 7/7] Generating unified recommendation across all 4 pillars...")
        decision = scoring_engine.make_video_decision(
            yolo_summary=analysis_result["yolo_aggregate"],
            llava_analysis=analysis_result["llava_analysis"],
            fraud_analysis=analysis_result["fraud_detection"],
            metadata_validation=validation,
            date_validation=date_validation,
            consistency_check=analysis_result.get("consistency_check")
        )

        report = scoring_engine.generate_video_detailed_report(
            analysis_results=analysis_result,
            decision=decision
        )
        print(f"[OK] Step 7 complete: Decision = {decision['recommendation']} ({decision['confidence']} confidence)")

        primary_annotated_path = analysis_result["keyframe_selection"].get("primary_path")
        secondary_annotated_path = analysis_result["keyframe_selection"].get("secondary_path")

        # Persist claim record
        claim_record = {
            "job_id": job_id,
            "timestamp": datetime.now().isoformat(),
            "claim_type": "VIDEO_WALK_AROUND",
            "claim_info": {
                "date": claim_date,
                "description": claim_description,
                "location": claim_location,
                "policy_id": policy_id
            },
            "metadata": metadata,
            "report": report,
            "decision": decision,
            "primary_annotated_keyframe": primary_annotated_path,
            "secondary_annotated_keyframe": secondary_annotated_path
        }
        claims_db[job_id] = claim_record

        print(f"\n[OK] Video claim analysis complete for job {job_id}")
        print(f"Recommendation: {decision['recommendation']}")
        print(f"{'='*70}\n")

        return {
            "success": True,
            "job_id": job_id,
            "claim_info": claim_record["claim_info"],
            "primary_annotated_keyframe_url": f"/api/annotated-image/{job_id}",
            "keyframe_timeline": analysis_result["keyframe_selection"].get("ranking", []),
            "report": report,
            "decision": decision
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"\n[ERROR] Error during video claim analysis: {str(e)}\n")
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        # Clean up temporary uploaded video file
        if os.path.exists(temp_video_path):
            try:
                os.remove(temp_video_path)
            except Exception:
                pass


@app.post("/api/analyze-claim-video")
async def analyze_claim_video(
    video: UploadFile = File(...),
    claim_date: str = Form(...),
    claim_description: str = Form(...),
    claim_location: str = Form(default="Unknown"),
    policy_id: str = Form(default="")
):
    """
    Dedicated endpoint for Walk-Around Video Claim Analysis (Step 8).

    Fields:
      - video: Walk-around video file (.mp4, .mov, .avi, .mkv, .webm)
      - claim_date: Stated accident date string (YYYY-MM-DD)
      - claim_description: Written accident description
      - claim_location: Location of accident
      - policy_id: Policy or account identifier
    """
    return await _process_video_claim(
        video=video,
        claim_date=claim_date,
        claim_description=claim_description,
        claim_location=claim_location,
        policy_id=policy_id
    )


@app.post("/api/analyze-claim")
async def analyze_claim(
    image: Optional[UploadFile] = File(None),
    video: Optional[UploadFile] = File(None),
    claim_date: str = Form(...),
    claim_description: str = Form(...),
    claim_location: str = Form(default="Unknown"),
    policy_id: str = Form(default="")
):
    """
    Unified claim validation pipeline supporting both Image and Video submissions.
    If a video is provided or the uploaded file has a video extension, routes to the
    video processing pipeline; otherwise processes via the standard image pipeline.
    """
    # 1. Check if submission is a video
    if video is not None:
        return await _process_video_claim(
            video=video,
            claim_date=claim_date,
            claim_description=claim_description,
            claim_location=claim_location,
            policy_id=policy_id
        )

    if image is not None:
        ext = os.path.splitext(image.filename)[1].lower() if image.filename else ""
        if ext in VIDEO_EXTENSIONS or (image.content_type and "video" in image.content_type):
            return await _process_video_claim(
                video=image,
                claim_date=claim_date,
                claim_description=claim_description,
                claim_location=claim_location,
                policy_id=policy_id
            )

    # 2. Process image claim
    if image is None:
        raise HTTPException(
            status_code=400,
            detail="Either 'image' or 'video' file must be uploaded"
        )

    # Validate inputs
    if not claim_description or len(claim_description) < 10:
        raise HTTPException(
            status_code=400,
            detail="Claim description must be at least 10 characters"
        )

    os.makedirs("data/uploads", exist_ok=True)
    temp_path = f"data/uploads/{image.filename}"

    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)

        print(f"\n{'='*70}")
        print(f"[IMAGE CLAIM] Processing claim: {claim_description[:50]}...")
        print(f"{'='*70}\n")

        # Step 1: Preprocess
        print("[Step 1/5] Preprocessing image and extracting EXIF...")
        preprocess_result = await preprocessing_service.process_claim_image(
            temp_path,
            claim_date,
            claim_description
        )
        print("[OK] Preprocessing complete")

        # Step 2-4: Complete analysis (YOLO detection + LLaVA + fraud)
        print("[Steps 2-4/5] Running AI analysis...")
        analysis_result = await detection_service.complete_claim_analysis(
            preprocess_result["processed_path"],
            preprocess_result["job_id"],
            claim_description,
            preprocess_result["metadata"],
            preprocess_result["validation"]
        )
        print("[OK] AI analysis complete")

        # Step 5: Make decision
        print("[Step 5/5] Generating recommendation...")
        decision = scoring_engine.make_decision(
            analysis_result["final_scores"]["damage_score"],
            analysis_result["final_scores"]["fraud_score"],
            analysis_result["final_scores"]["consistency_score"],
            preprocess_result["validation"]
        )
        print(f"[OK] Recommendation generated: {decision['recommendation']}")

        # Generate detailed report
        report = scoring_engine.generate_detailed_report(
            analysis_result,
            decision
        )

        # Store in database
        claim_record = {
            "job_id": preprocess_result["job_id"],
            "timestamp": datetime.now().isoformat(),
            "claim_type": "PHOTO_IMAGE",
            "claim_info": {
                "date": claim_date,
                "description": claim_description,
                "location": claim_location,
                "policy_id": policy_id
            },
            "metadata": preprocess_result["metadata"],
            "report": report,
            "annotated_image": analysis_result["yolo_detection"]["annotated_image_path"]
        }

        claims_db[preprocess_result["job_id"]] = claim_record

        print(f"\n[OK] Analysis complete!")
        print(f"Recommendation: {decision['recommendation']}")
        print(f"{'='*70}\n")

        return {
            "success": True,
            "job_id": preprocess_result["job_id"],
            "claim_info": claim_record["claim_info"],
            "report": report,
            "annotated_image_url": f"/api/annotated-image/{preprocess_result['job_id']}"
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"\n[ERROR] Error during image claim analysis: {str(e)}\n")
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass


@app.get("/api/claim/{job_id}")
async def get_claim(job_id: str):
    """Retrieve processed claim by job ID"""
    if job_id not in claims_db:
        raise HTTPException(status_code=404, detail="Claim not found")
    return claims_db[job_id]


@app.get("/api/claims")
async def list_claims():
    """List all processed claims"""
    claims_list = []
    for job_id, claim in claims_db.items():
        report = claim.get("report", {})
        decision = report.get("decision", {})
        fraud_analysis = report.get("fraud_analysis", {})
        damage_assessment = report.get("damage_assessment", {})

        claims_list.append({
            "job_id": job_id,
            "timestamp": claim.get("timestamp"),
            "claim_type": claim.get("claim_type", "PHOTO_IMAGE"),
            "claim_description": claim.get("claim_info", {}).get("description", "")[:100],
            "recommendation": decision.get("recommendation", "UNKNOWN"),
            "fraud_score": fraud_analysis.get("overall_score", 0),
            "damage_score": damage_assessment.get("damage_score", damage_assessment.get("score", 0))
        })

    return {
        "total": len(claims_list),
        "claims": sorted(claims_list, key=lambda x: x["timestamp"], reverse=True)
    }


@app.get("/api/annotated-image/{job_id}")
async def get_annotated_image(job_id: str):
    """Retrieve annotated image or primary keyframe with bounding boxes"""
    candidate_paths = [
        f"data/uploads/keyframes/{job_id}_keyframe_primary.jpg",
        f"data/uploads/annotated/{job_id}_annotated.jpg",
        f"data/uploads/{job_id}_annotated.jpg"
    ]
    for path in candidate_paths:
        if os.path.exists(path):
            return FileResponse(path, media_type="image/jpeg")

    raise HTTPException(status_code=404, detail="Annotated image not found")


@app.get("/api/annotated-keyframe/{job_id}")
async def get_annotated_keyframe(job_id: str, frame_type: str = "primary"):
    """Retrieve primary or secondary annotated keyframe"""
    filename = f"{job_id}_keyframe_{frame_type}.jpg"
    path = os.path.join("data/uploads/keyframes", filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"Annotated keyframe ({frame_type}) not found")
    return FileResponse(path, media_type="image/jpeg")


if __name__ == "__main__":
    print("\n" + "="*70)
    print("[SERVER] Starting Insurance Claim Validation API")
    print("="*70 + "\n")
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)