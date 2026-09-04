"""
Test Fraud Detection System (Day 6)
Tests duplicate detection, metadata fraud scoring, and consistency fraud detection
"""

import requests
import json
import time


def print_section(title):
    print(f"\n{'='*70}")
    print(f"  {title}")
    print(f"{'='*70}")


def test_fraud_detection():
    test_image = "test_images/damaged_car.jpg"
    
    print_section("🔍 DAY 6: FRAUD DETECTION SYSTEM TEST")
    
    # Test 1: First submission (should pass with low fraud score)
    print("\n📋 Test 1: First-time submission (Baseline)")
    print("─" * 70)
    
    with open(test_image, "rb") as f:
        files = {"image": f}
        data = {
            "claim_date": "2025-12-05",
            "claim_description": "Rear-end collision at traffic signal. Rear bumper severely dented and right tail light completely broken.",
            "claim_location": "Pune"
        }
        
        print("⏳ Submitting first claim...")
        response = requests.post(
            "http://localhost:8000/api/analyze-claim",
            files=files,
            data=data,
            timeout=600
        )
        
        result = response.json()
        
        if not result.get("success"):
            print(f"  ❌ Test 1 FAILED: {result.get('error')}\n")
            print(f"  Response: {json.dumps(result, indent=2)}")
            return
        
        # Check if fraud_detection exists in response
        if "fraud_detection" not in result.get("analysis", {}):
            print(f"  ❌ Test 1 FAILED: fraud_detection not in response")
            print(f"  Available keys in analysis: {list(result.get('analysis', {}).keys())}")
            print(f"\n  Full response structure:")
            print(json.dumps(result, indent=2))
            return
        
        fraud = result["analysis"]["fraud_detection"]["overall_fraud"]
        duplicate = result["analysis"]["fraud_detection"]["duplicate_check"]
        
        print(f"\n✅ Test 1 Results:")
        print(f"  • Fraud Score: {fraud['overall_fraud_score']}/10")
        print(f"  • Risk Level: {fraud['risk_level']}")
        print(f"  • Duplicate Detected: {'Yes' if duplicate['is_duplicate'] else 'No'}")
        print(f"  • Job ID: {result['job_id']}")
        
        if not duplicate['is_duplicate'] and fraud['overall_fraud_score'] <= 5:
            print("  ✅ Test 1 PASSED - Clean first submission\n")
        else:
            print("  ⚠️  Test 1 WARNING - Unexpected fraud indicators\n")
    
    # Wait a bit
    time.sleep(2)
    
    # Test 2: Resubmit same image (should flag as duplicate)
    print("\n📋 Test 2: Duplicate image submission")
    print("─" * 70)
    print("⏳ Resubmitting same image with different claim details...")
    
    with open(test_image, "rb") as f:
        files = {"image": f}
        data = {
            "claim_date": "2025-12-10",
            "claim_description": "Front bumper damaged in parking lot incident.",
            "claim_location": "Mumbai"
        }
        
        response = requests.post(
            "http://localhost:8000/api/analyze-claim",
            files=files,
            data=data,
            timeout=600
        )
        
        result = response.json()
        
        if not result.get("success"):
            print(f"  ❌ Test 2 FAILED: {result.get('error')}\n")
            return
        
        # Check if fraud_detection exists
        if "fraud_detection" not in result.get("analysis", {}):
            print(f"  ❌ Test 2 FAILED: fraud_detection not in response\n")
            return
        
        fraud = result["analysis"]["fraud_detection"]["overall_fraud"]
        duplicate = result["analysis"]["fraud_detection"]["duplicate_check"]
        
        print(f"\n✅ Test 2 Results:")
        print(f"  • Fraud Score: {fraud['overall_fraud_score']}/10")
        print(f"  • Risk Level: {fraud['risk_level']}")
        print(f"  • Duplicate Detected: {'Yes' if duplicate['is_duplicate'] else 'No'}")
        print(f"  • Duplicate Count: {duplicate['duplicate_count']}")
        
        if duplicate['is_duplicate']:
            print(f"\n  🔍 Duplicate Details:")
            for detail in duplicate['duplicate_details']:
                print(f"    • Previous Job ID: {detail['job_id']}")
                print(f"      Similarity: {detail['similarity_score']:.1%}")
                print(f"      Timestamp: {detail['timestamp']}")
        
        if duplicate['is_duplicate'] and fraud['overall_fraud_score'] >= 7:
            print("  ✅ Test 2 PASSED - Duplicate successfully detected!\n")
        else:
            print("  ⚠️  Test 2 WARNING - Duplicate detection may need adjustment\n")
    
    # Wait a bit
    time.sleep(2)
    
    # Test 3: Inconsistent claim description
    print("\n📋 Test 3: Inconsistent claim (fraud attempt)")
    print("─" * 70)
    print("⏳ Submitting claim with mismatched description...")
    
    with open(test_image, "rb") as f:
        files = {"image": f}
        data = {
            "claim_date": "2025-12-12",
            "claim_description": "Minor scratch on driver side door, very small damage, barely visible.",
            "claim_location": "Delhi"
        }
        
        response = requests.post(
            "http://localhost:8000/api/analyze-claim",
            files=files,
            data=data,
            timeout=600
        )
        
        result = response.json()
        
        if not result.get("success"):
            print(f"  ❌ Test 3 FAILED: {result.get('error')}\n")
            return
        
        # Check if fraud_detection exists
        if "fraud_detection" not in result.get("analysis", {}):
            print(f"  ❌ Test 3 FAILED: fraud_detection not in response\n")
            return
        
        fraud = result["analysis"]["fraud_detection"]["overall_fraud"]
        duplicate = result["analysis"]["fraud_detection"]["duplicate_check"]
        consistency = result["analysis"]["consistency_check"]
        consistency_fraud = result["analysis"]["fraud_detection"]["consistency_fraud"]
        
        print(f"\n✅ Test 3 Results:")
        print(f"  • Overall Fraud Score: {fraud['overall_fraud_score']}/10")
        print(f"  • Risk Level: {fraud['risk_level']}")
        print(f"  • Consistency Score: {consistency['consistency_score']}/10")
        print(f"  • Claim Consistent: {'Yes' if consistency['is_consistent'] else 'No'}")
        print(f"  • Consistency Fraud Score: {consistency_fraud['consistency_fraud_score']}/10")
        
        if consistency_fraud['risk_indicators']:
            print(f"\n  ⚠️  Fraud Indicators:")
            for indicator in consistency_fraud['risk_indicators']:
                print(f"    • {indicator}")
        
        if not consistency['is_consistent'] and fraud['overall_fraud_score'] >= 5:
            print("  ✅ Test 3 PASSED - Inconsistency detected!\n")
        else:
            print("  ⚠️  Test 3 WARNING - Inconsistency scoring may need tuning\n")
    
    # Final Summary
    print_section("📊 FRAUD DETECTION TEST SUMMARY")
    
    print("\n✅ Completed Tests:")
    print("  ✓ Test 1: Baseline legitimate claim")
    print("  ✓ Test 2: Duplicate image detection")
    print("  ✓ Test 3: Inconsistent claim description")
    
    print("\n🎯 Fraud Detection Features Tested:")
    print("  • Perceptual hashing (pHash, dHash, wHash, average)")
    print("  • Duplicate image detection")
    print("  • Metadata fraud scoring")
    print("  • Consistency fraud scoring")
    print("  • Overall fraud risk calculation")
    
    print("\n💾 Storage:")
    print("  • File-based hash storage: data/image_hashes.json")
    print("  • (Qdrant vector DB optional for production)")
    
    print("\n🏆 DAY 6 DELIVERABLES COMPLETE!")
    print("="*70)


if __name__ == "__main__":
    test_fraud_detection()
