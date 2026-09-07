import cv2
import numpy as np
from PIL import Image
import os
from typing import Tuple

class ImageProcessor:
    def __init__(self, max_size: int = 1024):
        self.max_size = max_size
    
    def load_image(self, image_path: str) -> np.ndarray:
        """Load image using OpenCV"""
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError(f"Failed to load image: {image_path}")
        return cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    
    def resize_image(self, image: np.ndarray) -> np.ndarray:
        """Resize image maintaining aspect ratio"""
        h, w = image.shape[:2]
        
        if max(h, w) <= self.max_size:
            return image
        
        if h > w:
            new_h = self.max_size
            new_w = int(w * (self.max_size / h))
        else:
            new_w = self.max_size
            new_h = int(h * (self.max_size / w))
        
        resized = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_AREA)
        return resized
    
    def normalize_image(self, image: np.ndarray) -> np.ndarray:
        """Normalize image for consistent processing"""
        # Convert to float32 and normalize to [0, 1]
        normalized = image.astype(np.float32) / 255.0
        return normalized
    
    def blur_faces_plates(self, image: np.ndarray) -> np.ndarray:
        """Optional: Blur faces and license plates for privacy"""
        # Load Haar Cascade for face detection
        face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        )
        
        gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
        faces = face_cascade.detectMultiScale(gray, 1.1, 4)
        
        # Blur detected faces
        for (x, y, w, h) in faces:
            face_region = image[y:y+h, x:x+w]
            blurred_face = cv2.GaussianBlur(face_region, (99, 99), 30)
            image[y:y+h, x:x+w] = blurred_face
        
        return image
    
    def save_image(self, image: np.ndarray, output_path: str) -> None:
        """Save processed image"""
        image_bgr = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)
        cv2.imwrite(output_path, image_bgr)