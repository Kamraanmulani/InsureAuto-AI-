import requests
import json
import time
from pathlib import Path

def print_section(title):
    print("\n" + "="*70)
    print(f"  {title}")
    print("="*70)

def test_complete_pipeline():
    base_url = "http://localhost:8000"
    
    # Test scenarios
    test_cases = [
        {
            "name": "Legitimate Claim - Rear-end Collision",
            "image": "test_images/damaged_car.jpg",
            "data": {
                "claim_date": "2025-12-05",
                "claim_description": "Rear-end collision at traffic signal around 8 PM. Rear bumper is severely dented and right tail light is completely shattered.",
                "claim_location": "Pune",
                "policy_id": "POL-2025-001"
            },
            "expected": "APPROVE or MANUAL_REVIEW"
        },
        {
            "name": "Suspicious Claim - Inconsistent Description",
            "image": "test_images/damaged_car.jpg",
            "data": {
                "claim_date": "2025-12-06",
                "claim_description": "Very minor scratch on driver side door, barely visible.",
                "claim_location": "Mumbai",
                "policy_id": "POL-2025-002"
            },
            "expected": "MANUAL_REVIEW or REJECT"
        }
    ]
    
    results = []
    
    for i, test_case in enumerate(test_cases, 1):
        print_section(f"Test Case {i}: {test_case['name']}")
        
        # Check if image exists
        if not Path(test_case["image"]).exists():
            print(f"⚠️  Image not found: {test_case['image']}")
            print("Skipping test case...\n")
            continue
        
        try:
            with open(test_case["image"], "rb") as f:
                files = {"image": f}
                
                print(f"📤 Submitting claim...")
                start_time = time.time()
                
                response = requests.post(
                    f"{base_url}/api/analyze-claim",
                    files=files,
                    data=test_case["data"],
                    timeout=180
                )
                
                elapsed_time = time.time() - start_time
                
                if response.status_code != 200:
                    print(f"❌ API Error: {response.status_code}")
                    print(response.text)
                    continue
                
                result = response.json()
                
                if not result.get("success"):
                    print(f"❌ Analysis failed")
                    continue
                
                # Extract key metrics
                report = result["report"]
                decision = report["decision"]
                damage = report["damage_assessment"]
                fraud = report["fraud_analysis"]
                
                # Display results
                print(f"\n⏱️  Processing Time: {elapsed_time:.2f} seconds")
                print(f"🆔 Job ID: {result['job_id']}")
                
                print(f"\n📊 FINAL DECISION: {decision['recommendation']}")
                print(f"   Confidence: {decision['confidence']}")
                print(f"   Explanation: {decision['explanation']}")
                
                print(f"\n💰 DAMAGE ASSESSMENT:")
                print(f"   Severity: {damage['severity']}")
                print(f"   Score: {damage['score']}/10")
                print(f"   Damaged Parts: {', '.join(damage['damaged_parts'][:3])}...")
                
                print(f"\n🔍 FRAUD ANALYSIS:")
                print(f"   Risk Level: {fraud['risk_level']}")
                print(f"   Score: {fraud['overall_score']}/10")
                print(f"   Is Duplicate: {fraud['is_duplicate']}")
                if fraud['fraud_indicators']:
                    print(f"   Indicators: {', '.join(fraud['fraud_indicators'][:2])}")
                
                print(f"\n✅ CONSISTENCY:")
                print(f"   Score: {report['consistency_analysis']['score']}/10")
                print(f"   Is Consistent: {report['consistency_analysis']['is_consistent']}")
                
                print(f"\n✓ Test completed successfully")
                print(f"   Expected: {test_case['expected']}")
                print(f"   Got: {decision['recommendation']}")
                
                results.append({
                    "test_name": test_case["name"],
                    "success": True,
                    "recommendation": decision["recommendation"],
                    "processing_time": elapsed_time,
                    "job_id": result["job_id"]
                })
                
        except requests.exceptions.Timeout:
            print(f"❌ Request timeout after 180 seconds")
            results.append({
                "test_name": test_case["name"],
                "success": False,
                "error": "Timeout"
            })
        except Exception as e:
            print(f"❌ Error: {str(e)}")
            results.append({
                "test_name": test_case["name"],
                "success": False,
                "error": str(e)
            })
    
    # Summary
    print_section("TEST SUMMARY")
    successful = sum(1 for r in results if r.get("success"))
    print(f"\nTotal Tests: {len(results)}")
    print(f"Successful: {successful}")
    print(f"Failed: {len(results) - successful}")
    
    if successful > 0:
        avg_time = sum(r.get("processing_time", 0) for r in results if r.get("success")) / successful
        print(f"\nAverage Processing Time: {avg_time:.2f} seconds")
    
    print("\n" + "="*70)
    print("✅ Pipeline testing complete!")
    print("="*70 + "\n")

if __name__ == "__main__":
    test_complete_pipeline()
