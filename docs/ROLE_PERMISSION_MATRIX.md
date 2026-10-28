# EduVerify-AI: Complete Role & Permission Matrix

**AICTE Intelligent Approval Validation & Assistance Platform**  
**Document Version:** 2.4.0 (Regulatory Cycle 2026–2027)  
**Standard Authorization Model:** HMAC-SHA256 Token / Firebase Verified ID Token + Tenant Boundary Enforcement

---

## 1. Permission Evaluation Values

- **`ALLOW`**: The role has full statutory or administrative authority to perform the operation.
- **`DENY`**: The role is explicitly prohibited from performing the operation. Server enforces HTTP 403 `ROLE_FORBIDDEN` or UI suppresses the control.
- **`CONDITIONAL`**: The operation is permitted only when specific prerequisite conditions, tenant boundaries, or state-machine rules are met (e.g. only own institution docket; only in `DRAFT` status; only assigned tasks).
- **`NOT_IMPLEMENTED`**: The capability is on the long-term roadmap but not implemented in current active release.
- **`NOT_APPLICABLE`**: The operation does not apply to the workflow domain of this role.

---

## 2. Master Role-Permission Matrix

| Category / Operation | AICTE Admin | College Management | Scrutiny Officer | Verification Officer | Inspection Officer | Technical & Regulatory Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Authentication & Profile** | | | | | | |
| View Authenticated Profile (`/auth/me`) | `ALLOW` | `ALLOW` | `ALLOW` | `ALLOW` | `ALLOW` | All authenticated users receive session profile info (`User` object). |
| Session Role Switching (`/auth/switch-demo`) | `ALLOW` | `ALLOW` | `ALLOW` | `ALLOW` | `ALLOW` | Simulation testing facility issuing cryptographically signed server HMAC tokens. |
| User Credential Login (`/auth/login`) | `ALLOW` | `ALLOW` | `ALLOW` | `ALLOW` | `ALLOW` | Issues signed token; logs audit event. |
| Google OAuth Sign-In (`/auth/firebase-login`) | `ALLOW` | `ALLOW` | `ALLOW` | `ALLOW` | `ALLOW` | Verifies Google ID token. Auto-provisions only as standard `COLLEGE_MANAGEMENT`. |
| Self-Escalation to Admin Role | `DENY` | `DENY` | `DENY` | `DENY` | `DENY` | Security violation; role assignment requires AICTE administrative action. |
| **Institution Directory & Profiles** | | | | | | |
| List Institutions (`GET /institutions`) | `ALLOW` | `CONDITIONAL` | `ALLOW` | `ALLOW` | `ALLOW` | College Management strictly scoped to own institution (`user.institutionId`). |
| View Single Institution (`GET /institutions/:id`) | `ALLOW` | `CONDITIONAL` | `ALLOW` | `ALLOW` | `ALLOW` | College Management gets 403 `TENANT_ACCESS_DENIED` on other institutions. |
| Update Institution Profile (`PUT /institutions/:id`) | `ALLOW` | `CONDITIONAL` | `DENY` | `DENY` | `DENY` | College updates own profile; Admin has oversight. Officers cannot modify data. |
| **Approval Dockets & Applications** | | | | | | |
| List Applications (`GET /applications`) | `ALLOW` | `CONDITIONAL` | `CONDITIONAL` | `CONDITIONAL` | `CONDITIONAL` | College: own tenant. Scrutiny: assigned or `SUBMITTED`/`UNDER_SCRUTINY`. Verification: assigned or `UNDER_VERIFICATION`. Inspection: assigned or `INSPECTION_PENDING`. |
| View Application Details (`GET /applications/:id`) | `ALLOW` | `CONDITIONAL` | `ALLOW` | `ALLOW` | `ALLOW` | College Management restricted strictly to own institutional applications. |
| Create Application Draft (`POST /applications`) | `ALLOW` | `ALLOW` | `DENY` | `DENY` | `DENY` | Admin can initiate for any college; College initiates for itself. Officers cannot. |
| Submit Application Docket (`DRAFT` -> `SUBMITTED`) | `ALLOW` | `ALLOW` | `DENY` | `DENY` | `DENY` | Requires at least 1 mandatory statutory certificate. Strictly forbidden to review officers. |
| Withdraw Application (`*` -> `WITHDRAWN`) | `ALLOW` | `CONDITIONAL` | `DENY` | `DENY` | `DENY` | College can withdraw only before final ratification. |
| Ratify Final Approval/Rejection (`RECOMMENDATION_SUBMITTED` -> `APPROVED`/`REJECTED`) | `ALLOW` | `DENY` | `DENY` | `DENY` | `DENY` | Statutory AICTE Apex Council prerogative under AICTE Act 1987 Section 10. |
| View Anomaly Reports (`GET /applications/:id/anomalies`) | `ALLOW` | `CONDITIONAL` | `ALLOW` | `ALLOW` | `ALLOW` | Evaluates font anomalies, duplicate hashes, and metadata consistency. |
| View Infrastructure Compliance (`GET /applications/:id/infrastructure`) | `ALLOW` | `CONDITIONAL` | `ALLOW` | `ALLOW` | `ALLOW` | Compares carpet area, computers, labs against statutory AICTE norms. |
| View Regulatory Alerts (`GET /applications/alerts`) | `ALLOW` | `CONDITIONAL` | `ALLOW` | `ALLOW` | `ALLOW` | Flags expired certificates and cross-institution duplicate document collisions. |
| **Document Vault & Optical Intelligence** | | | | | | |
| List Documents (`GET /documents`) | `ALLOW` | `CONDITIONAL` | `ALLOW` | `ALLOW` | `DENY` | College Management restricted to own tenant; Inspection officers use inspection findings. |
| View Single Document (`GET /documents/:id`) | `ALLOW` | `CONDITIONAL` | `ALLOW` | `ALLOW` | `DENY` | Cryptographic SHA-256 seal & OCR inspection. College restricted by tenant. |
| Upload Document (`POST /documents/upload`) | `ALLOW` | `CONDITIONAL` | `DENY` | `DENY` | `DENY` | Admin uploads supporting/test docs; College uploads filing. Officers cannot tamper. |
| Re-run OCR Extraction (`POST /documents/:id/retry-ocr`) | `ALLOW` | `CONDITIONAL` | `ALLOW` | `ALLOW` | `DENY` | Triggers Python PyMuPDF + Tesseract service with raw file buffer. |
| Download Evidence (`GET /documents/:id/download`) | `ALLOW` | `CONDITIONAL` | `ALLOW` | `ALLOW` | `DENY` | Signed URL generation with immutable audit trail. Tenant isolated. |
| **Scrutiny Workflow** | | | | | | |
| View Scrutiny Queue (`GET /scrutiny/queue`) | `ALLOW` | `DENY` | `ALLOW` | `DENY` | `DENY` | Applications in `SUBMITTED` or `UNDER_SCRUTINY` assigned to officer. |
| Evaluate Checklist Item (`PUT /scrutiny/checklist/:id`) | `ALLOW` | `DENY` | `ALLOW` | `DENY` | `DENY` | Scrutiny review of land, building, fire NOC, and faculty lists. |
| Submit Scrutiny Recommendation (`POST /scrutiny/submit-recommendation`) | `ALLOW` | `DENY` | `ALLOW` | `DENY` | `DENY` | Routes docket to `UNDER_VERIFICATION`, `CLARIFICATION_REQUIRED`, or `INSPECTION_PENDING`. |
| **External Source Verification Desk** | | | | | | |
| List Verification Adapters (`GET /verification/adapters`) | `ALLOW` | `DENY` | `ALLOW` | `ALLOW` | `DENY` | Lists state fire, revenue department, university, and PFMS integration status. |
| List Verification Tasks (`GET /verification/tasks`) | `ALLOW` | `DENY` | `ALLOW` | `ALLOW` | `DENY` | Tasks requiring primary source / issuing authority corroboration. |
| Run Automated Adapter Check (`POST /verification/tasks/:id/verify-external`) | `ALLOW` | `DENY` | `DENY` | `ALLOW` | `DENY` | Real-time external registry API / state portal validation check. |
| Record Manual Verification Dossier (`POST /verification/tasks/:id/record-manual`) | `ALLOW` | `DENY` | `DENY` | `ALLOW` | `DENY` | For offline/sub-registrar authorities without public APIs. Logs dispatch ref. |
| Record Verification Decision (`POST /verification/tasks/:id/record-outcome`) | `ALLOW` | `DENY` | `DENY` | `ALLOW` | `DENY` | Sets `VERIFIED`, `DISCREPANCY_FOUND`, or `UNABLE_TO_VERIFY` with evidence ledger. |
| **Expert Visit Committee (EVC) Inspections** | | | | | | |
| List Inspections (`GET /inspections`) | `ALLOW` | `CONDITIONAL` | `DENY` | `DENY` | `CONDITIONAL` | College sees own scheduled inspections. Officer sees assigned EVC visits. |
| Update Inspection Finding (`PUT /inspections/:id/category`) | `ALLOW` | `DENY` | `DENY` | `DENY` | `ALLOW` | Field officer records actual labs, computers, classrooms capacity on site. |
| Submit Final Inspection Report (`POST /inspections/:id/submit-report`) | `ALLOW` | `DENY` | `DENY` | `DENY` | `ALLOW` | Submits final EVC recommendation (`RECOMMENDED_FULL`, `DEFICIENCY_NOTED`, etc.). |
| **Clarification Hub** | | | | | | |
| View Clarification Tickets (`GET /clarifications`) | `ALLOW` | `CONDITIONAL` | `ALLOW` | `ALLOW` | `DENY` | College sees own tickets; Officers see assigned dockets. |
| Request Clarification (`POST /clarifications`) | `ALLOW` | `DENY` | `ALLOW` | `ALLOW` | `DENY` | Issues formal deficiency notice with statutory 14-day response deadline. |
| Respond to Clarification (`POST /clarifications/:id/respond`) | `ALLOW` | `CONDITIONAL` | `DENY` | `DENY` | `DENY` | College submits response text and replacement evidence reference. |
| Resolve Clarification Ticket (`POST /clarifications/:id/resolve`) | `ALLOW` | `DENY` | `ALLOW` | `ALLOW` | `DENY` | Evaluates institutional response as `RESOLVED` or `REJECTED`. |
| **System Audit Trail & Admin Governance** | | | | | | |
| Query Audit Logs (`GET /audit-logs`) | `ALLOW` | `DENY` | `DENY` | `DENY` | `DENY` | Strictly restricted to AICTE Administrator. Non-admins receive HTTP 403 `ROLE_FORBIDDEN`. |
| Configure Regulatory Rules & Handbook | `ALLOW` | `DENY` | `DENY` | `DENY` | `DENY` | Admin-only system configuration. |
| Export Audit / Statistical Reports (`GET /reports/export-csv`) | `ALLOW` | `ALLOW` | `ALLOW` | `DENY` | `DENY` | Generates RFC-compliant CSV with formula injection protection (CWE-1236). |
| View Aggregated Analytics (`GET /reports/summary`) | `ALLOW` | `CONDITIONAL` | `ALLOW` | `ALLOW` | `ALLOW` | College metrics scoped to own institution; Admin & officers see global metrics. |

---

## 3. Multi-Tenant Isolation Enforcement Rules

1. **College Management Multi-Tenant Boundary:**
   - User `usr-college-a` (`INST-2026-001`, National Institute of Engineering & Technology) can only access institutions, applications, documents, and notifications where `institutionId === 'INST-2026-001'`.
   - Access attempts to `INST-2026-002` (Apex Institute) fail immediately with HTTP 403 `TENANT_ACCESS_DENIED`.
2. **Cryptographic Identity Verification:**
   - Raw client headers (e.g. `x-user-id`) are strictly rejected unless accompanied by a verified `Authorization: Bearer <token>` signed by the server's HMAC session key or Google Firebase Admin SDK.
3. **Audit Trail Immutability:**
   - Every mutation (create draft, upload document, transition state, run OCR, query adapter, submit inspection, resolve clarification) records an immutable log in PostgreSQL / `db.auditLogs` capturing actor ID, actor role, timestamp, entity ID, and outcome.
