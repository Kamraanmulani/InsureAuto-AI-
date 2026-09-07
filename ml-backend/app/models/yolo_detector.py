from ultralytics import YOLO
import cv2
import numpy as np
from typing import List, Dict, Any, Tuple, Optional
import os

class YOLODamageDetector:
    def __init__(self, model_path: str = "yolov10m.pt"):
        """Initialize YOLO model for damage detection"""
        # Note: User changed to yolov10m.pt in download_models.py, so defaulting to that
        if not os.path.exists(model_path):
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            candidate = os.path.join(base_dir, model_path)
            if os.path.exists(candidate):
                model_path = candidate
        self.model = YOLO(model_path)
        
        # Define vehicle parts we're interested in
        # Note: Using COCO classes as base, will detect relevant objects
        self.relevant_classes = [
            'car', 'truck', 'bus', 'motorcycle', 'bicycle'
        ]
        
        # Define custom damage-related mappings
        self.damage_indicators = {
            'dent': ['deformed', 'crushed', 'bent'],
            'crack': ['broken', 'cracked', 'shattered'],
            'scratch': ['scratched', 'scraped'],
            'missing': ['missing', 'detached', 'fallen']
        }
        
        print("[OK] YOLO model loaded successfully")
    
    def detect_objects(self, image_path: str, conf_threshold: float = 0.25) -> List[Dict[str, Any]]:
        """Detect objects and potential damage in image"""
        
        # Run inference
        results = self.model(image_path, conf=conf_threshold)
        
        detections = []
        
        for result in results:
            boxes = result.boxes
            
            for box in boxes:
                # Extract detection info
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
        """Generate image with bounding boxes and labels"""
        
        # Load image
        image = cv2.imread(image_path)
        
        # Draw detections
        for det in detections:
            x1, y1, x2, y2 = det["bbox"]
            confidence = det["confidence"]
            class_name = det["class_name"]
            
            # Draw bounding box
            color = (0, 255, 0)  # Green for detected objects
            cv2.rectangle(image, (x1, y1), (x2, y2), color, 2)
            
            # Draw label
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
        
        # Save annotated image
        cv2.imwrite(output_path, image)
        return output_path
    
    def analyze_damage_regions(self, detections: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze detected objects to identify potential damage regions"""
        
        analysis = {
            "total_detections": len(detections),
            "primary_vehicle_detected": False,
            "vehicle_type": None,
            "detected_objects": [],
            "damage_indicators": []
        }
        
        # Find primary vehicle
        vehicles = [d for d in detections if d["class_name"] in self.relevant_classes]
        
        if vehicles:
            # Get largest vehicle (likely the claim subject)
            primary_vehicle = max(vehicles, key=lambda x: x["area"])
            analysis["primary_vehicle_detected"] = True
            analysis["vehicle_type"] = primary_vehicle["class_name"]
        
        # Categorize all detections
        for det in detections:
            analysis["detected_objects"].append({
                "type": det["class_name"],
                "confidence": det["confidence"],
                "bbox": det["bbox"]
            })
        
        return analysis
    
    def get_damage_score_from_detections(self, detections: List[Dict[str, Any]]) -> float:
        """Calculate initial damage score based on detections"""
        
        # Simple heuristic for prototype
        # More sophisticated scoring will come from LLaVA
        
        if not detections:
            return 0.0
        
        # Base score on number of detections and confidence
        score = 0.0
        
        for det in detections:
            # Higher confidence = more likely actual damage
            score += det["confidence"] * 2
        
        # Normalize to 0-10 scale
        normalized_score = min(score, 10.0)
        
        return round(normalized_score, 2)

    # =========================================================================
    # STEP 3: FAST BATCHED YOLO DAMAGE SCANNING FOR VIDEO FRAMES
    # =========================================================================

    def detect_objects_batch(
        self,
        images: List[Any],
        conf_threshold: float = 0.25,
        batch_size: int = 16
    ) -> List[List[Dict[str, Any]]]:
        """
        Step 3: Fast batched object & damage detection across multiple frames.
        Executes YOLO inference in batches to minimize latency on GPU/CPU.
        
        Args:
            images: List of image paths or numpy arrays
            conf_threshold: Minimum detection confidence
            batch_size: Batch size for model inference
            
        Returns:
            List of detection lists, corresponding to each input frame.
        """
        if not images:
            return []

        all_batch_detections: List[List[Dict[str, Any]]] = []

        # Process in batch chunks
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
        """
        Compute damage salience score for a frame to rank keyframes.
        Higher score indicates larger detected vehicle parts, higher confidence,
        and higher likelihood of visible damage.
        """
        if not detections:
            return 0.0

        score = 0.0
        for det in detections:
            conf = det["confidence"]
            area_ratio = det["area"] / max(1, frame_area)
            # Detections of vehicles or significant damage regions contribute to salience
            score += conf * area_ratio * 10.0

            # Bonus for relevant vehicle categories
            if det["class_name"] in self.relevant_classes:
                score += 1.0 + conf

        return round(score, 3)

    def scan_video_frames(
        self,
        candidate_keyframes: List[Dict[str, Any]],
        conf_threshold: float = 0.25,
        batch_size: int = 16
    ) -> List[Dict[str, Any]]:
        """
        Step 3: Fast batched scanning and damage scoring of video keyframes.
        Enriches candidate keyframe dictionaries with YOLO detections, analysis,
        and salience ranking scores.
        """
        if not candidate_keyframes:
            return []

        frames = [k["frame"] for k in candidate_keyframes]
        all_detections = self.detect_objects_batch(frames, conf_threshold=conf_threshold, batch_size=batch_size)

        for i, keyframe in enumerate(candidate_keyframes):
            detections = all_detections[i] if i < len(all_detections) else []
            keyframe["detections"] = detections
            keyframe["analysis"] = self.analyze_damage_regions(detections)

            frame_shape = keyframe["frame"].shape[:2]
            frame_area = frame_shape[0] * frame_shape[1]
            keyframe["salience_score"] = self.calculate_frame_salience_score(detections, frame_area=frame_area)

        return candidate_keyframes

    # =========================================================================
    # STEP 4: SMART KEYFRAME RANKING & SELECTION
    # =========================================================================

    def _bboxes_overlap(self, bbox1: List[int], bbox2: List[int], iou_threshold: float = 0.3) -> bool:
        """
        Check if two bounding boxes overlap significantly using IoU.
        Used to determine if two frames show damage in distinct regions.
        """
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
        """
        Return True if candidate shows damage on a sufficiently distinct region
        compared to the primary keyframe (low bounding-box overlap).
        """
        primary_bboxes = [d["bbox"] for d in primary_keyframe.get("detections", [])]
        candidate_bboxes = [d["bbox"] for d in candidate_keyframe.get("detections", [])]

        if not primary_bboxes or not candidate_bboxes:
            return True  # No detections to compare - treat as distinct

        # If any candidate bbox overlaps significantly with any primary bbox, not diverse
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
        """
        Step 4: Smart Keyframe Ranking & Selection.

        Ranks YOLO-scanned keyframes by damage salience score, selects the
        primary (highest salience) and an optional diverse secondary keyframe
        (showing a distinct damage region via IoU check), then saves annotated
        keyframe JPEGs to disk.

        Args:
            scanned_keyframes:      Output of scan_video_frames() - list of keyframe
                                    dicts already enriched with 'detections',
                                    'analysis', and 'salience_score'.
            job_id:                 Unique job ID used to name output files.
            output_dir:             Directory to write annotated keyframe images.
            max_keyframes:          Maximum number of keyframes to keep (1 or 2).
            diversity_iou_threshold: Min IoU below which frames are considered diverse.

        Returns:
            Dict with keys:
                - primary:          Primary keyframe dict (highest salience).
                - secondary:        Secondary keyframe dict or None.
                - primary_path:     Absolute path to saved annotated primary frame.
                - secondary_path:   Absolute path to saved annotated secondary frame or None.
                - ranking:          Full sorted list of keyframes with salience scores.
                - summary:          Human-readable selection summary.
        """
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

        # --- Sort all frames by salience score descending ---
        ranked = sorted(scanned_keyframes, key=lambda x: x.get("salience_score", 0.0), reverse=True)

        # --- Select primary keyframe ---
        primary = ranked[0]
        primary_path = os.path.join(output_dir, f"{job_id}_keyframe_primary.jpg")
        self.generate_annotated_frame(primary["frame"], primary["detections"], output_path=primary_path)

        print(f"  ✓ Primary keyframe selected: t={primary['timestamp_sec']}s, "
              f"salience={primary['salience_score']}, "
              f"detections={len(primary['detections'])}")

        # --- Select secondary keyframe (optional, diverse angle) ---
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
                    print(f"  ✓ Secondary keyframe selected: t={secondary['timestamp_sec']}s, "
                          f"salience={secondary['salience_score']}, "
                          f"detections={len(secondary['detections'])}")
                    break

        if secondary is None:
            print("  ℹ  No diverse secondary keyframe found; proceeding with primary only.")

        # --- Build compact ranking summary (timestamps + scores only) ---
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
                f"{len(scanned_keyframes)} candidates. "
                f"Primary at t={primary['timestamp_sec']}s "
                f"(salience={primary['salience_score']})."
                + (f" Secondary at t={secondary['timestamp_sec']}s "
                   f"(salience={secondary['salience_score']})." if secondary else "")
            )
        }

    def generate_annotated_frame(
        self,
        frame: np.ndarray,
        detections: List[Dict[str, Any]],
        output_path: Optional[str] = None
    ) -> np.ndarray:
        """
        Render bounding boxes directly onto an in-memory image frame.
        Optionally saves to output_path.
        """
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


# Export alias for consistency
YOLODetector = YOLODamageDetector
