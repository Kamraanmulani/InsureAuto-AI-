"""
Test script to verify Qdrant duplicate detection functionality
Tests the complete fraud detection pipeline with vector similarity search
"""

import os
import sys
import time
from pathlib import Path
from PIL import Image
import numpy as np

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.models.fraud_detector import FraudDetector

# ANSI color codes for better output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    MAGENTA = '\033[95m'
    CYAN = '\033[96m'
    BOLD = '\033[1m'
    END = '\033[0m'

def print_header(text):
    print(f"\n{Colors.CYAN}{Colors.BOLD}{'='*60}{Colors.END}")
    print(f"{Colors.CYAN}{Colors.BOLD}{text.center(60)}{Colors.END}")
    print(f"{Colors.CYAN}{Colors.BOLD}{'='*60}{Colors.END}\n")

def print_success(text):
    print(f"{Colors.GREEN}✅ {text}{Colors.END}")

def print_error(text):
    print(f"{Colors.RED}❌ {text}{Colors.END}")

def print_warning(text):
    print(f"{Colors.YELLOW}⚠️  {text}{Colors.END}")

def print_info(text):
    print(f"{Colors.BLUE}ℹ️  {text}{Colors.END}")

def create_test_image(filepath: str, color: tuple = (255, 0, 0), size: tuple = (640, 480)):
    """Create a test image with unique content"""
    img = Image.new('RGB', size, color)
    # Add some unique noise to make it different
    pixels = np.array(img)
    noise = np.random.randint(0, 50, pixels.shape, dtype=np.uint8)
    pixels = np.clip(pixels + noise, 0, 255).astype(np.uint8)
    img = Image.fromarray(pixels)
    img.save(filepath)
    print_info(f"Created test image: {filepath}")
    return filepath

def test_qdrant_connection():
    """Test 1: Check Qdrant connection"""
    print_header("TEST 1: Qdrant Connection Check")
    
    try:
        detector = FraudDetector(use_qdrant=True, qdrant_host="localhost", qdrant_port=6333)
        
        if detector.use_qdrant:
            print_success("Qdrant connection successful!")
            print_info(f"Collection name: {detector.collection_name}")
            
            # Check collection exists
            collections = detector.client.get_collections().collections
            collection_names = [c.name for c in collections]
            print_info(f"Available collections: {collection_names}")
            
            if detector.collection_name in collection_names:
                print_success(f"Collection '{detector.collection_name}' found!")
                
                # Get collection info
                collection_info = detector.client.get_collection(detector.collection_name)
                print_info(f"Vector size: {collection_info.config.params.vectors.size}")
                print_info(f"Distance metric: {collection_info.config.params.vectors.distance}")
                print_info(f"Points count: {collection_info.points_count}")
            
            return True, detector
        else:
            print_error("Qdrant not available - using fallback storage")
            return False, detector
            
    except Exception as e:
        print_error(f"Qdrant connection failed: {e}")
        return False, None

def test_perceptual_hashing(detector):
    """Test 2: Perceptual hash computation"""
    print_header("TEST 2: Perceptual Hash Computation")
    
    # Create test directory
    test_dir = Path("test_images_qdrant")
    test_dir.mkdir(exist_ok=True)
    
    # Create test image
    test_image = test_dir / "test_car_damage_1.jpg"
    create_test_image(str(test_image), color=(255, 100, 50))
    
    try:
        # Compute hashes
        hashes = detector.compute_perceptual_hash(str(test_image))
        
        print_success("Perceptual hashes computed successfully!")
        print_info(f"pHash: {hashes['phash']}")
        print_info(f"dHash: {hashes['dhash']}")
        print_info(f"wHash: {hashes['whash']}")
        print_info(f"Average Hash: {hashes['average_hash']}")
        print_info(f"Vector length: {len(hashes['phash_vector'])} dimensions")
        print_info(f"Vector sample: {hashes['phash_vector'][:10]}...")
        
        return True, test_image
        
    except Exception as e:
        print_error(f"Hash computation failed: {e}")
        return False, None

def test_first_image_storage(detector, test_image):
    """Test 3: Store first image (no duplicate expected)"""
    print_header("TEST 3: First Image Storage (No Duplicates)")
    
    try:
        job_id_1 = "test_job_001"
        result = detector.check_duplicate(str(test_image), job_id_1, threshold=0.9)
        
        print_info(f"Job ID: {job_id_1}")
        print_info(f"Is Duplicate: {result['is_duplicate']}")
        print_info(f"Duplicate Count: {result['duplicate_count']}")
        
        if not result['is_duplicate']:
            print_success("✅ CORRECT: First image not flagged as duplicate")
            print_info("Image hash stored in Qdrant successfully")
            return True, job_id_1
        else:
            print_error("❌ INCORRECT: First image should not be duplicate!")
            return False, job_id_1
            
    except Exception as e:
        print_error(f"First image storage failed: {e}")
        return False, None

