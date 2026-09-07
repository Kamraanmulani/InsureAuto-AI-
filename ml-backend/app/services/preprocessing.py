from app.utils.image_utils import ImageProcessor
from app.services.metadata_extractor import MetadataExtractor
import os
import uuid
from typing import Dict, Any
import shutil

class PreprocessingService:
    def __init__(self, upload_dir: str = "data/uploads"):
        self.upload_dir = upload_dir
        self.image_processor = ImageProcessor()
        self.metadata_extractor = MetadataExtractor()
        
        # Create directories
        os.makedirs(upload_dir, exist_ok=True)
        os.makedirs(f"{upload_dir}/processed", exist_ok=True)
    
    async def process_claim_image(self, 
                                  image_path: str, 
                                  claim_date: str,
                                  claim_description: str) -> Dict[str, Any]:
        """Complete preprocessing pipeline for a claim image"""
        
        # Generate unique ID for this processing job
        job_id = str(uuid.uuid4())
        
        # Step 1: Extract metadata
        metadata = self.metadata_extractor.extract_metadata(image_path)
        
        # Step 2: Validate metadata
        validation = self.metadata_extractor.validate_metadata(
            metadata, 
            claim_date
        )
        
        # Step 3: Load and process image
        image = self.image_processor.load_image(image_path)
        
        # Step 4: Resize image
        resized_image = self.image_processor.resize_image(image)
        
        # Step 5: Optional privacy protection
        # processed_image = self.image_processor.blur_faces_plates(resized_image)
        processed_image = resized_image  # Skip for prototype
        
        # Step 6: Save processed image
        processed_path = f"{self.upload_dir}/processed/{job_id}.jpg"
        self.image_processor.save_image(processed_image, processed_path)
        
        # Step 7: Create structured prompt for VLM
        prompt = self._create_vlm_prompt(claim_description, metadata)
        
        return {
            "job_id": job_id,
            "original_path": image_path,
            "processed_path": processed_path,
            "metadata": metadata,
            "validation": validation,
            "prompt": prompt,
            "image_dimensions": {
                "width": resized_image.shape[1],
                "height": resized_image.shape[0]
            }
        }
    
    def _create_vlm_prompt(self, claim_description: str, metadata: Dict) -> str:
        """Create structured prompt for Vision-Language Model"""
        prompt = f"""You are an expert insurance claim assessor analyzing damage from submitted photos.

CLAIM DESCRIPTION:
{claim_description}

IMAGE METADATA:
- Camera: {metadata.get('camera_make', 'Unknown')} {metadata.get('camera_model', 'Unknown')}
- Capture Date: {metadata.get('date_time_original', 'Unknown')}
- GPS: {metadata.get('gps_latitude', 'N/A')}, {metadata.get('gps_longitude', 'N/A')}

TASK:
Analyze the image and provide:
1. List all damaged parts you can identify
2. Describe the type and extent of damage for each part
3. Rate the overall damage severity as: Minor, Moderate, Severe, or Total Loss
4. Assess if the visible damage is consistent with the claim description
5. Note any inconsistencies or suspicious elements

Provide your analysis in a clear, structured format."""
        
        return prompt