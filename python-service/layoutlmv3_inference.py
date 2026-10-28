"""
EduVerify-AI: Modular LayoutLMv3 Pretrained Document Understanding Integration

Purpose:
- Provides CPU-compatible multi-modal (visual + text + layout) feature extraction.
- Prepares normalized 0-1000 bounding boxes from OCR or embedded text tokens.
- Loads model weights lazily or on-demand without blocking service startup.
- Handles missing PyTorch / Transformers / network dependencies with graceful degradation.
- Honestly reports model capabilities: base model generates token and layout embeddings;
  statutory field extraction uses deterministic regex and validation rules as the authoritative baseline.
"""

import os
import time
import logging
from typing import Optional, Dict, Any, List, Tuple
from pathlib import Path
try:
    from PIL import Image
except ImportError:
    Image = None

logger = logging.getLogger("eduverify-ocr.layoutlmv3")

MODEL_NAME = os.getenv("LAYOUTLMV3_MODEL_NAME", "microsoft/layoutlmv3-base")
MODEL_CACHE_DIR = os.getenv("LAYOUTLMV3_CACHE_DIR", None)

_processor = None
_model = None
_device = None
_model_load_error = None
_is_loaded = False


def check_dependencies() -> Dict[str, Any]:
    """Check if PyTorch and HuggingFace Transformers are installed."""
    torch_installed = False
    transformers_installed = False
    torch_version = None
    transformers_version = None

    try:
        import torch
        torch_installed = True
        torch_version = torch.__version__
    except ImportError:
        pass

    try:
        import transformers
        transformers_installed = True
        transformers_version = transformers.__version__
    except ImportError:
        pass

    return {
        "torch_available": torch_installed,
        "torch_version": torch_version,
        "transformers_available": transformers_installed,
        "transformers_version": transformers_version,
        "ready": torch_installed and transformers_installed,
    }


def load_layoutlmv3(force_reload: bool = False) -> Tuple[Optional[Any], Optional[Any], Optional[str]]:
    """
    Lazily loads the pretrained LayoutLMv3 model and processor.
    Returns (processor, model, error_message).
    """
    global _processor, _model, _device, _model_load_error, _is_loaded

    if _is_loaded and not force_reload:
        return _processor, _model, None

    deps = check_dependencies()
    if not deps["ready"]:
        _model_load_error = (
            "LayoutLMv3 requires 'torch' and 'transformers'. "
            "Install with: pip install torch transformers"
        )
        logger.info(_model_load_error)
        return None, None, _model_load_error

    try:
        import torch
        from transformers import AutoProcessor, AutoModel

        logger.info(f"Loading LayoutLMv3 processor & model ({MODEL_NAME})...")
        start = time.perf_counter()

        _processor = AutoProcessor.from_pretrained(
            MODEL_NAME,
            apply_ocr=False,
            cache_dir=MODEL_CACHE_DIR,
        )

        _model = AutoModel.from_pretrained(
            MODEL_NAME,
            cache_dir=MODEL_CACHE_DIR,
        )
        _model.eval()

        # Target CPU by default for broad compatibility
        _device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        _model.to(_device)

        _is_loaded = True
        _model_load_error = None
        elapsed = time.perf_counter() - start
        logger.info(f"LayoutLMv3 successfully loaded on {_device} in {elapsed:.2f}s")
        return _processor, _model, None

    except Exception as exc:
        _model_load_error = f"Failed to load LayoutLMv3 ({MODEL_NAME}): {str(exc)}"
        logger.warning(_model_load_error)
        _processor = None
        _model = None
        _is_loaded = False
        return None, None, _model_load_error


def normalize_box(box: List[int], width: int, height: int) -> List[int]:
    """Normalize pixel coordinates [left, top, right, bottom] to range [0, 1000]."""
    x0 = max(0, min(1000, round(1000 * box[0] / width)))
    y0 = max(0, min(1000, round(1000 * box[1] / height)))
    x1 = max(0, min(1000, round(1000 * box[2] / width)))
    y1 = max(0, min(1000, round(1000 * box[3] / height)))
    # Ensure valid box ordering
    x1 = max(x0, x1)
    y1 = max(y0, y1)
    return [x0, y0, x1, y1]