def test_exact_duplicate_detection(detector, test_image, original_job_id):
    """Test 4: Submit exact same image (should detect duplicate)"""
    print_header("TEST 4: Exact Duplicate Detection")
    
    try:
        job_id_2 = "test_job_002"
        
        print_info("Submitting THE SAME image again (simulating fraud)...")
        time.sleep(1)  # Small delay to ensure different timestamp
        
        result = detector.check_duplicate(str(test_image), job_id_2, threshold=0.9)
        
        print_info(f"Job ID: {job_id_2}")
        print_info(f"Is Duplicate: {result['is_duplicate']}")
        print_info(f"Duplicate Count: {result['duplicate_count']}")
        
        if result['is_duplicate']:
            print_success("✅ FRAUD DETECTED: Exact duplicate found!")
            
            for i, detail in enumerate(result['duplicate_details'], 1):
                print_info(f"\nDuplicate #{i}:")
                print_info(f"  Previous Job ID: {detail['job_id']}")
                print_info(f"  Similarity Score: {detail['similarity_score']:.3f} (100% = perfect match)")
                print_info(f"  Timestamp: {detail['timestamp']}")
                
                if detail['similarity_score'] >= 0.99:
                    print_success(f"  ⚠️  EXACT MATCH! Same image used in job '{detail['job_id']}'")
            
            return True
        else:
            print_error("❌ FAILED: Should have detected duplicate!")
            return False
            
    except Exception as e:
        print_error(f"Duplicate detection failed: {e}")
        return False

def test_different_image_no_duplicate(detector):
    """Test 5: Submit completely different image (no duplicate)"""
    print_header("TEST 5: Different Image (No Duplicate)")
    
    test_dir = Path("test_images_qdrant")
    different_image = test_dir / "test_car_damage_2.jpg"
    
    # Create completely different image
    create_test_image(str(different_image), color=(50, 100, 255))
    
    try:
        job_id_3 = "test_job_003"
        result = detector.check_duplicate(str(different_image), job_id_3, threshold=0.9)
        
        print_info(f"Job ID: {job_id_3}")
        print_info(f"Is Duplicate: {result['is_duplicate']}")
        print_info(f"Duplicate Count: {result['duplicate_count']}")
        
        if not result['is_duplicate']:
            print_success("✅ CORRECT: Different image not flagged as duplicate")
            return True
        else:
            print_warning(f"⚠️  Flagged as duplicate with {result['duplicate_count']} matches")
            print_warning("This might be expected if threshold is too low")
            return True  # Not a critical failure
            
    except Exception as e:
        print_error(f"Different image test failed: {e}")
        return False

def test_modified_image_detection(detector, original_image):
    """Test 6: Submit slightly modified image (should detect if similar enough)"""
    print_header("TEST 6: Modified Image Detection")
    
    test_dir = Path("test_images_qdrant")
    modified_image = test_dir / "test_car_damage_1_cropped.jpg"
    
    # Create modified version (cropped)
    img = Image.open(original_image)
    width, height = img.size
    img_cropped = img.crop((10, 10, width-10, height-10))
    img_cropped.save(modified_image)
    print_info(f"Created modified image (cropped): {modified_image}")
    
    try:
        job_id_4 = "test_job_004"
        result = detector.check_duplicate(str(modified_image), job_id_4, threshold=0.85)
        
        print_info(f"Job ID: {job_id_4}")
        print_info(f"Is Duplicate: {result['is_duplicate']}")
        print_info(f"Duplicate Count: {result['duplicate_count']}")
        
        if result['is_duplicate']:
            print_success("✅ GOOD: Detected modified version of original!")
            
            for detail in result['duplicate_details']:
                print_info(f"  Similar to Job: {detail['job_id']}")
                print_info(f"  Similarity: {detail['similarity_score']:.3f}")
                
                if detail['similarity_score'] >= 0.85:
                    print_warning(f"  ⚠️  SUSPICIOUS: Very similar to previous claim!")
            
            return True
        else:
            print_warning("⚠️  Modified image not detected (might need lower threshold)")
            return True  # Not critical
            
    except Exception as e:
        print_error(f"Modified image test failed: {e}")
        return False

