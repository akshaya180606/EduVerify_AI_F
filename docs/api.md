# EduVerify-AI REST API Reference (/api/v1)

All endpoints require session identification via `x-user-id` header or standard session cookie.

## Endpoint Groups

### Authentication & Sessions
- `GET /api/v1/auth/me`: Returns active session user profile.
- `POST /api/v1/auth/switch-demo`: Switches active testing role (`AICTE_ADMIN`, `COLLEGE_MANAGEMENT`, `SCRUTINY_OFFICER`, `VERIFICATION_OFFICER`, `INSPECTION_OFFICER`).
- `POST /api/v1/auth/login`: Authenticates user by institutional email.
- `POST /api/v1/auth/logout`: Terminates current session.

### Institutions
- `GET /api/v1/institutions`: Lists authorized institutions (strictly tenant-isolated for colleges).
- `GET /api/v1/institutions/:id`: Details for a single institution.
- `PUT /api/v1/institutions/:id`: Updates permitted profile parameters.

### Applications
- `GET /api/v1/applications`: Lists applications with optional `status` and `type` filters.
- `GET /api/v1/applications/:id`: Full dossier (status history, documents, checklists, clarifications).
- `POST /api/v1/applications`: Initializes new New Applicant or Extension of Approval draft.
- `POST /api/v1/applications/:id/transition`: Validated state machine transition.

### Documents & OCR
- `GET /api/v1/documents`: Lists documents matching filters.
- `GET /api/v1/documents/:id`: Document detail with extracted OCR fields and rule results.
- `POST /api/v1/documents/upload`: Computes real SHA-256, stores metadata, triggers OCR & rules engine.
- `GET /api/v1/documents/:id/download`: Authorized signed URL stream generator.

### Scrutiny
- `GET /api/v1/scrutiny/queue`: Returns applications pending scrutiny review.
- `PUT /api/v1/scrutiny/checklist/:id`: Updates checklist item evaluation status.
- `POST /api/v1/scrutiny/submit-recommendation`: Records officer recommendation.

### Verification
- `GET /api/v1/verification/tasks`: Returns assigned document verification tasks.
- `POST /api/v1/verification/tasks/:id/verify-external`: Runs G2G sandbox query.
- `POST /api/v1/verification/tasks/:id/record-outcome`: Records manual review decision.

### Inspections (EVC)
- `GET /api/v1/inspections`: Returns scheduled on-site inspections.
- `PUT /api/v1/inspections/:id/category`: Updates facility category findings.
- `POST /api/v1/inspections/:id/submit-report`: Submits final EVC inspection docket.

### Clarifications
- `GET /api/v1/clarifications`: Lists clarification notices.
- `POST /api/v1/clarifications`: Officer creates deficiency clarification request.
- `POST /api/v1/clarifications/:id/respond`: College submits response and replacement proof.
- `POST /api/v1/clarifications/:id/resolve`: Officer resolves or rejects response.

### Reports & Audit
- `GET /api/v1/reports/summary`: Statistical pipeline metrics.
- `GET /api/v1/reports/export-csv`: Generates formula-injection sanitized CSV.
- `GET /api/v1/audit-logs`: Immutable regulatory audit logs (Admin only).
- `GET /api/v1/health/ready`: Dependency readiness check.
- `GET /api/v1/rules`: Active validation rules configuration suite.
