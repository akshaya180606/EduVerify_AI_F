"""
EduVerify-AI: LayoutLMv3 Pretrained Model Downloader

Usage:
    python download_model.py [--model-name microsoft/layoutlmv3-base] [--cache-dir ./models/layoutlmv3]

Requirements:
    pip install torch transformers
"""

import os
import sys
import argparse
import time

def main():
    parser = argparse.ArgumentParser(description="Download LayoutLMv3 model weights for EduVerify-AI")
    parser.add_argument(
        "--model-name",
        type=str,
        default=os.getenv("LAYOUTLMV3_MODEL_NAME", "microsoft/layoutlmv3-base"),
        help="HuggingFace model repository name (default: microsoft/layoutlmv3-base)",
    )
    parser.add_argument(
        "--cache-dir",
        type=str,
        default=os.getenv("LAYOUTLMV3_CACHE_DIR", None),
        help="Optional local cache directory path",
    )
    args = parser.parse_args()

    print(f"=== EduVerify-AI LayoutLMv3 Model Downloader ===")
    print(f"Target Model: {args.model_name}")
    if args.cache_dir:
        print(f"Cache Directory: {args.cache_dir}")
        os.makedirs(args.cache_dir, exist_ok=True)

    try:
        import torch
        from transformers import AutoProcessor, AutoModel
    except ImportError as e:
        print(f"\n[ERROR] Missing required dependencies: {e}")
        print("Please install PyTorch and HuggingFace Transformers first:")
        print("    pip install torch transformers\n")
        sys.exit(1)

    print("\n[1/3] Downloading LayoutLMv3 processor...")
    start_time = time.perf_counter()
    try:
        processor = AutoProcessor.from_pretrained(
            args.model_name,
            apply_ocr=False,
            cache_dir=args.cache_dir,
        )
        print("  ✓ Processor downloaded successfully.")
    except Exception as e:
        print(f"  ✗ Failed to download processor: {e}")
        sys.exit(1)

    print("[2/3] Downloading LayoutLMv3 base model weights (~500 MB)...")
    try:
        model = AutoModel.from_pretrained(
            args.model_name,
            cache_dir=args.cache_dir,
        )
        print("  ✓ Model weights downloaded and verified.")
    except Exception as e:
        print(f"  ✗ Failed to download model weights: {e}")
        sys.exit(1)

    elapsed = time.perf_counter() - start_time
    print(f"[3/3] Complete!")
    print(f"  Model Architecture: {model.config.model_type}")
    print(f"  Hidden Size: {model.config.hidden_size}")
    print(f"  Total Duration: {elapsed:.2f}s")
    print("\nModel is ready for offline inference with python-service.")

if __name__ == "__main__":
    main()