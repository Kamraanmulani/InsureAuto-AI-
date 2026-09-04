import requests
import json
import os

def test_detection():
    # Test image path
    test_image_path = "test_images/damaged_car.jpg"
    
    # Prepare request
    with open(test_image_path, "rb") as f:
        files = {"image": f}
        data = {
            "claim_date": "2025-12-05",
            "claim_description": "Rear-end collision at traffic signal. Rear bumper and right tail light damaged."
        }
        
        # Send request
        # Note: Using port 8001 as per current server config
        response = requests.post(
            "http://localhost:8001/api/detect",
            files=files,
            data=data
        )
        
        try:
            result = response.json()
        except json.JSONDecodeError:
            print("Failed to decode JSON response")
            print(response.text)
            return
        
        # Save output to file
        with open("test_detection_output.json", "w") as out_f:
            json.dump(result, out_f, indent=2)
        print("Test output saved to test_detection_output.json")
        
        # Print results
        print("=" * 60)
        print("DETECTION RESULTS")
        print("=" * 60)
        
        if not result.get("success"):
            print("Detection failed:")
            print(result)
            return

        print(f"\nJob ID: {result['job_id']}")
        print(f"\nMetadata Validation:")
        print(f"  Risk Score: {result['preprocessing']['validation']['risk_score']}")
        print(f"  Issues: {result['preprocessing']['validation']['issues']}")
        
        print(f"\nDetection Summary:")
        detection = result['detection']
        print(f"  Total Objects: {detection['detection_summary']['total_objects']}")
        print(f"  Vehicle Detected: {detection['detection_summary']['vehicle_detected']}")
        print(f"  Vehicle Type: {detection['detection_summary']['vehicle_type']}")
        print(f"  Initial Damage Score: {detection['initial_damage_score']}/10")
        
        print(f"\nDetected Objects:")
        for obj in detection['analysis']['detected_objects']:
            print(f"  - {obj['type']}: {obj['confidence']:.2f} confidence")
        
        # Download and display annotated image
        job_id = result['job_id']
        img_response = requests.get(f"http://localhost:8001/api/annotated-image/{job_id}")
        
        if img_response.status_code == 200:
            with open(f"output_annotated_{job_id}.jpg", "wb") as f:
                f.write(img_response.content)
            print(f"\n✅ Annotated image saved as: output_annotated_{job_id}.jpg")
        else:
            print(f"\n❌ Failed to download annotated image: {img_response.status_code}")

if __name__ == "__main__":
    test_detection()