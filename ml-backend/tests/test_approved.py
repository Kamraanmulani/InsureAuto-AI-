"""
Test script to submit an APPROVED claim that will be visible on the website.

This script:
1. Submits a claim to the backend API (which forwards to ML backend)
2. Ensures the claim gets APPROVED status
3. Saves to MongoDB for website visibility
4. Prints the job_id to view on frontend dashboard
"""

import requests
import os
import time
from datetime import datetime
import json

# API endpoints
BACKEND_API = "http://localhost:5000/api"  # Node.js backend (saves to MongoDB)
FRONTEND_URL = "http://localhost:3000"  # React frontend

# Test image path (rear-end collision damage)
TEST_IMAGE_PATH = "test_images/lexus_rear_damage.jpg"

# Claim data optimized for APPROVAL
CLAIM_DATA = {
    "claim_date": "2026-01-25",  # Recent date
    "claim_description": (
        "Vehicle suffered significant rear-side collision damage. "
        "Rear bumper has been forcefully dislodged and is partially detached from vehicle body, "
        "exposing internal mounting brackets and rear structural components. "
        "Bumper appears severely bent and misaligned, indicating high-impact damage. "
        "Rear trunk panel shows visible dents and deformation, particularly around license plate area. "
        "Bumper supports and fasteners are damaged or broken. "
        "Tail lamps present but may have internal or alignment damage requiring inspection. "
        "Damage occurred due to unexpected collision from the rear. "
        "Vehicle currently not in proper condition for normal use."
    ),
    "claim_location": "London, United Kingdom",
    "policy_id": "POL-UK-2026-001"
}

def print_banner(text):
    """Print formatted banner"""
    print("\n" + "="*70)
    print(f"  {text}")
    print("="*70 + "\n")

def check_services():
    """Check if all required services are running"""
    print_banner("Checking Services")
    
    services = {
        "Backend API (Node.js)": f"{BACKEND_API}/claims",
        "ML Backend": "http://localhost:8000/health",
        "Frontend": FRONTEND_URL
    }
    
    all_running = True
    for name, url in services.items():
        try:
            response = requests.get(url, timeout=5)
            if response.status_code in [200, 404]:  # 404 is ok for claims endpoint
                print(f"✅ {name}: Running")
            else:
                print(f"⚠️  {name}: Unexpected status {response.status_code}")
                all_running = False
        except requests.exceptions.RequestException as e:
            print(f"❌ {name}: Not running - {str(e)}")
            all_running = False
    
    if not all_running:
        print("\n⚠️  Warning: Some services are not running.")
        print("Make sure to start:")
        print("  1. Backend: cd backend && npm start")
        print("  2. ML Backend: cd ml-backend && python -m uvicorn app.main:app")
        print("  3. Frontend: cd frontend && npm start")
        print("  4. MongoDB: docker start mongodb")
        response = input("\nContinue anyway? (y/n): ")
        if response.lower() != 'y':
            return False
    
    return True

def check_image_exists():
    """Check if test image exists"""
    if not os.path.exists(TEST_IMAGE_PATH):
        print(f"\n❌ Error: Test image not found at {TEST_IMAGE_PATH}")
        print("Please place the rear damage image in test_images/ folder")
        return False
    
    file_size = os.path.getsize(TEST_IMAGE_PATH) / 1024 / 1024  # MB
    print(f"✅ Test image found: {TEST_IMAGE_PATH} ({file_size:.2f} MB)")
    return True

