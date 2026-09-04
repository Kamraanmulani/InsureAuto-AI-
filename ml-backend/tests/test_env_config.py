"""
Test Environment Configuration
Verifies that .env file is loaded correctly and all services are accessible
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Add project root to path and load root .env
root_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root_dir))
load_dotenv(dotenv_path=root_dir / ".env")

print("=" * 70)
print("🔍 TESTING ENVIRONMENT CONFIGURATION")
print("=" * 70)

# Test 1: Check if .env is loaded
print("\n1. Environment Variables:")
print("-" * 70)

env_vars = {
    "USE_QDRANT": os.getenv("USE_QDRANT", "NOT SET"),
    "QDRANT_HOST": os.getenv("QDRANT_HOST", "NOT SET"),
    "QDRANT_PORT": os.getenv("QDRANT_PORT", "NOT SET"),
    "OLLAMA_HOST": os.getenv("OLLAMA_HOST", "NOT SET"),
    "API_HOST": os.getenv("API_HOST", "NOT SET"),
    "API_PORT": os.getenv("API_PORT", "NOT SET"),
    "YOLO_MODEL_PATH": os.getenv("YOLO_MODEL_PATH", "NOT SET"),
    "LLAVA_MODEL_NAME": os.getenv("LLAVA_MODEL_NAME", "NOT SET"),
}

for key, value in env_vars.items():
    status = "✅" if value != "NOT SET" else "❌"
    print(f"  {status} {key}: {value}")

# Test 2: Check Qdrant connection
print("\n2. Qdrant Connection:")
print("-" * 70)

try:
    import requests
    qdrant_host = os.getenv("QDRANT_HOST", "localhost")
    qdrant_port = os.getenv("QDRANT_PORT", "6333")
    
    response = requests.get(f"http://{qdrant_host}:{qdrant_port}/collections", timeout=5)
    if response.status_code == 200:
        data = response.json()
        collections = data.get("result", {}).get("collections", [])
        print(f"  ✅ Qdrant is accessible at {qdrant_host}:{qdrant_port}")
        print(f"  📊 Collections found: {len(collections)}")
        if collections:
            for coll in collections:
                print(f"     - {coll.get('name')}")
    else:
        print(f"  ❌ Qdrant returned status code: {response.status_code}")
except Exception as e:
    print(f"  ❌ Cannot connect to Qdrant: {e}")
    print(f"  💡 Make sure to run: docker-compose up -d qdrant")

# Test 3: Check if Qdrant client can be imported and initialized
print("\n3. Qdrant Client:")
print("-" * 70)

try:
    from qdrant_client import QdrantClient
    
    qdrant_host = os.getenv("QDRANT_HOST", "localhost")
    qdrant_port = int(os.getenv("QDRANT_PORT", "6333"))
    
    client = QdrantClient(host=qdrant_host, port=qdrant_port)
    collections = client.get_collections()
    print(f"  ✅ Qdrant client initialized successfully")
    print(f"  📊 Collections: {len(collections.collections)}")
except Exception as e:
    print(f"  ❌ Qdrant client error: {e}")

# Test 4: Check Ollama
print("\n4. Ollama LLaVA:")
print("-" * 70)

try:
    import requests
    ollama_host = os.getenv("OLLAMA_HOST", "http://localhost:11434")
    
    response = requests.get(f"{ollama_host}/api/tags", timeout=5)
    if response.status_code == 200:
        models = response.json().get("models", [])
        print(f"  ✅ Ollama is accessible at {ollama_host}")
        print(f"  📊 Models available: {len(models)}")
        
        llava_model = os.getenv("LLAVA_MODEL_NAME", "llava:13b")
        model_found = any(llava_model in m.get("name", "") for m in models)
        
        if model_found:
            print(f"  ✅ {llava_model} is available")
        else:
            print(f"  ⚠️  {llava_model} not found. Available models:")
            for model in models[:3]:
                print(f"     - {model.get('name')}")
    else:
        print(f"  ❌ Ollama returned status code: {response.status_code}")
except Exception as e:
    print(f"  ❌ Cannot connect to Ollama: {e}")
    print(f"  💡 Make sure Ollama is running: ollama list")

# Test 5: Test FraudDetector initialization
print("\n5. FraudDetector Initialization:")
print("-" * 70)

try:
    from app.models.fraud_detector import FraudDetector
    
    # Initialize with environment variables
    fraud_detector = FraudDetector()
    
    print(f"  ✅ FraudDetector initialized successfully")
    print(f"  📊 Using Qdrant: {fraud_detector.use_qdrant}")
    
    if fraud_detector.use_qdrant:
        print(f"  ✅ Qdrant integration enabled")
    else:
        print(f"  ℹ️  Using file-based storage (fallback)")
        
except Exception as e:
    print(f"  ❌ FraudDetector initialization error: {e}")

# Test 6: Check data directories
print("\n6. Data Directories:")
print("-" * 70)

data_dirs = [
    "data",
    "data/uploads",
    "data/uploads/processed",
    "data/uploads/annotated",
]

for dir_path in data_dirs:
    exists = os.path.exists(dir_path)
    status = "✅" if exists else "❌"
    print(f"  {status} {dir_path}")
    if not exists:
        try:
            os.makedirs(dir_path, exist_ok=True)
            print(f"     ✓ Created directory")
        except Exception as e:
            print(f"     ✗ Failed to create: {e}")

# Summary
print("\n" + "=" * 70)
print("📊 CONFIGURATION TEST SUMMARY")
print("=" * 70)

use_qdrant = os.getenv("USE_QDRANT", "false").lower() == "true"

if use_qdrant:
    print("\n✅ Qdrant integration is ENABLED")
    print("   The system will use Qdrant for duplicate detection")
else:
    print("\nℹ️  Qdrant integration is DISABLED")
    print("   The system will use file-based storage")
    print("   To enable Qdrant, set USE_QDRANT=true in .env")

print("\n💡 Next Steps:")
print("   1. Start the ML backend: python -m uvicorn app.main:app --reload")
print("   2. Test the API: python test_complete_pipeline.py")
print("   3. Open API docs: http://localhost:8000/docs")

print("\n" + "=" * 70)
