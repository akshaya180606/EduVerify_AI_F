-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('AICTE_ADMIN', 'COLLEGE_MANAGEMENT', 'SCRUTINY_OFFICER', 'VERIFICATION_OFFICER', 'INSPECTION_OFFICER');

-- CreateEnum
CREATE TYPE "InstitutionStatus" AS ENUM ('ACTIVE', 'ACCREDITED', 'PROVISIONAL', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ApplicationType" AS ENUM ('NEW_APPLICANT', 'EXTENSION_OF_APPROVAL');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_SCRUTINY', 'CLARIFICATION_REQUIRED', 'RESUBMITTED', 'UNDER_VERIFICATION', 'INSPECTION_PENDING', 'UNDER_INSPECTION', 'RECOMMENDATION_SUBMITTED', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('LAND_TITLE_DEED', 'BUILDING_PLAN_APPROVAL', 'FIRE_SAFETY_CERTIFICATE', 'AFFILIATION_ORDER', 'FACULTY_LIST_RATIFICATION', 'FINANCIAL_AUDIT_REPORT', 'POLLUTION_CLEARANCE', 'OCCUPANCY_CERTIFICATE');

-- CreateEnum
CREATE TYPE "ExtractionStatus" AS ENUM ('UPLOADED', 'QUEUED', 'PROCESSING', 'EXTRACTED', 'NEEDS_REVIEW', 'FAILED');

-- CreateEnum
CREATE TYPE "ValidationOutcome" AS ENUM ('PASS', 'FAIL', 'WARNING', 'NEEDS_REVIEW', 'NOT_APPLICABLE', 'UNABLE_TO_VERIFY');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'DISCREPANCY_FOUND', 'UNABLE_TO_VERIFY', 'UNSUPPORTED', 'ERROR');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "designation" TEXT,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "institutionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "institutions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "website" TEXT,
    "establishedYear" INTEGER NOT NULL,
    "affiliationUniversity" TEXT NOT NULL,
    "status" "InstitutionStatus" NOT NULL DEFAULT 'ACTIVE',
    "authorizedContactName" TEXT NOT NULL,
    "authorizedContactEmail" TEXT NOT NULL,
    "authorizedContactPhone" TEXT NOT NULL,
    "profileCompleteness" INTEGER NOT NULL DEFAULT 80,
    "totalFacultyCount" INTEGER NOT NULL DEFAULT 0,
    "totalStudentCapacity" INTEGER NOT NULL DEFAULT 0,
    "campusAreaAcres" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "institutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL,
    "applicationNumber" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "type" "ApplicationType" NOT NULL,
    "academicYear" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "submissionDate" TIMESTAMP(3),
    "assignedScrutinyOfficerId" TEXT,
    "assignedVerificationOfficerId" TEXT,
    "assignedInspectionOfficerId" TEXT,
    "overallScore" INTEGER,
    "finalDecisionReason" TEXT,
    "finalDecisionDate" TIMESTAMP(3),
    "programmes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_status_history" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "fromStatus" "ApplicationStatus" NOT NULL,
    "toStatus" "ApplicationStatus" NOT NULL,
    "changedById" TEXT NOT NULL,
    "changedByName" TEXT NOT NULL,
    "changedByRole" "UserRole" NOT NULL,
    "reason" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_checklist_items" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "requirement" TEXT NOT NULL,
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "scrutinyNotes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,

    CONSTRAINT "application_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "category" "DocumentCategory" NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "sha256Checksum" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "uploadedByName" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "extractionStatus" "ExtractionStatus" NOT NULL DEFAULT 'UPLOADED',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_extractions" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "confidenceScore" DOUBLE PRECISION,
    "institutionName" TEXT,
    "issuingAuthority" TEXT,
    "referenceNumber" TEXT,
    "issueDate" TEXT,
    "expiryDate" TEXT,
    "academicYear" TEXT,
    "address" TEXT,
    "registrationNumber" TEXT,
    "qrPayload" TEXT,
    "rawTextPreview" TEXT NOT NULL,
    "isCorrectedByOfficer" BOOLEAN NOT NULL DEFAULT false,
    "officerCorrectionNote" TEXT,
    "pages" JSONB,
    "fields" JSONB,
    "ocrError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_extractions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "validation_results" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "ruleTitle" TEXT NOT NULL,
    "outcome" "ValidationOutcome" NOT NULL,
    "explanation" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "ruleVersion" TEXT NOT NULL,
    "overrideBy" TEXT,
    "overrideReason" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "validation_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "duplicate_matches" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "matchedDocumentId" TEXT NOT NULL,
    "matchedApplicationId" TEXT NOT NULL,
    "matchedInstitutionId" TEXT NOT NULL,
    "matchedInstitutionName" TEXT NOT NULL,
    "matchType" TEXT NOT NULL,
    "similarityScore" DOUBLE PRECISION NOT NULL,
    "detectedTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "duplicate_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tasks" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "assignedOfficerId" TEXT NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "externalCheckAttempted" BOOLEAN NOT NULL DEFAULT false,
    "externalSourceUsed" TEXT,
    "attemptTimestamp" TIMESTAMP(3),
    "verificationEvidence" TEXT,
    "manualNotes" TEXT,
    "discrepancyDetails" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspections" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "officerId" TEXT NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "actualDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "overallRecommendation" TEXT NOT NULL DEFAULT 'PENDING',
    "summaryFindings" TEXT,
    "reportSubmittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_findings" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "requiredCapacity" TEXT NOT NULL,
    "verifiedCapacity" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "observations" TEXT NOT NULL,

    CONSTRAINT "inspection_findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clarifications" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "issuedByOfficerId" TEXT NOT NULL,
    "requestedItem" TEXT NOT NULL,
    "detailedReason" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_RESPONSE',
    "responseDate" TIMESTAMP(3),
    "responseText" TEXT,
    "responseDocumentId" TEXT,
    "responseDocumentName" TEXT,
    "resolutionNotes" TEXT,

    CONSTRAINT "clarifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "recipientUserId" TEXT,
    "recipientRole" "UserRole",
    "institutionId" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "type" TEXT NOT NULL DEFAULT 'INFO',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "actorRole" "UserRole" NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "institutionId" TEXT,
    "institutionName" TEXT,
    "outcome" TEXT NOT NULL DEFAULT 'SUCCESS',
    "details" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_institutionId_idx" ON "users"("institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "institutions_code_key" ON "institutions"("code");

