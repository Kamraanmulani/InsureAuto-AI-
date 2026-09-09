import os
import shutil
import uuid
from datetime import datetime
from typing import Optional, Dict, Any
from fastapi import APIRouter, File, UploadFile, Form, HTTPException
from fastapi.responses import FileResponse
from app.services.preprocessing import PreprocessingService
from app.services.detection_service import DetectionService
from app.services.scoring_engine import ScoringEngine
from app.utils.video_processor import VideoProcessor

router = APIRouter()

preprocessing_service = PreprocessingService()
detection_service = DetectionService()
scoring_engine = ScoringEngine()
video_processor = VideoProcessor()

VIDEO_EXTENSIONS = ('.mp4', '.mov', '.avi', '.mkv', '.webm')


@router.get("/")
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


@router.get("/health")
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
    policy_id: str,
    job_id: Optional[str] = None
) -> Dict[str, Any]:
    if not claim_description or len(claim_description) < 10:
        raise HTTPException(
            status_code=400,
            detail="Claim description must be at least 10 characters"
        )

    resolved_job_id = job_id.strip() if (job_id and job_id.strip()) else str(uuid.uuid4())
    os.makedirs("data/uploads", exist_ok=True)
    os.makedirs("data/uploads/keyframes", exist_ok=True)
    temp_video_path = f"data/uploads/{resolved_job_id}_{video.filename}"

    try:
        with open(temp_video_path, "wb") as buffer:
            shutil.copyfileobj(video.file, buffer)

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

        extraction_result = video_processor.extract_candidate_keyframes(temp_video_path)
        candidate_keyframes = extraction_result.get("keyframes", [])

        if not candidate_keyframes:
            raise HTTPException(
                status_code=400,
                detail="No non-blurry keyframes could be extracted from the video stream"
            )

        scanned_keyframes = detection_service.yolo_detector.scan_video_frames(candidate_keyframes)

        analysis_result = await detection_service.complete_video_claim_analysis(
            scanned_keyframes=scanned_keyframes,
            job_id=resolved_job_id,
            claim_description=claim_description,
            metadata=metadata,
            validation_result=validation,
            video_path=temp_video_path,
            policy_id=policy_id,
            date_validation=date_validation
        )

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

        primary_annotated_path = analysis_result["keyframe_selection"].get("primary_path")
        secondary_annotated_path = analysis_result["keyframe_selection"].get("secondary_path")

        claim_record = {
            "job_id": resolved_job_id,
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
            "primary_annotated_keyframe": primary_annotated_path,
            "secondary_annotated_keyframe": secondary_annotated_path
        }

        return {
            "success": True,
            "job_id": resolved_job_id,
            "claim_info": claim_record["claim_info"],
            "primary_annotated_keyframe_url": f"/api/annotated-image/{resolved_job_id}",
            "keyframe_timeline": analysis_result["keyframe_selection"].get("ranking", []),
            "report": report,
            "decision": decision
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        if os.path.exists(temp_video_path):
            try:
                os.remove(temp_video_path)
            except Exception:
                pass


@router.post("/api/analyze-claim-video")
async def analyze_claim_video(
    video: UploadFile = File(...),
    claim_date: str = Form(...),
    claim_description: str = Form(...),
    claim_location: str = Form(default="Unknown"),
    policy_id: str = Form(default=""),
    job_id: Optional[str] = Form(default=None)
):
    return await _process_video_claim(
        video=video,
        claim_date=claim_date,
        claim_description=claim_description,
        claim_location=claim_location,
        policy_id=policy_id,
        job_id=job_id
    )


@router.post("/api/analyze-claim")
async def analyze_claim(
    image: Optional[UploadFile] = File(None),
    video: Optional[UploadFile] = File(None),
    claim_date: str = Form(...),
    claim_description: str = Form(...),
    claim_location: str = Form(default="Unknown"),
    policy_id: str = Form(default=""),
    job_id: Optional[str] = Form(default=None)
):
    if video is not None:
        return await _process_video_claim(
            video=video,
            claim_date=claim_date,
            claim_description=claim_description,
            claim_location=claim_location,
            policy_id=policy_id,
            job_id=job_id
        )

    if image is not None:
        ext = os.path.splitext(image.filename)[1].lower() if image.filename else ""
        if ext in VIDEO_EXTENSIONS or (image.content_type and "video" in image.content_type):
            return await _process_video_claim(
                video=image,
                claim_date=claim_date,
                claim_description=claim_description,
                claim_location=claim_location,
                policy_id=policy_id,
                job_id=job_id
            )

    if image is None:
        raise HTTPException(
            status_code=400,
            detail="Either 'image' or 'video' file must be uploaded"
        )

    if not claim_description or len(claim_description) < 10:
        raise HTTPException(
            status_code=400,
            detail="Claim description must be at least 10 characters"
        )

    resolved_job_id = job_id.strip() if (job_id and job_id.strip()) else None

    os.makedirs("data/uploads", exist_ok=True)
    temp_path = f"data/uploads/{image.filename}"

    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)

        preprocess_result = await preprocessing_service.process_claim_image(
            temp_path,
            claim_date,
            claim_description,
            custom_job_id=resolved_job_id
        )

        analysis_result = await detection_service.complete_claim_analysis(
            preprocess_result["processed_path"],
            preprocess_result["job_id"],
            claim_description,
            preprocess_result["metadata"],
            preprocess_result["validation"]
        )

        decision = scoring_engine.make_decision(
            analysis_result["final_scores"]["damage_score"],
            analysis_result["final_scores"]["fraud_score"],
            analysis_result["final_scores"]["consistency_score"],
            preprocess_result["validation"]
        )

        report = scoring_engine.generate_detailed_report(
            analysis_result,
            decision
        )

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
            "report": report
        }

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
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass


