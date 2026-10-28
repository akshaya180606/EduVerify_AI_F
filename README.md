# EduVerify-AI — AICTE Approval & Document Verification Platform

**EduVerify-AI** is an institutional regulatory workflow, statutory field extraction, and document verification platform designed for the All India Council for Technical Education (AICTE). It provides end-to-end automation for college management, scrutiny officers, verification officers, and inspection teams to manage institutional approvals, compliance certificates, verification evidence, and statutory decisions in compliance with the **AICTE Approval Process Handbook (APH 2024–2027)**.

---

## 1. Local-First Architecture

EduVerify-AI is engineered to run **100% locally** without mandatory dependencies on external cloud services:

- **Frontend**: React 19, TypeScript, Tailwind CSS, Vite (`src/`).
- **Backend API Gateway**: Node.js & Express (`server.ts`, `server/routes/`, `server/services/`).
- **Persistence**: Local PostgreSQL with Prisma ORM (`prisma/schema.prisma`).
- **File Storage**: Local filesystem storage (`storage/documents/`, `storage/extracted-text/`, `storage/temporary/`, `storage/reports/`).
- **Document OCR Microservice**: Python FastAPI with PyMuPDF, Tesseract OCR, and LayoutLMv3 integration (`python-service/`).
- **Authentication & Security**: Cryptographically signed HMAC-SHA256 session tokens with server-side role validation, strict multi-tenant isolation, and formula injection sanitization.
- **Auditing**: Append-only PostgreSQL audit log (`AuditLog`).

```mermaid
graph TD
    Client[React + Vite Frontend Client] -->|REST API with Bearer Session Token| Gateway[Node.js + Express API Gateway /api/v1]
    Gateway --> AuthM[Session Auth & RBAC Middleware]
    AuthM --> Controller[Service & Route Layer]
    Controller --> Rules[APH 2024-2027 Regulatory Rules Engine]
    Controller --> Adapters[Modular Authority Verification Adapters]
    Controller --> Anomaly[Evidence-Linked Anomaly Detection Engine]
    Controller --> Infra[Infrastructure Compliance Assistant]
    Controller --> Hash[Local SHA-256 Digest Engine]
    Controller --> DB[(Local PostgreSQL via Prisma ORM)]
    Controller --> Storage[Local Filesystem Storage Vault]
    Controller --> OCR[Local Python FastAPI OCR / LayoutLMv3 Microservice]
    Controller --> Audit[(Append-Only Immutable Audit Log)]
```

---

## 2. Core Implemented Modules (Priorities 1–7)

### Priority 1: End-to-End Processing & Robust Pipeline
- Native PDF text extraction via PyMuPDF with automated Tesseract OCR fallback for scanned certificates.
- Deterministic statutory field extraction (candidate/institution name, registration numbers, dates, marks/CGPA, approval cycles).
- Multimodal document understanding pipeline with LayoutLMv3 bounding-box normalization.

### Priority 2: APH 2024–2027 Regulatory Rules Engine (`server/services/regulatoryRules.ts`)
- Configurable rule definitions separated from application routing.
- Evaluates application compliance against AICTE norms:
  - **Land Area Norms** (Clause 1.4 & Appendix 4 Table 4.1): Minimum contiguous acres based on Mega/Metro, Urban, or Rural terrain.
  - **Fire Safety Certificate & NOC** (Clause 2.3 & Appendix 15): Valid issuing authority and active non-expired status.
  - **Sanctioned Building Plan** (Clause 1.5 & Appendix 4): Competent municipal/panchayat approval check.
  - **Affiliating University NOC** (Clause 2.4): Valid affiliation covering requested programmes.
  - **Faculty-to-Student Cadre Ratio** (Clause 2.14 & Appendix 7): Maximum 1:20 ratio enforcement for Engineering & Technology.
  - **Pollution Control Clearance** (Clause 2.3): Valid water/air discharge clearance.
  - **Audited Financial Statements** (Clause 2.10): Chartered accountant audited balance sheet review.
- Outputs structured compliance scores, deficiency lists, and exact APH clause citations.

### Priority 3: Issuing-Authority Verification Adapter Architecture (`server/services/verificationAdapters.ts`)
- Modular adapter pattern supporting multi-source statutory verification:
  - `QRCodeVerificationAdapter`: Cryptographic signature verification and field reconciliation from embedded 2D barcodes.
  - `StatutoryReferenceAdapter`: Algorithmic pattern and checksum verification for state/central registration numbers.
  - `DigiLockerNADAdapter`: Adapter interface for National Academic Depository & DigiLocker G2G APIs.
  - `StateLandRegistryAdapter`: Verification adapter for revenue department land ownership records.