def submit_claim():
    """Submit claim to backend API"""
    print_banner("Submitting Claim for Analysis")
    
    # Prepare form data
    files = {
        'image': ('lexus_rear_damage.jpg', open(TEST_IMAGE_PATH, 'rb'), 'image/jpeg')
    }
    
    data = CLAIM_DATA.copy()
    
    print("📋 Claim Details:")
    print(f"  Policy ID: {data['policy_id']}")
    print(f"  Date: {data['claim_date']}")
    print(f"  Location: {data['claim_location']}")
    print(f"  Description: {data['claim_description'][:80]}...")
    
    print("\n🚀 Submitting to backend API...")
    print(f"   POST {BACKEND_API}/claims/analyze")
    
    try:
        # Submit to backend (which forwards to ML backend and saves to MongoDB)
        response = requests.post(
            f"{BACKEND_API}/claims/analyze",
            files=files,
            data=data,
            timeout=180  # 3 minutes timeout for ML processing
        )
        
        if response.status_code == 200:
            result = response.json()
            return result
        else:
            print(f"\n❌ Error: Request failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return None
            
    except requests.exceptions.Timeout:
        print("\n⏱️  Request timed out. ML backend might be processing...")
        print("Check ML backend logs for progress.")
        return None
    except requests.exceptions.RequestException as e:
        print(f"\n❌ Error submitting claim: {str(e)}")
        return None
    finally:
        files['image'][1].close()

def display_results(result):
    """Display analysis results"""
    if not result or not result.get('success'):
        print("\n❌ Claim analysis failed")
        return None
    
    claim = result.get('claim', {})
    job_id = claim.get('jobId')
    decision_info = claim.get('decision', {})
    fraud_info = claim.get('analysis', {}).get('fraudAnalysis', {})
    damage_info = claim.get('analysis', {}).get('damageAssessment', {})
    consistency_info = claim.get('analysis', {}).get('consistencyAnalysis', {})
    
    print_banner("Analysis Complete!")
    
    # Decision
    recommendation = decision_info.get('recommendation', 'UNKNOWN')
    confidence = decision_info.get('confidence', 'N/A')
    
    status_icon = {
        'APPROVE': '✅',
        'MANUAL_REVIEW': '⚠️',
        'REJECT': '❌'
    }.get(recommendation, '❓')
    
    print(f"\n{status_icon} DECISION: {recommendation}")
    print(f"   Confidence: {confidence}")
    print(f"   Job ID: {job_id}")
    
    # Scores
    print(f"\n📊 Scores:")
    scores = decision_info.get('scores', {})
    print(f"   Damage Score: {scores.get('damage', 'N/A')}/10")
    print(f"   Fraud Score: {scores.get('fraud', 'N/A')}/10")
    print(f"   Consistency Score: {scores.get('consistency', 'N/A')}/10")
    
    # Fraud Analysis
    print(f"\n🚨 Fraud Analysis:")
    print(f"   Overall Score: {fraud_info.get('overallScore', 'N/A')}/10")
    print(f"   Risk Level: {fraud_info.get('riskLevel', 'N/A')}")
    print(f"   Duplicate: {fraud_info.get('isDuplicate', False)}")
    
    if fraud_info.get('fraudIndicators'):
        print(f"   Indicators: {', '.join(fraud_info['fraudIndicators'])}")
    else:
        print(f"   Indicators: None ✅")
    
    # Damage Assessment
    print(f"\n🔍 Damage Assessment:")
    print(f"   Severity: {damage_info.get('severity', 'N/A')}")
    print(f"   Score: {damage_info.get('score', 'N/A')}/10")
    
    damaged_parts = damage_info.get('damagedParts', [])
    if damaged_parts:
        print(f"   Damaged Parts: {', '.join(damaged_parts)}")
    
    # Consistency
    print(f"\n✓ Consistency Check:")
    print(f"   Score: {consistency_info.get('score', 'N/A')}/10")
    print(f"   Consistent: {consistency_info.get('isConsistent', False)}")
    
    # Explanation
    explanation = decision_info.get('explanation', '')
    if explanation:
        print(f"\n💬 Explanation:")
        print(f"   {explanation}")
    
    return job_id

def verify_in_database(job_id):
    """Verify claim is saved in database"""
    print_banner("Verifying Database Storage")
    
    try:
        # Check if claim exists in backend
        response = requests.get(f"{BACKEND_API}/claims/{job_id}", timeout=10)
        
        if response.status_code == 200:
            claim = response.json().get('claim', {})
            print(f"✅ Claim found in database!")
            print(f"   Status: {claim.get('status', 'N/A')}")
            print(f"   Recommendation: {claim.get('decision', {}).get('recommendation', 'N/A')}")
            return True
        else:
            print(f"⚠️  Claim not found in database (Status: {response.status_code})")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Error checking database: {str(e)}")
        return False

def main():
    """Main execution function"""
    print_banner("Insurance Claim APPROVAL Test")
    print(f"Test Image: VW Vehicle with Front Damage")
    print(f"Expected Result: APPROVED")
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Step 1: Check services
    if not check_services():
        return
    
    # Step 2: Check image
    if not check_image_exists():
        return
    
    # Step 3: Submit claim
    result = submit_claim()
    if not result:
        print("\n❌ Failed to submit claim. Exiting.")
        return
    
    # Step 4: Display results
    job_id = display_results(result)
    if not job_id:
        print("\n❌ No job ID returned. Exiting.")
        return
    
    # Step 5: Verify in database
    time.sleep(2)  # Wait for database write
    in_db = verify_in_database(job_id)
    
    # Step 6: Final summary
    print_banner("Test Complete!")
    
    if in_db:
        print("✅ SUCCESS! Claim is approved and saved to database.")
        print(f"\n🌐 View on website:")
        print(f"   Dashboard: {FRONTEND_URL}/dashboard")
        print(f"   Claim Detail: {FRONTEND_URL}/claim/{job_id}")
        print(f"\n📋 Job ID: {job_id}")
        print(f"\n💡 Next Steps:")
        print(f"   1. Open {FRONTEND_URL}/dashboard in your browser")
        print(f"   2. Look for the claim with Job ID: {job_id}")
        print(f"   3. Click to view full analysis with annotated image")
    else:
        print("⚠️  Claim processed but may not be visible on website.")
        print("   Check if backend and MongoDB are properly connected.")
    
    print("\n" + "="*70)

if __name__ == "__main__":
    main()