@router.get("/api/claim/{job_id}")
@router.get("/api/claim/{job_id}")
async def get_claim(job_id: str):
    raise HTTPException(
        status_code=404,
        detail="Stateless inference engine: Canonical claim records are persisted in MongoDB via the Node.js API"
    )


@router.get("/api/claims")
async def list_claims():
    return {
        "message": "Stateless inference engine: Query MongoDB via Node.js API for claim records",
        "total": 0,
        "claims": []
    }


@router.get("/api/annotated-image/{job_id}")
async def get_annotated_image(job_id: str):
    candidate_paths = [
        f"data/uploads/keyframes/{job_id}_keyframe_primary.jpg",
        f"data/uploads/keyframes/{job_id}_primary.jpg",
        f"data/uploads/keyframes/{job_id}_keyframe_secondary.jpg",
        f"data/uploads/annotated/{job_id}_annotated.jpg",
        f"data/uploads/{job_id}_annotated.jpg",
        f"data/uploads/processed/{job_id}_processed.jpg",
        f"data/uploads/{job_id}.jpg"
    ]
    for path in candidate_paths:
        if os.path.exists(path):
            return FileResponse(path, media_type="image/jpeg")

    for search_dir in ["data/uploads/keyframes", "data/uploads/annotated", "data/uploads/processed", "data/uploads"]:
        if os.path.exists(search_dir):
            files = [
                os.path.join(search_dir, f)
                for f in os.listdir(search_dir)
                if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')) and not os.path.isdir(os.path.join(search_dir, f))
            ]
            if files:
                files.sort(key=lambda p: os.path.getmtime(p), reverse=True)
                return FileResponse(files[0], media_type="image/jpeg")

    raise HTTPException(status_code=404, detail="Annotated image not found")


@router.get("/api/annotated-keyframe/{job_id}")
async def get_annotated_keyframe(job_id: str, frame_type: str = "primary"):
    candidate_paths = [
        f"data/uploads/keyframes/{job_id}_keyframe_{frame_type}.jpg",
        f"data/uploads/keyframes/{job_id}_{frame_type}.jpg",
        f"data/uploads/{job_id}_keyframe_{frame_type}.jpg",
        f"data/uploads/{job_id}_{frame_type}.jpg",
        f"data/uploads/annotated/{job_id}_annotated.jpg",
        f"data/uploads/{job_id}_annotated.jpg",
        f"data/uploads/processed/{job_id}_processed.jpg"
    ]
    for path in candidate_paths:
        if os.path.exists(path):
            return FileResponse(path, media_type="image/jpeg")

    keyframe_dir = "data/uploads/keyframes"
    if os.path.exists(keyframe_dir):
        matching_files = [
            os.path.join(keyframe_dir, f)
            for f in os.listdir(keyframe_dir)
            if f.lower().endswith(f"_{frame_type}.jpg") or f.lower().endswith(f"_{frame_type}.jpeg") or f.lower().endswith(f"_{frame_type}.png")
        ]
        if matching_files:
            matching_files.sort(key=lambda p: os.path.getmtime(p), reverse=True)
            return FileResponse(matching_files[0], media_type="image/jpeg")

        all_keyframe_files = [
            os.path.join(keyframe_dir, f)
            for f in os.listdir(keyframe_dir)
            if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')) and not os.path.isdir(os.path.join(keyframe_dir, f))
        ]
        if all_keyframe_files:
            all_keyframe_files.sort(key=lambda p: os.path.getmtime(p), reverse=True)
            return FileResponse(all_keyframe_files[0], media_type="image/jpeg")

    for search_dir in ["data/uploads/annotated", "data/uploads/processed", "data/uploads"]:
        if os.path.exists(search_dir):
            files = [
                os.path.join(search_dir, f)
                for f in os.listdir(search_dir)
                if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')) and not os.path.isdir(os.path.join(search_dir, f))
            ]
            if files:
                files.sort(key=lambda p: os.path.getmtime(p), reverse=True)
                return FileResponse(files[0], media_type="image/jpeg")

    raise HTTPException(status_code=404, detail=f"Annotated keyframe ({frame_type}) not found")
