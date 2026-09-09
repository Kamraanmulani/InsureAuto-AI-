from app.models.yolo_detector import VehicleDetector, DamageDetector, DamageSeverityEstimator, YOLODamageDetector
from app.models.llava_analyzer import LLaVADamageAnalyzer
from app.models.fraud_detector import FraudDetector
from app.utils.video_processor import VideoProcessor
from typing import Dict, Any, List, Optional
import os
import numpy as np

class DetectionService:
    def __init__(self):
        self.vehicle_detector = VehicleDetector()
        self.yolo_detector = self.vehicle_detector
        self.damage_detector = DamageDetector()
        self.damage_severity_estimator = DamageSeverityEstimator()
        self.llava_analyzer = LLaVADamageAnalyzer(
            model_name="llava:13b",
            ollama_host="http://localhost:11434"
        )
        self.fraud_detector = FraudDetector()
        self.video_processor = VideoProcessor()
    
    async def complete_claim_analysis(self, 
                                       image_path: str, 
                                       job_id: str,
                                       claim_description: str,
                                       metadata: Dict[str, Any],
                                       validation_result: Dict[str, Any]) -> Dict[str, Any]:
        detections = self.vehicle_detector.detect_objects(image_path)
        analysis = self.vehicle_detector.analyze_vehicle_regions(detections)
        
        annotated_path = f"data/uploads/annotated/{job_id}_annotated.jpg"
        os.makedirs("data/uploads/annotated", exist_ok=True)
        
        self.vehicle_detector.generate_annotated_image(
            image_path,
            detections,
            annotated_path
        )
        
        dedicated_damage = self.damage_detector.detect_damage(image_path)
        
        llava_analysis = self.llava_analyzer.analyze_damage(
            image_path,
            claim_description,
            metadata
        )
        
        detected_parts_text = ", ".join(llava_analysis.get("parsed_analysis", {}).get("damaged_parts", []))
        consistency_check = self.llava_analyzer.check_consistency(
            image_path,
            claim_description,
            detected_parts_text
        )
        
        duplicate_check = self.fraud_detector.check_duplicate(image_path, job_id)
        metadata_fraud = self.fraud_detector.calculate_metadata_fraud_score(
            metadata,
            validation_result
        )
        consistency_fraud = self.fraud_detector.calculate_consistency_fraud_score(
            consistency_check["consistency_score"],
            consistency_check["is_consistent"]
        )
        overall_fraud = self.fraud_detector.calculate_overall_fraud_score(
            metadata_fraud["metadata_fraud_score"],
            duplicate_check,
            consistency_fraud["consistency_fraud_score"]
        )
        
        final_damage_score = float(llava_analysis.get("damage_score", 0.0))
        
        return {
            "vehicle_detection": {
                "detections": detections,
                "analysis": analysis,
                "annotated_image_path": annotated_path
            },
            "yolo_detection": {
                "detections": detections,
                "analysis": analysis,
                "annotated_image_path": annotated_path
            },
            "dedicated_damage_detection": dedicated_damage,
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
                "damaged_parts": llava_analysis.get("parsed_analysis", {}).get("damaged_parts", []),
                "severity": llava_analysis.get("severity_level", "Unknown"),
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
        keyframe_dir = "data/uploads/keyframes"
        keyframe_selection = self.vehicle_detector.select_top_keyframes(
            scanned_keyframes=scanned_keyframes,
            job_id=job_id,
            output_dir=keyframe_dir,
            max_keyframes=2
        )

        primary = keyframe_selection["primary"]
        secondary = keyframe_selection["secondary"]
        primary_path = keyframe_selection["primary_path"]
        secondary_path = keyframe_selection["secondary_path"]

        if primary is None:
            raise ValueError(
                f"No valid keyframes could be selected from {len(scanned_keyframes)} candidates."
            )

        primary_detections = primary.get("detections", [])
        primary_analysis = primary.get("analysis", {})

        all_detections = []
        total_vehicle_area = 0
        total_frame_area = 0
        confidences = []
        vehicles_found = []

        for kf in scanned_keyframes:
            dets = kf.get("detections", [])
            all_detections.extend(dets)
            f_shape = kf.get("frame").shape[:2] if isinstance(kf.get("frame"), np.ndarray) else (640, 640)
            total_frame_area += (f_shape[0] * f_shape[1])
            for d in dets:
                total_vehicle_area += d.get("area", 0)
                confidences.append(d.get("confidence", 0.0))
                if d.get("class_name") in self.vehicle_detector.relevant_classes:
                    vehicles_found.append(d.get("class_name"))

        agg_area_ratio = round(total_vehicle_area / max(1, total_frame_area), 4) if total_frame_area > 0 else 0.0
        mean_conf = round(float(np.mean(confidences)), 3) if confidences else 0.0

        vehicle_aggregate = {
            "total_detections": len(all_detections),
            "aggregate_vehicle_area_ratio": agg_area_ratio,
            "aggregate_damage_area_ratio": agg_area_ratio,
            "mean_confidence": mean_conf,
            "primary_vehicle_detected": len(vehicles_found) > 0 or primary_analysis.get("primary_vehicle_detected", False),
            "vehicle_type": vehicles_found[0] if vehicles_found else primary_analysis.get("vehicle_type", "Unknown")
        }

        dedicated_damage = self.damage_detector.detect_damage(primary_path)

        llava_analysis = self.llava_analyzer.analyze_damage_from_video_keyframe(
            primary_keyframe_path=primary_path,
            claim_description=claim_description,
            metadata=metadata,
            primary_timestamp=primary["timestamp_sec"],
            secondary_keyframe_path=secondary_path,
            secondary_timestamp=secondary["timestamp_sec"] if secondary else None,
            composite_output_dir=keyframe_dir
        )

        detected_parts_text = ", ".join(
            llava_analysis.get("parsed_analysis", {}).get("damaged_parts", [])
        )
        consistency_check = self.llava_analyzer.check_consistency(
            primary_path,
            claim_description,
            detected_parts_text
        )

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

        final_damage_score = float(llava_analysis.get("damage_score", 0.0))

        return {
            "vehicle_detection": {
                "detections": primary_detections,
                "analysis": primary_analysis,
                "annotated_image_path": primary_path
            },
            "yolo_detection": {
                "detections": primary_detections,
                "analysis": primary_analysis,
                "annotated_image_path": primary_path
            },
            "vehicle_aggregate": vehicle_aggregate,
            "yolo_aggregate": vehicle_aggregate,
            "dedicated_damage_detection": dedicated_damage,
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
                "damaged_parts": llava_analysis.get("parsed_analysis", {}).get("damaged_parts", []),
                "severity": llava_analysis.get("severity_level", "Unknown"),
                "damage_score": final_damage_score,
                "consistency_score": consistency_check["consistency_score"],
                "is_consistent": consistency_check["is_consistent"],
                "fraud_score": overall_fraud["overall_fraud_score"],
                "fraud_risk_level": overall_fraud["risk_level"]
            },
            "keyframe_selection": {
                "ranking": keyframe_selection["ranking"],
                "summary": keyframe_selection["summary"],
                "primary_path": primary_path,
                "secondary_path": secondary_path,
                "primary_timestamp": primary["timestamp_sec"],
                "secondary_timestamp": secondary["timestamp_sec"] if secondary else None,
                "llava_mode": llava_analysis.get("mode", "SINGLE_KEYFRAME"),
                "composite_path": llava_analysis.get("composite_path")
            }
        }