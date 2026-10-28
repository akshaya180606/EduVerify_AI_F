export type UserRole = 
  | 'AICTE_ADMIN'
  | 'COLLEGE_MANAGEMENT'
  | 'SCRUTINY_OFFICER'
  | 'VERIFICATION_OFFICER'
  | 'INSPECTION_OFFICER';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  institutionId?: string; // Strictly set for COLLEGE_MANAGEMENT
  designation?: string;
  phone?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Institution {
  id: string;
  code: string; // e.g. "AICTE-ENG-1042"
  name: string;
  type: 'ENGINEERING_TECHNOLOGY' | 'MANAGEMENT' | 'PHARMACY' | 'ARCHITECTURE' | 'APPLIED_ARTS';
  address: string;
  district: string;
  state: string;
  pincode: string;
  website: string;
  establishedYear: number;
  affiliationUniversity: string;
  status: 'ACTIVE' | 'ACCREDITED' | 'PROVISIONAL' | 'SUSPENDED';
  authorizedContactName: string;
  authorizedContactEmail: string;
  authorizedContactPhone: string;
  profileCompleteness: number; // 0 - 100%
  totalFacultyCount: number;
  totalStudentCapacity: number;
  campusAreaAcres: number;
  createdAt: string;
  updatedAt: string;
}

export type ApplicationType = 'NEW_APPLICANT' | 'EXTENSION_OF_APPROVAL';

export type ApplicationStatus = 
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_SCRUTINY'
  | 'CLARIFICATION_REQUIRED'
  | 'RESUBMITTED'
  | 'UNDER_VERIFICATION'
  | 'INSPECTION_PENDING'
  | 'UNDER_INSPECTION'
  | 'RECOMMENDATION_SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'WITHDRAWN';

