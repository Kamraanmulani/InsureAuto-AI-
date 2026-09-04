import torch
from transformers import AutoProcessor, LlavaNextForConditionalGeneration, BitsAndBytesConfig

def test_bnb():
    print(f"CUDA available: {torch.cuda.is_available()}")
    if not torch.cuda.is_available():
        return

    model_id = "llava-hf/llava-v1.6-mistral-7b-hf"
    
    quantization_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_compute_dtype=torch.float16
    )
    
    print("Loading model with 4-bit quantization...")
    try:
        model = LlavaNextForConditionalGeneration.from_pretrained(
            model_id,
            quantization_config=quantization_config,
            device_map="cuda:0"
        )
        print("✅ Model loaded successfully!")
        print(f"Model device: {model.device}")
        print(f"Memory footprint: {model.get_memory_footprint() / 1024**3:.2f} GB")
        
    except Exception as e:
        print(f"❌ Error loading model: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_bnb()
