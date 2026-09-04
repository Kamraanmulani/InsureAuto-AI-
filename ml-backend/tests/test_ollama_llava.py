import requests
import json
import time

def test_ollama_llava():
    """Test LLaVA analysis with Ollama"""
    
    test_image_path = "test_images/damaged_car.jpg"
    
    print("="*70)
    print("Testing LLaVA Analysis with Ollama")
    print("="*70)
    
    with open(test_image_path, "rb") as f:
        files = {"image": f}
        data = {
            "claim_date": "2025-12-05",
            "claim_description": "Rear-end collision at traffic signal around 8 PM. Rear bumper severely dented and right tail light completely shattered.",
            "claim_location": "Pune"
        }
        
        print("\n📤 Submitting claim for analysis...")
        print(f"Description: {data['claim_description'][:80]}...")
        
        start_time = time.time()
        
        try:
            response = requests.post(
                "http://localhost:8000/api/analyze-claim",
                files=files,
                data=data,
                timeout=180
            )
            
            elapsed = time.time() - start_time
            
            if response.status_code != 200:
                print(f"\n❌ Error: {response.status_code}")
                print(response.text)
                return
            
            result = response.json()
            
            if not result.get("success"):
                print(f"\n❌ Analysis failed: {result.get('error', 'Unknown error')}")
                return
            
            # Display results
            print(f"\n✅ Analysis completed in {elapsed:.2f} seconds")
            print("\n" + "="*70)
            print("RESULTS")
            print("="*70)
            
            report = result["report"]
            
            # Decision
            decision = report["decision"]
            print(f"\n🎯 RECOMMENDATION: {decision['recommendation']}")
            print(f"   Confidence: {decision['confidence']}")
            print(f"   Explanation: {decision['explanation']}")
            
            # Damage Assessment
            damage = report["damage_assessment"]
            print(f"\n💥 DAMAGE ASSESSMENT:")
            print(f"   Severity: {damage['severity']}")
            print(f"   Score: {damage['score']}/10")
            print(f"   Damaged Parts:")
            for part in damage['damaged_parts']:
                print(f"      • {part}")
            print(f"   Description: {damage['description'][:150]}...")
            
            # Fraud Analysis
            fraud = report["fraud_analysis"]
            print(f"\n🔍 FRAUD ANALYSIS:")
            print(f"   Risk Level: {fraud['risk_level']}")
            print(f"   Score: {fraud['overall_score']}/10")
            print(f"   Is Duplicate: {fraud['is_duplicate']}")
            if fraud['fraud_indicators']:
                print(f"   Indicators:")
                for ind in fraud['fraud_indicators']:
                    print(f"      • {ind}")
            
            # Consistency
            consistency = report["consistency_analysis"]
            print(f"\n✓ CONSISTENCY:")
            print(f"   Score: {consistency['score']}/10")
            print(f"   Is Consistent: {consistency['is_consistent']}")
            
            print(f"\n⏱️  Performance: {elapsed:.2f}s total")
            print("="*70)
            
        except requests.exceptions.Timeout:
            print(f"\n❌ Request timeout after 180 seconds")
        except Exception as e:
            print(f"\n❌ Error: {e}")

if __name__ == "__main__":
    test_ollama_llava()