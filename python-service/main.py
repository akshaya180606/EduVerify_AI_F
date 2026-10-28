
"""
EduVerify-AI OCR and Statutory Field Extraction Microservice

Features:
- FastAPI REST API
- PDF text extraction using PyMuPDF
- Tesseract OCR fallback for scanned PDF pages
- OCR support for common image formats
- OpenCV image preprocessing
- Improved statutory field extraction
- SHA-256 document checksum
- Per-page OCR confidence
- Health-check endpoint

Run:
    python -m uvicorn main:app --host 0.0.0.0 --port 5005 --reload
"""

import hashlib
import io
import logging
import os
import re
import shutil
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import cv2
import numpy as np
import pymupdf
import pytesseract

from fastapi import FastAPI, File, HTTPException, UploadFile, Query
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ImageOps, UnidentifiedImageError
from pytesseract import Output

import layoutlmv3_inference

# ============================================================
# CONFIGURATION & MULTI-PLATFORM TESSERACT DETECTION
# ============================================================

APP_NAME = "EduVerify-AI OCR Microservice"
APP_VERSION = "1.2.0"

MAX_FILE_SIZE = 50 * 1024 * 1024
MIN_EMBEDDED_TEXT_LENGTH = 25
PDF_RENDER_DPI = 250

def detect_tesseract_cmd() -> str | None:
    """Detects available Tesseract binary across Linux, macOS, and Windows."""
    candidates = [
        os.getenv("TESSERACT_CMD"),
        os.getenv("TESSERACT_PATH"),
        shutil.which("tesseract"),
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
        r"D:\tesseract\tesseract.exe",
        "/usr/bin/tesseract",
        "/usr/local/bin/tesseract",
    ]
    for c in candidates:
        if c and Path(c).is_file():
            pytesseract.pytesseract.tesseract_cmd = str(Path(c).resolve())
            return str(Path(c).resolve())
    return None

TESSERACT_PATH = detect_tesseract_cmd()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)

logger = logging.getLogger("eduverify-ocr")

SUPPORTED_EXTENSIONS = {
    ".pdf",
    ".png",
    ".jpg",
    ".jpeg",
    ".tif",
    ".tiff",
    ".bmp",
    ".webp",
}


# ============================================================
# FASTAPI APPLICATION
# ============================================================

