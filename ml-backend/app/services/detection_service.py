from app.models.yolo_detector import YOLODamageDetector
from app.models.llava_analyzer import LLaVADamageAnalyzer
from app.models.fraud_detector import FraudDetector
from typing import Dict, Any
import os

class DetectionService:
    def __init__(self):
        self.yolo_detector = YOLODamageDetector()
        # Initialize with Ollama LLaVA 13B
        self.llava_analyzer = LLaVADamageAnalyzer(
            model_name="llava:7b",
            ollama_host="http://localhost:11434"
        )
        # Initialize fraud detector - will auto-detect Qdrant from environment
        # Set USE_QDRANT=true in environment to enable Qdrant
        self.fraud_detector = FraudDetector()
    
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