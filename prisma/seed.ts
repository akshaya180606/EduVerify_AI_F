/**
 * Synthetic Development Seed Script for EduVerify-AI
 * Conforms to AICTE Regulatory Schema
 * Uses synthetic, non-sensitive demo institutions and users.
 */

import { PrismaClient, UserRole, InstitutionStatus, ApplicationType, ApplicationStatus, DocumentCategory, ExtractionStatus, ValidationOutcome, VerificationStatus } from '@prisma/client';
import { getEffectiveDatabaseUrl } from '../server/storage/prisma.js';

const effectiveUrl = getEffectiveDatabaseUrl();
const prisma = new PrismaClient({
  datasources: effectiveUrl ? { db: { url: effectiveUrl } } : undefined,
});

export async function seed() {
  console.log('[Seed] Seeding synthetic development data into PostgreSQL...');

  // 1. Institutions
  const inst1 = await prisma.institution.upsert({
    where: { id: 'INST-2026-001' },
    update: {},
    create: {
      id: 'INST-2026-001',
      code: 'AICTE-1-4928190',
      name: 'National Institute of Engineering & Technology',
      type: 'ENGINEERING_TECHNOLOGY',
      address: 'Sector 62, Institutional Area, Knowledge Park',
      district: 'Noida',
      state: 'Uttar Pradesh',
      pincode: '201309',
      website: 'https://niet.edu.in',
      establishedYear: 2001,
      affiliationUniversity: 'Dr. A.P.J. Abdul Kalam Technical University (AKTU)',
      status: InstitutionStatus.ACCREDITED,
      authorizedContactName: 'Prof. Sunita Rao',
      authorizedContactEmail: 'principal@niet.edu.in',
      authorizedContactPhone: '+91 98101 23456',
      profileCompleteness: 95,
      totalFacultyCount: 142,
      totalStudentCapacity: 2400,
      campusAreaAcres: 18.5,
    },
  });

  const inst2 = await prisma.institution.upsert({
    where: { id: 'INST-2026-002' },
    update: {},
    create: {
      id: 'INST-2026-002',
      code: 'AICTE-1-5829104',
      name: 'Apex Institute of Technology & Management',
      type: 'ENGINEERING_TECHNOLOGY',
      address: 'Plot 4, Silicon Valley Road, Whitefield',
      district: 'Bengaluru Urban',
      state: 'Karnataka',
      pincode: '560066',
      website: 'https://apextech.ac.in',
      establishedYear: 2012,
      affiliationUniversity: 'Visvesvaraya Technological University (VTU)',
      status: InstitutionStatus.ACTIVE,
      authorizedContactName: 'Dr. Vikram Sengupta',
      authorizedContactEmail: 'director@apextech.ac.in',
      authorizedContactPhone: '+91 98450 67890',
      profileCompleteness: 88,
      totalFacultyCount: 98,
      totalStudentCapacity: 1600,
      campusAreaAcres: 12.0,
    },
  });

  // 2. Synthetic Users
  const usersData = [
    {
      id: 'usr-admin-01',
      email: 'admin@aicte-india.org',
      passwordHash: '$2b$10$demo_hash_aicte_admin_2026',
      name: 'Dr. Rajesh Sharma',
      role: UserRole.AICTE_ADMIN,
      designation: 'Advisor & Approval Bureau Chief, AICTE Central',
      phone: '+91 11 2958 1000',
      isActive: true,
      institutionId: null,
    },
    {
      id: 'usr-college-a',
      email: 'principal@niet.edu.in',
      passwordHash: '$2b$10$demo_hash_niet_principal_2026',
      name: 'Prof. Sunita Rao',
      role: UserRole.COLLEGE_MANAGEMENT,
      designation: 'Principal, National Institute of Engineering & Technology',
      phone: '+91 98101 23456',
      isActive: true,
      institutionId: 'INST-2026-001',
    },
    {
      id: 'usr-college-b',
      email: 'director@apextech.ac.in',
      passwordHash: '$2b$10$demo_hash_apex_director_2026',
      name: 'Dr. Vikram Sengupta',
      role: UserRole.COLLEGE_MANAGEMENT,
      designation: 'Director, Apex Institute of Technology & Management',
      phone: '+91 98450 67890',
      isActive: true,
      institutionId: 'INST-2026-002',
    },
    {
      id: 'usr-scrutiny-01',
      email: 'scrutiny.kumar@aicte.gov.in',
      passwordHash: '$2b$10$demo_hash_scrutiny_officer_2026',
      name: 'Er. Amit Kumar',
      role: UserRole.SCRUTINY_OFFICER,
      designation: 'Senior Scrutiny Officer, Northern Regional Office',
      phone: '+91 11 2958 1240',
      isActive: true,
      institutionId: null,
    },
    {
      id: 'usr-verify-01',
      email: 'verify.patel@aicte.gov.in',
      passwordHash: '$2b$10$demo_hash_verify_officer_2026',
      name: 'Dr. Priya Patel',
      role: UserRole.VERIFICATION_OFFICER,
      designation: 'Lead Document Verification Officer, Regulatory Cell',
      phone: '+91 11 2958 1350',
      isActive: true,
      institutionId: null,
    },
    {
      id: 'usr-inspect-01',
      email: 'inspect.sharma@aicte.gov.in',
      passwordHash: '$2b$10$demo_hash_inspect_officer_2026',
      name: 'Prof. Arvind Sharma',
      role: UserRole.INSPECTION_OFFICER,
      designation: 'Expert Visiting Committee (EVC) Chairman',
      phone: '+91 94120 54321',
      isActive: true,
      institutionId: null,
    },
  ];

  for (const u of usersData) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: {},
      create: u,
    });
  }

  // 3. Applications
  const app1 = await prisma.application.upsert({
    where: { id: 'APP-2026-001' },
    update: {},
    create: {
      id: 'APP-2026-001',
      applicationNumber: 'AICTE/2026-27/EOA-8492',
      institutionId: 'INST-2026-001',
      type: ApplicationType.EXTENSION_OF_APPROVAL,
      academicYear: '2026-2027',
      status: ApplicationStatus.UNDER_SCRUTINY,
      submissionDate: new Date('2026-10-10T14:30:00.000Z'),
      assignedScrutinyOfficerId: 'usr-scrutiny-01',
      assignedVerificationOfficerId: 'usr-verify-01',
      assignedInspectionOfficerId: 'usr-inspect-01',
      overallScore: 84,
      programmes: [
        { name: 'Computer Science and Engineering', level: 'UG', intakeApproved: 180, intakeRequested: 240 },
        { name: 'Artificial Intelligence & Data Science', level: 'UG', intakeApproved: 60, intakeRequested: 120 },
        { name: 'Electronics and Communication Engineering', level: 'UG', intakeApproved: 120, intakeRequested: 120 },
        { name: 'M.Tech Cyber Security', level: 'PG', intakeApproved: 18, intakeRequested: 30 },
      ],
    },
  });

  const app2 = await prisma.application.upsert({
    where: { id: 'APP-2026-002' },
    update: {},
    create: {
      id: 'APP-2026-002',
      applicationNumber: 'AICTE/2026-27/NEW-1049',
      institutionId: 'INST-2026-002',
      type: ApplicationType.NEW_APPLICANT,
      academicYear: '2026-2027',
      status: ApplicationStatus.UNDER_VERIFICATION,
      submissionDate: new Date('2026-10-05T11:00:00.000Z'),
      assignedScrutinyOfficerId: 'usr-scrutiny-01',
      assignedVerificationOfficerId: 'usr-verify-01',
      overallScore: 78,
      programmes: [
        { name: 'Mechanical Engineering (Robotics)', level: 'UG', intakeApproved: 60, intakeRequested: 60 },
        { name: 'MBA Innovation & Entrepreneurship', level: 'PG', intakeApproved: 60, intakeRequested: 120 },
      ],
    },
  });

  // 4. Application Status History
  await prisma.applicationStatusHistory.deleteMany({
    where: { applicationId: { in: ['APP-2026-001', 'APP-2026-002'] } },
  });

  await prisma.applicationStatusHistory.createMany({
    data: [
      {
        id: 'hist-1',
        applicationId: 'APP-2026-001',
        fromStatus: ApplicationStatus.DRAFT,
        toStatus: ApplicationStatus.SUBMITTED,
        changedById: 'usr-college-a',
        changedByName: 'Prof. Sunita Rao',
        changedByRole: UserRole.COLLEGE_MANAGEMENT,
        reason: 'Final submission of EoA 2026-27 docket with fee transaction reference #TXN904812.',
        timestamp: new Date('2026-10-10T14:30:00.000Z'),
      },
      {
        id: 'hist-2',
        applicationId: 'APP-2026-001',
        fromStatus: ApplicationStatus.SUBMITTED,
        toStatus: ApplicationStatus.UNDER_SCRUTINY,
        changedById: 'usr-admin-01',
        changedByName: 'Dr. Rajesh Sharma',
        changedByRole: UserRole.AICTE_ADMIN,
        reason: 'Auto-assigned to Northern Regional Scrutiny Officer Er. Amit Kumar.',
        timestamp: new Date('2026-10-11T09:15:00.000Z'),
      },
    ],
  });

  // 5. Checklist Items
  await prisma.applicationChecklistItem.deleteMany({
    where: { applicationId: 'APP-2026-001' },
  });

  await prisma.applicationChecklistItem.createMany({
    data: [
      {
        id: 'chk-1',
        applicationId: 'APP-2026-001',
        category: 'Land & Legal Ownership',
        requirement: 'Clear title and non-encumbrance land ownership deed of >= 7.5 contiguous acres for mega-city / urban zone.',
        isMandatory: true,
        status: 'COMPLIANT',
        scrutinyNotes: 'Verified 18.5 acres registered in 2001. No mortgages recorded in revenue register.',
        reviewedAt: new Date('2026-10-14T10:00:00.000Z'),
        reviewedBy: 'Er. Amit Kumar',
      },
      {
        id: 'chk-2',
        applicationId: 'APP-2026-001',
        category: 'Safety & Municipal Approvals',
        requirement: 'Current Fire Safety NOC issued by Competent Fire Officer valid for the operating academic cycle.',
        isMandatory: true,
        status: 'COMPLIANT',
        scrutinyNotes: 'NOC valid up to June 2028. Pressurized sprinkler system inspected.',
        reviewedAt: new Date('2026-10-14T10:15:00.000Z'),
        reviewedBy: 'Er. Amit Kumar',
      },
      {
        id: 'chk-3',
        applicationId: 'APP-2026-001',
        category: 'Faculty Cadre Ratio',
        requirement: 'Sanctioned faculty list adhering to 1:20 teacher-student ratio for UG Engineering and 1:15 for PG.',
        isMandatory: true,
        status: 'CLARIFICATION_REQUIRED',
        scrutinyNotes: 'Ratio in AI & Data Science shows 1:24. Clarification required regarding ratified professor recruitments.',
        reviewedAt: new Date('2026-10-14T11:00:00.000Z'),
        reviewedBy: 'Er. Amit Kumar',
      },
      {
        id: 'chk-4',
        applicationId: 'APP-2026-001',
        category: 'Physical Infrastructure',
        requirement: 'Approved architectural floor plans demonstrating barrier-free ramps, elevators, and disabled-friendly facilities.',
        isMandatory: true,
        status: 'PENDING',
        scrutinyNotes: 'Under review by municipal liaison officer.',
      },
    ],
  });

  // 6. Documents & OCR Extractions & Validations
  const docDataList = [
    {
      id: 'DOC-2026-001',
      applicationId: 'APP-2026-001',
      institutionId: 'INST-2026-001',
      category: DocumentCategory.LAND_TITLE_DEED,
      originalFilename: 'NIET_Registered_Land_Deed_2026.pdf',
      storageKey: 'institutions/INST-2026-001/docs/land_title_deed_17192001.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 2458920,
      sha256Checksum: 'a7b8c9d0e1f234567890abcdef1234567890abcdef1234567890abcdef123456',
      uploadedById: 'usr-college-a',
      uploadedByName: 'Prof. Sunita Rao',
      version: 1,
      extractionStatus: ExtractionStatus.EXTRACTED,
      isVerified: true,
      verificationStatus: VerificationStatus.VERIFIED,
      createdAt: new Date('2026-10-09T11:20:00.000Z'),
      extraction: {
        id: 'ext-1',
        engineVersion: 'PyMuPDF-v1.24+PaddleOCR-v2.7',
        confidenceScore: 96.5,
        institutionName: 'National Institute of Engineering & Technology',
        issuingAuthority: 'Sub-Registrar Office, Gautam Buddha Nagar, UP',
        referenceNumber: 'REG-DEED-2001-VOL-84-PG-119',
        issueDate: '2001-04-18',
        academicYear: 'Perpetual',
        address: 'Plot 19, Knowledge Park II, Greater Noida',
        qrPayload: 'https://igrsup.gov.in/verifyDeed?ref=REG-DEED-2001-VOL-84-PG-119',
        rawTextPreview: 'GOVERNMENT OF UTTAR PRADESH - REGISTRATION DEPARTMENT: Registered Deed of Conveyance in favor of National Institute of Engineering & Technology Society...',
      },
      validations: [
        {
          id: 'val-1',
          ruleId: 'RULE-INT-001',
          ruleTitle: 'File Integrity & Size Compliance',
          outcome: ValidationOutcome.PASS,
          explanation: 'File size (2.34 MB) within limits; valid SHA-256 integrity seal.',
          evidence: 'SHA-256: a7b8c9d0e1f2... (2458920 bytes)',
          ruleVersion: '1.2.0',
        },
        {
          id: 'val-2',
          ruleId: 'RULE-CON-003',
          ruleTitle: 'Institution Name Alignment',
          outcome: ValidationOutcome.PASS,
          explanation: 'Extracted deed title matches official institution name (100% token similarity).',
          evidence: '"National Institute of Engineering & Technology"',
          ruleVersion: '2.0.1',
        },
      ],
    },
    {
      id: 'DOC-2026-002',
      applicationId: 'APP-2026-001',
      institutionId: 'INST-2026-001',
      category: DocumentCategory.FIRE_SAFETY_CERTIFICATE,
      originalFilename: 'Fire_NOC_Validity_2027.pdf',
      storageKey: 'institutions/INST-2026-001/docs/fire_safety_cert_17192002.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 840291,
      sha256Checksum: 'b8c9d0e1f234567890abcdef1234567890abcdef1234567890abcdef1234567a',
      uploadedById: 'usr-college-a',
      uploadedByName: 'Prof. Sunita Rao',
      version: 1,
      extractionStatus: ExtractionStatus.EXTRACTED,
      isVerified: true,
      verificationStatus: VerificationStatus.VERIFIED,
      createdAt: new Date('2026-10-09T11:25:00.000Z'),
      extraction: {
        id: 'ext-2',
        engineVersion: 'PyMuPDF-v1.24+PaddleOCR-v2.7',
        confidenceScore: 94.0,
        institutionName: 'National Institute of Engineering & Technology',
        issuingAuthority: 'Chief Fire Officer, Fire Service Headquarter, Noida',
        referenceNumber: 'CFO/UPFS/2025/NOC-4891',
        issueDate: '2025-06-14',
        expiryDate: '2028-06-13',
        address: 'Sector 62, Institutional Area, Noida',
        rawTextPreview: 'OFFICE OF THE CHIEF FIRE OFFICER: RENEWAL CERTIFICATE OF FIRE SAFETY. Certified that all multi-storey academic blocks are fitted with pressurized hydrant rings...',
      },
      validations: [
        {
          id: 'val-3',
          ruleId: 'RULE-VAL-004',
          ruleTitle: 'Document Expiration and Validity Check',
          outcome: ValidationOutcome.PASS,
          explanation: 'NOC valid through 2028-06-13 (Active regulatory coverage).',
          evidence: 'Expiry: 2028-06-13 (Current: 2026-10-24)',
          ruleVersion: '1.4.0',
        },
      ],
    },
    {
      id: 'DOC-2026-003',
      applicationId: 'APP-2026-001',
      institutionId: 'INST-2026-001',
      category: DocumentCategory.BUILDING_PLAN_APPROVAL,
      originalFilename: 'Municipal_Approved_Building_Plan.pdf',
      storageKey: 'institutions/INST-2026-001/docs/building_plan_17192003.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 4912030,
      sha256Checksum: 'c9d0e1f234567890abcdef1234567890abcdef1234567890abcdef1234567ab8',
      uploadedById: 'usr-college-a',
      uploadedByName: 'Prof. Sunita Rao',
      version: 1,
      extractionStatus: ExtractionStatus.NEEDS_REVIEW,
      isVerified: false,
      verificationStatus: VerificationStatus.PENDING,
      createdAt: new Date('2026-10-09T11:32:00.000Z'),
      extraction: {
        id: 'ext-3',
        engineVersion: 'PyMuPDF-v1.24+PaddleOCR-v2.7',
        confidenceScore: 71.0,
        institutionName: 'NIET Educational Trust',
        issuingAuthority: 'NOIDA Development Authority - Planning Dept',
        referenceNumber: 'NOIDA/BP/2019/3902',
        issueDate: '2019-11-20',
        rawTextPreview: 'NOIDA DEVELOPMENT AUTHORITY - SANCTION LETTER: Map approved for Academic Block A, B, C and Central Library with total built-up area of 42,000 sq.m...',
      },
      validations: [
        {
          id: 'val-4',
          ruleId: 'RULE-MET-002',
          ruleTitle: 'Mandatory Metadata Extraction Presence',
          outcome: ValidationOutcome.WARNING,
          explanation: 'Blueprint layout scan has lower OCR clarity on engineer seals (71% confidence). Officer inspection advised.',
          evidence: 'Confidence: 71% | Floor area schedule requires visual confirmation.',
          ruleVersion: '1.1.0',
        },
      ],
    },
    {
      id: 'DOC-2026-004',
      applicationId: 'APP-2026-002',
      institutionId: 'INST-2026-002',
      category: DocumentCategory.LAND_TITLE_DEED,
      originalFilename: 'Apex_Deed_Whitefield_2026.pdf',
      storageKey: 'institutions/INST-2026-002/docs/apex_land_17192004.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 3109400,
      sha256Checksum: 'd0e1f234567890abcdef1234567890abcdef1234567890abcdef1234567ab8c9',
      uploadedById: 'usr-college-b',
      uploadedByName: 'Dr. Vikram Sengupta',
      version: 1,
      extractionStatus: ExtractionStatus.EXTRACTED,
      isVerified: false,
      verificationStatus: VerificationStatus.PENDING,
      createdAt: new Date('2026-10-04T10:15:00.000Z'),
      extraction: {
        id: 'ext-4',
        engineVersion: 'PyMuPDF-v1.24+PaddleOCR-v2.7',
        confidenceScore: 95.0,
        institutionName: 'Apex Institute of Technology & Management',
        issuingAuthority: 'Senior Sub-Registrar, KR Puram, Bangalore',
        referenceNumber: 'KRP-DEED-2012-BOOK1-DOC490',
        issueDate: '2012-08-22',
        address: 'Plot 4, Silicon Valley Road, Whitefield',
        rawTextPreview: 'GOVERNMENT OF KARNATAKA REGISTRATION AND STAMPS: Absolute sale deed in respect of conversion of non-agricultural land for educational campus...',
      },
      validations: [
        {
          id: 'val-5',
          ruleId: 'RULE-INT-001',
          ruleTitle: 'File Integrity & Size Compliance',
          outcome: ValidationOutcome.PASS,
          explanation: 'File size and SHA-256 seal valid.',
          evidence: 'Bytes: 3109400',
          ruleVersion: '1.2.0',
        },
      ],
    },
  ];

  for (const doc of docDataList) {
    const { extraction, validations, ...docFields } = doc;
    await prisma.document.upsert({
      where: { id: doc.id },
      update: {},
      create: docFields,
    });

    if (extraction) {
      await prisma.documentExtraction.deleteMany({ where: { documentId: doc.id } });
      await prisma.documentExtraction.create({
        data: {
          ...extraction,
          documentId: doc.id,
        },
      });
    }

    if (validations && validations.length > 0) {
      await prisma.validationResult.deleteMany({ where: { documentId: doc.id } });
      for (const val of validations) {
        await prisma.validationResult.create({
          data: {
            ...val,
            documentId: doc.id,
          },
        });
      }
    }
  }

  // 7. Verification Tasks
  await prisma.verificationTask.deleteMany({
    where: { id: { in: ['VT-2026-001', 'VT-2026-002', 'VT-2026-003'] } },
  });

  await prisma.verificationTask.createMany({
    data: [
      {
        id: 'VT-2026-001',
        documentId: 'DOC-2026-001',
        assignedOfficerId: 'usr-verify-01',
        status: VerificationStatus.VERIFIED,
        externalCheckAttempted: true,
        externalSourceUsed: 'UP State IGRSUP Revenue Portal API (Sandbox Adapter)',
        attemptTimestamp: new Date('2026-10-12T15:45:00.000Z'),
        verificationEvidence: 'IGRSUP Match: Registration Reference REG-DEED-2001-VOL-84 verified against district revenue registry. Grantee: NIET Educational Society.',
        manualNotes: 'QR code URL tested and verified against safe domain whitelist.',
      },
      {
        id: 'VT-2026-002',
        documentId: 'DOC-2026-003',
        assignedOfficerId: 'usr-verify-01',
        status: VerificationStatus.PENDING,
        externalCheckAttempted: false,
      },
      {
        id: 'VT-2026-003',
        documentId: 'DOC-2026-004',
        assignedOfficerId: 'usr-verify-01',
        status: VerificationStatus.PENDING,
        externalCheckAttempted: false,
      },
    ],
  });

  // 8. Inspections & Findings
  await prisma.inspection.upsert({
    where: { id: 'INSP-2026-001' },
    update: {},
    create: {
      id: 'INSP-2026-001',
      applicationId: 'APP-2026-001',
      institutionId: 'INST-2026-001',
      officerId: 'usr-inspect-01',
      scheduledDate: new Date('2026-11-04T10:00:00.000Z'),
      status: 'SCHEDULED',
      overallRecommendation: 'PENDING',
      summaryFindings: 'Preliminary digital docket complete. On-site physical surprise inspection scheduled for November 4, 2026.',
    },
  });

  await prisma.inspectionFinding.deleteMany({
    where: { inspectionId: 'INSP-2026-001' },
  });

  await prisma.inspectionFinding.createMany({
    data: [
      {
        id: 'insp-f-1',
        inspectionId: 'INSP-2026-001',
        category: 'CLASSROOMS',
        label: 'Smart Classrooms & Lecture Halls',
        requiredCapacity: '48 Classrooms (66 sq.m each with AV & WiFi)',
        verifiedCapacity: 'Pending Physical Verification',
        status: 'COMPLIANT',
        observations: 'Pre-inspection geo-tagged video evidence uploaded by institution.',
      },
      {
        id: 'insp-f-2',
        inspectionId: 'INSP-2026-001',
        category: 'LABORATORIES',
        label: 'Specialized Hardware & Software Labs',
        requiredCapacity: '24 Department Labs with licensed CAD & Simulation packages',
        verifiedCapacity: 'Pending Physical Verification',
        status: 'COMPLIANT',
        observations: 'AICTE Idea Lab setup confirmed with CNC and 3D printing equipment.',
      },
      {
        id: 'insp-f-3',
        inspectionId: 'INSP-2026-001',
        category: 'LIBRARY',
        label: 'Central Digital & Print Library',
        requiredCapacity: '>= 45,000 Volumes and IEEE/Springer E-Journals subscription',
        verifiedCapacity: 'Pending Physical Verification',
        status: 'COMPLIANT',
        observations: 'E-consortium subscription active.',
      },
      {
        id: 'insp-f-4',
        inspectionId: 'INSP-2026-001',
        category: 'COMPUTING_FACILITIES',
        label: 'Central Computer Center & High-Speed Bandwidth',
        requiredCapacity: '1,200 Workstations (i7/16GB) and 1 Gbps redundant leased line',
        verifiedCapacity: 'Pending Physical Verification',
        status: 'COMPLIANT',
        observations: 'Dual-ring optical fiber connection provided by Tata Tele.',
      },
      {
        id: 'insp-f-5',
        inspectionId: 'INSP-2026-001',
        category: 'SAFETY_ACCESSIBILITY',
        label: 'Barrier-Free Campus, Fire Alarms & CCTV',
        requiredCapacity: 'Braille signage, wheelchair ramps on all floors, zero-effluent STP',
        verifiedCapacity: 'Pending Physical Verification',
        status: 'COMPLIANT',
        observations: 'All building wings equipped with lifts and ramps.',
      },
    ],
  });

  // 9. Clarifications
  await prisma.clarification.upsert({
    where: { id: 'CLAR-2026-001' },
    update: {},
    create: {
      id: 'CLAR-2026-001',
      applicationId: 'APP-2026-001',
      institutionId: 'INST-2026-001',
      issuedByOfficerId: 'usr-scrutiny-01',
      requestedItem: 'Faculty Cadre Ratification Orders for AI & Data Science Department',
      detailedReason: 'The requested intake increase from 60 to 120 students in AI & Data Science requires 3 additional ratified associate professors/professors as per AICTE Approval Process Handbook (APH) Table 2.1.',
      issuedAt: new Date('2026-10-15T11:15:00.000Z'),
      dueDate: new Date('2026-10-29T23:59:59.000Z'),
      status: 'PENDING_RESPONSE',
    },
  });

  // 10. Notifications
  await prisma.notification.deleteMany({
    where: { id: { in: ['NOTIF-001', 'NOTIF-002', 'NOTIF-003'] } },
  });

  await prisma.notification.createMany({
    data: [
      {
        id: 'NOTIF-001',
        recipientRole: UserRole.COLLEGE_MANAGEMENT,
        institutionId: 'INST-2026-001',
        title: 'Clarification Required: Faculty Cadre Ratio',
        message: 'Scrutiny Officer Er. Amit Kumar issued a clarification on application AICTE/2026-27/EOA-8492. Due date: Oct 29, 2026.',
        link: '/clarifications',
        isRead: false,
        timestamp: new Date('2026-10-15T11:15:00.000Z'),
        type: 'ACTION_REQUIRED',
      },
      {
        id: 'NOTIF-002',
        recipientRole: UserRole.SCRUTINY_OFFICER,
        title: 'New EoA Application Docket Assigned',
        message: 'National Institute of Engineering & Technology submitted EoA 2026-27 application for scrutiny evaluation.',
        link: '/scrutiny',
        isRead: false,
        timestamp: new Date('2026-10-11T09:15:00.000Z'),
        type: 'INFO',
      },
      {
        id: 'NOTIF-003',
        recipientRole: UserRole.AICTE_ADMIN,
        title: 'Regulatory Audit: System Integrity Check Complete',
        message: 'Daily automated SHA-256 cross-document tamper and duplicate check executed across 4,120 active dockets.',
        link: '/audit',
        isRead: true,
        timestamp: new Date('2026-10-24T00:00:00.000Z'),
        type: 'SUCCESS',
      },
    ],
  });

  // 11. Append-Only Audit Logs
  await prisma.auditLog.deleteMany({
    where: { id: { in: ['AUDIT-101', 'AUDIT-102', 'AUDIT-103', 'AUDIT-104'] } },
  });

  await prisma.auditLog.createMany({
    data: [
      {
        id: 'AUDIT-101',
        actorId: 'usr-college-a',
        actorName: 'Prof. Sunita Rao',
        actorRole: UserRole.COLLEGE_MANAGEMENT,
        action: 'SUBMIT_APPLICATION',
        entityType: 'APPLICATION',
        entityId: 'APP-2026-001',
        institutionId: 'INST-2026-001',
        institutionName: 'National Institute of Engineering & Technology',
        timestamp: new Date('2026-10-10T14:30:00.000Z'),
        outcome: 'SUCCESS',
        details: 'Submitted EoA 2026-27 docket with 3 uploaded mandatory compliance certificates.',
      },
      {
        id: 'AUDIT-102',
        actorId: 'usr-admin-01',
        actorName: 'Dr. Rajesh Sharma',
        actorRole: UserRole.AICTE_ADMIN,
        action: 'ASSIGN_OFFICERS',
        entityType: 'APPLICATION',
        entityId: 'APP-2026-001',
        institutionId: 'INST-2026-001',
        institutionName: 'National Institute of Engineering & Technology',
        timestamp: new Date('2026-10-11T09:15:00.000Z'),
        outcome: 'SUCCESS',
        details: 'Assigned Scrutiny Officer: Er. Amit Kumar; Verification Officer: Dr. Priya Patel; Inspection: Prof. Arvind Sharma.',
      },
      {
        id: 'AUDIT-103',
        actorId: 'usr-verify-01',
        actorName: 'Dr. Priya Patel',
        actorRole: UserRole.VERIFICATION_OFFICER,
        action: 'VERIFY_DOCUMENT_SOURCE',
        entityType: 'DOCUMENT',
        entityId: 'DOC-2026-001',
        institutionId: 'INST-2026-001',
        institutionName: 'National Institute of Engineering & Technology',
        timestamp: new Date('2026-10-12T15:45:00.000Z'),
        outcome: 'SUCCESS',
        details: 'Verified Land Title Deed against UP State IGRSUP Portal. Issuer reference confirmed authentic.',
      },
      {
        id: 'AUDIT-104',
        actorId: 'usr-scrutiny-01',
        actorName: 'Er. Amit Kumar',
        actorRole: UserRole.SCRUTINY_OFFICER,
        action: 'ISSUE_CLARIFICATION',
        entityType: 'CLARIFICATION',
        entityId: 'CLAR-2026-001',
        institutionId: 'INST-2026-001',
        institutionName: 'National Institute of Engineering & Technology',
        timestamp: new Date('2026-10-15T11:15:00.000Z'),
        outcome: 'SUCCESS',
        details: 'Issued clarification requirement for AI & Data Science faculty cadre orders. Deadline set to 2026-10-29.',
      },
    ],
  });

  console.log('[Seed] Synthetic database seeding completed successfully!');
}

if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  seed()
    .catch((err) => {
      console.error('[Seed Error]:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