- **Statutory Status Distinctions**:
  - `VERIFIED`: Confirmed match against official records.
  - `MISMATCH_DETECTED`: Discrepancy between certificate claim and registry response.
  - `PENDING`: Asynchronous registry call initiated.
  - `SOURCE_UNAVAILABLE`: External portal downtime.
  - `NOT_CONFIGURED`: Adapter requiring production API keys/credentials (clearly flagged without fabricating live responses).
  - `MANUAL_REVIEW_REQUIRED`: Escalate to official verification officer.
- **Manual Verification Dossier Workflow**: Officer-recorded manual verification with verification method, official notes, file reference, and timestamp (`POST /api/v1/verification/tasks/:id/record-manual`).

### Priority 4: Evidence-Linked Anomaly Detection (`server/services/anomalyDetection.ts`)
- Analyzes document text and metadata for anomalies:
  - Graphic editing markers (Photoshop, Canva, Illustrator, GIMP metadata traces).
  - Chronological date inversions (issue date > expiry date, post-dated future certificates, certificates issued prior to institutional establishment).
  - Institution name mismatch against registered AICTE tenant profile.
  - Cross-institution SHA-256 duplicate document collision detection.
- **Statutory Boundary & Disclaimer**: Every anomaly flag is explicitly marked as statistical/structural decision-support (`humanReviewStatus: 'PENDING_HUMAN_REVIEW'`) and states that automated flags do not constitute legal proof of forgery without independent authorized verification.

### Priority 5: Infrastructure Compliance Assistance (`server/services/infrastructureComplianceService.ts`)
- Automated verification of instructional, administrative, and amenities carpet areas against APH Appendix 4 & 5.
- Validates minimum dimensions: classrooms (min 66 sqm), laboratories (min 66 sqm), central library (min 400 sqm), computer center (min 150 sqm).
- Barrier-free physical access checks (wheelchair ramps, accessible lifts, disabled-friendly toilets).
- Automated routing for on-site Expert Visiting Committee (EVC) physical inspection for deficient blueprint schedules or New Applicant institutions.

### Priority 6: Dashboard, Alerts, and Audit Trail (`server/routes/applications.ts`, `src/features/dashboard/Dashboard.tsx`)
- High-severity Regulatory Action Alerts panel on dashboard:
  - Expired statutory certificates.
  - Cross-institution duplicate document hash collisions.
  - High-risk anomaly flags requiring scrutiny review.
- Append-only immutable audit trail capturing user IDs, timestamps, client IPs, previous values, and change payloads.

### Priority 7: Security & Multi-Tenant Isolation
- Cryptographically signed HMAC-SHA256 session tokens.
- Role-Based Access Control (RBAC) enforced on both client routes and API endpoints.
- Strict multi-tenant isolation ensuring `COLLEGE_MANAGEMENT` can only access documents belonging to their assigned `institutionId`.
- Formula injection protection (CWE-1236) on CSV exports.

---

## 3. Authorized Regulatory Roles

| Persona | Role Key | Permissions & Capabilities |
| :--- | :--- | :--- |
| **Central Administrator** | `AICTE_ADMIN` | Council-wide oversight, regulatory rules management, full audit trail access, and approval ratification. |
| **College Management** | `COLLEGE_MANAGEMENT` | Tenant-isolated workspace: submit New Applicant / EoA applications, upload certificates, respond to clarifications. |
| **Scrutiny Officer** | `SCRUTINY_OFFICER` | Application completeness review, checklist item evaluation, deficiency notice issuance. |
| **Verification Officer** | `VERIFICATION_OFFICER` | Document verification, statutory field review, adapter execution, manual dossier recording. |
| **Inspection Team** | `INSPECTION_OFFICER` | Expert Visiting Committee (EVC) on-site infrastructure evaluation and report submission. |

---

## 4. Local Setup & Quick Start

### Prerequisites
- Node.js 20+ and npm
- PostgreSQL 15+ running locally (e.g., port 5432)
- Python 3.10+ (with Tesseract OCR installed)
- Tesseract OCR (e.g., `apt-get install tesseract-ocr` or Windows installer)

### Step 1: Environment Configuration
Create `.env` in the project root:
```env
PORT=3000
NODE_ENV=development
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/eduverify?schema=public"
STORAGE_PATH="./storage"
LOCAL_OCR_URL="http://127.0.0.1:5005"
SESSION_SECRET="eduverify_local_super_secret_key_minimum_32_chars"
```

### Step 2: Install Node Dependencies & Initialize Database
```bash
# Install Node dependencies
npm install

# Push database schema & generate Prisma Client (requires local PostgreSQL)
npx prisma db push
npx prisma generate

# Seed sample regulatory accounts and reference data
npx prisma db seed
```

