from app.models.yolo_detector import YOLODamageDetector
from app.models.llava_analyzer import LLaVADamageAnalyzer
from app.models.fraud_detector import FraudDetector
from app.utils.video_processor import VideoProcessor
from typing import Dict, Any, List, Optional
import os
import numpy as np

class DetectionService:
    def __init__(self):
        self.yolo_detector = YOLODamageDetector()
        # Initialize with Ollama LLaVA 13B
        self.llava_analyzer = LLaVADamageAnalyzer(
            model_name="llava:13b",
            ollama_host="http://localhost:11434"
        )
        # Initialize fraud detector - will auto-detect Qdrant from environment
        # Set USE_QDRANT=true in environment to enable Qdrant
        self.fraud_detector = FraudDetector()
        self.video_processor = VideoProcessor()
    
    async def complete_claim_analysis(self, 
                                       image_path: str, 
                                       job_id: str,
                                       claim_description: str,
                                       metadata: Dict[str, Any],
                                       validation_result: Dict[str, Any]) -> Dict[str, Any]:
        """Complete end-to-end claim analysis with fraud detection"""
        
        print(f"\n{'='*60}")
        print(f"Starting complete analysis for job {job_id}")
        print(f"{'='*60}")
        
        # Step 1: YOLO Detection
        print("\n[1/5] Running YOLO detection...")
        detections = self.yolo_detector.detect_objects(image_path)
        analysis = self.yolo_detector.analyze_damage_regions(detections)
        
        # Generate annotated image
        annotated_path = f"data/uploads/annotated/{job_id}_annotated.jpg"
        os.makedirs("data/uploads/annotated", exist_ok=True)
        
        self.yolo_detector.generate_annotated_image(
            image_path,
            detections,
            annotated_path
        )
        print(f"✓ Detected {len(detections)} objects")
        
        # Step 2: LLaVA Damage Analysis
        print("\n[2/5] Running LLaVA damage analysis...")
        llava_analysis = self.llava_analyzer.analyze_damage(
            image_path,
            claim_description,
            metadata
        )
        print(f"✓ Severity: {llava_analysis['severity_level']}, Score: {llava_analysis['damage_score']}/10")
        
        # Step 3: Consistency Check
        print("\n[3/5] Checking claim consistency...")
        detected_parts_text = ", ".join(llava_analysis["parsed_analysis"].get("damaged_parts", []))
        consistency_check = self.llava_analyzer.check_consistency(
            image_path,
            claim_description,
            detected_parts_text
        )
        print(f"✓ Consistency score: {consistency_check['consistency_score']}/10")
        
        # Step 4: Fraud Detection
        print("\n[4/5] Running fraud detection...")
        
        # 4a. Duplicate check
        duplicate_check = self.fraud_detector.check_duplicate(image_path, job_id)
        
        # 4b. Metadata fraud score
        metadata_fraud = self.fraud_detector.calculate_metadata_fraud_score(
            metadata,
            validation_result
        )
        
        # 4c. Consistency fraud score
        consistency_fraud = self.fraud_detector.calculate_consistency_fraud_score(
            consistency_check["consistency_score"],
            consistency_check["is_consistent"]
        )
        
        # 4d. Overall fraud score
        overall_fraud = self.fraud_detector.calculate_overall_fraud_score(
            metadata_fraud["metadata_fraud_score"],
            duplicate_check,
            consistency_fraud["consistency_fraud_score"]
        )
        print(f"✓ Fraud risk: {overall_fraud['risk_level']} ({overall_fraud['overall_fraud_score']}/10)")
        
        # Step 5: Combine scores
        final_damage_score = llava_analysis["damage_score"]
        
        print(f"\n[5/5] Analysis complete!")
        print(f"{'='*60}\n")
        
        return {
            "yolo_detection": {
                "detections": detections,
                "analysis": analysis,
                "annotated_image_path": annotated_path
            },
            "llava_analysis": llava_analysis,
            "consistency_check": consistency_check,
            "fraud_detection": {
                "duplicate_check": duplicate_check,
                "metadata_fraud": metadata_fraud,
                "consistency_fraud": consistency_fraud,
                "overall_fraud": overall_fraud
            },
            "final_scores": {
                "damage_score": final_damage_score,
                "fraud_score": overall_fraud["overall_fraud_score"],
                "consistency_score": consistency_check["consistency_score"]
            },
            "summary": {
                "damaged_parts": llava_analysis["parsed_analysis"].get("damaged_parts", []),
                "severity": llava_analysis["severity_level"],
                "damage_score": final_damage_score,
                "consistency_score": consistency_check["consistency_score"],
                "is_consistent": consistency_check["is_consistent"],
                "fraud_score": overall_fraud["overall_fraud_score"],
                "fraud_risk_level": overall_fraud["risk_level"]
            }
        }

    async def complete_video_claim_analysis(
        self,
        scanned_keyframes: List[Dict[str, Any]],
        job_id: str,
        claim_description: str,
        metadata: Dict[str, Any],
        validation_result: Dict[str, Any],
        video_path: Optional[str] = None,
        policy_id: Optional[str] = None,
        date_validation: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Video claim pipeline — Steps 4, 5, 6, & 7 integrated.

        Accepts the output of scan_video_frames() (Step 3) already annotated
        with detections and salience scores, then executes:
          Step 4 — Smart keyframe ranking & selection (primary + optional secondary).
          Step 5 — Single-inference LLaVA damage analysis on selected keyframe(s).
          Step 6 — Video fraud & temporal duplicate detection (composite signatures,
                   Qdrant claim_videos search, editing software scan).
          Step 7 — Aggregates YOLO metrics for unified scoring engine decision.

        Args:
            scanned_keyframes:  List of keyframe dicts from scan_video_frames(),
                                each containing 'frame', 'detections', 'analysis',
                                'salience_score', and 'timestamp_sec'.
            job_id:             Unique job identifier.
            claim_description:  Claimant's written description.
            metadata:           Video/EXIF metadata dict from VideoProcessor.
            validation_result:  Validation result from VideoProcessor.
            video_path:         Optional path to raw video file on disk.
            policy_id:          Optional insurance policy identifier.
            date_validation:    Optional date consistency validation dict.

        Returns:
            Dictionary containing YOLO evidence, LLaVA reasoning, consistency check,
            Step 6 video fraud detection, YOLO aggregate statistics, and keyframe selections.
        """
        print(f"\n{'='*60}")
        print(f"[VIDEO] Starting video analysis pipeline for job {job_id}")
        print(f"{'='*60}")

        # ── Step 4: Smart Keyframe Ranking & Selection ─────────────────────────
        print(f"\n[Step 4/7] Ranking {len(scanned_keyframes)} candidate keyframes by damage salience...")
        keyframe_dir = "data/uploads/keyframes"
        keyframe_selection = self.yolo_detector.select_top_keyframes(
            scanned_keyframes=scanned_keyframes,
            job_id=job_id,
            output_dir=keyframe_dir,
            max_keyframes=2
        )
        print(f"[OK] {keyframe_selection['summary']}")

        primary = keyframe_selection["primary"]
        secondary = keyframe_selection["secondary"]
        primary_path = keyframe_selection["primary_path"]
        secondary_path = keyframe_selection["secondary_path"]

        # Fallback: if all keyframes have zero salience, still pick the first one
        if primary is None:
            raise ValueError(
                f"No valid keyframes could be selected from {len(scanned_keyframes)} candidates."
            )

        # Primary detections and analysis
        primary_detections = primary.get("detections", [])
        primary_analysis = primary.get("analysis", {})

        # ── YOLO Aggregate Statistics Across All Keyframes ─────────────────────
        all_detections = []
        total_damage_area = 0
        total_frame_area = 0
        confidences = []
        vehicles_found = []

        for kf in scanned_keyframes:
            dets = kf.get("detections", [])
            all_detections.extend(dets)
            f_shape = kf.get("frame").shape[:2] if isinstance(kf.get("frame"), np.ndarray) else (640, 640)
            total_frame_area += (f_shape[0] * f_shape[1])
            for d in dets:
                total_damage_area += d.get("area", 0)
                confidences.append(d.get("confidence", 0.0))
                if d.get("class_name") in self.yolo_detector.relevant_classes:
                    vehicles_found.append(d.get("class_name"))

        agg_area_ratio = round(total_damage_area / max(1, total_frame_area), 4) if total_frame_area > 0 else 0.0
        mean_conf = round(float(np.mean(confidences)), 3) if confidences else 0.0

        yolo_aggregate = {
            "total_detections": len(all_detections),
            "aggregate_damage_area_ratio": agg_area_ratio,
            "mean_confidence": mean_conf,
            "primary_vehicle_detected": len(vehicles_found) > 0 or primary_analysis.get("primary_vehicle_detected", False),
            "vehicle_type": vehicles_found[0] if vehicles_found else primary_analysis.get("vehicle_type", "Unknown")
        }

        # ── Step 5: Single-Inference LLaVA on Best Keyframe(s) ────────────────
        print(f"\n[Step 5/7] Running LLaVA on selected keyframe(s)...")
        llava_analysis = self.llava_analyzer.analyze_damage_from_video_keyframe(
            primary_keyframe_path=primary_path,
            claim_description=claim_description,
            metadata=metadata,
            primary_timestamp=primary["timestamp_sec"],
            secondary_keyframe_path=secondary_path,
            secondary_timestamp=secondary["timestamp_sec"] if secondary else None,
            composite_output_dir=keyframe_dir
        )
        print(f"[OK] LLaVA [{llava_analysis['mode']}] — Severity: {llava_analysis['severity_level']}, "
              f"Score: {llava_analysis['damage_score']}/10")

        # ── Consistency Check (reuse existing LLaVA method) ───────────────────
        print("\n  Checking claim-video consistency...")
        detected_parts_text = ", ".join(
            llava_analysis["parsed_analysis"].get("damaged_parts", [])
        )
        consistency_check = self.llava_analyzer.check_consistency(
            primary_path,
            claim_description,
            detected_parts_text
        )
        print(f"[OK] Consistency score: {consistency_check['consistency_score']}/10")

        # ── Step 6: Video Fraud & Temporal Duplicate Detection ────────────────
        print(f"\n[Step 6/7] Running video fraud & temporal duplicate detection...")
        actual_video_path = video_path or metadata.get("file_path")
        candidate_frames = [kf["frame"] for kf in scanned_keyframes] if scanned_keyframes else None

        duplicate_check = self.fraud_detector.check_video_duplicate(
            video_path=actual_video_path,
            job_id=job_id,
            frames=candidate_frames,
            policy_id=policy_id
        )

        metadata_fraud = self.fraud_detector.calculate_video_metadata_fraud_score(
            metadata=metadata,
            validation_result=validation_result,
            date_validation=date_validation,
            video_path=actual_video_path
        )

        consistency_fraud = self.fraud_detector.calculate_consistency_fraud_score(
            consistency_check["consistency_score"],
            consistency_check["is_consistent"]
        )

        overall_fraud = self.fraud_detector.calculate_overall_video_fraud_score(
            metadata_score=metadata_fraud["metadata_fraud_score"],
            duplicate_check=duplicate_check,
            consistency_score=consistency_fraud["consistency_fraud_score"]
        )
        print(f"[OK] Video Fraud risk: {overall_fraud['risk_level']} ({overall_fraud['overall_fraud_score']}/10) "
              f"— Duplicate: {duplicate_check['is_duplicate']}")

        final_damage_score = llava_analysis["damage_score"]

        print(f"\n{'='*60}")
        print(f"[VIDEO] Analysis complete for job {job_id}")
        print(f"{'='*60}\n")

        return {
            # YOLO evidence from the primary keyframe
            "yolo_detection": {
                "detections": primary_detections,
                "analysis": primary_analysis,
                "annotated_image_path": primary_path
            },
            # YOLO aggregate metrics across all candidate keyframes (Step 7)
            "yolo_aggregate": yolo_aggregate,
            # LLaVA analysis (video-aware)
            "llava_analysis": llava_analysis,
            # Consistency check result
            "consistency_check": consistency_check,
            # Step 6 Video Fraud breakdown
            "fraud_detection": {
                "duplicate_check": duplicate_check,
                "metadata_fraud": metadata_fraud,
                "consistency_fraud": consistency_fraud,
                "overall_fraud": overall_fraud
            },
            # Unified scores (same keys as image pipeline)
            "final_scores": {
                "damage_score": final_damage_score,
                "fraud_score": overall_fraud["overall_fraud_score"],
                "consistency_score": consistency_check["consistency_score"]
            },
            "summary": {
                "damaged_parts": llava_analysis["parsed_analysis"].get("damaged_parts", []),
                "severity": llava_analysis["severity_level"],
                "damage_score": final_damage_score,
                "consistency_score": consistency_check["consistency_score"],
                "is_consistent": consistency_check["is_consistent"],
                "fraud_score": overall_fraud["overall_fraud_score"],
                "fraud_risk_level": overall_fraud["risk_level"]
            },
            # Video-specific extras
            "keyframe_selection": {
                "ranking": keyframe_selection["ranking"],
                "summary": keyframe_selection["summary"],
                "primary_path": primary_path,
                "secondary_path": secondary_path,
                "primary_timestamp": primary["timestamp_sec"],
                "secondary_timestamp": secondary["timestamp_sec"] if secondary else None,
                "llava_mode": llava_analysis["mode"],
                "composite_path": llava_analysis.get("composite_path")
            }
        }
