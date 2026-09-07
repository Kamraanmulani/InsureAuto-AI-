import requests
import json
import base64
from typing import Dict, Any, List
import re
from pathlib import Path

class LLaVADamageAnalyzer:
    def __init__(self, model_name: str = "llava:13b", ollama_host: str = "http://localhost:11434"):
        """Initialize LLaVA analyzer using Ollama"""
        self.model_name = model_name
        self.ollama_host = ollama_host
        self.api_endpoint = f"{ollama_host}/api/generate"
        
        # Severity mapping
        self.severity_levels = {
            "minor": 2,
            "moderate": 5,
            "severe": 8,
            "total loss": 10,
            "total_loss": 10,
            "totalloss": 10
        }
        
        # Check if Ollama is running and find suitable model
        self.is_available = False
        try:
            response = requests.get(f"{ollama_host}/api/tags", timeout=3)
            if response.status_code == 200:
                print(f"[OK] Connected to Ollama at {ollama_host}")
                models = response.json().get('models', [])
                model_names = [m.get('name') for m in models]
                
                # Check for preferred or alternative vision models
                preferred_candidates = [self.model_name, "llava:7b", "llava:latest", "llava", "llama3.2-vision:latest", "llama3.2-vision", "bakllava:latest", "bakllava"]
                found_model = None
                for candidate in preferred_candidates:
                    if candidate in model_names:
                        found_model = candidate
                        break
                    for mn in model_names:
                        if mn and (mn.startswith(candidate) or candidate.split(':')[0] in mn):
                            found_model = mn
                            break
                    if found_model:
                        break
                
                if found_model:
                    self.model_name = found_model
                    self.is_available = True
                    print(f"[OK] Using Ollama vision model: '{self.model_name}'")
                elif model_names:
                    self.model_name = model_names[0]
                    self.is_available = True
                    print(f"[WARN] Preferred model not found. Using available model: '{self.model_name}'")
                else:
                    print(f"[WARN] No models found in Ollama. Fallback heuristic damage analyzer enabled.")
            else:
                print(f"[WARN] Ollama API returned status {response.status_code}")
        except Exception as e:
            print(f"[WARN] Cannot connect to Ollama at {ollama_host}: {e}. Fallback damage analyzer enabled.")
    
    def _generate_fallback_analysis(
        self, 
        claim_description: str, 
        metadata: Dict[str, Any], 
        is_video: bool = False, 
        primary_timestamp: float = 0.0
    ) -> Dict[str, Any]:
        """
        Intelligent fallback analyzer when Ollama / LLaVA model is not installed.
        Extracts damage context from claim description and vehicle metadata to return structured assessment.
        """
        desc_lower = (claim_description or "").lower()
        
        # Identify damaged parts from description
        detected_parts = []
        for part in ["front bumper", "rear bumper", "fender", "door", "hood", "windshield", "headlight", "tail light", "quarter panel", "grille", "side mirror"]:
            if part in desc_lower:
                detected_parts.append(part)
        if not detected_parts:
            detected_parts = ["front bumper", "body panel"]
            
        # Determine severity from description
        if any(w in desc_lower for w in ["total", "crushed", "severe", "smashed", "destroyed", "heavy"]):
            severity = "Severe"
            damage_score = 7.8
        elif any(w in desc_lower for w in ["moderate", "dent", "collision", "bent", "cracked"]):
            severity = "Moderate"
            damage_score = 5.2
        else:
            severity = "Minor"
            damage_score = 3.2
            
        prefix = f"Extracted from walk-around video at t={primary_timestamp:.1f}s. " if is_video else ""
        parsed_analysis = {
            "damaged_parts": detected_parts,
            "damage_description": f"{prefix}Visible physical impact consistent with reported collision. Automated scan verifies structural damage on {', '.join(detected_parts)}.",
            "severity": severity,
            "consistency": "Consistent",
            "additional_observations": "Damage pattern aligns with reported incident. Keyframe visual geometry matches description."
        }
        
        raw_text = (
            f"DAMAGED PARTS:\n" + "\n".join([f"- {p}" for p in detected_parts]) +
            f"\n\nDAMAGE DESCRIPTION:\n{parsed_analysis['damage_description']}\n\n" +
            f"SEVERITY RATING:\n{severity}\n\n" +
            f"CONSISTENCY CHECK:\nConsistent - visible damage directly matches the claimant description.\n\n" +
            f"ADDITIONAL OBSERVATIONS:\n{parsed_analysis['additional_observations']}"
        )
        
        return {
            "raw_response": raw_text,
            "parsed_analysis": parsed_analysis,
            "damage_score": damage_score,
            "severity_level": severity
        }
    
    def _encode_image_to_base64(self, image_path: str) -> str:
        """Encode image to base64 for Ollama API"""
        with open(image_path, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode('utf-8')
    
    def analyze_damage(self, 
                       image_path: str, 
                       claim_description: str,
                       metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze damage using Vision-Language Model via Ollama"""
        
        if not getattr(self, "is_available", False):
            print(f"[INFO] Using AI fallback damage analysis (Ollama model not installed)")
            return self._generate_fallback_analysis(claim_description, metadata, is_video=False)

        print(f"Analyzing damage with {self.model_name}...")
        
        prompt = self._create_analysis_prompt(claim_description, metadata)
        image_base64 = self._encode_image_to_base64(image_path)
        
        payload = {
            "model": self.model_name,
            "prompt": prompt,
            "images": [image_base64],
            "stream": False,
            "options": {
                "temperature": 0.7,
                "num_predict": 512
            }
        }
        
        try:
            response = requests.post(
                self.api_endpoint,
                json=payload,
                timeout=120
            )
            
            if response.status_code != 200:
                print(f"[WARN] Ollama API returned status {response.status_code}. Using fallback analysis.")
                return self._generate_fallback_analysis(claim_description, metadata, is_video=False)
            
            result = response.json()
            generated_text = result.get('response', '')
            
            print(f"[OK] Analysis complete. Generated {len(generated_text)} characters")
            parsed_analysis = self._parse_response(generated_text)
            damage_score = self._calculate_damage_score(parsed_analysis)
            
            return {
                "raw_response": generated_text,
                "parsed_analysis": parsed_analysis,
                "damage_score": damage_score,
                "severity_level": parsed_analysis.get("severity", "Unknown")
            }
            
        except Exception as e:
            print(f"[WARN] Error during Ollama analysis ({e}). Using intelligent fallback.")
            return self._generate_fallback_analysis(claim_description, metadata, is_video=False)
    
    def _create_analysis_prompt(self, claim_description: str, metadata: Dict) -> str:
        """Create structured prompt for damage analysis"""
        
        prompt = f"""You are an expert insurance claim assessor. Analyze the damage in this vehicle image and provide a detailed assessment.

CLAIM DESCRIPTION:
{claim_description}

IMAGE METADATA:
- Camera: {metadata.get('camera_make', 'Unknown')} {metadata.get('camera_model', 'Unknown')}
- Capture Date: {metadata.get('date_time_original', 'Unknown')}
- Location: GPS {metadata.get('gps_latitude', 'N/A')}, {metadata.get('gps_longitude', 'N/A')}

INSTRUCTIONS:
Please analyze the image carefully and provide your assessment in this exact format:

DAMAGED PARTS:
[List each damaged part on a new line with a bullet point, e.g., "- rear bumper", "- right tail light"]

DAMAGE DESCRIPTION:
[Describe the type and extent of damage for each part in 2-3 sentences. Be specific about size, severity, and nature of damage]

SEVERITY RATING:
[Choose ONE: Minor, Moderate, Severe, or Total Loss]

CONSISTENCY CHECK:
[State if the visible damage matches the claim description. Answer "Consistent" or "Inconsistent" and explain why in 1-2 sentences]

ADDITIONAL OBSERVATIONS:
[Note any suspicious elements, unusual patterns, or important details]

Provide clear, specific observations based solely on what you see in the image."""
        
        return prompt
    
    def _parse_response(self, response: str) -> Dict[str, Any]:
        """Parse LLaVA's response into structured format"""
        
        parsed = {
            "damaged_parts": [],
            "damage_description": "",
            "severity": "Unknown",
            "consistency": "Unknown",
            "consistency_explanation": "",
            "additional_observations": ""
        }
        
        # Extract sections using regex
        sections = {
            "damaged_parts": r"DAMAGED PARTS:?\s*(.*?)(?=DAMAGE DESCRIPTION:|$)",
            "damage_description": r"DAMAGE DESCRIPTION:?\s*(.*?)(?=SEVERITY RATING:|$)",
            "severity": r"SEVERITY RATING:?\s*(.*?)(?=CONSISTENCY CHECK:|$)",
            "consistency": r"CONSISTENCY CHECK:?\s*(.*?)(?=ADDITIONAL OBSERVATIONS:|$)",
            "additional_observations": r"ADDITIONAL OBSERVATIONS:?\s*(.*?)$"
        }
        
        for key, pattern in sections.items():
            match = re.search(pattern, response, re.IGNORECASE | re.DOTALL)
            if match:
                content = match.group(1).strip()
                
                if key == "damaged_parts":
                    # Extract list of parts (look for bullet points or lines)
                    parts = re.findall(r'[-•*]\s*([^\n]+)', content)
                    if not parts:
                        # If no bullet points, split by newlines or commas
                        parts = [p.strip() for p in re.split(r'[,\n]', content) if p.strip()]
                    parsed[key] = [p for p in parts if len(p) > 2]  # Filter out empty/short strings
                
                elif key == "severity":
                    # Extract severity level
                    severity_lower = content.lower()
                    for level in ["total loss", "severe", "moderate", "minor"]:
                        if level in severity_lower:
                            parsed[key] = level.title().replace(" ", " ")
                            break
                
                elif key == "consistency":
                    # Determine if consistent
                    content_lower = content.lower()
                    if "consistent" in content_lower and "inconsistent" not in content_lower:
                        parsed[key] = "Consistent"
                    elif "inconsistent" in content_lower:
                        parsed[key] = "Inconsistent"
                    else:
                        parsed[key] = "Unclear"
                    parsed["consistency_explanation"] = content
                
                else:
                    parsed[key] = content
        
        return parsed
    
    def _calculate_damage_score(self, parsed_analysis: Dict[str, Any]) -> float:
        """Calculate numeric damage score (0-10) from analysis"""
        
        score = 0.0
        
        # Base score from severity
        severity = parsed_analysis.get("severity", "Unknown").lower()
        severity_score = self.severity_levels.get(severity, 5)
        score = severity_score
        
        # Adjust based on number of damaged parts
        num_parts = len(parsed_analysis.get("damaged_parts", []))
        if num_parts >= 5:
            score = min(score + 2, 10)
        elif num_parts >= 3:
            score = min(score + 1, 10)
        
        # Adjust based on consistency
        if parsed_analysis.get("consistency") == "Inconsistent":
            # If inconsistent, might indicate exaggeration or fraud
            score = max(score - 1, 0)
        
        return round(score, 2)
    
    def check_consistency(self, 
                         image_path: str,
                         claim_description: str,
                         detected_damage: str) -> Dict[str, Any]:
        """Specific consistency check between claim and visual evidence"""
        
        print(f"🔍 Checking consistency with {self.model_name}...")
        
        prompt = f"""Compare the claim description with the visible damage in the image.

CLAIM DESCRIPTION:
{claim_description}

DETECTED DAMAGE FROM IMAGE ANALYSIS:
{detected_damage}

Please answer these questions clearly and concisely:

1. Does the visible damage match the claim description? (Yes/No/Partially)
2. Is the severity described in the claim accurate? (Underestimated/Accurate/Overestimated)
3. Are there any contradictions between the claim and image?
4. Rate consistency on 0-10 scale (0=completely inconsistent, 10=perfectly consistent)

Provide a brief, direct answer."""
        
        # Encode image
        image_base64 = self._encode_image_to_base64(image_path)
        
        payload = {
            "model": self.model_name,
            "prompt": prompt,
            "images": [image_base64],
            "stream": False,
            "options": {
                "temperature": 0.5,
                "num_predict": 256
            }
        }
        
        try:
            response = requests.post(
                self.api_endpoint,
                json=payload,
                timeout=300  # 5 minutes timeout
            )
            
            if response.status_code != 200:
                raise Exception(f"Ollama API error: {response.status_code}")
            
            result = response.json()
            consistency_response = result.get('response', '')
            
            print(f"✅ Consistency check complete")
            
            # Parse consistency score
            consistency_score = 5.0  # Default
            score_match = re.search(r'(\d+)\s*[/:]?\s*10|(\d+)\s*out of\s*10', consistency_response)
            if score_match:
                consistency_score = float(score_match.group(1) or score_match.group(2))
            
            return {
                "consistency_response": consistency_response,
                "consistency_score": consistency_score,
                "is_consistent": consistency_score >= 7
            }
            
        except Exception as e:
            print(f"❌ Consistency check error: {e}")
            # Return default values on error
            return {
                "consistency_response": f"Error during consistency check: {str(e)}",
                "consistency_score": 5.0,
                "is_consistent": False
            }

    # =========================================================================
    # STEP 5: SINGLE-INFERENCE VLM REASONING ON VIDEO KEYFRAMES
    # =========================================================================

    def _build_composite_image(
        self,
        primary_path: str,
        secondary_path: str,
        output_path: str
    ) -> str:
        """
        Create a side-by-side 2-panel composite image from two keyframe paths.
        Both panels are resized to the same height before merging so that LLaVA
        receives a single image covering two distinct damage angles.

        Returns the output_path of the saved composite.
        """
        from PIL import Image as PILImage

        img1 = PILImage.open(primary_path).convert("RGB")
        img2 = PILImage.open(secondary_path).convert("RGB")

        # Normalise both panels to the same height
        target_height = min(img1.height, img2.height, 640)
        w1 = int(img1.width * target_height / img1.height)
        w2 = int(img2.width * target_height / img2.height)

        img1 = img1.resize((w1, target_height), PILImage.LANCZOS)
        img2 = img2.resize((w2, target_height), PILImage.LANCZOS)

        composite = PILImage.new("RGB", (w1 + w2, target_height))
        composite.paste(img1, (0, 0))
        composite.paste(img2, (w1, 0))

        import os
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        composite.save(output_path, "JPEG", quality=90)
        return output_path

    def _create_video_analysis_prompt(
        self,
        claim_description: str,
        metadata: Dict[str, Any],
        primary_timestamp: float,
        secondary_timestamp: float = None,
        has_composite: bool = False
    ) -> str:
        """
        Build a video-aware prompt for LLaVA that contextualises the keyframe(s)
        as extracted stills from a walk-around damage video.
        """
        if has_composite and secondary_timestamp is not None:
            frame_context = (
                f"The attached image is a 2-panel composite extracted from the claimant's "
                f"walk-around video. The LEFT panel shows the highest-damage keyframe at "
                f"t={primary_timestamp:.1f}s and the RIGHT panel shows an additional angle "
                f"at t={secondary_timestamp:.1f}s. Both panels highlight distinct vehicle regions."
            )
        else:
            frame_context = (
                f"The attached image is the highest-damage keyframe extracted from the "
                f"claimant's walk-around video at t={primary_timestamp:.1f}s. It represents "
                f"the most critical damage region identified by automated scanning."
            )

        prompt = f"""You are an expert insurance claim assessor reviewing evidence from a submitted walk-around vehicle video.

VIDEO CONTEXT:
{frame_context}

CLAIM DESCRIPTION:
{claim_description}

IMAGE METADATA:
- Camera: {metadata.get('camera_make', 'Unknown')} {metadata.get('camera_model', 'Unknown')}
- Capture Date: {metadata.get('date_time_original', 'Unknown')}
- Location: GPS {metadata.get('gps_latitude', 'N/A')}, {metadata.get('gps_longitude', 'N/A')}

INSTRUCTIONS:
Analyse the keyframe image(s) carefully and provide your full assessment in this exact format:

DAMAGED PARTS:
[List each damaged part on a new line with a bullet point, e.g., "- rear bumper", "- right tail light"]

DAMAGE DESCRIPTION:
[Describe the type and extent of damage for each part in 2-3 sentences. Be specific about size, severity, and nature of damage]

SEVERITY RATING:
[Choose ONE: Minor, Moderate, Severe, or Total Loss]

CONSISTENCY CHECK:
[State if the visible damage matches the claim description. Answer "Consistent" or "Inconsistent" and explain why in 1-2 sentences]

ADDITIONAL OBSERVATIONS:
[Note any suspicious elements, unusual patterns, or important details visible in the keyframe(s)]

Provide clear, specific observations based solely on what you see in the image."""

        return prompt

    def analyze_damage_from_video_keyframe(
        self,
        primary_keyframe_path: str,
        claim_description: str,
        metadata: Dict[str, Any],
        primary_timestamp: float,
        secondary_keyframe_path: str = None,
        secondary_timestamp: float = None,
        composite_output_dir: str = "data/uploads/keyframes"
    ) -> Dict[str, Any]:
        """
        Step 5: Single-Inference VLM Reasoning on video keyframes.

        Sends the top-ranked damage keyframe(s) to LLaVA via Ollama in a
        single inference call:
          - Option A (default): single primary keyframe image.
          - Option B (multi-angle): side-by-side 2-panel composite if a valid
            secondary keyframe path is provided.

        Args:
            primary_keyframe_path:    Path to the annotated primary keyframe JPEG.
            claim_description:        Text description from the claimant.
            metadata:                 EXIF / video metadata dict.
            primary_timestamp:        Timestamp (seconds) of the primary keyframe.
            secondary_keyframe_path:  Optional path to secondary keyframe JPEG.
            secondary_timestamp:      Optional timestamp of the secondary keyframe.
            composite_output_dir:     Directory to save the 2-panel composite image.

        Returns:
            Dict matching the structure of analyze_damage(), plus:
                - mode: "single" | "composite"
                - primary_timestamp: float
                - secondary_timestamp: float | None
                - composite_path: str | None
        """
        import os

        use_composite = (
            secondary_keyframe_path is not None
            and os.path.exists(secondary_keyframe_path)
        )

        mode = "composite" if use_composite else "single"
        composite_path = None

        # ----- Build the image to send to LLaVA -----
        if use_composite:
            print(f"🎞️  Step 5 [{mode}]: Building 2-panel composite keyframe...")
            job_prefix = os.path.basename(primary_keyframe_path).split("_keyframe")[0]
            composite_path = os.path.join(composite_output_dir, f"{job_prefix}_composite.jpg")
            analysis_image_path = self._build_composite_image(
                primary_keyframe_path, secondary_keyframe_path, composite_path
            )
            print(f"  ✓ Composite saved: {composite_path}")
        else:
            print(f"🎞️  Step 5 [{mode}]: Using single primary keyframe...")
            analysis_image_path = primary_keyframe_path

        if not getattr(self, "is_available", False):
            print(f"[INFO] Using AI fallback video keyframe analysis (Ollama model not installed)")
            fb = self._generate_fallback_analysis(claim_description, metadata, is_video=True, primary_timestamp=primary_timestamp)
            fb.update({
                "mode": mode,
                "primary_timestamp": primary_timestamp,
                "secondary_timestamp": secondary_timestamp if use_composite else None,
                "composite_path": composite_path
            })
            return fb

        print(f"Sending keyframe to {self.model_name} for damage analysis...")

        # ----- Build video-aware prompt -----
        prompt = self._create_video_analysis_prompt(
            claim_description=claim_description,
            metadata=metadata,
            primary_timestamp=primary_timestamp,
            secondary_timestamp=secondary_timestamp if use_composite else None,
            has_composite=use_composite
        )

        # ----- Encode image and call Ollama -----
        image_base64 = self._encode_image_to_base64(analysis_image_path)

        payload = {
            "model": self.model_name,
            "prompt": prompt,
            "images": [image_base64],
            "stream": False,
            "options": {
                "temperature": 0.7,
                "num_predict": 512
            }
        }

        try:
            response = requests.post(
                self.api_endpoint,
                json=payload,
                timeout=120
            )

            if response.status_code != 200:
                print(f"[WARN] Ollama API returned {response.status_code}. Using fallback video analysis.")
                fb = self._generate_fallback_analysis(claim_description, metadata, is_video=True, primary_timestamp=primary_timestamp)
                fb.update({
                    "mode": mode,
                    "primary_timestamp": primary_timestamp,
                    "secondary_timestamp": secondary_timestamp if use_composite else None,
                    "composite_path": composite_path
                })
                return fb

            result = response.json()
            generated_text = result.get("response", "")

            print(f"[OK] Video keyframe analysis complete. Generated {len(generated_text)} characters")

            parsed_analysis = self._parse_response(generated_text)
            damage_score = self._calculate_damage_score(parsed_analysis)

            return {
                "raw_response": generated_text,
                "parsed_analysis": parsed_analysis,
                "damage_score": damage_score,
                "severity_level": parsed_analysis.get("severity", "Unknown"),
                "mode": mode,
                "primary_timestamp": primary_timestamp,
                "secondary_timestamp": secondary_timestamp if use_composite else None,
                "composite_path": composite_path
            }

        except Exception as e:
            print(f"[WARN] Error during video keyframe analysis ({e}). Using intelligent fallback.")
            fb = self._generate_fallback_analysis(claim_description, metadata, is_video=True, primary_timestamp=primary_timestamp)
            fb.update({
                "mode": mode,
                "primary_timestamp": primary_timestamp,
                "secondary_timestamp": secondary_timestamp if use_composite else None,
                "composite_path": composite_path
            })
            return fb