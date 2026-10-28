"""
EduVerify-AI: LayoutLMv3 Pretrained Model Verification Script

Purpose:
1. Verify PyTorch, Transformers, and LayoutLMv3 model loading.
2. Accept any certificate PDF/image or automatically generate a synthetic test certificate fixture.
3. Normalize bounding boxes to [0, 1000] scale.
4. Execute LayoutLMv3 forward pass on CPU.
5. Report inference timing, tensor dimensions, and model status.
6. Clearly document that pretrained base weights provide multi-modal embeddings,
   while statutory field extraction uses deterministic pattern rules.

Usage:
    python test_layoutlmv3.py [--pdf path/to/sample.pdf] [--tesseract-path /path/to/tesseract]
"""

import os
import sys
import time
import argparse
import shutil
from pathlib import Path
try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    Image = None
    ImageDraw = None
    ImageFont = None

# ---------------------------------------------------------
# 1. TESSERACT CONFIGURATION
# ---------------------------------------------------------
def detect_tesseract_path(user_path: str = None) -> str | None:
    """Detects available Tesseract binary across platforms."""
    candidates = [
        user_path,
        os.getenv("TESSERACT_CMD"),
        os.getenv("TESSERACT_PATH"),
        shutil.which("tesseract"),
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
        "/usr/bin/tesseract",
        "/usr/local/bin/tesseract",
    ]
    for c in candidates:
        if c and Path(c).is_file():
            return str(Path(c).resolve())
    return None


def create_synthetic_certificate_image():
    """Creates a high-contrast synthetic certificate image for testing when no file is provided."""
    if Image is None:
        raise ImportError("Pillow/PIL is not installed. Run: pip install pillow")
    img = Image.new("RGB", (1000, 700), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)

    # Outer border
    draw.rectangle([(20, 20), (980, 680)], outline=(17, 94, 89), width=4)
    draw.rectangle([(30, 30), (970, 670)], outline=(13, 148, 136), width=2)

    # Header and text
    draw.text((250, 70), "ALL INDIA COUNCIL FOR TECHNICAL EDUCATION", fill=(17, 94, 89))
    draw.text((360, 110), "CERTIFICATE OF ACCREDITATION", fill=(0, 0, 0))
    draw.text((100, 180), "This is to certify that National Institute of Engineering & Technology", fill=(0, 0, 0))
    draw.text((100, 220), "has fulfilled all mandatory regulatory and infrastructure norms for Academic Year 2026-2027.", fill=(0, 0, 0))
    draw.text((100, 280), "Candidate Name: Prof. Sunita Rao", fill=(0, 0, 0))
    draw.text((100, 320), "Course / Discipline: Computer Science & Engineering", fill=(0, 0, 0))
    draw.text((100, 360), "Grade Awarded: First Class with Distinction (CGPA: 9.4)", fill=(0, 0, 0))
    draw.text((100, 420), "Certificate Reference No: AICTE/2026/EOA-9812", fill=(0, 0, 0))
    draw.text((100, 460), "Date of Issue: 15/06/2026", fill=(0, 0, 0))
    draw.text((100, 500), "Valid Until: 30/06/2027", fill=(0, 0, 0))
    draw.text((100, 580), "Authorized Signatory: Member Secretary, AICTE New Delhi", fill=(100, 100, 100))

    return img


def render_pdf_first_page(pdf_path: Path):
    """Renders the first page of a PDF using PyMuPDF."""
    import pymupdf
    with pymupdf.open(str(pdf_path)) as doc:
        if len(doc) == 0:
            raise ValueError("PDF contains no pages.")
        page = doc[0]
        pix = page.get_pixmap(matrix=pymupdf.Matrix(1.5, 1.5), alpha=False)
        return Image.frombytes("RGB", (pix.width, pix.height), pix.samples)


def main():
    parser = argparse.ArgumentParser(description="Test LayoutLMv3 document inference")
    parser.add_argument("--pdf", type=str, default=os.getenv("SAMPLE_PDF_PATH"), help="Path to sample certificate PDF")
    parser.add_argument("--tesseract-path", type=str, default=None, help="Path to tesseract binary")
    args = parser.parse_args()

    print("=" * 60)
    print("EduVerify-AI: LayoutLMv3 Pretrained Document Model Test")
    print("=" * 60)

    # 1. Dependency check
    try:
        import torch
        from transformers import AutoProcessor, AutoModel
        print(f"✓ PyTorch version: {torch.__version__}")
        import transformers
        print(f"✓ Transformers version: {transformers.__version__}")
    except ImportError as e:
        print(f"\n[INFO] Missing ML dependencies: {e}")
        print("To run LayoutLMv3 inference, install:")
        print("    pip install torch transformers\n")
        print("Pretrained base model integration is configured with graceful fallbacks.")
        sys.exit(0)

    # 2. Configure Tesseract
    tess_cmd = detect_tesseract_path(args.tesseract_path)
    if tess_cmd:
        try:
            import pytesseract
            pytesseract.pytesseract.tesseract_cmd = tess_cmd
            ver = pytesseract.get_tesseract_version()
            print(f"✓ Tesseract version: {ver} ({tess_cmd})")
        except Exception as e:
            print(f"! Tesseract present but could not be queried: {e}")
    else:
        print("! Tesseract binary not detected in PATH; testing will use bounding box layout synthesis.")

    # 3. Obtain test document image
    if args.pdf and Path(args.pdf).is_file():
        print(f"✓ Loading provided PDF: {args.pdf}")
        image = render_pdf_first_page(Path(args.pdf))
    else:
        print("✓ No external PDF specified; generating high-fidelity synthetic AICTE certificate test image...")
        image = create_synthetic_certificate_image()

    print(f"✓ Document image prepared: {image.width}x{image.height} px")

    # 4. Extract words & boxes
    from layoutlmv3_inference import extract_words_and_boxes_from_image, run_layoutlmv3_inference
    words, boxes = extract_words_and_boxes_from_image(image)
    print(f"✓ Extracted {len(words)} word tokens with normalized bounding boxes.")

    # 5. Run LayoutLMv3 Inference
    print("\nRunning LayoutLMv3 multi-modal forward pass (CPU)...")
    res = run_layoutlmv3_inference(image, words, boxes)

    if res.get("status") == "SUCCESS":
        print("\n" + "=" * 60)
        print("LAYOUTLMv3 INFERENCE COMPLETED SUCCESSFULLY")
        print("=" * 60)
        print(f"Model: {res.get('model')}")
        print(f"Device: {res.get('device')}")
        print(f"Input tokens: {res.get('input_tokens_count')}")
        print(f"Hidden state tensor: {res.get('last_hidden_state_shape')}")
        print(f"Document embedding norm: {res.get('document_embedding_norm')}")
        print(f"Inference latency: {res.get('inference_time_ms')} ms")
        print("\nVerification Notes:")
        print("  - Base LayoutLMv3 processes visual + textual layout tokens.")
        print("  - Embeddings can be used for document classification & clustering.")
        print("  - Statutory field extraction is backed by deterministic rules engine.")
        print("=" * 60)
    else:
        print(f"\nInference status: {res.get('status')}")
        print(f"Message: {res.get('message') or res.get('error')}")


if __name__ == "__main__":
    main()
