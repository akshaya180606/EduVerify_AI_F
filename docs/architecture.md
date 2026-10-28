# System Architecture & Technical Design

## Overview
**EduVerify-AI** is architected as an institutional regulatory governance platform adhering to AICTE Approval Process Handbook (APH) guidelines. It features a strict multi-tenant boundary, server-authoritative role-based access control, cryptographic document verification, and an append-only audit trail.

```mermaid
graph TD
    Client[React + Vite Frontend Client] -->|REST API with x-user-id & Bearer| Gateway[Node.js + Express API Gateway /api/v1]
    Gateway --> AuthM[Multi-Tenant & RBAC Middleware]
    AuthM --> Controller[Service & Repository Layer]
    Controller --> Rules[Document Validation Rule Engine]
    Controller --> Hash[Crypto SHA-256 Digest Engine]
    Controller --> DB[(PostgreSQL via Prisma ORM)]
    Controller --> Vault[Private Object Storage Adapter GCS/S3]
    Controller --> OCR[Optional Python FastAPI OCR Service]
    Controller --> G2G[External Issuer Sandbox Adapters]
    Controller --> Audit[(Append-Only Immutable Audit Trail)]
```

## Core Subsystems
1. **Frontend Presentation Layer**: React 19 SPA running on Vite, styled with Tailwind CSS using the exact regulatory color palette (`#115E59`, `#0D9488`, `#F3F8F7`, `#193A39`).
2. **REST API Gateway**: Versioned under `/api/v1` with centralized error handling, sensitive header redaction, and strict input validation.
3. **Multi-Tenant Isolation**: College Management sessions are strictly locked to their single designated institution ID. Cross-tenant queries return HTTP 403 `TENANT_ACCESS_DENIED`.
4. **Validation Rules Engine**: Evaluates file integrity, expiry validity, institution name fuzzy match (Jaccard similarity), and cross-docket duplicate file anomaly.
5. **Verification Framework**: Pluggable G2G adapters for verifying certificate reference numbers against state electronic ledgers with anti-SSRF IP restrictions.
