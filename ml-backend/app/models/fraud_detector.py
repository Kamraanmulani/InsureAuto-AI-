import cv2
import imagehash
from PIL import Image
from typing import Dict, Any, List, Optional, Union
import numpy as np
from datetime import datetime
import os
import json

class FraudDetector:
    def __init__(self, use_qdrant: bool = None, qdrant_host: str = None, qdrant_port: int = None):
        """Initialize fraud detection system with optional Qdrant support"""
        
        # Get settings from environment variables or parameters
        if use_qdrant is None:
            use_qdrant = os.getenv("USE_QDRANT", "false").lower() == "true"
        
        if qdrant_host is None:
            qdrant_host = os.getenv("QDRANT_HOST", "localhost")
        
        if qdrant_port is None:
            qdrant_port = int(os.getenv("QDRANT_PORT", "6333"))
        
        self.use_qdrant = use_qdrant
        self.storage_file = "data/image_hashes.json"
        self.video_storage_file = "data/video_hashes.json"
        self.collection_name = "claim_images"
        self.video_collection_name = "claim_videos"
        
        # Ensure data directory exists
        os.makedirs("data", exist_ok=True)
        
        if use_qdrant:
            try:
                from qdrant_client import QdrantClient
                from qdrant_client.models import Distance, VectorParams, PointStruct
                
                # Connect to Qdrant
                print(f"[QDRANT] Connecting to Qdrant at {qdrant_host}:{qdrant_port}")
                self.client = QdrantClient(host=qdrant_host, port=qdrant_port)
                
                # Initialize collections if they don't exist
                self._init_collection()
                self._init_video_collection()
                print("[OK] Fraud Detector initialized with Qdrant")
            except Exception as e:
                print(f"[WARN] Qdrant not available: {e}")
                print("   Falling back to file-based storage")
                self.use_qdrant = False
                self._init_file_storage()
                self._init_video_file_storage()
        else:
            # Use file-based storage as fallback
            self._init_file_storage()
            self._init_video_file_storage()
            print("[OK] Fraud Detector initialized with file-based storage")
    
    def _init_file_storage(self):
        """Initialize file-based storage for image hashes"""
        if not os.path.exists(self.storage_file):
            with open(self.storage_file, 'w') as f:
                json.dump([], f)
                
    def _init_video_file_storage(self):
        """Initialize file-based storage for video composite hashes"""
        if not os.path.exists(self.video_storage_file):
            with open(self.video_storage_file, 'w') as f:
                json.dump([], f)
    
    def _init_collection(self):
        """Initialize Qdrant collection for image hashes"""
        try:
            from qdrant_client.models import Distance, VectorParams
            
            collections = self.client.get_collections().collections
            collection_names = [c.name for c in collections]
            
            if self.collection_name not in collection_names:
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=VectorParams(size=64, distance=Distance.COSINE)
                )
                print(f"Created Qdrant collection: {self.collection_name}")
        except Exception as e:
            print(f"Error initializing Qdrant collection: {e}")
            raise

    def _init_video_collection(self):
        """Initialize Qdrant collection for composite video signatures"""
        try:
            from qdrant_client.models import Distance, VectorParams
            
            collections = self.client.get_collections().collections
            collection_names = [c.name for c in collections]
            
            if self.video_collection_name not in collection_names:
                self.client.create_collection(
                    collection_name=self.video_collection_name,
                    vectors_config=VectorParams(size=64, distance=Distance.COSINE)
                )
                print(f"Created Qdrant collection: {self.video_collection_name}")
        except Exception as e:
            print(f"Error initializing Qdrant video collection: {e}")
            raise
    
    def compute_perceptual_hash(self, image_path: str) -> Dict[str, Any]:
        """Compute multiple perceptual hashes for robust duplicate detection"""
        
        image = Image.open(image_path)
        
        # Compute different hash types
        phash = imagehash.phash(image)
        dhash = imagehash.dhash(image)
        whash = imagehash.whash(image)
        average_hash = imagehash.average_hash(image)
        
        # Convert to vectors for Qdrant (using phash as main)
        phash_vector = self._hash_to_vector(phash)
        
        return {
            "phash": str(phash),
            "dhash": str(dhash),
            "whash": str(whash),
            "average_hash": str(average_hash),
            "phash_vector": phash_vector
        }
    
    def _hash_to_vector(self, hash_obj) -> List[float]:
        """Convert image hash to vector for Qdrant"""
        # Convert hash to binary string, then to vector
        binary_str = format(int(str(hash_obj), 16), '064b')
        vector = [float(bit) for bit in binary_str]
        return vector
    
    def _hamming_distance(self, hash1: str, hash2: str) -> int:
        """Calculate Hamming distance between two hashes"""
        return sum(c1 != c2 for c1, c2 in zip(hash1, hash2))
    
    def check_duplicate(self, image_path: str, job_id: str, threshold: float = 0.9) -> Dict[str, Any]:
        """Check if image is a duplicate or reused from previous claims"""
        
        # Compute hash
        hashes = self.compute_perceptual_hash(image_path)
        
        if self.use_qdrant:
            return self._check_duplicate_qdrant(hashes, job_id, threshold)
        else:
            return self._check_duplicate_file(hashes, job_id, threshold)
    
    def _check_duplicate_qdrant(self, hashes: Dict[str, Any], job_id: str, threshold: float) -> Dict[str, Any]:
        """Check duplicates using Qdrant vector database"""
        try:
            from qdrant_client.models import PointStruct
            
            # Search for similar images in Qdrant
            search_results = None

            # Newer clients: `query_points` (returns QueryResponse with .points)
            if hasattr(self.client, "query_points"):
                response = self.client.query_points(
                    collection_name=self.collection_name,
                    query=hashes["phash_vector"],
                    limit=5,
                    score_threshold=threshold,
                )
                search_results = response.points

            # Older clients: `search` or `search_points` (return list[ScoredPoint])
            elif hasattr(self.client, "search") or hasattr(self.client, "search_points"):
                search_method = getattr(self.client, "search", None) or getattr(self.client, "search_points", None)
                search_results = search_method(
                    collection_name=self.collection_name,
                    query_vector=hashes["phash_vector"],
                    limit=5,
                    score_threshold=threshold,
                )

            else:
                raise AttributeError("QdrantClient has no compatible search method (query_points/search/search_points)")
            
            is_duplicate = len(search_results) > 0
            duplicate_details = []
            
            if is_duplicate:
                for result in search_results:
                    duplicate_details.append({
                        "job_id": result.payload.get("job_id"),
                        "similarity_score": result.score,
                        "timestamp": result.payload.get("timestamp")
                    })
            
            # Store current image hash
            self.client.upsert(
                collection_name=self.collection_name,
                points=[
                    PointStruct(
                        id=abs(hash(job_id)) % (10 ** 8),  # Convert to positive integer ID
                        vector=hashes["phash_vector"],
                        payload={
                            "job_id": job_id,
                            "timestamp": datetime.now().isoformat(),
                            "phash": hashes["phash"],
                            "dhash": hashes["dhash"]
                        }
                    )
                ]
            )
            
            return {
                "is_duplicate": is_duplicate,
                "duplicate_count": len(search_results),
                "duplicate_details": duplicate_details,
                "hashes": hashes
            }
        except Exception as e:
            print(f"Error in Qdrant duplicate check: {e}")
            # Fallback to file-based method
            return self._check_duplicate_file(hashes, job_id, threshold)
    
    def _check_duplicate_file(self, hashes: Dict[str, Any], job_id: str, threshold: float) -> Dict[str, Any]:
        """Check duplicates using file-based storage"""
        
        # Load existing hashes
        try:
            with open(self.storage_file, 'r') as f:
                stored_hashes = json.load(f)
        except:
            stored_hashes = []
        
        is_duplicate = False
        duplicate_details = []
        
        # Compare with stored hashes (using Hamming distance)
        # threshold of 0.9 similarity = max 6 bits different (out of 64)
        max_hamming = int((1 - threshold) * 64)
        
        for stored in stored_hashes:
            distance = self._hamming_distance(hashes["phash"], stored["phash"])
            if distance <= max_hamming:
                is_duplicate = True
                similarity = 1 - (distance / 64)
                duplicate_details.append({
                    "job_id": stored["job_id"],
                    "similarity_score": round(similarity, 3),
                    "timestamp": stored["timestamp"]
                })
        
        # Store current hash
        stored_hashes.append({
            "job_id": job_id,
            "timestamp": datetime.now().isoformat(),
            "phash": hashes["phash"],
            "dhash": hashes["dhash"],
            "whash": hashes["whash"],
            "average_hash": hashes["average_hash"]
        })
        
        # Save updated hashes
        with open(self.storage_file, 'w') as f:
            json.dump(stored_hashes, f, indent=2)
        
        return {
            "is_duplicate": is_duplicate,
            "duplicate_count": len(duplicate_details),
            "duplicate_details": duplicate_details,
            "hashes": hashes
        }
    
    def calculate_metadata_fraud_score(self, 
                                       metadata: Dict[str, Any],
                                       validation_result: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate fraud risk score based on metadata"""
        
        fraud_score = 0
        fraud_indicators = []
        
        # Base score from validation
        fraud_score += validation_result.get("risk_score", 0)
        
        # Check for missing EXIF
        if not metadata.get("has_exif"):
            fraud_score += 3
            fraud_indicators.append("Missing EXIF data")
        
        # Check for editing software
        if metadata.get("software"):
            software = metadata["software"].lower()
            editing_tools = ["photoshop", "gimp", "pixlr", "lightroom", "snapseed"]
            for tool in editing_tools:
                if tool in software:
                    fraud_score += 2
                    fraud_indicators.append(f"Edited with {tool}")
                    break
        
        # Check for suspicious metadata patterns
        if metadata.get("camera_make") == "Unknown" and metadata.get("has_exif"):
            fraud_score += 1
            fraud_indicators.append("Camera information missing despite EXIF presence")
        
        # Add validation issues
        if validation_result.get("issues"):
            fraud_indicators.extend(validation_result["issues"])
        
        # Normalize to 0-10 scale
        fraud_score = min(fraud_score, 10)
        
        return {
            "metadata_fraud_score": fraud_score,
            "fraud_indicators": fraud_indicators,
            "risk_level": self._get_risk_level(fraud_score)
        }
    
    def calculate_consistency_fraud_score(self, 
                                         consistency_score: float,
                                         is_consistent: bool) -> Dict[str, Any]:
        """Calculate fraud risk based on claim-image consistency"""
        
        # Inverse relationship: low consistency = high fraud risk
        if consistency_score >= 7:
            fraud_score = 1
            risk_indicators = []
        elif consistency_score >= 4:
            fraud_score = 5
            risk_indicators = ["Moderate inconsistency between claim and image"]
        else:
            fraud_score = 9
            risk_indicators = ["Severe inconsistency between claim and image"]
        
        if not is_consistent:
            risk_indicators.append("Claim description does not match visual evidence")
        
        return {
            "consistency_fraud_score": fraud_score,
            "risk_indicators": risk_indicators
        }
    
    def calculate_overall_fraud_score(self,
                                     metadata_score: float,
                                     duplicate_check: Dict[str, Any],
                                     consistency_score: float) -> Dict[str, Any]:
        """Calculate final fraud risk score combining all factors"""
        
        # Weight different factors
        weights = {
            "metadata": 0.3,
            "duplicate": 0.4,
            "consistency": 0.3
        }
        
        # Calculate weighted score
        duplicate_score = 10 if duplicate_check["is_duplicate"] else 0
        
        overall_score = (
            weights["metadata"] * metadata_score +
            weights["duplicate"] * duplicate_score +
            weights["consistency"] * consistency_score
        )
        
        overall_score = round(overall_score, 2)
        
        # Compile all indicators
        all_indicators = []
        
        if duplicate_check["is_duplicate"]:
            all_indicators.append(
                f"Image reused from {duplicate_check['duplicate_count']} previous claim(s)"
            )
        
        return {
            "overall_fraud_score": overall_score,
            "risk_level": self._get_risk_level(overall_score),
            "breakdown": {
                "metadata_score": metadata_score,
                "duplicate_score": duplicate_score,
                "consistency_score": consistency_score
            },
            "all_fraud_indicators": all_indicators
        }
    
    def _get_risk_level(self, score: float) -> str:
        """Convert numeric score to risk level"""
        if score <= 3:
            return "LOW"
        elif score <= 7:
            return "MEDIUM"
        else:
            return "HIGH"

    # =========================================================================
    # STEP 6: VIDEO FRAUD & TEMPORAL DUPLICATE DETECTION
    # =========================================================================

    def compute_video_signature(
        self,
        video_path: Optional[str] = None,
        frames: Optional[List[Any]] = None,
        temporal_fractions: List[float] = [0.25, 0.50, 0.75]
    ) -> Dict[str, Any]:
        """
        Step 6: Compute composite video signature using temporal fingerprinting.
        Extracts keyframes at defined checkpoints (e.g. 25%, 50%, 75% of video length),
        calculates perceptual hashes (pHash, dHash) and mirrored variants, and averages
        their 64-bit vector embeddings into a composite video signature.
        """
        extracted_frames: List[Dict[str, Any]] = []

        # 1. Source frames directly from video file if provided
        if video_path and os.path.exists(video_path):
            cap = cv2.VideoCapture(video_path)
            try:
                total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
                fps = float(cap.get(cv2.CAP_PROP_FPS)) or 30.0
                if total_frames > 0:
                    for frac in temporal_fractions:
                        target_frame_idx = max(0, min(total_frames - 1, int(total_frames * frac)))
                        cap.set(cv2.CAP_PROP_POS_FRAMES, target_frame_idx)
                        ret, raw_frame = cap.read()
                        if ret and raw_frame is not None:
                            extracted_frames.append({
                                "frame": raw_frame,
                                "fraction": frac,
                                "timestamp_sec": round(target_frame_idx / fps, 2)
                            })
            finally:
                cap.release()

        # 2. Fallback to passed in-memory frames / candidate keyframes
        if not extracted_frames and frames:
            num_frames = len(frames)
            for frac in temporal_fractions:
                idx = max(0, min(num_frames - 1, int(num_frames * frac)))
                item = frames[idx]
                frame_arr = item["frame"] if isinstance(item, dict) and "frame" in item else item
                ts = item.get("timestamp_sec", round(frac * 10, 2)) if isinstance(item, dict) else round(frac * 10, 2)
                extracted_frames.append({
                    "frame": frame_arr,
                    "fraction": frac,
                    "timestamp_sec": ts
                })

        if not extracted_frames:
            zero_vec = [0.0] * 64
            return {
                "composite_vector": zero_vec,
                "mirrored_composite_vector": zero_vec,
                "composite_phash": "0" * 16,
                "composite_dhash": "0" * 16,
                "temporal_frames_count": 0,
                "frame_details": []
            }

        temporal_hashes = []
        for item in extracted_frames:
            raw_bgr = item["frame"]
            if isinstance(raw_bgr, np.ndarray):
                rgb_img = cv2.cvtColor(raw_bgr, cv2.COLOR_BGR2RGB)
                pil_img = Image.fromarray(rgb_img)
                # Compute mirrored frame (horizontal flip) to detect mirrored video reuse
                mirrored_bgr = cv2.flip(raw_bgr, 1)
                pil_mirrored = Image.fromarray(cv2.cvtColor(mirrored_bgr, cv2.COLOR_BGR2RGB))
            else:
                pil_img = raw_bgr
                pil_mirrored = pil_img.transpose(Image.FLIP_LEFT_RIGHT)

            ph = imagehash.phash(pil_img)
            dh = imagehash.dhash(pil_img)
            mph = imagehash.phash(pil_mirrored)
            mdh = imagehash.dhash(pil_mirrored)

            temporal_hashes.append({
                "fraction": item["fraction"],
                "timestamp_sec": item["timestamp_sec"],
                "phash": str(ph),
                "dhash": str(dh),
                "phash_vector": self._hash_to_vector(ph),
                "mirrored_phash": str(mph),
                "mirrored_dhash": str(mdh),
                "mirrored_phash_vector": self._hash_to_vector(mph)
            })

        # Average the 64-bit vector embeddings into composite vectors
        phash_vectors = np.array([f["phash_vector"] for f in temporal_hashes], dtype=float)
        mirrored_vectors = np.array([f["mirrored_phash_vector"] for f in temporal_hashes], dtype=float)

        composite_vector = np.mean(phash_vectors, axis=0).tolist()
        mirrored_composite_vector = np.mean(mirrored_vectors, axis=0).tolist()

        composite_phash = "_".join(f["phash"] for f in temporal_hashes)
        composite_dhash = "_".join(f["dhash"] for f in temporal_hashes)

        return {
            "composite_vector": composite_vector,
            "mirrored_composite_vector": mirrored_composite_vector,
            "composite_phash": composite_phash,
            "composite_dhash": composite_dhash,
            "temporal_frames_count": len(temporal_hashes),
            "frame_details": [
                {
                    "checkpoint": f"{int(f['fraction'] * 100)}%",
                    "timestamp_sec": f["timestamp_sec"],
                    "phash": f["phash"],
                    "dhash": f["dhash"]
                }
                for f in temporal_hashes
            ]
        }

    def _cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """Calculate cosine similarity between two vector embeddings"""
        if not vec1 or not vec2:
            return 0.0
        a = np.array(vec1, dtype=float)
        b = np.array(vec2, dtype=float)
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)
        if norm_a == 0.0 or norm_b == 0.0:
            return 0.0
        dot = float(np.dot(a, b))
        sim = dot / (norm_a * norm_b)
        return round(float(max(0.0, min(1.0, sim))), 4)

    def check_video_duplicate(
        self,
        video_path: Optional[str] = None,
        job_id: str = "",
        frames: Optional[List[Any]] = None,
        policy_id: Optional[str] = None,
        threshold: float = 0.88
    ) -> Dict[str, Any]:
        """
        Check if walk-around video is a duplicate, spliced, or mirrored submission.
        Queries Qdrant vector database (claim_videos collection) with file fallback.
        """
        signature = self.compute_video_signature(video_path=video_path, frames=frames)

        if self.use_qdrant:
            return self._check_video_duplicate_qdrant(signature, job_id, policy_id, threshold)
        else:
            return self._check_video_duplicate_file(signature, job_id, policy_id, threshold)

    def _search_qdrant_points(
        self,
        collection_name: str,
        vector: List[float],
        threshold: float,
        limit: int = 5
    ) -> List[Any]:
        """Search points across different qdrant-client versions"""
        if hasattr(self.client, "query_points"):
            response = self.client.query_points(
                collection_name=collection_name,
                query=vector,
                limit=limit,
                score_threshold=threshold,
            )
            return response.points
        elif hasattr(self.client, "search") or hasattr(self.client, "search_points"):
            search_method = getattr(self.client, "search", None) or getattr(self.client, "search_points", None)
            return search_method(
                collection_name=collection_name,
                query_vector=vector,
                limit=limit,
                score_threshold=threshold,
            )
        else:
            raise AttributeError("QdrantClient has no compatible search method")

    def _check_video_duplicate_qdrant(
        self,
        signature: Dict[str, Any],
        job_id: str,
        policy_id: Optional[str],
        threshold: float
    ) -> Dict[str, Any]:
        """Check video duplicates in Qdrant claim_videos collection"""
        try:
            from qdrant_client.models import PointStruct

            # 1. Search normal composite vector
            normal_matches = self._search_qdrant_points(
                collection_name=self.video_collection_name,
                vector=signature["composite_vector"],
                threshold=threshold
            )

            # 2. Search mirrored composite vector (to detect mirrored/flipped submissions)
            mirrored_matches = self._search_qdrant_points(
                collection_name=self.video_collection_name,
                vector=signature["mirrored_composite_vector"],
                threshold=threshold
            )

            is_mirrored = False
            active_matches = normal_matches
            if len(mirrored_matches) > 0:
                best_normal_score = max([m.score for m in normal_matches], default=0.0)
                best_mirror_score = max([m.score for m in mirrored_matches], default=0.0)
                if best_mirror_score > best_normal_score:
                    active_matches = mirrored_matches
                    is_mirrored = True

            is_duplicate = len(active_matches) > 0
            duplicate_details = []
            cross_policy_reuse = False
            max_sim = 0.0

            for result in active_matches:
                score = round(float(result.score), 4)
                if score > max_sim:
                    max_sim = score
                matched_job = result.payload.get("job_id") if result.payload else None
                matched_policy = result.payload.get("policy_id") if result.payload else None
                
                # Check cross-policy fraud
                if policy_id and matched_policy and matched_policy != policy_id and matched_policy != "unknown":
                    cross_policy_reuse = True

                duplicate_details.append({
                    "job_id": matched_job,
                    "policy_id": matched_policy,
                    "similarity_score": score,
                    "is_mirrored": is_mirrored,
                    "timestamp": result.payload.get("timestamp") if result.payload else None
                })

            # Upsert current video signature
            self.client.upsert(
                collection_name=self.video_collection_name,
                points=[
                    PointStruct(
                        id=abs(hash(f"video_{job_id}")) % (10 ** 8),
                        vector=signature["composite_vector"],
                        payload={
                            "job_id": job_id,
                            "policy_id": policy_id or "unknown",
                            "timestamp": datetime.now().isoformat(),
                            "composite_phash": signature["composite_phash"],
                            "composite_dhash": signature["composite_dhash"]
                        }
                    )
                ]
            )

            return {
                "is_duplicate": is_duplicate,
                "duplicate_count": len(duplicate_details),
                "similarity_score": max_sim,
                "is_mirrored": is_mirrored,
                "cross_policy_reuse": cross_policy_reuse,
                "duplicate_details": duplicate_details,
                "video_signature": {
                    "composite_phash": signature["composite_phash"],
                    "composite_dhash": signature["composite_dhash"],
                    "frame_details": signature["frame_details"]
                }
            }
        except Exception as e:
            print(f"Error in Qdrant video duplicate check: {e}")
            return self._check_video_duplicate_file(signature, job_id, policy_id, threshold)

    def _check_video_duplicate_file(
        self,
        signature: Dict[str, Any],
        job_id: str,
        policy_id: Optional[str],
        threshold: float
    ) -> Dict[str, Any]:
        """Check video duplicates using file storage fallback"""
        try:
            with open(self.video_storage_file, 'r') as f:
                stored_videos = json.load(f)
        except Exception:
            stored_videos = []

        is_duplicate = False
        duplicate_details = []
        is_mirrored = False
        cross_policy_reuse = False
        max_sim = 0.0

        current_vec = signature["composite_vector"]
        mirrored_vec = signature["mirrored_composite_vector"]

        for stored in stored_videos:
            stored_vec = stored.get("composite_vector", [])
            if not stored_vec:
                continue

            sim_normal = self._cosine_similarity(current_vec, stored_vec)
            sim_mirrored = self._cosine_similarity(mirrored_vec, stored_vec)

            matched_sim = max(sim_normal, sim_mirrored)
            if matched_sim >= threshold:
                is_duplicate = True
                if matched_sim > max_sim:
                    max_sim = matched_sim

                mirror_flag = sim_mirrored > sim_normal
                if mirror_flag:
                    is_mirrored = True

                stored_pol = stored.get("policy_id")
                if policy_id and stored_pol and stored_pol != policy_id and stored_pol != "unknown":
                    cross_policy_reuse = True

                duplicate_details.append({
                    "job_id": stored.get("job_id"),
                    "policy_id": stored_pol,
                    "similarity_score": round(matched_sim, 4),
                    "is_mirrored": mirror_flag,
                    "timestamp": stored.get("timestamp")
                })

        # Persist new signature
        stored_videos.append({
            "job_id": job_id,
            "policy_id": policy_id or "unknown",
            "timestamp": datetime.now().isoformat(),
            "composite_vector": signature["composite_vector"],
            "composite_phash": signature["composite_phash"],
            "composite_dhash": signature["composite_dhash"]
        })

        with open(self.video_storage_file, 'w') as f:
            json.dump(stored_videos, f, indent=2)

        return {
            "is_duplicate": is_duplicate,
            "duplicate_count": len(duplicate_details),
            "similarity_score": round(max_sim, 4),
            "is_mirrored": is_mirrored,
            "cross_policy_reuse": cross_policy_reuse,
            "duplicate_details": duplicate_details,
            "video_signature": {
                "composite_phash": signature["composite_phash"],
                "composite_dhash": signature["composite_dhash"],
                "frame_details": signature["frame_details"]
            }
        }

    def check_video_editing_software(
        self,
        metadata: Dict[str, Any],
        video_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Check for markers indicating third-party video editing tools
        (Adobe Premiere, CapCut, InShot, DaVinci Resolve, Final Cut Pro, Filmora, KineMaster, etc.).
        """
        editing_tools = [
            "adobe premiere", "premiere", "capcut", "inshot",
            "davinci", "resolve", "final cut", "filmora", "kinemaster",
            "after effects", "handbrake", "imovie", "quicktime",
            "vegas", "viva video", "splice", "lavf"
        ]

        detected_tools = []
        evidence = []

        # 1. Metadata attributes check
        fields = ["software", "codec", "encoder", "writing_application", "comment", "file_name"]
        for field in fields:
            val = metadata.get(field)
            if val and isinstance(val, str):
                val_lower = val.lower()
                for tool in editing_tools:
                    if tool in val_lower and tool not in detected_tools:
                        detected_tools.append(tool)
                        evidence.append(f"Metadata tag '{field}': '{val}'")

        # 2. Container binary header scan if video file is on disk
        if video_path and os.path.exists(video_path):
            try:
                file_size = os.path.getsize(video_path)
                read_len = min(32768, file_size)
                with open(video_path, "rb") as f:
                    head_chunk = f.read(read_len)
                    tail_chunk = b""
                    if file_size > read_len:
                        f.seek(max(0, file_size - read_len))
                        tail_chunk = f.read(read_len)
                sample_data = head_chunk + tail_chunk

                binary_signatures = {
                    b"Adobe": "Adobe Premiere",
                    b"Premiere": "Adobe Premiere",
                    b"CapCut": "CapCut",
                    b"InShot": "InShot",
                    b"DaVinci": "DaVinci Resolve",
                    b"Final Cut": "Apple Final Cut Pro",
                    b"Filmora": "Wondershare Filmora",
                    b"KineMaster": "KineMaster",
                    b"HandBrake": "HandBrake"
                }

                for sig_bytes, tool_name in binary_signatures.items():
                    if sig_bytes in sample_data:
                        norm = tool_name.lower()
                        if not any(t in norm for t in detected_tools):
                            detected_tools.append(norm)
                            evidence.append(f"Embedded binary container atom marker: '{tool_name}'")
            except Exception:
                pass

        return {
            "detected": len(detected_tools) > 0,
            "tools": detected_tools,
            "evidence": evidence
        }

    def calculate_video_metadata_fraud_score(
        self,
        metadata: Dict[str, Any],
        validation_result: Optional[Dict[str, Any]] = None,
        date_validation: Optional[Dict[str, Any]] = None,
        video_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Calculate video metadata fraud risk score based on container properties,
        video editing software detection, and claim date consistency.
        """
        fraud_score = 0.0
        fraud_indicators = []

        # 1. Base score from container validation
        if validation_result:
            base_risk = validation_result.get("risk_score", 0)
            fraud_score += base_risk
            if validation_result.get("errors"):
                fraud_score += 2.0
                fraud_indicators.extend(validation_result["errors"])

        # 2. Video editing tools detection (Adobe Premiere, CapCut, InShot, etc.)
        editing_check = self.check_video_editing_software(metadata, video_path)
        if editing_check["detected"]:
            fraud_score += 4.0
            tools_str = ", ".join(t.title() for t in editing_check["tools"])
            fraud_indicators.append(f"Video editing software detected: {tools_str}")

        # 3. Temporal discrepancy between claim date and video recording
        if date_validation:
            date_diff = date_validation.get("date_difference_days")
            if not date_validation.get("is_date_consistent", True) or (date_diff is not None and date_diff > 7):
                date_risk = date_validation.get("risk_score", 3)
                fraud_score += date_risk
                fraud_indicators.extend(date_validation.get("notes", []))

        # Check for missing creation timestamp
        if not metadata.get("created_at") and not metadata.get("modified_at"):
            fraud_score += 1.0
            fraud_indicators.append("Missing video container creation timestamp")

        # Normalize to 0-10 scale
        normalized_score = round(min(10.0, fraud_score), 2)

        return {
            "metadata_fraud_score": normalized_score,
            "fraud_indicators": fraud_indicators,
            "risk_level": self._get_risk_level(normalized_score),
            "editing_software": editing_check,
            "date_validation": date_validation
        }

    def calculate_overall_video_fraud_score(
        self,
        metadata_score: float,
        duplicate_check: Dict[str, Any],
        consistency_score: float
    ) -> Dict[str, Any]:
        """
        Calculate final video fraud risk score combining temporal duplicate detection,
        metadata tampering indicators, and textual-visual consistency.
        """
        weights = {
            "metadata": 0.25,
            "duplicate": 0.45,
            "consistency": 0.30
        }

        duplicate_score = 10.0 if duplicate_check.get("is_duplicate", False) else 0.0

        overall_score = (
            weights["metadata"] * metadata_score +
            weights["duplicate"] * duplicate_score +
            weights["consistency"] * consistency_score
        )
        overall_score = round(min(10.0, overall_score), 2)

        all_indicators = []

        if duplicate_check.get("is_duplicate"):
            sim_pct = round(duplicate_check.get("similarity_score", 1.0) * 100, 1)
            if duplicate_check.get("cross_policy_reuse"):
                all_indicators.append(
                    f"Video reused across different insurance policy numbers/accounts (similarity: {sim_pct}%)"
                )
            elif duplicate_check.get("is_mirrored"):
                all_indicators.append(
                    f"Mirrored/flipped video submission detected matching prior claim (similarity: {sim_pct}%)"
                )
            else:
                all_indicators.append(
                    f"Video duplicate detected from {duplicate_check.get('duplicate_count', 1)} prior claim(s) (similarity: {sim_pct}%)"
                )

        return {
            "overall_fraud_score": overall_score,
            "risk_level": self._get_risk_level(overall_score),
            "breakdown": {
                "metadata_score": metadata_score,
                "duplicate_score": duplicate_score,
                "consistency_score": consistency_score
            },
            "all_fraud_indicators": all_indicators
        }

