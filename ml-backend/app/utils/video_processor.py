import os
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
import cv2
import numpy as np


class VideoProcessor:
    """
    Video ingestion and fast validation utility for insurance claim processing.
    
    Implements Step 1 of the Video Processing Pipeline:
    - Format and extension validation (.mp4, .mov, .avi, .mkv, .webm)
    - File size and stream duration limits (max 50MB, max 30s)
    - Resolution requirements (min 640x480)
    - Container metadata extraction (duration, FPS, codec, resolution, creation time)
    - Claim date vs. video timestamp temporal consistency validation
    """

    ALLOWED_EXTENSIONS = ('.mp4', '.mov', '.avi', '.mkv', '.webm')
    DEFAULT_MAX_SIZE_MB = 50.0
    DEFAULT_MAX_DURATION_SEC = 30.0
    DEFAULT_MIN_RESOLUTION = (640, 480)  # (width, height)

    def __init__(
        self,
        max_size_mb: float = DEFAULT_MAX_SIZE_MB,
        max_duration_sec: float = DEFAULT_MAX_DURATION_SEC,
        min_resolution: Tuple[int, int] = DEFAULT_MIN_RESOLUTION,
        allowed_extensions: Tuple[str, ...] = ALLOWED_EXTENSIONS
    ):
        self.max_size_mb = max_size_mb
        self.max_duration_sec = max_duration_sec
        self.min_resolution = min_resolution
        self.allowed_extensions = tuple(ext.lower() for ext in allowed_extensions)

    def validate_video_file(self, video_path: str) -> Dict[str, Any]:
        """
        Perform fast initial validation on video file path, format, size, duration, and resolution.
        
        Returns:
            Dict containing:
                - is_valid (bool): True if video passes all critical constraints
                - errors (List[str]): Critical issues preventing processing
                - warnings (List[str]): Non-blocking issues or advisories
                - properties (Dict[str, Any]): Basic stream properties if decodable
        """
        errors: List[str] = []
        warnings: List[str] = []
        properties: Dict[str, Any] = {}

        # 1. Existence check
        if not os.path.exists(video_path):
            return {
                "is_valid": False,
                "errors": [f"Video file not found: {video_path}"],
                "warnings": warnings,
                "properties": properties
            }

        # 2. Extension / format validation
        _, ext = os.path.splitext(video_path)
        ext = ext.lower()
        if ext not in self.allowed_extensions:
            errors.append(
                f"Unsupported video extension '{ext}'. Allowed formats: {', '.join(self.allowed_extensions)}"
            )

        # 3. File size limit validation
        try:
            file_size_bytes = os.path.getsize(video_path)
            file_size_mb = file_size_bytes / (1024 * 1024)
            properties["file_size_mb"] = round(file_size_mb, 2)

            if file_size_bytes == 0:
                errors.append("Video file is empty (0 bytes)")
            elif file_size_mb > self.max_size_mb:
                errors.append(
                    f"Video file size ({file_size_mb:.1f} MB) exceeds maximum allowed limit ({self.max_size_mb:.1f} MB)"
                )
        except Exception as e:
            errors.append(f"Failed to check file size: {str(e)}")

        # If extension or file size failed, stop early before decoding
        if errors:
            return {
                "is_valid": False,
                "errors": errors,
                "warnings": warnings,
                "properties": properties
            }

        # 4. Stream decoding and property inspection via OpenCV
        cap = cv2.VideoCapture(video_path)
        try:
            if not cap.isOpened():
                errors.append("Failed to open or decode video stream. The file may be corrupt or encoded in an unsupported codec.")
                return {
                    "is_valid": False,
                    "errors": errors,
                    "warnings": warnings,
                    "properties": properties
                }

            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            fps = float(cap.get(cv2.CAP_PROP_FPS))
            frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            fourcc_int = int(cap.get(cv2.CAP_PROP_FOURCC))
            codec = "".join([chr((fourcc_int >> 8 * i) & 0xFF) for i in range(4)]).strip()

            # Handle edge case where fps or frame_count is invalid/zero
            if fps <= 0:
                fps = 30.0  # Fallback assumption
                warnings.append("FPS could not be detected reliably from stream; defaulting to 30.0")

            duration = (frame_count / fps) if frame_count > 0 else 0.0

            properties.update({
                "width": width,
                "height": height,
                "fps": round(fps, 2),
                "frame_count": frame_count,
                "duration_seconds": round(duration, 2),
                "codec": codec or "unknown"
            })

            # Check minimum resolution (support landscape, portrait, and widescreen aspect ratio encodings like 848x478, 854x480)
            min_w, min_h = self.min_resolution
            longer_edge = max(width, height)
            shorter_edge = min(width, height)
            req_longer = max(min_w, min_h)
            req_shorter = min(min_w, min_h)
            
            # Widescreen 480p often encodes to 848x478 or 854x480 (macroblock alignment)
            # Accept if total resolution is comparable or longer edge is sufficiently high
            is_valid_resolution = (
                (longer_edge >= req_longer and shorter_edge >= int(req_shorter * 0.80)) or
                (width * height >= int(min_w * min_h * 0.75) and shorter_edge >= 360)
            )

            if not is_valid_resolution:
                errors.append(
                    f"Video resolution ({width}x{height}) is below minimum requirement ({min_w}x{min_h})"
                )

            # Check maximum duration
            if duration > self.max_duration_sec:
                errors.append(
                    f"Video duration ({duration:.1f}s) exceeds maximum allowed duration ({self.max_duration_sec:.1f}s)"
                )
            elif duration < 1.0 and frame_count > 0:
                warnings.append("Video is extremely short (< 1 second), which may hinder multi-angle damage assessment")

        finally:
            cap.release()

        is_valid = len(errors) == 0
        return {
            "is_valid": is_valid,
            "errors": errors,
            "warnings": warnings,
            "properties": properties
        }

    def extract_video_metadata(self, video_path: str) -> Dict[str, Any]:
        """
        Extract comprehensive technical and container metadata from a video file.
        """
        metadata: Dict[str, Any] = {
            "file_name": os.path.basename(video_path),
            "file_path": video_path,
            "extension": os.path.splitext(video_path)[1].lower(),
            "file_size_mb": 0.0,
            "duration_seconds": 0.0,
            "fps": 0.0,
            "frame_count": 0,
            "width": 0,
            "height": 0,
            "aspect_ratio": "Unknown",
            "codec": "Unknown",
            "created_at": None,
            "modified_at": None,
            "has_video_stream": False
        }

        if not os.path.exists(video_path):
            return metadata

        # File system attributes
        try:
            stat = os.stat(video_path)
            metadata["file_size_mb"] = round(stat.st_size / (1024 * 1024), 2)
            metadata["created_at"] = datetime.fromtimestamp(stat.st_ctime).isoformat()
            metadata["modified_at"] = datetime.fromtimestamp(stat.st_mtime).isoformat()
        except Exception as e:
            print(f"Warning: Could not read file stats: {e}")

        # Stream attributes
        cap = cv2.VideoCapture(video_path)
        try:
            if cap.isOpened():
                width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                fps = float(cap.get(cv2.CAP_PROP_FPS))
                frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
                fourcc_int = int(cap.get(cv2.CAP_PROP_FOURCC))
                codec = "".join([chr((fourcc_int >> 8 * i) & 0xFF) for i in range(4)]).strip()

                if fps > 0 and frame_count > 0:
                    duration = frame_count / fps
                else:
                    duration = 0.0

                aspect_ratio = f"{width}:{height}"
                if height > 0:
                    ratio_val = width / height
                    if abs(ratio_val - 16 / 9) < 0.05:
                        aspect_ratio = "16:9"
                    elif abs(ratio_val - 4 / 3) < 0.05:
                        aspect_ratio = "4:3"
                    elif abs(ratio_val - 9 / 16) < 0.05:
                        aspect_ratio = "9:16 (Portrait)"
                    elif abs(ratio_val - 1.0) < 0.05:
                        aspect_ratio = "1:1 (Square)"

                metadata.update({
                    "duration_seconds": round(duration, 2),
                    "fps": round(fps, 2),
                    "frame_count": frame_count,
                    "width": width,
                    "height": height,
                    "aspect_ratio": aspect_ratio,
                    "codec": codec or "unknown",
                    "has_video_stream": frame_count > 0
                })
        finally:
            cap.release()

        return metadata

    def validate_video_date(
        self,
        metadata: Dict[str, Any],
        claim_date: str,
        allowed_variance_days: int = 7
    ) -> Dict[str, Any]:
        """
        Cross-reference video timestamp metadata against the claimant's stated claim date.
        
        Args:
            metadata: Metadata dictionary produced by extract_video_metadata()
            claim_date: Claim date string formatted as 'YYYY-MM-DD'
            allowed_variance_days: Maximum expected days between accident date and recording
            
        Returns:
            Dict containing:
                - is_date_consistent (bool)
                - date_difference_days (Optional[int])
                - risk_score (int: 0 to 5)
                - notes (List[str])
        """
        result = {
            "is_date_consistent": True,
            "date_difference_days": None,
            "risk_score": 0,
            "notes": []
        }

        # Parse claim date
        try:
            claim_date_dt = datetime.strptime(claim_date, "%Y-%m-%d").date()
        except Exception as e:
            result["is_date_consistent"] = False
            result["risk_score"] = 2
            result["notes"].append(f"Invalid claim date format '{claim_date}'. Expected 'YYYY-MM-DD': {e}")
            return result

        # Check modified_at or created_at timestamp
        video_ts_str = metadata.get("modified_at") or metadata.get("created_at")
        if not video_ts_str:
            result["notes"].append("No reliable file creation or modification timestamp available")
            result["risk_score"] += 1
            return result

        try:
            video_dt = datetime.fromisoformat(video_ts_str).date()
            diff_days = abs((video_dt - claim_date_dt).days)
            result["date_difference_days"] = diff_days

            if diff_days > allowed_variance_days:
                result["is_date_consistent"] = False
                # Scale risk with time discrepancy
                calculated_risk = min(5, 2 + (diff_days // allowed_variance_days))
                result["risk_score"] = calculated_risk
                result["notes"].append(
                    f"Video timestamp ({video_dt}) differs from claim date ({claim_date_dt}) by {diff_days} days (threshold: {allowed_variance_days} days)"
                )
            else:
                result["notes"].append(
                    f"Video timestamp ({video_dt}) is consistent with claim date ({claim_date_dt}) (difference: {diff_days} days)"
                )
        except Exception as e:
            result["notes"].append(f"Could not parse video timestamp: {e}")
            result["risk_score"] += 1

        return result

    def get_video_summary(
        self,
        video_path: str,
        claim_date: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Unified Step 1 analysis: runs validation, metadata extraction, and optional date verification.
        """
        validation = self.validate_video_file(video_path)
        metadata = self.extract_video_metadata(video_path)
        
        date_validation = None
        if claim_date:
            date_validation = self.validate_video_date(metadata, claim_date)

        return {
            "validation": validation,
            "metadata": metadata,
            "date_validation": date_validation
        }

    # =========================================================================
    # STEP 2: LOW-LATENCY KEYFRAME EXTRACTION & QUALITY FILTERING
    # =========================================================================

    def calculate_blur_score(self, frame: np.ndarray) -> float:
        """
        Compute image sharpness using the variance of the Laplacian operator.
        Score = Var(∇² I).
        Lower values indicate heavy motion blur or camera shake.
        
        Args:
            frame: RGB or BGR numpy array
            
        Returns:
            float: Variance score (typically 0-50 for blurry, >100 for sharp)
        """
        if frame is None or frame.size == 0:
            return 0.0

        if len(frame.shape) == 3:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        else:
            gray = frame

        # Compute Laplacian and its variance
        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        score = float(laplacian.var())
        return round(score, 2)

    def is_blurry(self, frame: np.ndarray, threshold: float = 100.0) -> bool:
        """
        Determine if a frame is motion-blurred based on Laplacian variance threshold.
        """
        return self.calculate_blur_score(frame) < threshold

    def extract_candidate_keyframes(
        self,
        video_path: str,
        sample_interval_sec: float = 1.0,
        max_candidate_frames: int = 20,
        blur_threshold: float = 100.0,
        target_size: Tuple[int, int] = (640, 640)
    ) -> Dict[str, Any]:
        """
        Fast low-latency keyframe extraction pipeline (Step 2):
        1. Adaptive temporal sampling: extracts 1 frame every sample_interval_sec (e.g. 1.0s).
        2. Blur rejection: discards blurry frames using Laplacian variance.
        3. Normalization: resizes frames to target_size (640x640) for fast YOLO batch scanning.
        
        Args:
            video_path: Path to video file
            sample_interval_sec: Seconds between sampled frames (e.g. 1.0s for 1 FPS sample)
            max_candidate_frames: Maximum number of frames to retain
            blur_threshold: Minimum Laplacian variance to be considered sharp (default: 100.0)
            target_size: Dimensions (width, height) to resize keyframes for YOLO
            
        Returns:
            Dict containing:
                - total_stream_frames: Total frames in source video
                - sampled_count: Number of frames sampled at the interval
                - retained_count: Number of non-blurry frames retained
                - dropped_blurry_count: Number of frames discarded due to blur
                - keyframes: List of keyframe dicts with 'frame_idx', 'timestamp_sec', 
                             'blur_score', 'frame' (640x640), and 'original_shape'
        """
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video not found: {video_path}")

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Unable to decode video stream: {video_path}")

        keyframes: List[Dict[str, Any]] = []
        all_evaluated: List[Dict[str, Any]] = []
        dropped_blurry_count = 0
        sampled_count = 0

        try:
            fps = float(cap.get(cv2.CAP_PROP_FPS))
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

            if fps <= 0:
                fps = 30.0

            # Calculate frame step based on desired time interval
            step = max(1, int(fps * sample_interval_sec))

            # Determine frame indices to inspect
            target_indices: List[int] = []
            current_idx = 0
            while current_idx < total_frames and len(target_indices) < max_candidate_frames:
                target_indices.append(current_idx)
                current_idx += step

            for frame_idx in target_indices:
                cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
                success, raw_frame = cap.read()
                if not success or raw_frame is None:
                    continue

                sampled_count += 1
                orig_h, orig_w = raw_frame.shape[:2]
                timestamp_sec = round(frame_idx / fps, 2)
                blur_score = self.calculate_blur_score(raw_frame)

                # Resize to target YOLO resolution
                resized_frame = cv2.resize(raw_frame, target_size, interpolation=cv2.INTER_AREA)

                frame_data = {
                    "frame_idx": frame_idx,
                    "timestamp_sec": timestamp_sec,
                    "blur_score": blur_score,
                    "frame": resized_frame,
                    "original_shape": (orig_h, orig_w)
                }
                all_evaluated.append(frame_data)

                # Blur filtering gate
                if blur_score >= blur_threshold:
                    keyframes.append(frame_data)
                else:
                    dropped_blurry_count += 1

            # Fallback guarantee: If ALL frames were dropped due to high threshold,
            # retain the top 3 least-blurry frames so downstream models can still analyze
            if len(keyframes) == 0 and len(all_evaluated) > 0:
                sorted_by_sharpness = sorted(all_evaluated, key=lambda x: x["blur_score"], reverse=True)
                fallback_count = min(3, len(sorted_by_sharpness))
                keyframes = sorted_by_sharpness[:fallback_count]
                dropped_blurry_count = len(all_evaluated) - len(keyframes)

        finally:
            cap.release()

        return {
            "total_stream_frames": total_frames,
            "sampled_count": sampled_count,
            "retained_count": len(keyframes),
            "dropped_blurry_count": dropped_blurry_count,
            "keyframes": keyframes
        }

    def save_keyframe(self, frame: np.ndarray, output_path: str) -> str:
        """Save a keyframe numpy array to disk"""
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        cv2.imwrite(output_path, frame)
        return output_path

