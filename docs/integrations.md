# Integrations & External Adapters

## 1. Document Storage Adapter
- **Provider**: Google Cloud Storage / Amazon S3.
- **Access Model**: Private bucket. No public bucket policies.
- **Signed URLs**: Temporary signed URLs generated for authorized users with 5-minute TTL.

## 2. Python OCR Microservice
- **Endpoint**: `http://localhost:8000/api/ocr/extract`
- **Contract**: Accepts multi-part document files; returns extracted key-value pairs, raw text, and bounding-box coordinates.

## 3. Gemini AI Intelligence
- **Model**: `gemini-2.5-flash` via `@google/genai` TypeScript SDK.
- **Scope**: Automated summarization of lengthy regulatory inspection notes and verification evidence.
- **Security**: Kept strictly server-side behind `/api/v1/` routes. Zero API key exposure to frontend clients.

## 4. G2G Verification Adapters
- **Adapters**: UP State IGRSUP Revenue Portal, State Fire Safety CFO Gateway, University Affiliation Portals.
- **Sandbox Adapter**: Pre-configured for local testing to simulate live G2G API responses without requiring external credentials.
