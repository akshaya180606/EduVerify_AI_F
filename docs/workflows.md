# Regulatory Approval Workflow Specification

## AICTE Approval State Machine Lifecycle

```mermaid
stateDiagram-v2
    [*] --> DRAFT : College initiates application
    DRAFT --> SUBMITTED : College submits docket (Mandatory docs required)
    SUBMITTED --> UNDER_SCRUTINY : Central Bureau assigns Scrutiny Officer
    UNDER_SCRUTINY --> CLARIFICATION_REQUIRED : Officer finds deficiency
    CLARIFICATION_REQUIRED --> RESUBMITTED : College uploads revised evidence
    RESUBMITTED --> UNDER_SCRUTINY : Re-evaluation
    UNDER_SCRUTINY --> UNDER_VERIFICATION : Document completeness cleared
    UNDER_VERIFICATION --> INSPECTION_PENDING : Issuing authority records verified
    INSPECTION_PENDING --> UNDER_INSPECTION : EVC Visiting Committee visits campus
    UNDER_INSPECTION --> RECOMMENDATION_SUBMITTED : EVC submits inspection report
    RECOMMENDATION_SUBMITTED --> APPROVED : AICTE Council ratifies approval
    RECOMMENDATION_SUBMITTED --> REJECTED : Statutory deficiency recorded
    DRAFT --> WITHDRAWN : College cancels docket
    SUBMITTED --> WITHDRAWN : Permitted withdrawal
```

## Authorized Roles & Transitions
1. `DRAFT -> SUBMITTED`: Permitted only to `COLLEGE_MANAGEMENT` with valid mandatory certificates.
2. `SUBMITTED -> UNDER_SCRUTINY`: Permitted to `SCRUTINY_OFFICER` and `AICTE_ADMIN`.
3. `UNDER_SCRUTINY -> CLARIFICATION_REQUIRED`: Triggered when checklist item has `CLARIFICATION_REQUIRED`.
4. `UNDER_SCRUTINY -> UNDER_VERIFICATION`: Forwarded when all checklist items pass.
5. `RECOMMENDATION_SUBMITTED -> APPROVED / REJECTED`: Strictly restricted to `AICTE_ADMIN`.
