"""
Quick debug script to check API response structure
"""
import requests
import json

test_image = "test_images/damaged_car.jpg"

print("Testing API response structure...")

with open(test_image, "rb") as f:
    files = {"image": f}
    data = {
        "claim_date": "2025-12-05",
        "claim_description": "Rear-end collision. Rear bumper damaged.",
        "claim_location": "Pune"
    }
    
    try:
        response = requests.post(
            "http://localhost:8000/api/analyze-claim",
            files=files,
            data=data,
            timeout=120
        )
        
        result = response.json()
        
        print("\n" + "="*70)
        print("API RESPONSE STRUCTURE:")
        print("="*70)
        
        print(f"\nSuccess: {result.get('success')}")
        
        if result.get('success'):
            print(f"\nTop-level keys: {list(result.keys())}")
            
            if 'analysis' in result:
                print(f"\nAnalysis keys: {list(result['analysis'].keys())}")
                
                # Check for fraud_detection
                if 'fraud_detection' in result['analysis']:
                    print("\n✅ fraud_detection is present!")
                    print(f"Fraud detection keys: {list(result['analysis']['fraud_detection'].keys())}")
                else:
                    print("\n❌ fraud_detection is MISSING!")
                    print("\nFull response:")
                    print(json.dumps(result, indent=2))
        else:
            print(f"\nError: {result.get('error')}")
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