app = FastAPI(
    title=APP_NAME,
    description=(
        "OCR, statutory-field extraction, and LayoutLMv3 multi-modal "
        "document understanding for educational and institutional verification."
    ),
    version=APP_VERSION,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# HEALTH & MODEL STATUS ENDPOINTS
# ============================================================

@app.get("/")
def root() -> dict[str, Any]:
    return {
        "service": APP_NAME,
        "version": APP_VERSION,
        "status": "running",
        "docs": "/docs",
        "model_status_endpoint": "/api/model/status",
    }


@app.get("/health")
def health() -> dict[str, Any]:
    tesseract_available = False
    tesseract_version = "unavailable"
    tesseract_error = None

    try:
        tesseract_version = str(pytesseract.get_tesseract_version())
        tesseract_available = True
    except Exception as exc:
        tesseract_error = str(exc)

    pymupdf_version = getattr(pymupdf, "__version__", "1.24.0")
    layout_status = layoutlmv3_inference.get_layoutlmv3_status()

    return {
        "status": "UP" if tesseract_available else "degraded",
        "service": "eduverify-ocr-fastapi",
        "name": APP_NAME,
        "version": APP_VERSION,
        "tesseract_available": tesseract_available,
        "tesseract_version": tesseract_version,
        "tesseract_path": TESSERACT_PATH,
        "tesseract_error": tesseract_error,
        "pymupdf_available": True,
        "pymupdf_version": pymupdf_version,
        "layoutlmv3": layout_status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/model/status")
def get_model_status() -> dict[str, Any]:
    """Returns LayoutLMv3 model loading state, hardware device, and capabilities."""
    return layoutlmv3_inference.get_layoutlmv3_status()


@app.post("/api/model/inference")
async def run_model_inference(
    file: UploadFile = File(...),
) -> dict[str, Any]:
    """Executes LayoutLMv3 multi-modal forward pass on uploaded document."""
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    filename = file.filename or "uploaded_doc"
    ext = Path(filename).suffix.lower()

    if ext == ".pdf":
        doc = pymupdf.open(stream=file_bytes, filetype="pdf")
        if len(doc) == 0:
            raise HTTPException(status_code=400, detail="PDF contains no pages.")
        page = doc[0]
        pix = page.get_pixmap(matrix=pymupdf.Matrix(1.5, 1.5), alpha=False)
        img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        doc.close()
    else:
        try:
            img = Image.open(io.BytesIO(file_bytes)).convert("RGB")
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Invalid image format: {exc}")

    return layoutlmv3_inference.run_layoutlmv3_inference(img)


# ============================================================
# TEXT UTILITIES
# ============================================================

def normalize_text(text: str) -> str:
    """Normalize whitespace while preserving OCR field separators."""

    text = text.replace("\x00", " ")
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = text.replace("\u00a0", " ")
    text = text.replace("\u2013", "-").replace("\u2014", "-")

    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n[ \t]+", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()


def calculate_sha256(data: bytes) -> str:
    """Calculate the SHA-256 checksum of the original document."""

    return hashlib.sha256(data).hexdigest()


def clean_field_value(value: str | None) -> str | None:
    """Remove surrounding whitespace and OCR separator characters."""

    if value is None:
        return None

    value = value.strip()
    value = re.sub(r"^[\s:;,\-|_]+", "", value)
    value = re.sub(r"[\s:;,\-|_]+$", "", value)
    value = re.sub(r"\s+", " ", value)

    return value or None


def extract_regex_field(
    patterns: list[str],
    text: str,
) -> str | None:
    """
    Try multiple patterns in order.

    If a capturing group exists, return the first captured value.
    Otherwise, return the complete match.
    """

    for pattern in patterns:
        try:
            match = re.search(
                pattern,
                text,
                flags=re.IGNORECASE | re.MULTILINE,
            )

            if not match:
                continue

            value = (
                match.group(1)
                if match.lastindex
                else match.group(0)
            )

            value = clean_field_value(value)

            if value:
                return value

        except (re.error, IndexError) as exc:
            logger.warning("Regex extraction failed: %s", exc)

    return None


# ============================================================
# DATE PATTERNS
# ============================================================

MONTH_PATTERN = (
    r"(?:January|February|March|April|May|June|July|"
    r"August|September|October|November|December|"
    r"Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)"
)

DATE_PATTERN = (
    rf"(?:"
    rf"\d{{1,2}}\s+{MONTH_PATTERN}\s+\d{{4}}"
    rf"|{MONTH_PATTERN}\s+\d{{1,2}},?\s+\d{{4}}"
    rf"|\d{{1,2}}[/-]\d{{1,2}}[/-]\d{{2,4}}"
    rf"|\d{{4}}[/-]\d{{1,2}}[/-]\d{{1,2}}"
    rf")"
)


# ============================================================
# IMAGE PREPROCESSING
# ============================================================

def preprocess_image_variants(
    image: Image.Image,
) -> list[tuple[str, Image.Image]]:
    """Generate image variants for OCR."""

    image = ImageOps.exif_transpose(image).convert("RGB")

    variants = [("original", image)]

    rgb = np.array(image)
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)

    clahe = cv2.createCLAHE(
        clipLimit=2.0,
        tileGridSize=(8, 8),
    )

    enhanced = clahe.apply(gray)

    height, width = enhanced.shape

    if max(height, width) < 1400:
        scale = min(2.0, 1400 / max(height, width))

        if scale > 1:
            enhanced = cv2.resize(
                enhanced,
                None,
                fx=scale,
                fy=scale,
                interpolation=cv2.INTER_CUBIC,
            )

    variants.append(
        (
            "grayscale_enhanced",
            Image.fromarray(enhanced),
        )
    )

    thresholded = cv2.adaptiveThreshold(
        enhanced,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        31,
        11,
    )

    variants.append(
        (
            "adaptive_threshold",
            Image.fromarray(thresholded),
        )
    )

    return variants


# ============================================================
# TESSERACT OCR
# ============================================================

def validate_tesseract() -> None:
    """Ensure that Tesseract is installed and accessible."""

    try:
        pytesseract.get_tesseract_version()

    except Exception as exc:
        raise RuntimeError(
            "Tesseract OCR is unavailable. Check TESSERACT_PATH "
            "and your Tesseract installation."
        ) from exc


def run_ocr_once(
    image: Image.Image,
    config: str = "--oem 3 --psm 6",
) -> tuple[str, float]:
    """Run Tesseract and calculate average word confidence."""

    validate_tesseract()

    data = pytesseract.image_to_data(
        image,
        output_type=Output.DICT,
        config=config,
    )

    words = []
    confidence_values = []

    for index, word in enumerate(data.get("text", [])):
        word = str(word).strip()

        if not word:
            continue

        words.append(word)

        try:
            confidence = float(data["conf"][index])

            if confidence >= 0:
                confidence_values.append(confidence)

        except (ValueError, TypeError, IndexError):
            pass

    text = normalize_text(" ".join(words))

    confidence = (
        round(sum(confidence_values) / len(confidence_values), 2)
        if confidence_values
        else 0.0
    )

    return text, confidence


def perform_ocr(
    image: Image.Image,
) -> tuple[str, float, str]:
    """OCR all preprocessing variants and select a candidate."""

    best_text = ""
    best_confidence = 0.0
    best_variant = "none"
    best_score = -1.0

    for variant_name, variant_image in preprocess_image_variants(image):
        try:
            text, confidence = run_ocr_once(variant_image)

            score = min(len(text), 3000) * 0.02 + confidence * 0.8

            if score > best_score:
                best_text = text
                best_confidence = confidence
                best_variant = variant_name
                best_score = score

        except Exception as exc:
            logger.warning(
                "OCR variant %s failed: %s",
                variant_name,
                exc,
            )

    return best_text, best_confidence, best_variant


# ============================================================
# PDF EXTRACTION
# ============================================================

def extract_pdf(
    file_bytes: bytes,
) -> tuple[str, list[dict[str, Any]], list[str]]:
    """Extract digital PDF text and OCR scanned pages."""

    page_texts = []
    page_results = []
    warnings = []

    try:
        document = pymupdf.open(
            stream=file_bytes,
            filetype="pdf",
        )

    except Exception as exc:
        raise ValueError(
            "Unable to open the PDF. It may be corrupted "
            "or password-protected."
        ) from exc

    try:
        if document.needs_pass:
            raise ValueError(
                "Password-protected PDFs are not supported."
            )

        if document.page_count == 0:
            raise ValueError("The PDF contains no pages.")

        for page_index, page in enumerate(document):
            page_number = page_index + 1

            embedded_text = normalize_text(page.get_text("text"))

            if len(embedded_text) >= MIN_EMBEDDED_TEXT_LENGTH:
                page_text = embedded_text
                confidence = 100.0
                engine = "pymupdf"
                preprocessing = "embedded_text"

            else:
                try:
                    scale = PDF_RENDER_DPI / 72.0

                    pixmap = page.get_pixmap(
                        matrix=pymupdf.Matrix(scale, scale),
                        alpha=False,
                    )

                    image_bytes = pixmap.tobytes("png")

                    with Image.open(io.BytesIO(image_bytes)) as image:
                        image.load()

                        (
                            page_text,
                            confidence,
                            preprocessing,
                        ) = perform_ocr(image.copy())

                    engine = "pymupdf+tesseract"

                    if not page_text and embedded_text:
                        page_text = embedded_text
                        engine = "pymupdf"

                except Exception as exc:
                    logger.exception(
                        "OCR failed on PDF page %s",
                        page_number,
                    )

                    warnings.append(
                        f"OCR failed on page {page_number}."
                    )

                    page_text = embedded_text
                    confidence = 0.0
                    engine = "pymupdf"
                    preprocessing = "embedded_text_fallback"

            page_text = normalize_text(page_text)
            page_texts.append(page_text)

            page_results.append(
                {
                    "page": page_number,
                    "text": page_text,
                    "confidence": round(confidence, 2),
                    "engine": engine,
                    "preprocessing": preprocessing,
                }
            )

    finally:
        document.close()

    return (
        normalize_text("\n\n".join(page_texts)),
        page_results,
        warnings,
    )


# ============================================================
# IMAGE EXTRACTION
# ============================================================

def extract_image(
    file_bytes: bytes,
) -> tuple[str, list[dict[str, Any]], list[str]]:
    """Extract text from an image."""

    try:
        with Image.open(io.BytesIO(file_bytes)) as image:
            image.load()
            image_copy = image.copy()

    except (UnidentifiedImageError, OSError) as exc:
        raise ValueError(
            "The uploaded file is not a supported image."
        ) from exc

    text, confidence, preprocessing = perform_ocr(image_copy)
    text = normalize_text(text)

    warnings = []

    if not text:
        warnings.append("No readable text detected.")

    pages = [
        {
            "page": 1,
            "text": text,
            "confidence": round(confidence, 2),
            "engine": "tesseract",
            "preprocessing": preprocessing,
        }
    ]

    return text, pages, warnings


# ============================================================
# REFERENCE NUMBER EXTRACTION
# ============================================================

def extract_reference_number(text: str) -> str | None:
    """Extract reference numbers such as SEA/ENR/2026/0148."""

    labelled_patterns = [
        (
            r"\b(?:Reference\s*(?:Number|No\.?)?|"
            r"Ref\.?\s*(?:Number|No\.?)?|"
            r"Certificate\s*(?:Number|No\.?)?|"
            r"Registration\s*(?:Number|No\.?)?|"
            r"Enrollment\s*(?:Number|No\.?)?|"
            r"Enrolment\s*(?:Number|No\.?)?)"
            r"\s*[|:#=-]?\s*"
            r"([A-Z0-9][A-Z0-9./_-]{3,39})"
        ),
    ]

    result = extract_regex_field(labelled_patterns, text)

    if result:
        return result

    # Generic slash-delimited identifiers.
    match = re.search(
        r"\b("
        r"[A-Z][A-Z0-9-]{1,12}"
        r"(?:/[A-Z0-9-]{1,20}){2,5}"
        r")\b",
        text,
        flags=re.IGNORECASE,
    )

    if match and any(ch.isdigit() for ch in match.group(1)):
        return match.group(1)

    # Hyphen-delimited identifiers.
    match = re.search(
        r"\b([A-Z]{2,10}-\d{2,4}-\d{3,12})\b",
        text,
        flags=re.IGNORECASE,
    )

    return match.group(1) if match else None


# ============================================================
# ISSUE DATE EXTRACTION
# ============================================================

def extract_issue_date(text: str) -> str | None:
    """Extract a labelled issue date or a likely unlabelled date."""

    patterns = [
        rf"\b(?:Date\s+of\s+Issue|Issue\s+Date|"
        rf"Issued\s+On|Date\s+Issued|Certificate\s+Date)"
        rf"\s*[|:=-]?\s*({DATE_PATTERN})"
    ]

    result = extract_regex_field(patterns, text)

    if result:
        return result

    # Exclude dates belonging to an expiry/validity label.
    expiry_dates = set()

    expiry_pattern = (
        rf"\b(?:Valid\s+Until|Valid\s+Through|Expiry\s+Date|"
        rf"Expiration\s+Date|Expires\s+On|Date\s+of\s+Expiry)"
        rf"\s*[|:=-]?\s*({DATE_PATTERN})"
    )

    for match in re.finditer(
        expiry_pattern,
        text,
        flags=re.IGNORECASE,
    ):
        expiry_dates.add(match.group(1).lower())

    for match in re.finditer(
        DATE_PATTERN,
        text,
        flags=re.IGNORECASE,
    ):
        candidate = match.group(0).strip()

        if candidate.lower() not in expiry_dates:
            return candidate

    return None


# ============================================================
# EXPIRY DATE EXTRACTION
# ============================================================

def extract_expiry_date(text: str) -> str | None:
    """Extract expiry dates, including values separated by |."""

    patterns = [
        rf"\b(?:Valid\s+Until|Valid\s+Through|"
        rf"Expiry\s+Date|Expiration\s+Date|Expires\s+On|"
        rf"Date\s+of\s+Expiry|Validity\s+Until)"
        rf"\s*[|:=-]?\s*({DATE_PATTERN})"
    ]

    return extract_regex_field(patterns, text)


# ============================================================
# INSTITUTION NAME EXTRACTION
# ============================================================


def extract_institution_name(text: str) -> str | None:
    """Extract the institution name without unrelated introductory text."""

    # Prefer the institution's distinctive name.
    # This pattern handles uppercase names embedded in a long OCR line.
    patterns = [
        r"\b(EDUCATION\s*&\s*SKILLS\s+ACADEMY)\b",
        r"\b([A-Z][A-Z0-9&.' -]{2,70}\s+ACADEMY)\b",
        r"\b([A-Z][A-Z0-9&.' -]{2,70}\s+UNIVERSITY)\b",
        r"\b([A-Z][A-Z0-9&.' -]{2,70}\s+COLLEGE)\b",
        r"\b([A-Z][A-Z0-9&.' -]{2,70}\s+POLYTECHNIC)\b",
        r"\b([A-Z][A-Z0-9&.' -]{2,70}\s+INSTITUTE)\b",
    ]

    for pattern in patterns:
        match = re.search(pattern, text)

        if match:
            return match.group(1).strip()

    # Try explicitly labelled fields.
    labelled_patterns = [
        r"\b(?:Institution|Organization|Organisation|"
        r"College|University|School)\s+Name\s*[|:=-]\s*"
        r"([^|\n]{3,100}?)"
        r"(?=\s*(?:\||\n|$))",
    ]

    result = extract_regex_field(labelled_patterns, text)

    if result:
        return result.strip(" |:-")

    return None



# ============================================================
# ISSUING AUTHORITY EXTRACTION
# ============================================================

def extract_issuing_authority(text: str) -> str | None:
    """Extract the authority from labelled or role-based text."""

    # The lookahead stops at the next field label or separator.
    labelled_patterns = [
        (
            r"\bIssuing\s+Authority\s*[|:=-]\s*"
            r"(.{3,120}?)"
            r"(?=\s*(?:\||\n|Institution\s+Address\b|"
            r"Academic\s+Year\b|Reference\s+Number\b|"
            r"Date\s+of\s+Issue\b|Valid\s+Until\b|$))"
        ),
    ]

    result = extract_regex_field(labelled_patterns, text)

    if result:
        return result.strip(" |:-")

    # Handles "Registrar, Sample Institution" when it appears
    # without a field label.
    role_pattern = (
        r"\b("
        r"(?:Registrar|Principal|Director|Dean|Secretary|"
        r"Commissioner|Controller\s+of\s+Examinations)"
        r"\s*,\s*[A-Z][A-Za-z0-9&.,'()\- ]{2,100}"
        r")"
        r"(?=\s*(?:\||\n|Institution\s+Address\b|$))"
    )

    result = extract_regex_field([role_pattern], text)

    if result:
        return result.strip(" |:-")

    return None


# ============================================================
# ADDRESS EXTRACTION
# ============================================================

def extract_address(text: str) -> str | None:
    """Extract only the address value, stopping at the next field."""

    patterns = [
        (
            r"\bInstitution\s+Address\s*[|:=-]\s*"
            r"(.{8,250}?)"
            r"(?=\s*(?:\||\n|This\s+document\b|"
            r"Authorized\s+Signatory\b|Authorised\s+Signatory\b|"
            r"Institution\s+Seal\b|NOT\s+VALID\b|$))"
        ),
        (
            r"\bRegistered\s+Address\s*[|:=-]\s*"
            r"(.{8,250}?)"
            r"(?=\s*(?:\||\n|This\s+document\b|$))"
        ),
        (
            r"\bOffice\s+Address\s*[|:=-]\s*"
            r"(.{8,250}?)"
            r"(?=\s*(?:\||\n|This\s+document\b|$))"
        ),
        (
            r"\bAddress\s*[|:=-]\s*"
            r"(.{8,250}?)"
            r"(?=\s*(?:\||\n|This\s+document\b|$))"
        ),
    ]

    result = extract_regex_field(patterns, text)

    if result:
        return result.strip(" |:-")

    return None


# ============================================================
# ACADEMIC YEAR EXTRACTION
# ============================================================

def extract_academic_year(text: str) -> str | None:
    """Extract an academic-year range such as 2026 - 2027."""

    patterns = [
        (
            r"\bAcademic\s+Year\s*[|:=-]?\s*"
            r"(20\d{2}\s*[-/]\s*(?:20)?\d{2})"
        ),
        (
            r"\b(20\d{2}\s*[-/]\s*(?:20)?\d{2})\b"
        ),
    ]

    return extract_regex_field(patterns, text)


# ============================================================
# STATUTORY FIELD EXTRACTION: CANDIDATE, PROGRAMME & MARKS
# ============================================================

def extract_student_name(text: str) -> str | None:
    """Extract candidate/student/awardee name from certificate or transcript."""
    patterns = [
        r"\b(?:This\s+is\s+to\s+certify\s+that|Certify\s+that|Certified\s+that)\s+(?:Mr\.?|Ms\.?|Mrs\.?|Miss|Shri|Smt\.?|Kum\.?|Dr\.?)?\s*([A-Z][a-zA-Z'. -]{2,45})\b",
        r"\b(?:Candidate(?:\s*Name)?|Student(?:\s*Name)?|Name\s*of\s*(?:the\s*)?(?:Candidate|Student|Awardee|Holder)|Awarded\s*to|Conferred\s*upon|Presented\s*to)\s*[|:#=-]?\s*(?:Mr\.?|Ms\.?|Mrs\.?|Shri|Smt\.?|Kum\.?)?\s*([A-Z][a-zA-Z'. -]{2,45})\b",
        r"\bName\s*[|:#=-]\s*([A-Z][a-zA-Z'. -]{2,45})\b",
    ]
    result = extract_regex_field(patterns, text)
    if result:
        lower = result.lower()
        if not any(k in lower for k in ["council", "university", "institute", "college", "board", "director", "department", "examination"]):
            return result.strip()
    return None


def extract_course_or_qualification(text: str) -> str | None:
    """Extract programme, degree, branch, or course qualification."""
    patterns = [
        r"\b(?:Degree\s*of|Diploma\s*in|Programme\s*in|Program\s*in|Course|Branch|Specialization|Discipline)\s*[|:#=-]?\s*([A-Za-z0-9&, .()-]{3,65})\b",
        r"\b(Bachelor\s+of\s+(?:Technology|Engineering|Science|Commerce|Arts|Architecture|Pharmacy|Business\s+Administration|Computer\s+Applications)(?:\s+(?:in|with)\s+[A-Za-z& ,()-]+)?)\b",
        r"\b(Master\s+of\s+(?:Technology|Engineering|Science|Commerce|Arts|Business\s+Administration|Computer\s+Applications)(?:\s+(?:in|with)\s+[A-Za-z& ,()-]+)?)\b",
        r"\b(B\.?\s*Tech\.?(?:\s+in\s+[A-Za-z& ,()-]+)?)\b",
        r"\b(M\.?\s*Tech\.?(?:\s+in\s+[A-Za-z& ,()-]+)?)\b",
        r"\b(B\.?\s*E\.?|M\.?\s*E\.?|B\.?\s*Pharm|M\.?\s*Pharm|M\.?\s*B\.?\s*A\.?|M\.?\s*C\.?\s*A\.?)\b",
        r"\b(Diploma\s+in\s+[A-Za-z& ,()-]+)\b",
    ]
    result = extract_regex_field(patterns, text)
    return result.strip() if result else None


def extract_marks_or_grade(text: str) -> str | None:
    """Extract CGPA, percentage, or awarded division/grade."""
    patterns = [
        r"\b(?:CGPA|GPA|Cumulative\s*Grade\s*Point\s*Average)\s*[|:#=-]?\s*(\d{1,2}(?:\.\d{1,3})?(?:\s*(?:out\s*of|/)\s*10(?:\.0)?)?)\b",
        r"\b(?:Percentage|Marks\s*Obtained|Total\s*Marks)\s*[|:#=-]?\s*(\d{1,3}(?:\.\d{1,2})?\s*%(?:\s*(?:out\s*of|/)\s*\d{3,4})?|\d{2,4}\s*/\s*\d{2,4})\b",
        r"\b(?:Division|Class|Awarded\s*Grade|Grade)\s*[|:#=-]?\s*([A-Za-z0-9+ -]{1,30}(?:Class|Distinction|Grade)?)\b",
    ]
    result = extract_regex_field(patterns, text)
    return result.strip() if result else None


# ============================================================
# FIELD EXTRACTION
# ============================================================

def make_field_entry(val: str | None, method: str = "DETERMINISTIC_REGEX", confidence: float | None = 0.95) -> dict[str, Any]:
    return {
        "value": val,
        "confidence": confidence if val else None,
        "method": method,
        "is_missing": val is None,
        "missing_reason": None if val else "Field not detected in document text",
    }


def extract_fields_from_text(text: str) -> dict[str, Any]:
    """Extract all supported statutory fields from OCR text."""

    text = normalize_text(text)

    fields_raw = {
        "institution_name": extract_institution_name(text),
        "student_name": extract_student_name(text),
        "reference_number": extract_reference_number(text),
        "certificate_number": extract_reference_number(text),
        "course_or_qualification": extract_course_or_qualification(text),
        "marks_or_grade": extract_marks_or_grade(text),
        "issue_date": extract_issue_date(text),
        "expiry_date": extract_expiry_date(text),
        "academic_year": extract_academic_year(text),
        "issuing_authority": extract_issuing_authority(text),
        "address": extract_address(text),
    }

    return {k: make_field_entry(v) for k, v in fields_raw.items()}


# ============================================================
# DOCUMENT PROCESSING
# ============================================================

def process_document(
    file_bytes: bytes,
    filename: str,
    content_type: str | None,
    run_layoutlmv3: bool = False,
) -> dict[str, Any]:
    """Process an uploaded PDF or image."""

    start_time = time.perf_counter()

    if not file_bytes:
        raise ValueError("The uploaded file is empty.")

    if len(file_bytes) > MAX_FILE_SIZE:
        raise ValueError("The uploaded file exceeds the 50 MB limit.")

    extension = Path(filename).suffix.lower()

    if extension not in SUPPORTED_EXTENSIONS:
        raise ValueError(
            "Unsupported file type. Upload a PDF or supported image."
        )

    checksum = calculate_sha256(file_bytes)
    first_page_image = None

    if extension == ".pdf":
        full_text, pages, warnings = extract_pdf(file_bytes)
        mime_type = "application/pdf"
        engine = "pymupdf+tesseract"
        if run_layoutlmv3:
            try:
                doc = pymupdf.open(stream=file_bytes, filetype="pdf")
                if len(doc) > 0:
                    pix = doc[0].get_pixmap(matrix=pymupdf.Matrix(1.5, 1.5), alpha=False)
                    first_page_image = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
                doc.close()
            except Exception as e:
                logger.warning(f"Could not render first page for LayoutLMv3: {e}")

    else:
        full_text, pages, warnings = extract_image(file_bytes)
        mime_type = content_type or "image/unknown"
        engine = "tesseract"
        if run_layoutlmv3:
            try:
                first_page_image = Image.open(io.BytesIO(file_bytes)).convert("RGB")
            except Exception as e:
                logger.warning(f"Could not load image for LayoutLMv3: {e}")

    fields = extract_fields_from_text(full_text)

    confidences = [
        page["confidence"]
        for page in pages
        if isinstance(page.get("confidence"), (int, float))
    ]

    average_confidence = (
        round(sum(confidences) / len(confidences), 2)
        if confidences
        else 0.0
    )

    processing_time_ms = round(
        (time.perf_counter() - start_time) * 1000,
        2,
    )

    response_payload = {
        "document": {
            "filename": filename,
            "document_id": checksum[:16],
            "sha256": checksum,
            "mime_type": mime_type,
            "size_bytes": len(file_bytes),
            "page_count": len(pages),
        },
        "engine": engine,
        "confidence": average_confidence,
        "raw_text": full_text,
        "pages": pages,
        "fields": fields,
        "processing_time_ms": processing_time_ms,
        "status": "success" if full_text else "no_text_detected",
        "warnings": warnings,
    }

    if run_layoutlmv3 and first_page_image:
        response_payload["layoutlmv3"] = layoutlmv3_inference.run_layoutlmv3_inference(first_page_image)

    return response_payload


# ============================================================
# OCR API ENDPOINT
# ============================================================

@app.post("/api/ocr/extract")
async def extract_document(
    file: UploadFile = File(...),
    run_layoutlmv3: bool = Query(False, description="Enable LayoutLMv3 multi-modal feature embedding pass"),
) -> dict[str, Any]:
    """Upload a PDF/image and return OCR text, structured fields, and optional LayoutLMv3 embeddings."""

    filename = file.filename or "uploaded_document"

    try:
        file_bytes = await file.read()

        if not file_bytes:
            raise HTTPException(
                status_code=400,
                detail="The uploaded file is empty.",
            )

        return process_document(
            file_bytes=file_bytes,
            filename=filename,
            content_type=file.content_type,
            run_layoutlmv3=run_layoutlmv3,
        )

    except HTTPException:
        raise

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    except RuntimeError as exc:
        logger.exception("OCR runtime error")
        raise HTTPException(
            status_code=503,
            detail=str(exc),
        ) from exc

    except Exception as exc:
        logger.exception("Document processing failed")
        raise HTTPException(
            status_code=500,
            detail="Document processing failed. Check the server logs.",
        ) from exc

    finally:
        await file.close()


# ============================================================
# DEVELOPMENT ENTRY POINT
# ============================================================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=5005,
        reload=True,
    )
