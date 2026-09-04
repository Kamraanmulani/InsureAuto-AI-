import requests
import json

# Test image (use any sample damaged car image)
test_image_path = "test_images/damaged_car.jpg"

with open(test_image_path, "rb") as f:
    files = {"image": f}
    data = {
        "claim_date": "2025-12-05",
        "claim_description": "Rear-end collision at traffic signal. Rear bumper and tail light damaged."
    }
    
    response = requests.post(
        "http://localhost:8001/api/preprocess",
        files=files,
        data=data
    )
    
    output = response.json()
    with open("test_output.json", "w") as out_f:
        json.dump(output, out_f, indent=2)
    print("Test output saved to test_output.json")