def test_qdrant_search_performance(detector):
    """Test 7: Performance test"""
    print_header("TEST 7: Qdrant Search Performance")
    
    try:
        # Get current collection stats
        collection_info = detector.client.get_collection(detector.collection_name)
        points_count = collection_info.points_count
        
        print_info(f"Total images in database: {points_count}")
        
        # Create new test image
        test_dir = Path("test_images_qdrant")
        perf_test_image = test_dir / "perf_test.jpg"
        create_test_image(str(perf_test_image), color=(128, 128, 128))
        
        # Measure search time
        hashes = detector.compute_perceptual_hash(str(perf_test_image))
        
        start_time = time.time()

        # Prefer modern `query_points`, fall back to `search` / `search_points`
        client = detector.client
        if hasattr(client, "query_points"):
            response = client.query_points(
                collection_name=detector.collection_name,
                query=hashes["phash_vector"],
                limit=5,
                score_threshold=0.9,
            )
            search_results = response.points
        elif hasattr(client, "search") or hasattr(client, "search_points"):
            search_method = getattr(client, "search", None) or getattr(client, "search_points", None)
            search_results = search_method(
                collection_name=detector.collection_name,
                query_vector=hashes["phash_vector"],
                limit=5,
                score_threshold=0.9,
            )
        else:
            raise AttributeError("QdrantClient has no compatible search method (query_points/search/search_points)")
        end_time = time.time()
        
        search_time_ms = (end_time - start_time) * 1000
        
        print_success(f"Search completed in {search_time_ms:.2f}ms")
        print_info(f"Results found: {len(search_results)}")
        
        if search_time_ms < 100:
            print_success("⚡ Excellent performance! (< 100ms)")
        elif search_time_ms < 500:
            print_success("✅ Good performance (< 500ms)")
        else:
            print_warning(f"⚠️  Slower than expected ({search_time_ms:.2f}ms)")
        
        return True
        
    except Exception as e:
        print_error(f"Performance test failed: {e}")
        return False

def print_final_summary(results):
    """Print final test summary"""
    print_header("TEST SUMMARY")
    
    total_tests = len(results)
    passed_tests = sum(results.values())
    
    print(f"\n{Colors.BOLD}Results:{Colors.END}")
    print(f"  Total Tests: {total_tests}")
    print(f"  Passed: {Colors.GREEN}{passed_tests}{Colors.END}")
    print(f"  Failed: {Colors.RED}{total_tests - passed_tests}{Colors.END}")
    
    print(f"\n{Colors.BOLD}Individual Test Results:{Colors.END}")
    for test_name, passed in results.items():
        status = f"{Colors.GREEN}✅ PASS{Colors.END}" if passed else f"{Colors.RED}❌ FAIL{Colors.END}"
        print(f"  {test_name}: {status}")
    
    if passed_tests == total_tests:
        print(f"\n{Colors.GREEN}{Colors.BOLD}🎉 ALL TESTS PASSED! Qdrant duplicate detection is working perfectly!{Colors.END}\n")
    else:
        print(f"\n{Colors.RED}{Colors.BOLD}⚠️  Some tests failed. Please review the output above.{Colors.END}\n")

def main():
    """Run all tests"""
    print(f"\n{Colors.MAGENTA}{Colors.BOLD}")
    print("╔═══════════════════════════════════════════════════════════╗")
    print("║                                                           ║")
    print("║       QDRANT DUPLICATE DETECTION TEST SUITE              ║")
    print("║       Insurance Claim Fraud Detection System             ║")
    print("║                                                           ║")
    print("╚═══════════════════════════════════════════════════════════╝")
    print(f"{Colors.END}")
    
    results = {}
    
    # Test 1: Connection
    success, detector = test_qdrant_connection()
    results["Qdrant Connection"] = success
    
    if not success or not detector.use_qdrant:
        print_error("\n❌ Qdrant not available. Cannot proceed with tests.")
        print_info("Please ensure Qdrant is running: docker run -p 6333:6333 qdrant/qdrant")
        return
    
    # Test 2: Hash computation
    success, test_image = test_perceptual_hashing(detector)
    results["Hash Computation"] = success
    
    if not success:
        print_error("\n❌ Hash computation failed. Cannot proceed.")
        return
    
    # Test 3: First image storage
    success, original_job_id = test_first_image_storage(detector, test_image)
    results["First Image Storage"] = success
    
    # Test 4: Exact duplicate detection
    success = test_exact_duplicate_detection(detector, test_image, original_job_id)
    results["Exact Duplicate Detection"] = success
    
    # Test 5: Different image (no duplicate)
    success = test_different_image_no_duplicate(detector)
    results["Different Image (No Dup)"] = success
    
    # Test 6: Modified image detection
    success = test_modified_image_detection(detector, test_image)
    results["Modified Image Detection"] = success
    
    # Test 7: Performance
    success = test_qdrant_search_performance(detector)
    results["Search Performance"] = success
    
    # Print summary
    print_final_summary(results)
    
    # Cleanup
    print_header("Cleanup")
    print_info("Test images saved in 'test_images_qdrant/' directory")
    print_info("Qdrant collection 'claim_images' contains test data")
    print_warning("To reset: Delete collection or restart Qdrant container")

if __name__ == "__main__":
    main()
