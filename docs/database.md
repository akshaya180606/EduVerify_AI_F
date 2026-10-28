# Database Schema & Relational Model

## PostgreSQL Database Configuration
- **ORM**: Prisma ORM with versioned schema in `prisma/schema.prisma`.
- **Environment Variable**: `DATABASE_URL="postgresql://aicte_usr:secret@localhost:5432/eduverify_db?schema=public"`

## Relational Tables (27+ Models Defined)
1. `users`: System users with hashed passwords, roles (`UserRole` enum), and optional institution affiliation.
2. `institutions`: Institutional data with AICTE code, acreage, student capacity, completeness score.
3. `applications`: Approval lifecycle dockets with foreign key to institutions.
4. `application_status_history`: Immutable transition log with actor reference, rationale, and timestamps.
5. `application_checklist_items`: Scrutiny checklist compliance points.
6. `documents`: Document records with SHA-256 hash, storage key, file size, versioning.
7. `document_extractions`: Extracted OCR text, metadata, engine version, and confidence rating.
8. `validation_results`: Rule outcomes (`PASS`, `FAIL`, `WARNING`, `NEEDS_REVIEW`, `NOT_APPLICABLE`).
9. `duplicate_matches`: Cross-docket exact and near-similarity match records.
10. `verification_tasks`: External G2G issuer checks and evidence capture.
11. `inspections`: EVC committee inspection schedules and reports.
12. `inspection_findings`: Infrastructure category observations (Classrooms, Labs, Library, Computing, Safety).
13. `clarifications`: Formal deficiency notices issued by officers to institutions.
14. `notifications`: In-app event alerts.
15. `audit_logs`: Immutable security audit events.

## Migrations Command
```bash
npx prisma migrate dev --name init_aicte_schema
npx prisma db seed
```
