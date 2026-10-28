# EduVerify-AI Python OCR & Document Intelligence Service

This microservice provides an optional, specialized Python runtime for:
- PDF structural parsing using `PyMuPDF` (fitz)
- Multi-lingual OCR using `PaddleOCR` and `Tesseract`
- Computer vision preprocessing with `OpenCV` (deskewing, contrast normalization)
- Digital certificate QR code reading and X.509 signature payload extraction

## Prerequisites
- Python 3.10+
- pip and virtualenv

## Installation
```bash
cd python-service
python -m venv venv
source venv/bin/activate
pip install fastapi uvicorn pymupdf paddlepaddle paddleocr opencv-python-headless python-multipart
```

## Running the Service
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## Health Check
- `GET http://localhost:8000/health`
- Swagger UI Documentation: `http://localhost:8000/docs`