### Step 3: Set Up Python OCR & LayoutLMv3 Microservice
```bash
# Navigate to the Python microservice directory
cd python-service

# Create and activate Python virtual environment
python -m venv venv
source venv/bin/activate   # On Windows: .\venv\Scripts\Activate.ps1

# Install requirements
pip install -r requirements.txt

# (Optional) Pre-download LayoutLMv3 model weights for offline inference
python download_model.py --model-name microsoft/layoutlmv3-base

# Run LayoutLMv3 self-test
python test_layoutlmv3.py

# Start the OCR microservice on port 5005
python main.py
```

### Step 4: Start EduVerify-AI Node/React Application
```bash
# Start full-stack development server on http://localhost:3000
npm run dev
```

### Step 5: Open Application
Open your browser and navigate to:
```
http://localhost:3000
```

---

## 5. Automated Test Suite (57 Passing Tests)

The repository includes a comprehensive automated test suite covering all critical regulatory, verification, security, and persistence modules:

```bash
# Run all automated tests
npm test
```

### Test Suite Breakdown:
1. `tests/regulatory_rules.test.ts` (3 tests):
   - Evaluates compliant application scoring (100% compliance).
   - Identifies expired Fire Safety NOC and attaches exact APH Clause 2.3 citation.
   - Flags non-compliant faculty-to-student cadre ratio exceeding 1:20 norm.
2. `tests/verification_adapters.test.ts` (4 tests):
   - Confirms valid signed QR payload matching certificate claims.
   - Detects tampered QR payload returning `MISMATCH_DETECTED`.
   - Returns `NOT_CONFIGURED` gracefully for unconfigured external APIs without fabricated results.
   - Validates statutory reference series pattern and issuing authority matching.
3. `tests/anomaly_detection.test.ts` (3 tests):
   - Detects graphic editing markers (Photoshop/Canva) and provides officer guidance.
   - Flags chronological date inversions (issue date later than expiry date).
   - Detects cross-institution duplicate document hash collisions.
4. `tests/infrastructure_compliance.test.ts` (3 tests):
   - Verifies architectural blueprint area schedules against APH Appendix 4.
   - Flags missing building plan evidence as high-severity deficiency.
   - Automatically routes New Applicant institutions for mandatory on-site EVC inspection.
5. `tests/mock_persistence.test.ts` (3 tests):
   - Enforces placeholder credential isolation and prevents hardcoding in source code.
   - Tests statutory field normalization across candidate, course, marks, and dates.
   - Verifies tenant isolation preventing cross-college data access.
6. `tests/auth_readiness_audit.test.ts` (8 tests):
   - Verifies HMAC-SHA256 session token generation and tamper detection.
   - Rejects unauthenticated role header spoofing.
   - Enforces role-based endpoint protection and Google Sign-In security posture.
7. `tests/database.test.ts` (10 tests):
   - Tests PostgreSQL live schema persistence, transaction rollback, and SHA-256 duplicate detection.
8. `tests/ocr.test.ts`, `tests/rules.test.ts`, `tests/security.test.ts`, `tests/workflow.test.ts` (23 tests):
   - Unit tests covering document validation, field extraction rules, CSV sanitization, and workflow progression.

---

## 6. Pre-Seeded Demonstration Accounts

EduVerify-AI includes an interactive role switcher in the header navigation bar:

- **AICTE Central Administrator**: Dr. Rajesh Sharma (`admin@aicte-india.org`)
- **College Management A**: Prof. Sunita Rao (`principal@niet.edu.in`) — National Institute of Engineering & Technology
- **College Management B**: Dr. Vikram Sengupta (`director@apextech.ac.in`) — Apex Institute of Technology
- **Scrutiny Officer**: Er. Amit Kumar (`scrutiny.kumar@aicte.gov.in`)
- **Verification Officer**: Dr. Priya Patel (`verify.patel@aicte.gov.in`)
- **Inspection Officer**: Prof. Arvind Sharma (`inspect.sharma@aicte.gov.in`)

---

## 7. Statutory & Legal Decision-Support Disclaimer

EduVerify-AI is an **AI-assisted regulatory decision-support platform**. All automated findings, optical character recognition outputs, LayoutLMv3 embeddings, and anomaly flags:
1. Provide evidence-linked recommendations with clause citations to assist authorized AICTE scrutiny officers.
2. **Do not constitute automatic approval, rejection, or legal proof of document forgery**.
3. Require formal human-in-the-loop validation by authorized AICTE verification officers, scrutiny committees, or Expert Visiting Committees (EVC) before statutory orders are issued.
