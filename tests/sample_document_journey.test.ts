import test from 'node:test';
import assert from 'node:assert/strict';
import { computeSHA256, generateSafeStorageKey, canAccessInstitution } from '../src/utils/security.js';
import { executeDocumentValidation } from '../src/utils/validationRules.js';
import { evaluateApplicationCompliance } from '../server/services/regulatoryRules.js';
import { analyzeDocumentAnomalies } from '../server/services/anomalyDetection.js';
import {
  QRCodeVerificationAdapter,
  DigiLockerNADAdapter,
} from '../server/services/verificationAdapters.js';
import { DocumentRecord, Institution, Application, User } from '../src/types/index.js';

test('End-to-End Sample Document Journey: Synthetic Fire Safety NOC Validation', async t => {
  // 1. Synthetic Document Definition (Zero PII, fully synthetic regulatory test docket)
  const syntheticContent = Buffer.from(
    '%PDF-1.4\n1 0 obj << /Title (Fire Safety Certificate NOC 2026) /Producer (Directorate of Delhi Fire Service) >> endobj\n' +
    'DELHI FIRE SERVICE: GOVERNMENT OF NCT OF DELHI\n' +
    'Ref: FS-NOC-2026-DELHI-9812\n' +
    'Certified that National Institute of Engineering & Technology located at Plot 4, Knowledge Park, ' +
    'has complied with fire prevention and safety requirements under Rule 33 of Delhi Fire Service Rules 2010.\n' +
    'Date of Issue: 10/01/2026. Valid up to: 09/01/2027.\n'
  );

  const testInst: Institution = {
    id: 'INST-2026-001',
    code: '1-100200',
    name: 'National Institute of Engineering & Technology',
    type: 'ENGINEERING_TECHNOLOGY',
    address: 'Plot 4, Knowledge Park',
    district: 'New Delhi',
    state: 'Delhi',
    pincode: '110001',
    website: 'https://niet.edu.in',
    establishedYear: 2012,
    affiliationUniversity: 'Guru Gobind Singh Indraprastha University',
    status: 'ACTIVE',
    authorizedContactName: 'Prof. Sunita Rao',
    authorizedContactEmail: 'principal@niet.edu.in',
    authorizedContactPhone: '+91 11 2345 6789',
    profileCompleteness: 100,
    totalFacultyCount: 45,
    totalStudentCapacity: 600,
    campusAreaAcres: 5.5,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const testApp: Application = {
    id: 'APP-2026-001',
    applicationNumber: 'AICTE/2026-27/1-100200',
    institutionId: 'INST-2026-001',
    institutionName: 'National Institute of Engineering & Technology',
    type: 'EXTENSION_OF_APPROVAL',
    academicYear: '2026-2027',
    status: 'SUBMITTED',
    programmes: [
      { name: 'Computer Science & Engineering', level: 'UG', intakeApproved: 180, intakeRequested: 180 },
      { name: 'Electronics & Communication', level: 'UG', intakeApproved: 120, intakeRequested: 120 },
    ],
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z',
  };

  const sha256Digest = await computeSHA256(syntheticContent);
  const storageKey = generateSafeStorageKey(testInst.id, 'FIRE_SAFETY_CERTIFICATE', 'fire_safety_noc_2026.pdf');

  // Complete pre-initialized synthetic document record
  const docRecord: DocumentRecord = {
    id: 'DOC-SYNTHETIC-2026-FIRE-001',
    applicationId: testApp.id,
    institutionId: testInst.id,
    category: 'FIRE_SAFETY_CERTIFICATE',
    categoryLabel: 'Fire & Rescue Safety NOC',
    originalFilename: 'fire_safety_noc_2026.pdf',
    storageKey,
    mimeType: 'application/pdf',
    fileSizeBytes: syntheticContent.length,
    sha256Checksum: sha256Digest,
    uploadedById: 'usr-college-a',
    uploadedByName: 'Prof. Sunita Rao',
    uploadTimestamp: '2026-01-16T10:00:00Z',
    version: 1,
    extractionStatus: 'EXTRACTED',
    extractedData: {
      documentId: 'DOC-SYNTHETIC-2026-FIRE-001',
      engineVersion: 'PyMuPDF-v1.24+Tesseract-v5.3',
      confidenceScore: 96.5,
      institutionName: 'National Institute of Engineering & Technology',
      issuingAuthority: 'Delhi Fire Service, Government of NCT of Delhi',
      referenceNumber: 'FS-NOC-2026-DELHI-9812',
      issueDate: '2026-01-10',
      expiryDate: '2027-01-09',
      address: 'Plot 4, Knowledge Park, New Delhi',
      rawTextPreview: syntheticContent.toString(),
      pageCount: 1,
      pages: [{ pageNumber: 1, charCount: 280, extractionMethod: 'NATIVE_PDF', confidence: 98.0, textPreview: 'Delhi Fire Service...' }],
    },
    validationResults: [],
    duplicateMatches: [],
    isVerified: false,
    verificationStatus: 'PENDING',
  };

  // Step 1: File type validation and SHA-256 checksum computation
  await t.test('Step 1: File type validation and SHA-256 checksum computation', () => {
    assert.ok(syntheticContent.length > 0, 'Document content must not be empty');
    assert.ok(syntheticContent.slice(0, 5).toString().startsWith('%PDF'), 'Document must have valid PDF magic bytes');
    assert.equal(sha256Digest.length, 64, 'SHA-256 digest must be 64-character hex');
    assert.ok(storageKey.includes('INST-2026-001'), 'Storage key must be namespaced to institution');
    assert.ok(storageKey.includes('fire_safety_certificate'), 'Storage key must include category slug');
  });

  // Step 2: Statutory field extraction and metadata presence
  await t.test('Step 2: Statutory field extraction and metadata presence', () => {
    assert.equal(docRecord.extractedData?.referenceNumber, 'FS-NOC-2026-DELHI-9812');
    assert.equal(docRecord.extractedData?.issueDate, '2026-01-10');
    assert.equal(docRecord.extractedData?.expiryDate, '2027-01-09');
    assert.equal(docRecord.extractedData?.issuingAuthority, 'Delhi Fire Service, Government of NCT of Delhi');
  });

  // Step 3: Document validation rules
  await t.test('Step 3: Document validation evaluates non-expired validity and institution match', () => {
    docRecord.validationResults = executeDocumentValidation(docRecord, testApp.institutionName, testApp.academicYear);

    // Rule RULE-VAL-004 is expiration check
    const expiryCheck = docRecord.validationResults.find(r => r.ruleId === 'RULE-VAL-004');
    assert.ok(expiryCheck, 'Expiry check rule must be evaluated');
    assert.equal(expiryCheck.outcome, 'PASS', 'Active non-expired NOC must pass validation');

    // Rule RULE-CON-003 is institution consistency check
    const instCheck = docRecord.validationResults.find(r => r.ruleId === 'RULE-CON-003');
    assert.ok(instCheck, 'Institution consistency check must be evaluated');
    assert.equal(instCheck.outcome, 'PASS', 'Institution name match must pass');
  });

  // Step 4: AICTE APH 2024-2027 Clause 2.3 evaluation
  await t.test('Step 4: AICTE APH 2024-2027 Clause 2.3 evaluation confirms fire safety compliance', () => {
    const compliance = evaluateApplicationCompliance(testApp, [docRecord], testInst);
    const fireRule = compliance.results.find(r => r.aphClause.includes('Clause 2.3'));

    assert.ok(fireRule, 'Fire Safety rule AICTE APH Clause 2.3 must be evaluated');
    assert.equal(fireRule.outcome, 'COMPLIANT', 'Active NOC must be marked COMPLIANT');
    assert.ok(fireRule.evidence.includes('FS-NOC-2026-DELHI-9812'), 'Evidence must cite reference number');
  });

  // Step 5: Anomaly detection
  await t.test('Step 5: Anomaly detection confirms clean document without structural anomalies', () => {
    const anomalyReport = analyzeDocumentAnomalies(docRecord, testInst, testApp);

    assert.equal(anomalyReport.overallRiskLevel, 'LOW', 'Clean document must have LOW risk rating');
    assert.equal(anomalyReport.flags.length, 0, 'Clean document must produce zero anomaly flags');
    assert.ok(anomalyReport.disclaimer.includes('do NOT constitute proof of forgery'), 'Report must carry statutory disclaimer');
  });

  // Step 6: Issuing-Authority Verification Adapter execution
  await t.test('Step 6: Authority Verification executes QR code adapter and handles G2G DigiLocker', async () => {
    const docWithQR: DocumentRecord = {
      ...docRecord,
      extractedData: {
        ...docRecord.extractedData!,
        qrPayload: 'https://fireservices.delhi.gov.in/verify?ref=FS-NOC-2026-DELHI-9812&auth=DFSDelhi',
      },
    };

    const qrResult = await QRCodeVerificationAdapter.verify(docWithQR, testInst);
    assert.equal(qrResult.outcome, 'VERIFIED', 'Matching QR code signature must verify');

    const digiResult = await DigiLockerNADAdapter.verify(docRecord, testInst);
    assert.equal(digiResult.outcome, 'NOT_CONFIGURED', 'Unconfigured G2G API must return NOT_CONFIGURED without fabrication');
  });

  // Step 7: Multi-tenant access authorization
  await t.test('Step 7: Multi-tenant isolation prevents cross-college access', () => {
    const collegeUserA: User = {
      id: 'usr-college-a',
      name: 'Prof. Sunita Rao',
      email: 'principal@niet.edu.in',
      role: 'COLLEGE_MANAGEMENT',
      institutionId: 'INST-2026-001',
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
    };

    const collegeUserB: User = {
      id: 'usr-college-b',
      name: 'Dr. Vikram Sengupta',
      email: 'director@apextech.ac.in',
      role: 'COLLEGE_MANAGEMENT',
      institutionId: 'INST-2026-002',
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
    };

    const verifyOfficer: User = {
      id: 'usr-verify-patel',
      name: 'Dr. Priya Patel',
      email: 'verify.patel@aicte.gov.in',
      role: 'VERIFICATION_OFFICER',
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
    };

    assert.equal(canAccessInstitution(collegeUserA, docRecord.institutionId), true, 'College A can access own document');
    assert.equal(canAccessInstitution(collegeUserB, docRecord.institutionId), false, 'College B is strictly denied access');
    assert.equal(canAccessInstitution(verifyOfficer, docRecord.institutionId), true, 'Verification officer can access');
  });
});