def extract_words_and_boxes_from_image(image: Any) -> Tuple[List[str], List[List[int]]]:
    """
    Extract word tokens and normalized 0-1000 bounding boxes from an image using Tesseract or fallback.
    """
    words = []
    boxes = []
    width, height = image.size

    try:
        import pytesseract
        from pytesseract import Output

        ocr_data = pytesseract.image_to_data(
            image,
            output_type=Output.DICT,
            config="--psm 3",
        )

        for i, raw_word in enumerate(ocr_data.get("text", [])):
            word = str(raw_word).strip()
            if not word:
                continue
            left = int(ocr_data["left"][i])
            top = int(ocr_data["top"][i])
            w = int(ocr_data["width"][i])
            h = int(ocr_data["height"][i])
            if w <= 0 or h <= 0:
                continue

            normalized = normalize_box([left, top, left + w, top + h], width, height)
            words.append(word)
            boxes.append(normalized)

    except Exception as exc:
        logger.warning(f"Could not extract word boxes via Tesseract ({exc}); using full-image box fallback.")
        words = ["DOCUMENT_CONTENT"]
        boxes = [[0, 0, 1000, 1000]]

    if not words:
        words = ["EMPTY_DOCUMENT"]
        boxes = [[0, 0, 1000, 1000]]

    return words, boxes


def run_layoutlmv3_inference(
    image: Any,
    words: Optional[List[str]] = None,
    boxes: Optional[List[List[int]]] = None,
) -> Dict[str, Any]:
    """
    Executes LayoutLMv3 multi-modal forward pass.
    Returns feature representation summary, token statistics, and timing.
    """
    deps = check_dependencies()
    if not deps["ready"]:
        return {
            "status": "UNAVAILABLE",
            "model": MODEL_NAME,
            "message": "PyTorch or HuggingFace Transformers not installed in current environment.",
            "instructions": "Run: pip install torch transformers torchvision",
            "is_mock": False,
        }

    processor, model, error = load_layoutlmv3()
    if error or not processor or not model:
        return {
            "status": "ERROR",
            "model": MODEL_NAME,
            "message": error or "Model could not be initialized.",
            "is_mock": False,
        }

    import torch

    start_time = time.perf_counter()

    # If words and boxes are not supplied, extract them from image
    if not words or not boxes:
        words, boxes = extract_words_and_boxes_from_image(image)

    # Ensure RGB
    if image.mode != "RGB":
        image = image.convert("RGB")

    try:
        inputs = processor(
            images=image,
            text=words,
            boxes=boxes,
            return_tensors="pt",
            truncation=True,
            padding="max_length",
            max_length=512,
        )

        inputs = {k: v.to(_device) for k, v in inputs.items()}

        with torch.inference_mode():
            outputs = model(**inputs)

        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
        hidden_shape = list(outputs.last_hidden_state.shape)
        # Compute mean pooled representation vector norm as a document visual-textual fingerprint
        mean_embedding = outputs.last_hidden_state.mean(dim=1).squeeze().cpu().numpy()
        embedding_norm = float(torch.norm(torch.tensor(mean_embedding)).item())

        return {
            "status": "SUCCESS",
            "model": MODEL_NAME,
            "device": str(_device),
            "input_tokens_count": len(words),
            "processed_tensor_tokens": hidden_shape[1],
            "hidden_dimension": hidden_shape[2],
            "last_hidden_state_shape": hidden_shape,
            "document_embedding_norm": round(embedding_norm, 4),
            "inference_time_ms": elapsed_ms,
            "task_clarification": (
                "LayoutLMv3 base model produces visual-textual multi-modal representations. "
                "Downstream token classification (fine-tuned on FUNSD/CORD) is required for automated "
                "named-entity sequence labeling; rule-based extraction serves as the authoritative baseline."
            ),
        }

    except Exception as exc:
        logger.exception("LayoutLMv3 inference failed")
        return {
            "status": "INFERENCE_FAILED",
            "model": MODEL_NAME,
            "error": str(exc),
            "is_mock": False,
        }


def get_layoutlmv3_status() -> Dict[str, Any]:
    """Provides public status and capabilities report for API health checks."""
    deps = check_dependencies()
    return {
        "configured_model": MODEL_NAME,
        "is_loaded": _is_loaded,
        "device": str(_device) if _device else "unassigned",
        "dependencies": deps,
        "last_error": _model_load_error,
        "architecture": "microsoft/layoutlmv3-base (Multi-modal Document Understanding Transformer)",
        "capabilities": [
            "Visual document feature extraction",
            "Bounding box normalized 0-1000 representation",
            "Token layout multi-modal cross-attention",
        ],
        "statutory_extraction_baseline": "Deterministic regex and pattern heuristics (active)",
    }
