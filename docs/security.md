# Security and Tenant Isolation Specification

## 1. Institutional Tenant Isolation
- **Isolation Policy**: Users with role `COLLEGE_MANAGEMENT` can only query, read, upload, download, or transition resources associated with their own `institutionId`.
- **Enforcement Point**: Server-side authorization check (`canAccessInstitution(user, institutionId)`) executed on every API route under `/api/v1/institutions`, `/api/v1/applications`, `/api/v1/documents`, and `/api/v1/clarifications`.
- **Cross-Institution Testing**: College A (NIET) user cannot query or download documents belonging to College B (Apex Tech), verified via automated unit test `tests/security.test.ts`.

## 2. Cryptographic Integrity & File Storage
- **SHA-256 Hashing**: Generated server-side and client-side from actual uploaded file bytes. Prevents tampering and unapproved document replacement.
- **Private Storage**: Storage keys generated using safe random UUIDs; public URLs are disabled. Access is mediated via short-lived signed URLs (TTL 300s).

## 3. CSV Formula Injection Defense (CWE-1236)
- Cell values starting with dangerous spreadsheet formula triggers (`=`, `+`, `-`, `@`, `\t`, `\r`) are escaped with a leading single quote (`'`), neutralizing executable Excel/Calc macros.

## 4. SSRF & Safe External G2G Querying
- External verification requests check against a domain whitelist. Private IP subnets (`127.0.0.1`, `10.0.0.0/8`, `192.168.0.0/16`, `169.254.0.0/16`) are blocked to prevent internal network scanning.

## 5. Append-Only Audit Trail
- Security-sensitive events (logins, role switches, document uploads, checklist evaluations, external checks, clarification notices, approval ratifications) write immutable audit records with timestamps and actor credentials.
