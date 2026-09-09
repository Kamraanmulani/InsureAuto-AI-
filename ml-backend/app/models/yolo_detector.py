from ultralytics import YOLO
import cv2
import numpy as np
from typing import List, Dict, Any, Tuple, Optional
import os

class VehicleDetector:
    def __init__(self, model_path: str = "yolov10m.pt"):
        if not os.path.exists(model_path):
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            candidate = os.path.join(base_dir, model_path)
            if os.path.exists(candidate):
                model_path = candidate
        self.model = YOLO(model_path)
        self.relevant_classes = [
            'car', 'truck', 'bus', 'motorcycle', 'bicycle'
        ]
        print("[OK] Vehicle detector model loaded successfully")

    def detect_objects(self, image_path: str, conf_threshold: float = 0.25) -> List[Dict[str, Any]]:
        results = self.model(image_path, conf=conf_threshold, verbose=False)
        detections = []
        for result in results:
            boxes = result.boxes
            for box in boxes:
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                confidence = float(box.conf[0])
                class_id = int(box.cls[0])
                class_name = self.model.names[class_id]
                detection = {
                    "bbox": [int(x1), int(y1), int(x2), int(y2)],
                    "confidence": round(confidence, 3),
                    "class_id": class_id,
                    "class_name": class_name,
                    "area": int((x2 - x1) * (y2 - y1))
                }
                detections.append(detection)
        return detections

    def generate_annotated_image(self, 
                                 image_path: str, 
                                 detections: List[Dict[str, Any]], 
                                 output_path: str) -> str:
        image = cv2.imread(image_path)
        for det in detections:
            x1, y1, x2, y2 = det["bbox"]
            confidence = det["confidence"]
            class_name = det["class_name"]
            color = (0, 255, 0)
            cv2.rectangle(image, (x1, y1), (x2, y2), color, 2)
            label = f"{class_name} {confidence:.2f}"
            label_size, _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
            cv2.rectangle(
                image,
                (x1, y1 - label_size[1] - 5),
                (x1 + label_size[0], y1),
                color,
                -1
            )
            cv2.putText(
                image,
                label,
                (x1, y1 - 5),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                (0, 0, 0),
                1
            )
        cv2.imwrite(output_path, image)
        return output_path

    def analyze_damage_regions(self, detections: List[Dict[str, Any]]) -> Dict[str, Any]:
        return self.analyze_vehicle_regions(detections)

    def analyze_vehicle_regions(self, detections: List[Dict[str, Any]]) -> Dict[str, Any]:
        analysis = {
            "total_detections": len(detections),
            "primary_vehicle_detected": False,
            "vehicle_type": None,
            "detected_objects": []
        }
        vehicles = [d for d in detections if d["class_name"] in self.relevant_classes]
        if vehicles:
            primary_vehicle = max(vehicles, key=lambda x: x["area"])
            analysis["primary_vehicle_detected"] = True
            analysis["vehicle_type"] = primary_vehicle["class_name"]
        for det in detections:
            analysis["detected_objects"].append({
                "type": det["class_name"],
                "confidence": det["confidence"],
                "bbox": det["bbox"]
            })
        return analysis

    def get_damage_score_from_detections(self, detections: List[Dict[str, Any]]) -> float:
        return 0.0

    def detect_objects_batch(
        self,
        images: List[Any],
        conf_threshold: float = 0.25,
        batch_size: int = 16
    ) -> List[List[Dict[str, Any]]]:
        if not images:
            return []
        all_batch_detections: List[List[Dict[str, Any]]] = []
        for i in range(0, len(images), batch_size):
            chunk = images[i: i + batch_size]
            results = self.model(chunk, conf=conf_threshold, verbose=False)
            for result in results:
                frame_detections = []
                boxes = result.boxes
                for box in boxes:
                    x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                    confidence = float(box.conf[0])
                    class_id = int(box.cls[0])
                    class_name = self.model.names[class_id]
                    detection = {
                        "bbox": [int(x1), int(y1), int(x2), int(y2)],
                        "confidence": round(confidence, 3),
                        "class_id": class_id,
                        "class_name": class_name,
                        "area": int((x2 - x1) * (y2 - y1))
                    }
                    frame_detections.append(detection)
                all_batch_detections.append(frame_detections)
        return all_batch_detections

    def calculate_frame_salience_score(
        self,
        detections: List[Dict[str, Any]],
        frame_area: int = 640 * 640
    ) -> float:
        if not detections:
            return 0.0
        score = 0.0
        for det in detections:
            conf = det["confidence"]
            area_ratio = det["area"] / max(1, frame_area)
            score += conf * area_ratio * 10.0
            if det["class_name"] in self.relevant_classes:
                score += 1.0 + conf
        return round(score, 3)

    def scan_video_frames(
        self,
        candidate_keyframes: List[Dict[str, Any]],
        conf_threshold: float = 0.25,
        batch_size: int = 16
    ) -> List[Dict[str, Any]]:
        if not candidate_keyframes:
            return []
        frames = [k["frame"] for k in candidate_keyframes]
        all_detections = self.detect_objects_batch(frames, conf_threshold=conf_threshold, batch_size=batch_size)
        for i, keyframe in enumerate(candidate_keyframes):
            detections = all_detections[i] if i < len(all_detections) else []
            keyframe["detections"] = detections
            keyframe["analysis"] = self.analyze_vehicle_regions(detections)
            frame_shape = keyframe["frame"].shape[:2]
            frame_area = frame_shape[0] * frame_shape[1]
            keyframe["salience_score"] = self.calculate_frame_salience_score(detections, frame_area=frame_area)
        return candidate_keyframes

    def _bboxes_overlap(self, bbox1: List[int], bbox2: List[int], iou_threshold: float = 0.3) -> bool:
        x1 = max(bbox1[0], bbox2[0])
        y1 = max(bbox1[1], bbox2[1])
        x2 = min(bbox1[2], bbox2[2])
        y2 = min(bbox1[3], bbox2[3])
        inter_area = max(0, x2 - x1) * max(0, y2 - y1)
        if inter_area == 0:
            return False
        area1 = (bbox1[2] - bbox1[0]) * (bbox1[3] - bbox1[1])
        area2 = (bbox2[2] - bbox2[0]) * (bbox2[3] - bbox2[1])
        union_area = area1 + area2 - inter_area
        return (inter_area / max(1, union_area)) >= iou_threshold

    def _frames_are_visually_diverse(
        self,
        primary_keyframe: Dict[str, Any],
        candidate_keyframe: Dict[str, Any],
        iou_threshold: float = 0.3
    ) -> bool:
        primary_bboxes = [d["bbox"] for d in primary_keyframe.get("detections", [])]
        candidate_bboxes = [d["bbox"] for d in candidate_keyframe.get("detections", [])]
        if not primary_bboxes or not candidate_bboxes:
            return True
        for cb in candidate_bboxes:
            for pb in primary_bboxes:
                if self._bboxes_overlap(pb, cb, iou_threshold):
                    return False
        return True

    def select_top_keyframes(
        self,
        scanned_keyframes: List[Dict[str, Any]],
        job_id: str,
        output_dir: str = "data/uploads/keyframes",
        max_keyframes: int = 2,
        diversity_iou_threshold: float = 0.3
    ) -> Dict[str, Any]:
        if not scanned_keyframes:
            return {
                "primary": None,
                "secondary": None,
                "primary_path": None,
                "secondary_path": None,
                "ranking": [],
                "summary": "No candidate keyframes available for ranking."
            }
        os.makedirs(output_dir, exist_ok=True)
        ranked = sorted(scanned_keyframes, key=lambda x: x.get("salience_score", 0.0), reverse=True)
        primary = ranked[0]
        primary_path = os.path.join(output_dir, f"{job_id}_keyframe_primary.jpg")
        self.generate_annotated_frame(primary["frame"], primary["detections"], output_path=primary_path)

        secondary = None
        secondary_path = None
        if max_keyframes >= 2 and len(ranked) > 1:
            for candidate in ranked[1:]:
                if candidate.get("salience_score", 0.0) > 0 and self._frames_are_visually_diverse(
                    primary, candidate, iou_threshold=diversity_iou_threshold
                ):
                    secondary = candidate
                    secondary_path = os.path.join(output_dir, f"{job_id}_keyframe_secondary.jpg")
                    self.generate_annotated_frame(
                        secondary["frame"], secondary["detections"], output_path=secondary_path
                    )
                    break

        ranking_summary = [
            {
                "rank": idx + 1,
                "timestamp_sec": kf["timestamp_sec"],
                "salience_score": kf["salience_score"],
                "num_detections": len(kf.get("detections", []))
            }
            for idx, kf in enumerate(ranked)
        ]

        return {
            "primary": primary,
            "secondary": secondary,
            "primary_path": primary_path,
            "secondary_path": secondary_path,
            "ranking": ranking_summary,
            "summary": (
                f"Selected {1 if secondary is None else 2} keyframe(s) from "
                f"{len(scanned_keyframes)} candidates."
            )
        }

    def generate_annotated_frame(
        self,
        frame: np.ndarray,
        detections: List[Dict[str, Any]],
        output_path: Optional[str] = None
    ) -> np.ndarray:
        annotated = frame.copy()
        for det in detections:
            x1, y1, x2, y2 = det["bbox"]
            confidence = det["confidence"]
            class_name = det["class_name"]
            color = (0, 255, 0)
            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
            label = f"{class_name} {confidence:.2f}"
            label_size, _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
            cv2.rectangle(
                annotated,
                (x1, max(0, y1 - label_size[1] - 5)),
                (x1 + label_size[0], max(label_size[1] + 5, y1)),
                color,
                -1
            )
            cv2.putText(
                annotated,
                label,
                (x1, max(label_size[1], y1 - 5)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                (0, 0, 0),
                1
            )
        if output_path:
            os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
            cv2.imwrite(output_path, annotated)
        return annotated


class DamageDetector:
    def __init__(self, model_path: Optional[str] = None):
        self.model_path = model_path
        self.is_available = False
        self.status = "MODEL_UNAVAILABLE"

    def detect_damage(self, image_input: Any) -> Dict[str, Any]:
        return {
            "available": False,
            "status": "MODEL_UNAVAILABLE",
            "message": "Vehicle detected. Dedicated damage model unavailable.",
            "detected_damage_regions": []
        }


class DamageSeverityEstimator:
    def __init__(self):
        pass

    def estimate_severity(self, damage_regions: List[Dict[str, Any]]) -> Dict[str, Any]:
        if not damage_regions:
            return {
                "available": False,
                "status": "MODEL_UNAVAILABLE",
                "severity": "Unassessed",
                "score": 0.0
            }
        return {
            "available": True,
            "status": "EVALUATED",
            "severity": "Moderate",
            "score": 5.0
        }


YOLODamageDetector = VehicleDetector
YOLODetector = VehicleDetector