export interface Application {
  id: string;
  applicationNumber: string; // e.g., "AICTE/2026-27/APP-8492"
  institutionId: string;
  institutionName: string;
  type: ApplicationType;
  academicYear: string; // e.g., "2026-2027"
  status: ApplicationStatus;
  submissionDate?: string;
  assignedScrutinyOfficerId?: string;
  assignedScrutinyOfficerName?: string;
  assignedVerificationOfficerId?: string;
  assignedVerificationOfficerName?: string;
  assignedInspectionOfficerId?: string;
  assignedInspectionOfficerName?: string;
  programmes: Array<{
    name: string;
    level: 'UG' | 'PG' | 'DIPLOMA';
    intakeApproved: number;
    intakeRequested: number;
  }>;
  overallScore?: number;
  finalDecisionReason?: string;
  finalDecisionDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationStatusHistory {
  id: string;
  applicationId: string;
  fromStatus: ApplicationStatus;
  toStatus: ApplicationStatus;
  changedById: string;
  changedByName: string;
  changedByRole: UserRole;
  reason: string;
  timestamp: string;
}

export type DocumentCategory = 
  | 'LAND_TITLE_DEED'
  | 'BUILDING_PLAN_APPROVAL'
  | 'FIRE_SAFETY_CERTIFICATE'
  | 'AFFILIATION_ORDER'
  | 'FACULTY_LIST_RATIFICATION'
  | 'FINANCIAL_AUDIT_REPORT'
  | 'POLLUTION_CLEARANCE'
  | 'OCCUPANCY_CERTIFICATE';

export type DocumentExtractionStatus = 'UPLOADED' | 'QUEUED' | 'PROCESSING' | 'EXTRACTED' | 'NEEDS_REVIEW' | 'FAILED';

export type ValidationOutcome = 'PASS' | 'FAIL' | 'WARNING' | 'NEEDS_REVIEW' | 'NOT_APPLICABLE' | 'UNABLE_TO_VERIFY';

export interface DocumentRecord {
  id: string;
  applicationId: string;
  institutionId: string;
  category: DocumentCategory;
  categoryLabel: string;
  originalFilename: string;
  storageKey: string;
  mimeType: string;
  fileSizeBytes: number;
  sha256Checksum: string;
  uploadedById: string;
  uploadedByName: string;
  uploadTimestamp: string;
  version: number;
  extractionStatus: DocumentExtractionStatus;
  extractedData?: ExtractedDocumentData;
  validationResults: ValidationResultItem[];
  duplicateMatches: DuplicateMatch[];
  isVerified: boolean;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'DISCREPANCY_FOUND' | 'UNABLE_TO_VERIFY';
  comments?: string;
}

export interface ExtractedFieldDetail {
  value: string | null;
  page?: number;
  source_snippet?: string;
  sourceSnippet?: string;
  method: string;
  confidence?: number | null;
  is_missing?: boolean;
  isMissing?: boolean;
  missing_reason?: string;
  missingReason?: string;
}

export interface ExtractedPageDetail {
  page_number?: number;
  pageNumber?: number;
  char_count?: number;
  charCount?: number;
  extraction_method?: string;
  extractionMethod?: string;
  confidence?: number | null;
  text_preview?: string;
  textPreview?: string;
}

export interface ExtractedDocumentData {
  documentId: string;
  engineVersion: string;
  confidenceScore: number | null; // 0 - 100 or null if N/A
  institutionName?: string;
  studentName?: string;
  candidateName?: string;
  courseOrQualification?: string;
  qualification?: string;
  marksOrGrade?: string;
  issuingAuthority?: string;
  referenceNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  academicYear?: string;
  address?: string;
  registrationNumber?: string;
  qrPayload?: string;
  rawTextPreview: string;
  pageCount?: number;
  pages?: ExtractedPageDetail[];
  fields?: Record<string, ExtractedFieldDetail>;
  ocrError?: string;
  isCorrectedByOfficer?: boolean;
  officerCorrectionNote?: string;
}

export interface ValidationResultItem {
  id: string;
  ruleId: string;
  ruleTitle: string;
  outcome: ValidationOutcome;
  explanation: string;
  evidence: string;
  timestamp: string;
  ruleVersion: string;
  overrideBy?: string;
  overrideReason?: string;
}

export interface DuplicateMatch {
  matchedDocumentId: string;
  matchedApplicationId: string;
  matchedInstitutionId: string;
  matchedInstitutionName: string;
  matchType: 'EXACT_HASH' | 'NEAR_SIMILARITY';
  similarityScore: number; // 100 for exact, 0-99 for near
  detectedTimestamp: string;
}

export interface ScrutinyChecklistItem {
  id: string;
  applicationId: string;
  category: string;
  requirement: string;
  isMandatory: boolean;
  status: 'PENDING' | 'COMPLIANT' | 'NON_COMPLIANT' | 'CLARIFICATION_REQUIRED' | 'NOT_APPLICABLE';
  scrutinyNotes?: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface VerificationTask {
  id: string;
  documentId: string;
  applicationId: string;
  institutionId: string;
  documentCategory: DocumentCategory;
  documentTitle: string;
  assignedOfficerId: string;
  assignedOfficerName: string;
  status: 'PENDING' | 'VERIFIED' | 'DISCREPANCY_FOUND' | 'UNABLE_TO_VERIFY';
  externalCheckAttempted: boolean;
  externalSourceUsed?: string;
  attemptTimestamp?: string;
  verificationEvidence?: string;
  manualNotes?: string;
  discrepancyDetails?: string;
  updatedAt: string;
}

export interface InspectionRecord {
  id: string;
  applicationId: string;
  institutionId: string;
  institutionName: string;
  officerId: string;
  officerName: string;
  scheduledDate: string;
  actualDate?: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  categories: {
    category: 'CLASSROOMS' | 'LABORATORIES' | 'LIBRARY' | 'COMPUTING_FACILITIES' | 'FACULTY_VERIFICATION' | 'SAFETY_ACCESSIBILITY';
    label: string;
    requiredCapacity: string;
    verifiedCapacity: string;
    status: 'COMPLIANT' | 'NON_COMPLIANT' | 'NEEDS_IMPROVEMENT';
    observations: string;
  }[];
  overallRecommendation: 'RECOMMEND_APPROVAL' | 'RECOMMEND_REJECTION' | 'CONDITIONAL_APPROVAL' | 'PENDING';
  summaryFindings: string;
  reportSubmittedAt?: string;
  createdAt: string;
}

export interface Clarification {
  id: string;
  applicationId: string;
  institutionId: string;
  institutionName: string;
  issuedByOfficerId: string;
  issuedByOfficerName: string;
  requestedItem: string;
  detailedReason: string;
  issuedAt: string;
  dueDate: string;
  status: 'PENDING_RESPONSE' | 'SUBMITTED' | 'RESOLVED' | 'REJECTED';
  responseDate?: string;
  responseText?: string;
  responseDocumentId?: string;
  responseDocumentName?: string;
  resolutionNotes?: string;
}

export interface NotificationItem {
  id: string;
  recipientUserId?: string;
  recipientRole?: UserRole;
  institutionId?: string;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  timestamp: string;
  type: 'INFO' | 'WARNING' | 'ACTION_REQUIRED' | 'SUCCESS';
}

export interface AuditLogItem {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  entityType: 'APPLICATION' | 'DOCUMENT' | 'INSTITUTION' | 'USER' | 'VERIFICATION' | 'INSPECTION' | 'CLARIFICATION' | 'VALIDATION_RULE';
  entityId: string;
  institutionId?: string;
  institutionName?: string;
  timestamp: string;
  outcome: 'SUCCESS' | 'DENIED' | 'FAILED';
  details: string;
}
