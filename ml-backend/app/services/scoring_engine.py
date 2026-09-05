from typing import Dict, Any, List, Optional

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
                "high": 7
            },
            "damage": {
                "minor": 3,
                "moderate": 7,
                "severe": 8
            },
            "duplicate_similarity": {
                "threshold": 0.88
            }
        }
    
    def make_decision(self,
                     damage_score: float,
                     fraud_score: float,
                     consistency_score: float,
                     metadata_validation: Dict[str, Any],
                     **kwargs) -> Dict[str, Any]:
        """
        Make claim decision based on damage, fraud, consistency, and metadata.
        Backward-compatible with original 4-argument image pipeline, while
        supporting video kwargs when passed.
        
        Returns:
            - recommendation: APPROVE, MANUAL_REVIEW, or REJECT
            - confidence: confidence level in decision (HIGH, MEDIUM, LOW)
            - explanation: human-readable explanation
            - scores: dict of damage, fraud, consistency scores
        """
        # If full video analysis dicts are passed via kwargs, delegate to make_video_decision
        if "yolo_summary" in kwargs or "llava_analysis" in kwargs:
            return self.make_video_decision(
                yolo_summary=kwargs.get("yolo_summary", {}),
                llava_analysis=kwargs.get("llava_analysis", {}),
                fraud_analysis=kwargs.get("fraud_analysis", {}),
                metadata_validation=metadata_validation,
                date_validation=kwargs.get("date_validation"),
                consistency_check=kwargs.get("consistency_check")
            )

        recommendation = "MANUAL_REVIEW"  # Default
        confidence = "MEDIUM"
        explanation_parts = []
        
        # Rule 1: High fraud score -> Auto-reject
        if fraud_score >= self.thresholds["fraud"]["high"]:
            recommendation = "REJECT"
            confidence = "HIGH"
            explanation_parts.append(
                f"High fraud risk detected (score: {fraud_score}/10)"
            )
        
        # Rule 2: Low fraud + High consistency -> Fast-track approval
        elif (fraud_score <= self.thresholds["fraud"]["low"] and 
              consistency_score >= self.thresholds["consistency"]["high"]):
            recommendation = "APPROVE"
            confidence = "HIGH"
            explanation_parts.append(
                f"Low fraud risk ({fraud_score}/10) and high consistency ({consistency_score}/10)"
            )
        
        # Rule 3: Very low consistency -> Reject
        elif consistency_score < self.thresholds["consistency"]["low"]:
            recommendation = "REJECT"
            confidence = "HIGH"
            explanation_parts.append(
                f"Severe inconsistency between claim and evidence ({consistency_score}/10)"
            )

        # Rule 4: Medium fraud or medium consistency -> Manual review
        elif (self.thresholds["fraud"]["low"] < fraud_score < self.thresholds["fraud"]["high"] or
              self.thresholds["consistency"]["low"] < consistency_score < self.thresholds["consistency"]["high"]):
            recommendation = "MANUAL_REVIEW"
            confidence = "MEDIUM"
            explanation_parts.append(
                f"Moderate fraud risk ({fraud_score}/10) or consistency issues ({consistency_score}/10)"
            )
        
        # Rule 5: Metadata issues
        if metadata_validation and metadata_validation.get("risk_score", 0) >= 5:
            if recommendation == "APPROVE":
                recommendation = "MANUAL_REVIEW"
                confidence = "MEDIUM"
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

    # =========================================================================
    # STEP 7: UNIFIED DECISION ENGINE FOR VIDEO CLAIMS
    # =========================================================================

    def make_video_decision(
        self,
        yolo_summary: Dict[str, Any],
        llava_analysis: Dict[str, Any],
        fraud_analysis: Dict[str, Any],
        metadata_validation: Optional[Dict[str, Any]] = None,
        date_validation: Optional[Dict[str, Any]] = None,
        consistency_check: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Step 7: Unified Decision Engine for Walk-Around Video Claims.
        Aggregates:
          1. YOLO aggregate damage area and confidence across keyframes.
          2. LLaVA severity and textual-visual consistency analysis.
          3. Metadata risk (video editing software, creation timestamp discrepancy).
          4. Video duplicate similarity score (mirrored & cross-policy flags).
        
        Generates final decision: APPROVE, MANUAL_REVIEW, or REJECT.
        """
        # --- 1. Extract Pillar Data ---
        # Pillar 1: YOLO Aggregate
        yolo_det_count = yolo_summary.get("total_detections", 0)
        yolo_area_ratio = float(yolo_summary.get("aggregate_damage_area_ratio", 0.0))
        yolo_mean_conf = float(yolo_summary.get("mean_confidence", 0.0))
        vehicle_detected = yolo_summary.get("primary_vehicle_detected", True)

        # Pillar 2: LLaVA Severity & Consistency
        damage_score = float(llava_analysis.get("damage_score", 0.0))
        severity_level = llava_analysis.get("severity_level", "Unknown")
        damage_category = self._categorize_damage(damage_score)
        
        if consistency_check:
            consistency_score = float(consistency_check.get("consistency_score", 5.0))
            is_consistent = consistency_check.get("is_consistent", True)
        else:
            consistency_score = float(llava_analysis.get("consistency_score", 5.0))
            is_consistent = llava_analysis.get("is_consistent", True)

        # Pillar 3: Metadata Risk (Editing Software & Timestamp Discrepancy)
        meta_fraud = fraud_analysis.get("metadata_fraud", {})
        meta_fraud_score = float(meta_fraud.get("metadata_fraud_score", 0.0))
        editing_info = meta_fraud.get("editing_software", {})
        editing_detected = editing_info.get("detected", False)
        editing_tools = editing_info.get("tools", [])

        date_val = date_validation or meta_fraud.get("date_validation") or {}
        date_diff_days = date_val.get("date_difference_days")
        is_date_consistent = date_val.get("is_date_consistent", True)

        # Pillar 4: Video Duplicate Similarity Score
        dup_check = fraud_analysis.get("duplicate_check", {})
        is_duplicate = dup_check.get("is_duplicate", False)
        duplicate_similarity = float(dup_check.get("similarity_score", 0.0))
        cross_policy_reuse = dup_check.get("cross_policy_reuse", False)
        is_mirrored = dup_check.get("is_mirrored", False)

        overall_fraud = fraud_analysis.get("overall_fraud", {})
        overall_fraud_score = float(overall_fraud.get("overall_fraud_score", 0.0))

        # --- 2. Evaluate Decision Rules ---
        decision_reasons: List[str] = []
        recommendation = "MANUAL_REVIEW"
        confidence = "MEDIUM"

        # --- Critical Rejection Checks ---
        if is_duplicate or duplicate_similarity >= self.thresholds["duplicate_similarity"]["threshold"]:
            recommendation = "REJECT"
            confidence = "HIGH"
            sim_pct = round(duplicate_similarity * 100, 1)
            if cross_policy_reuse:
                decision_reasons.append(
                    f"Video duplicate detected across different policy numbers/accounts ({sim_pct}% similarity)"
                )
            elif is_mirrored:
                decision_reasons.append(
                    f"Mirrored/flipped video duplicate detected from previous claim submission ({sim_pct}% similarity)"
                )
            else:
                decision_reasons.append(
                    f"Duplicate walk-around video detected in database ({sim_pct}% similarity)"
                )

        elif overall_fraud_score >= self.thresholds["fraud"]["high"]:
            recommendation = "REJECT"
            confidence = "HIGH"
            decision_reasons.append(
                f"High composite fraud risk ({overall_fraud_score}/10)"
            )

        elif editing_detected:
            recommendation = "REJECT"
            confidence = "HIGH"
            tools_str = ", ".join(t.title() for t in editing_tools)
            decision_reasons.append(
                f"Video footage was edited or re-encoded with editing software ({tools_str})"
            )

        elif consistency_score < self.thresholds["consistency"]["low"]:
            recommendation = "REJECT"
            confidence = "HIGH"
            decision_reasons.append(
                f"Severe inconsistency between claimant description and video visual evidence ({consistency_score}/10)"
            )

        # --- Fast-Track Approval Checks ---
        elif (
            overall_fraud_score <= self.thresholds["fraud"]["low"]
            and consistency_score >= self.thresholds["consistency"]["high"]
            and is_consistent
            and not editing_detected
            and (is_date_consistent or (date_diff_days is not None and date_diff_days <= 7))
            and vehicle_detected
        ):
            # If damage is minor or moderate, approve cleanly
            if damage_score <= self.thresholds["damage"]["moderate"]:
                recommendation = "APPROVE"
                confidence = "HIGH"
                decision_reasons.append(
                    f"Clean video verification: Low fraud risk ({overall_fraud_score}/10) and high textual-visual consistency ({consistency_score}/10)"
                )
            else:
                # Severe damage or total loss still warrants adjuster valuation
                recommendation = "MANUAL_REVIEW"
                confidence = "HIGH"
                decision_reasons.append(
                    f"Severe damage ({damage_score}/10) requires professional adjuster valuation prior to settlement"
                )

        # --- Manual Review Fallback & Special Flags ---
        else:
            recommendation = "MANUAL_REVIEW"
            confidence = "MEDIUM"

            if self.thresholds["fraud"]["low"] < overall_fraud_score < self.thresholds["fraud"]["high"]:
                decision_reasons.append(f"Moderate fraud indicators present ({overall_fraud_score}/10)")

            if self.thresholds["consistency"]["low"] <= consistency_score < self.thresholds["consistency"]["high"]:
                decision_reasons.append(f"Moderate consistency concerns ({consistency_score}/10)")

            if date_diff_days is not None and date_diff_days > 7:
                decision_reasons.append(
                    f"Video timestamp differs from stated claim date by {date_diff_days} days"
                )

            if not vehicle_detected and yolo_det_count == 0:
                decision_reasons.append(
                    "Primary vehicle could not be distinctly recognized in video keyframes"
                )

        # Corroborate physical damage with YOLO detections
        if yolo_area_ratio >= 0.05 and yolo_mean_conf >= 0.65:
            decision_reasons.append(
                f"YOLO verified physical damage across keyframes (coverage: {round(yolo_area_ratio * 100, 1)}%, confidence: {round(yolo_mean_conf, 2)})"
            )

        # Append damage classification
        decision_reasons.append(f"Assessed damage severity: {damage_category} ({damage_score}/10)")

        explanation = ". ".join(decision_reasons) + "."

        return {
            "recommendation": recommendation,
            "confidence": confidence,
            "explanation": explanation,
            "reasons": decision_reasons,
            "scores": {
                "damage": damage_score,
                "fraud": overall_fraud_score,
                "consistency": consistency_score
            },
            "pillar_breakdown": {
                "yolo_aggregate": {
                    "aggregate_damage_area_ratio": round(yolo_area_ratio, 4),
                    "mean_confidence": round(yolo_mean_conf, 3),
                    "total_detections": yolo_det_count,
                    "primary_vehicle_detected": vehicle_detected
                },
                "llava_severity": {
                    "severity_level": severity_level,
                    "damage_score": damage_score,
                    "consistency_score": consistency_score,
                    "is_consistent": is_consistent
                },
                "metadata_risk": {
                    "editing_software_detected": editing_detected,
                    "editing_tools": editing_tools,
                    "date_difference_days": date_diff_days,
                    "is_date_consistent": is_date_consistent,
                    "metadata_fraud_score": meta_fraud_score
                },
                "duplicate_similarity": {
                    "is_duplicate": is_duplicate,
                    "similarity_score": round(duplicate_similarity, 4),
                    "cross_policy_reuse": cross_policy_reuse,
                    "is_mirrored": is_mirrored
                }
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
        """Generate comprehensive report for dashboard (supports both image and video claims)"""
        if "keyframe_selection" in analysis_results or "yolo_aggregate" in analysis_results:
            return self.generate_video_detailed_report(analysis_results, decision)

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

    def generate_video_detailed_report(
        self,
        analysis_results: Dict[str, Any],
        decision: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate comprehensive dashboard report tailored for video claims"""
        llava = analysis_results.get("llava_analysis", {})
        fraud = analysis_results.get("fraud_detection", {})
        yolo = analysis_results.get("yolo_detection", {})
        keyframe_info = analysis_results.get("keyframe_selection", {})
        yolo_agg = analysis_results.get("yolo_aggregate", {})
        dup_check = fraud.get("duplicate_check", {})

        report = {
            "claim_type": "VIDEO_WALK_AROUND",
            "decision": decision,
            "damage_assessment": {
                "severity": llava.get("severity_level", "Unknown"),
                "damage_score": decision["scores"]["damage"],
                "damaged_parts": llava.get("parsed_analysis", {}).get("damaged_parts", []),
                "description": llava.get("parsed_analysis", {}).get("damage_description", ""),
                "recommendation": llava.get("parsed_analysis", {}).get("repair_or_replace", "Inspection Required"),
                "yolo_aggregate": {
                    "area_coverage_ratio": yolo_agg.get("aggregate_damage_area_ratio", 0.0),
                    "mean_confidence": yolo_agg.get("mean_confidence", 0.0),
                    "total_keyframe_detections": yolo_agg.get("total_detections", len(yolo.get("detections", [])))
                }
            },
            "fraud_analysis": {
                "overall_score": fraud.get("overall_fraud", {}).get("overall_fraud_score", 0),
                "risk_level": fraud.get("overall_fraud", {}).get("risk_level", "UNKNOWN"),
                "video_duplicate_check": {
                    "is_duplicate": dup_check.get("is_duplicate", False),
                    "similarity_score": dup_check.get("similarity_score", 0.0),
                    "cross_policy_reuse": dup_check.get("cross_policy_reuse", False),
                    "is_mirrored": dup_check.get("is_mirrored", False),
                    "duplicate_details": dup_check.get("duplicate_details", [])
                },
                "metadata_fraud": {
                    "score": fraud.get("metadata_fraud", {}).get("metadata_fraud_score", 0),
                    "editing_software_detected": fraud.get("metadata_fraud", {}).get("editing_software", {}).get("detected", False),
                    "editing_tools": fraud.get("metadata_fraud", {}).get("editing_software", {}).get("tools", [])
                },
                "fraud_indicators": fraud.get("overall_fraud", {}).get("all_fraud_indicators", []),
                "score_breakdown": fraud.get("overall_fraud", {}).get("breakdown", {})
            },
            "consistency_analysis": {
                "score": decision["scores"]["consistency"],
                "is_consistent": analysis_results.get("consistency_check", {}).get("is_consistent", False),
                "explanation": analysis_results.get("consistency_check", {}).get("consistency_response", "")
            },
            "video_evidence": {
                "primary_annotated_keyframe_url": keyframe_info.get("primary_path"),
                "secondary_annotated_keyframe_url": keyframe_info.get("secondary_path"),
                "composite_path": keyframe_info.get("composite_path"),
                "llava_mode": keyframe_info.get("llava_mode", "SINGLE_KEYFRAME"),
                "keyframe_timeline": keyframe_info.get("ranking", []),
                "summary": keyframe_info.get("summary", "")
            }
        }

        return report
