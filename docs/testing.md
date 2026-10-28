# Automated Testing Strategy

## Unit Testing Framework
Unit tests are implemented using Node.js's native test runner (`node:test`) and executed with `npx --yes tsx --test`.

### Executed Test Suites:
1. `tests/rules.test.ts`:
   - Text normalization and token Jaccard similarity scoring.
   - SHA-256 integrity and file-size threshold violations.
   - Expiration date detection and failure flagging for expired NOCs.
2. `tests/security.test.ts`:
   - Formula injection sanitizer for spreadsheet export (`=`, `+`, `-`, `@`).
   - Strict multi-tenant isolation guard (`canAccessInstitution`) verifying that College A cannot access College B.
   - Role authorization bounds (`canPerformAction`).
   - Cryptographic SHA-256 generation.
3. `tests/workflow.test.ts`:
   - Application state machine progression from DRAFT to APPROVED.
   - Rejection of invalid skips and illegal backward transitions.
   - Clarification round-trip logic.

## Running Tests
```bash
npx --yes tsx --test tests/*.test.ts
```
