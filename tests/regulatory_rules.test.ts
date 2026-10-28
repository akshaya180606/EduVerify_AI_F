import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateApplicationCompliance, AICTE_REGULATORY_RULES } from '../server/services/regulatoryRules.js';
import { Application, DocumentRecord, Institution } from '../src/types/index.js';

test('AICTE APH Regulatory Checklist & Compliance Rules', async t => {
  const sampleInst: Institution = {
    id: 'INST-TEST-001',
    code: '1-99882211',
    name: 'Metropolitan Institute of Technology',
    type: 'ENGINEERING_TECHNOLOGY',
    address: 'Plot 4, Sector 12',
    district: 'Bengaluru Urban',
    state: 'Karnataka',
    pincode: '560001',
    website: 'https://mit.ac.in',
    establishedYear: 2012,
    affiliationUniversity: 'Visvesvaraya Technological University',
    status: 'ACTIVE',
    authorizedContactName: 'Dr. Suresh Kumar',
    authorizedContactEmail: 'principal@mit.ac.in',
    authorizedContactPhone: '+91 9845012345',
    profileCompleteness: 95,
    totalFacultyCount: 45,
    totalStudentCapacity: 720,
    campusAreaAcres: 3.5, // Meets Urban requirement (2.5 acres)
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const sampleApp: Application = {
    id: 'APP-TEST-EOA',
    applicationNumber: 'AICTE/2026-27/EOA-001',
    institutionId: 'INST-TEST-001',
    institutionName: 'Metropolitan Institute of Technology',
    type: 'EXTENSION_OF_APPROVAL',
    academicYear: '2026-2027',
    status: 'SUBMITTED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    programmes: [
      { name: 'Computer Science & Engineering', level: 'UG', intakeApproved: 180, intakeRequested: 180 },
    ],
  };

  await t.test('1. Fully compliant application docket achieves high score without deficiencies', () => {
    const compliantDocs: DocumentRecord[] = [
      {
        id: 'DOC-1',
        applicationId: 'APP-TEST-EOA',
        institutionId: 'INST-TEST-001',
        category: 'FIRE_SAFETY_CERTIFICATE',
        categoryLabel: 'Fire Safety NOC',
        originalFilename: 'fire_noc_2026.pdf',
        storageKey: 'key1',
        mimeType: 'application/pdf',
        fileSizeBytes: 1024 * 100,
        sha256Checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        uploadedById: 'user-1',
        uploadedByName: 'Principal',
        uploadTimestamp: new Date().toISOString(),
        version: 1,
        extractionStatus: 'EXTRACTED',
        extractedData: {
          documentId: 'DOC-1',
          engineVersion: 'PyMuPDF-v1.24',
          confidenceScore: 98,
          referenceNumber: 'FS-BLR-2026-90',
          expiryDate: '2028-12-31', // Valid
          rawTextPreview: 'Fire safety certificate valid until 2028',
        },
        validationResults: [],
        duplicateMatches: [],
        isVerified: false,
        verificationStatus: 'PENDING',
      },
      {
        id: 'DOC-2',
        applicationId: 'APP-TEST-EOA',
        institutionId: 'INST-TEST-001',
        category: 'BUILDING_PLAN_APPROVAL',
        categoryLabel: 'Building Plan Approval',
        originalFilename: 'building_sanction.pdf',
        storageKey: 'key2',
        mimeType: 'application/pdf',
        fileSizeBytes: 1024 * 500,
        sha256Checksum: 'a3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        uploadedById: 'user-1',
        uploadedByName: 'Principal',
        uploadTimestamp: new Date().toISOString(),
        version: 1,
        extractionStatus: 'EXTRACTED',
        extractedData: {
          documentId: 'DOC-2',
          engineVersion: 'PyMuPDF-v1.24',
          confidenceScore: 95,
          referenceNumber: 'BBMP/BP/2024/771',
          rawTextPreview: 'BBMP sanctioned plan approval for instructional blocks',
        },
        validationResults: [],
        duplicateMatches: [],
        isVerified: false,
        verificationStatus: 'PENDING',
      },
      {
        id: 'DOC-3',
        applicationId: 'APP-TEST-EOA',
        institutionId: 'INST-TEST-001',
        category: 'AFFILIATION_ORDER',
        categoryLabel: 'Affiliation Order',
        originalFilename: 'vtu_affiliation_order.pdf',
        storageKey: 'key3',
        mimeType: 'application/pdf',
        fileSizeBytes: 1024 * 150,
        sha256Checksum: 'b3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        uploadedById: 'user-1',
        uploadedByName: 'Principal',
        uploadTimestamp: new Date().toISOString(),
        version: 1,
        extractionStatus: 'EXTRACTED',
        extractedData: {
          documentId: 'DOC-3',
          engineVersion: 'PyMuPDF-v1.24',
          confidenceScore: 99,
          referenceNumber: 'VTU/ACA/2026-27/341',
          rawTextPreview: 'Continuation of affiliation granted to Metropolitan Institute of Technology',
        },
        validationResults: [],
        duplicateMatches: [],
        isVerified: false,
        verificationStatus: 'PENDING',
      },
      {
        id: 'DOC-4',
        applicationId: 'APP-TEST-EOA',
        institutionId: 'INST-TEST-001',
        category: 'FACULTY_LIST_RATIFICATION',
        categoryLabel: 'Faculty List',
        originalFilename: 'ratified_faculty.pdf',
        storageKey: 'key4',
        mimeType: 'application/pdf',
        fileSizeBytes: 1024 * 200,
        sha256Checksum: 'c3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        uploadedById: 'user-1',
        uploadedByName: 'Principal',
        uploadTimestamp: new Date().toISOString(),
        version: 1,
        extractionStatus: 'EXTRACTED',
        extractedData: {
          documentId: 'DOC-4',
          engineVersion: 'PyMuPDF-v1.24',
          confidenceScore: 94,
          rawTextPreview: 'Ratified faculty roster signed by Registrar',
        },
        validationResults: [],
        duplicateMatches: [],
        isVerified: false,
        verificationStatus: 'PENDING',
      },
      {
        id: 'DOC-5',
        applicationId: 'APP-TEST-EOA',
        institutionId: 'INST-TEST-001',
        category: 'FINANCIAL_AUDIT_REPORT',
        categoryLabel: 'CA Audit Report',
        originalFilename: 'audit_report_fy25.pdf',
        storageKey: 'key5',
        mimeType: 'application/pdf',
        fileSizeBytes: 1024 * 300,
        sha256Checksum: 'd3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        uploadedById: 'user-1',
        uploadedByName: 'Principal',
        uploadTimestamp: new Date().toISOString(),
        version: 1,
        extractionStatus: 'EXTRACTED',
        extractedData: {
          documentId: 'DOC-5',
          engineVersion: 'PyMuPDF-v1.24',
          confidenceScore: 97,
          referenceNumber: 'UDIN-26481023BC9801',
          rawTextPreview: 'Audited balance sheet and income statement with UDIN',
        },
        validationResults: [],
        duplicateMatches: [],
        isVerified: false,
        verificationStatus: 'PENDING',
      },
    ];

    const report = evaluateApplicationCompliance(sampleApp, compliantDocs, sampleInst, new Date('2026-10-24'));

    assert.equal(report.summary.hasCriticalDeficiency, false, 'Compliant docket should have no critical deficiency');
    assert.equal(report.summary.nonCompliantCount, 0);
    assert.ok(report.summary.complianceScore >= 80, `Compliance score (${report.summary.complianceScore}%) should be >= 80%`);
  });

  await t.test('2. Expired Fire NOC triggers mandatory non-compliance with APH Clause reference', () => {
    const expiredFireDocs: DocumentRecord[] = [
      {
        id: 'DOC-EXP-FIRE',
        applicationId: 'APP-TEST-EOA',
        institutionId: 'INST-TEST-001',
        category: 'FIRE_SAFETY_CERTIFICATE',
        categoryLabel: 'Fire Safety NOC',
        originalFilename: 'fire_noc_old.pdf',
        storageKey: 'key-exp',
        mimeType: 'application/pdf',
        fileSizeBytes: 1024 * 100,
        sha256Checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        uploadedById: 'user-1',
        uploadedByName: 'Principal',
        uploadTimestamp: new Date().toISOString(),
        version: 1,
        extractionStatus: 'EXTRACTED',
        extractedData: {
          documentId: 'DOC-EXP-FIRE',
          engineVersion: 'PyMuPDF-v1.24',
          confidenceScore: 95,
          referenceNumber: 'FS-OLD-2024',
          expiryDate: '2025-06-30', // Clearly expired in 2026
          rawTextPreview: 'Fire safety certificate valid until June 2025',
        },
        validationResults: [],
        duplicateMatches: [],
        isVerified: false,
        verificationStatus: 'PENDING',
      },
    ];

    const report = evaluateApplicationCompliance(sampleApp, expiredFireDocs, sampleInst, new Date('2026-10-24'));

    const fireResult = report.results.find(r => r.ruleId === 'APH-FIRE-002');
    assert.ok(fireResult);
    assert.equal(fireResult.outcome, 'NON_COMPLIANT');
    assert.equal(fireResult.aphClause, 'Clause 2.3 & Appendix 15');
    assert.ok(fireResult.explanation.includes('expired'));
    assert.equal(report.summary.hasCriticalDeficiency, true);
  });

  await t.test('3. Student-to-faculty ratio exceeding 1:20 flags statutory non-compliance', () => {
    const deficientInst: Institution = {
      ...sampleInst,
      totalFacultyCount: 20, // 720 students / 20 faculty = 36:1 (violates 1:20 norm)
    };

    const facultyDocs: DocumentRecord[] = [
      {
        id: 'DOC-FAC-1',
        applicationId: 'APP-TEST-EOA',
        institutionId: 'INST-TEST-001',
        category: 'FACULTY_LIST_RATIFICATION',
        categoryLabel: 'Faculty List',
        originalFilename: 'faculty_list.pdf',
        storageKey: 'key-fac',
        mimeType: 'application/pdf',
        fileSizeBytes: 10240,
        sha256Checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        uploadedById: 'user-1',
        uploadedByName: 'Principal',
        uploadTimestamp: new Date().toISOString(),
        version: 1,
        extractionStatus: 'EXTRACTED',
        validationResults: [],
        duplicateMatches: [],
        isVerified: false,
        verificationStatus: 'PENDING',
      },
    ];

    const report = evaluateApplicationCompliance(sampleApp, facultyDocs, deficientInst, new Date('2026-10-24'));
    const facResult = report.results.find(r => r.ruleId === 'APH-FAC-005');
    assert.ok(facResult);
    assert.equal(facResult.outcome, 'NON_COMPLIANT');
    assert.ok(facResult.explanation.includes('1:36.0'));
    assert.ok(facResult.remedialAction?.includes('Recruit additional qualified faculty'));
  });
});
