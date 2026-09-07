import exifread
from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS
from datetime import datetime
from typing import Dict, Optional, Any
import os

class MetadataExtractor:
    def __init__(self):
        self.default_metadata = {
            "has_exif": False,
            "timestamp": None,
            "gps_latitude": None,
            "gps_longitude": None,
            "camera_make": None,
            "camera_model": None,
            "software": None,
            "date_time_original": None,
            "file_size_mb": 0,
            "image_width": 0,
            "image_height": 0
        }
    
    def extract_metadata(self, image_path: str) -> Dict[str, Any]:
        """Extract comprehensive EXIF metadata from image"""
        metadata = self.default_metadata.copy()
        
        try:
            # Get file size
            metadata["file_size_mb"] = os.path.getsize(image_path) / (1024 * 1024)
            
            # Open image with PIL for EXIF
            with Image.open(image_path) as img:
                metadata["image_width"] = img.width
                metadata["image_height"] = img.height
                
                # Extract EXIF data
                exif_data = img._getexif()
                
                if exif_data:
                    metadata["has_exif"] = True
                    
                    for tag_id, value in exif_data.items():
                        tag = TAGS.get(tag_id, tag_id)
                        
                        if tag == "Make":
                            metadata["camera_make"] = str(value)
                        elif tag == "Model":
                            metadata["camera_model"] = str(value)
                        elif tag == "Software":
                            metadata["software"] = str(value)
                        elif tag == "DateTime":
                            metadata["timestamp"] = str(value)
                        elif tag == "DateTimeOriginal":
                            metadata["date_time_original"] = str(value)
                        elif tag == "GPSInfo":
                            gps_data = self._parse_gps(value)
                            metadata.update(gps_data)
            
            # Additional extraction using exifread for more details
            with open(image_path, 'rb') as f:
                tags = exifread.process_file(f, details=False)
                
                # Check for editing software
                if 'Image Software' in tags:
                    metadata["software"] = str(tags['Image Software'])
            
            return metadata
            
        except Exception as e:
            print(f"Error extracting metadata: {e}")
            return metadata
    
    def _parse_gps(self, gps_info: Dict) -> Dict[str, Optional[float]]:
        """Parse GPS coordinates from EXIF"""
        gps_data = {
            "gps_latitude": None,
            "gps_longitude": None
        }
        
        try:
            lat = gps_info.get(2)  # GPSLatitude
            lat_ref = gps_info.get(1)  # GPSLatitudeRef
            lon = gps_info.get(4)  # GPSLongitude
            lon_ref = gps_info.get(3)  # GPSLongitudeRef
            
            if lat and lon:
                gps_data["gps_latitude"] = self._convert_to_degrees(lat, lat_ref)
                gps_data["gps_longitude"] = self._convert_to_degrees(lon, lon_ref)
        
        except Exception as e:
            print(f"Error parsing GPS: {e}")
        
        return gps_data
    
    def _convert_to_degrees(self, value, ref):
        """Convert GPS coordinates to degrees"""
        d = float(value[0])
        m = float(value[1])
        s = float(value[2])
        
        degrees = d + (m / 60.0) + (s / 3600.0)
        
        if ref in ['S', 'W']:
            degrees = -degrees
        
        return degrees
    
    def validate_metadata(self, metadata: Dict[str, Any], 
                         claim_date: str, 
                         claim_location: Optional[str] = None) -> Dict[str, Any]:
        """Validate metadata against claim information"""
        validation_result = {
            "is_valid": True,
            "issues": [],
            "risk_score": 0
        }
        
        # Check if EXIF exists
        if not metadata["has_exif"]:
            validation_result["issues"].append("No EXIF data found")
            validation_result["risk_score"] += 3
        
        # Check timestamp
        if metadata["date_time_original"]:
            try:
                exif_date = datetime.strptime(
                    metadata["date_time_original"], 
                    "%Y:%m:%d %H:%M:%S"
                )
                claim_date_obj = datetime.strptime(claim_date, "%Y-%m-%d")
                
                # Check if dates are close (within 7 days)
                date_diff = abs((exif_date - claim_date_obj).days)
                if date_diff > 7:
                    validation_result["issues"].append(
                        f"EXIF date ({exif_date.date()}) differs from claim date ({claim_date_obj.date()}) by {date_diff} days"
                    )
                    validation_result["risk_score"] += min(date_diff // 7, 5)
            
            except Exception as e:
                validation_result["issues"].append(f"Could not parse dates: {e}")
                validation_result["risk_score"] += 2
        
        # Check for editing software
        editing_software = ["Photoshop", "GIMP", "Lightroom", "Snapseed"]
        if metadata["software"]:
            for sw in editing_software:
                if sw.lower() in metadata["software"].lower():
                    validation_result["issues"].append(
                        f"Image edited with {sw}"
                    )
                    validation_result["risk_score"] += 3
        
        # Determine validity
        if validation_result["risk_score"] >= 5:
            validation_result["is_valid"] = False
        
        return validation_result