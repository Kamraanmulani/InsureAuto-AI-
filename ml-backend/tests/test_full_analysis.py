import requests
import json

def test_full_analysis():
    test_image_path = "test_images/damaged_car.jpg"
    
    with open(test_image_path, "rb") as f:
        files = {"image": f}
        data = {
            "claim_date": "2025-12-05",
            "claim_description": "Rear-end collision at traffic signal around 8 PM. Rear bumper severely dented and right tail light is completely broken.",
            "claim_location": "Pune"
        }
        
        print("🚀 Sending claim for analysis...")
        response = requests.post(
            "http://localhost:8000/api/analyze-claim",
            files=files,
            data=data,
            timeout=600  # 10 minutes timeout for LLaVA 13B analysis
        )
        
        result = response.json()
        
        if not result.get("success"):
            print(f"❌ Error: {result.get('error')}")
            return
        
        # Print comprehensive results
        print("\n" + "=" * 70)
        print("COMPREHENSIVE CLAIM ANALYSIS RESULTS")
        print("=" * 70)
        
        print(f"\n📋 Job ID: {result['job_id']}")
        
        # Claim Information
        print("\n📝 CLAIM INFORMATION:")
        print(f"  Date: {result['claim_info']['date']}")
        print(f"  Location: {result['claim_info']['location']}")
        print(f"  Description: {result['claim_info']['description']}")
        
        # Get the report
        report = result['report']
        
        # Damage Assessment
        damage_assessment = report['damage_assessment']
        print("\n📊 DAMAGE ASSESSMENT:")
        print(f"  Severity: {damage_assessment['severity']}")
        print(f"  Damage Score: {damage_assessment['score']}/10")
        if damage_assessment.get('description'):
            print(f"  Description: {damage_assessment['description']}")
        
        # Damaged Parts
        if damage_assessment.get('damaged_parts'):
            print("\n🔧 DAMAGED PARTS IDENTIFIED:")
            for part in damage_assessment['damaged_parts']:
                print(f"  • {part}")
        
        # Fraud Analysis
        fraud_analysis = report['fraud_analysis']
        print("\n🚨 FRAUD ANALYSIS:")
        print(f"  Overall Score: {fraud_analysis['overall_score']}/10")
        print(f"  Risk Level: {fraud_analysis['risk_level']}")
        
        if fraud_analysis.get('fraud_indicators'):
            print("\n⚠️  FRAUD INDICATORS:")
            for indicator in fraud_analysis['fraud_indicators']:
                if isinstance(indicator, dict):
                    print(f"  • {indicator.get('type', 'N/A')}: {indicator.get('description', 'N/A')} (Severity: {indicator.get('severity', 'N/A')})")
                else:
                    print(f"  • {indicator}")
        
        # Consistency Check
        consistency = report.get('consistency_analysis', {})
        if consistency:
            print("\n✅ CONSISTENCY CHECK:")
            print(f"  Score: {consistency.get('score', 'N/A')}/10")
            print(f"  Is Consistent: {consistency.get('is_consistent', 'N/A')}")
            if consistency.get('explanation'):
                print(f"  Explanation: {consistency['explanation']}")
        
        # Final Decision
        decision = report['decision']
        print("\n⚖️  FINAL DECISION:")
        print(f"  Recommendation: {decision['recommendation']}")
        print(f"  Confidence: {decision['confidence']}")
        if decision.get('explanation'):
            print(f"  Explanation: {decision['explanation']}")
        
        # Visual Evidence
        visual = report.get('visual_evidence', {})
        if visual:
            print("\n🎯 VISUAL EVIDENCE:")
            print(f"  Vehicle Detected: {visual.get('vehicle_detected', 'N/A')}")
            print(f"  Vehicle Type: {visual.get('vehicle_type', 'Unknown')}")
            print(f"  Total Objects Detected: {visual.get('objects_detected', 0)}")
        
        print(f"\n📸 Annotated image available at: {result['annotated_image_url']}")
        
        # Download annotated image
        img_url = f"http://localhost:8000{result['annotated_image_url']}"
        img_response = requests.get(img_url)
        if img_response.status_code == 200:
            output_path = f"output_{result['job_id']}_annotated.jpg"
            with open(output_path, "wb") as f:
                f.write(img_response.content)
            print(f"✅ Downloaded: {output_path}")
        
        print("\n" + "=" * 70)

if __name__ == "__main__":
    test_full_analysis()
