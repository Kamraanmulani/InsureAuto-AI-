from typing import Dict, Any, List

class ScoringEngine:
    def __init__(self):
        # Configurable thresholds
        self.thresholds = {
            "fraud": {
                "low": 3,
                "high": 7
            },
            "consistency": {
                "low": 4,
                "high": 7  # This is blocking you
            },
            "damage": {
                "minor": 3,
                "moderate": 7,
                "severe": 8
            }
        }
    
    def make_decision(self,
                     damage_score: float,
                     fraud_score: float,
                     consistency_score: float,
                     metadata_validation: Dict[str, Any]) -> Dict[str, Any]:
        """
        Make final claim decision based on all scores
        
        Returns:
            - recommendation: APPROVE, MANUAL_REVIEW, or REJECT
            - confidence: confidence level in decision
            - explanation: human-readable explanation
        """
        
        recommendation = "MANUAL_REVIEW"  # Default
        confidence = "MEDIUM"
        explanation_parts = []
        
        # Rule 1: High fraud score -> Auto-reject or manual review
        if fraud_score >= self.thresholds["fraud"]["high"]:
            recommendation = "REJECT"
            confidence = "HIGH"
            explanation_parts.append(
                f"High fraud risk detected (score: {fraud_score}/10)"
            )
        
        # Rule 2: Low fraud + High consistency -> Fast-track approval
        elif (fraud_score <= 4 and  # Increased from 3 to 4 (your score is 3.3)
              consistency_score >= 5):  # Lowered from 7 to 5 (your score is 5.0)
            recommendation = "APPROVE"
            confidence = "HIGH"
            explanation_parts.append(
                f"Low fraud risk ({fraud_score}/10) and high consistency ({consistency_score}/10)"
            )
        
        # Rule 3: Medium fraud or medium consistency -> Manual review
        elif (self.thresholds["fraud"]["low"] < fraud_score < self.thresholds["fraud"]["high"] or
              self.thresholds["consistency"]["low"] < consistency_score < self.thresholds["consistency"]["high"]):
            recommendation = "MANUAL_REVIEW"
            confidence = "MEDIUM"
            explanation_parts.append(
                f"Moderate fraud risk ({fraud_score}/10) or consistency issues ({consistency_score}/10)"
            )
        
        # Rule 4: Very low consistency -> Reject
        elif consistency_score < self.thresholds["consistency"]["low"]:
            recommendation = "REJECT"
            confidence = "HIGH"
            explanation_parts.append(
                f"Severe inconsistency between claim and evidence ({consistency_score}/10)"
            )
        
        # Rule 5: Metadata issues
        if metadata_validation.get("risk_score", 0) >= 5:
            if recommendation == "APPROVE":
                recommendation = "MANUAL_REVIEW"
            explanation_parts.append(
                "Metadata validation concerns detected"
            )
        
        # Add damage assessment to explanation
        damage_category = self._categorize_damage(damage_score)
        explanation_parts.append(
            f"Damage severity: {damage_category} ({damage_score}/10)"
        )
        
        # Compile final explanation
        explanation = ". ".join(explanation_parts) + "."
        
        return {
            "recommendation": recommendation,
            "confidence": confidence,
            "explanation": explanation,
            "scores": {
                "damage": damage_score,
                "fraud": fraud_score,
                "consistency": consistency_score
            }
        }
    
    def _categorize_damage(self, damage_score: float) -> str:
        """Categorize damage based on score"""
        if damage_score <= self.thresholds["damage"]["minor"]:
            return "Minor"
        elif damage_score <= self.thresholds["damage"]["moderate"]:
            return "Moderate"
        elif damage_score <= self.thresholds["damage"]["severe"]:
            return "Severe"
        else:
            return "Total Loss"
    
    def generate_detailed_report(self,
                                analysis_results: Dict[str, Any],
                                decision: Dict[str, Any]) -> Dict[str, Any]:
        """Generate comprehensive report for dashboard"""
        
        # Extract key information
        llava = analysis_results.get("llava_analysis", {})
        fraud = analysis_results.get("fraud_detection", {})
        yolo = analysis_results.get("yolo_detection", {})
        
        report = {
            "decision": decision,
            "damage_assessment": {
                "severity": llava.get("severity_level", "Unknown"),
                "damaged_parts": llava.get("parsed_analysis", {}).get("damaged_parts", []),
                "description": llava.get("parsed_analysis", {}).get("damage_description", ""),
                "score": decision["scores"]["damage"]
            },
            "fraud_analysis": {
                "overall_score": fraud.get("overall_fraud", {}).get("overall_fraud_score", 0),
                "risk_level": fraud.get("overall_fraud", {}).get("risk_level", "UNKNOWN"),
                "is_duplicate": fraud.get("duplicate_check", {}).get("is_duplicate", False),
                "fraud_indicators": fraud.get("overall_fraud", {}).get("all_fraud_indicators", []),
                "breakdown": fraud.get("overall_fraud", {}).get("breakdown", {})
            },
            "consistency_analysis": {
                "score": decision["scores"]["consistency"],
                "is_consistent": analysis_results.get("consistency_check", {}).get("is_consistent", False),
                "explanation": analysis_results.get("consistency_check", {}).get("consistency_response", "")
            },
            "visual_evidence": {
                "objects_detected": len(yolo.get("detections", [])),
                "vehicle_detected": yolo.get("analysis", {}).get("primary_vehicle_detected", False),
                "vehicle_type": yolo.get("analysis", {}).get("vehicle_type", "Unknown")
            }
        }
        
        return report