-- CreateIndex
CREATE INDEX "institutions_code_idx" ON "institutions"("code");

-- CreateIndex
CREATE INDEX "institutions_state_district_idx" ON "institutions"("state", "district");

-- CreateIndex
CREATE INDEX "institutions_status_idx" ON "institutions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "applications_applicationNumber_key" ON "applications"("applicationNumber");

-- CreateIndex
CREATE INDEX "applications_institutionId_idx" ON "applications"("institutionId");

-- CreateIndex
CREATE INDEX "applications_status_idx" ON "applications"("status");

-- CreateIndex
CREATE INDEX "applications_academicYear_idx" ON "applications"("academicYear");

-- CreateIndex
CREATE INDEX "application_status_history_applicationId_idx" ON "application_status_history"("applicationId");

-- CreateIndex
CREATE INDEX "application_checklist_items_applicationId_idx" ON "application_checklist_items"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "documents_storageKey_key" ON "documents"("storageKey");

-- CreateIndex
CREATE INDEX "documents_applicationId_idx" ON "documents"("applicationId");

-- CreateIndex
CREATE INDEX "documents_institutionId_idx" ON "documents"("institutionId");

-- CreateIndex
CREATE INDEX "documents_sha256Checksum_idx" ON "documents"("sha256Checksum");

-- CreateIndex
CREATE INDEX "documents_category_idx" ON "documents"("category");

-- CreateIndex
CREATE INDEX "document_extractions_documentId_idx" ON "document_extractions"("documentId");

-- CreateIndex
CREATE INDEX "validation_results_documentId_idx" ON "validation_results"("documentId");

-- CreateIndex
CREATE INDEX "validation_results_ruleId_idx" ON "validation_results"("ruleId");

-- CreateIndex
CREATE INDEX "duplicate_matches_documentId_idx" ON "duplicate_matches"("documentId");

-- CreateIndex
CREATE INDEX "duplicate_matches_matchedInstitutionId_idx" ON "duplicate_matches"("matchedInstitutionId");

-- CreateIndex
CREATE INDEX "verification_tasks_documentId_idx" ON "verification_tasks"("documentId");

-- CreateIndex
CREATE INDEX "verification_tasks_assignedOfficerId_idx" ON "verification_tasks"("assignedOfficerId");

-- CreateIndex
CREATE INDEX "verification_tasks_status_idx" ON "verification_tasks"("status");

-- CreateIndex
CREATE INDEX "inspections_applicationId_idx" ON "inspections"("applicationId");

-- CreateIndex
CREATE INDEX "inspections_institutionId_idx" ON "inspections"("institutionId");

-- CreateIndex
CREATE INDEX "inspections_officerId_idx" ON "inspections"("officerId");

-- CreateIndex
CREATE INDEX "inspection_findings_inspectionId_idx" ON "inspection_findings"("inspectionId");

-- CreateIndex
CREATE INDEX "clarifications_applicationId_idx" ON "clarifications"("applicationId");

-- CreateIndex
CREATE INDEX "clarifications_institutionId_idx" ON "clarifications"("institutionId");

-- CreateIndex
CREATE INDEX "clarifications_status_idx" ON "clarifications"("status");

-- CreateIndex
CREATE INDEX "notifications_recipientUserId_idx" ON "notifications"("recipientUserId");

-- CreateIndex
CREATE INDEX "notifications_recipientRole_idx" ON "notifications"("recipientRole");

-- CreateIndex
CREATE INDEX "notifications_institutionId_idx" ON "notifications"("institutionId");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_institutionId_idx" ON "audit_logs"("institutionId");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_status_history" ADD CONSTRAINT "application_status_history_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_checklist_items" ADD CONSTRAINT "application_checklist_items_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_extractions" ADD CONSTRAINT "document_extractions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_results" ADD CONSTRAINT "validation_results_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duplicate_matches" ADD CONSTRAINT "duplicate_matches_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_tasks" ADD CONSTRAINT "verification_tasks_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_officerId_fkey" FOREIGN KEY ("officerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_findings" ADD CONSTRAINT "inspection_findings_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clarifications" ADD CONSTRAINT "clarifications_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clarifications" ADD CONSTRAINT "clarifications_issuedByOfficerId_fkey" FOREIGN KEY ("issuedByOfficerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

