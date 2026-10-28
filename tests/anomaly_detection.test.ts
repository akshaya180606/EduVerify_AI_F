import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeDocumentAnomalies } from '../server/services/anomalyDetection.js';
import { DocumentRecord, Institution, Application } from '../src/types/index.js';

test('Evidence-Linked Anomaly Detection Engine', async t => {
  const sampleInst: Institution = {
    id: 'INST-001',
    code: '1-100200',
    name: 'Technological Academy of Pune',
    type: 'ENGINEERING_TECHNOLOGY',
    address: 'Campus Road',
    district: 'Pune',
    state: 'Maharashtra',
    pincode: '411001',
    website: 'https://tap.edu.in',
    establishedYear: 2015,
    affiliationUniversity: 'SPPU',
    status: 'ACTIVE',
    authorizedContactName: 'Dr. Ramesh Joshi',
    authorizedContactEmail: 'ramesh@tap.edu.in',
    authorizedContactPhone: '+91 9822000000',
    profileCompleteness: 90,
    totalFacultyCount: 40,
    totalStudentCapacity: 600,
    campusAreaAcres: 4.0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const sampleApp: Application = {
    id: 'APP-1',
    applicationNumber: 'AICTE/2026/001',
    institutionId: 'INST-001',
    institutionName: 'Technological Academy of Pune',
    type: 'EXTENSION_OF_APPROVAL',
    academicYear: '2026-2027',
    status: 'DRAFT',
    programmes: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await t.test('1. Detects graphic editing markers (Adobe Photoshop) in statutory certificates', () => {
    const manipulatedDoc: DocumentRecord = {
      id: 'DOC-ANOM-1',
      applicationId: 'APP-1',
      institutionId: 'INST-001',
      category: 'FIRE_SAFETY_CERTIFICATE',
      categoryLabel: 'Fire Safety NOC',
      originalFilename: 'fire_noc_edited.pdf',
      storageKey: 'key1',
      mimeType: 'application/pdf',
      fileSizeBytes: 10240,
      sha256Checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      uploadedById: 'user-1',
      uploadedByName: 'Registrar',
      uploadTimestamp: new Date().toISOString(),
      version: 1,
      extractionStatus: 'EXTRACTED',
      extractedData: {
        documentId: 'DOC-ANOM-1',
        engineVersion: 'PyMuPDF-v1.24',
        confidenceScore: 90,
        referenceNumber: 'NOC-FS-2026-112',
        rawTextPreview: 'Fire safety certificate. Producer: Adobe Photoshop 2024 (Windows). Export layer 1.',
      },
      validationResults: [],
      duplicateMatches: [],
      isVerified: false,
      verificationStatus: 'PENDING',
    };

    const report = analyzeDocumentAnomalies(manipulatedDoc, sampleInst, sampleApp);
    assert.equal(report.overallRiskLevel, 'HIGH');
    const photoFlag = report.flags.find(f => f.category === 'SUSPICIOUS_METADATA');
    assert.ok(photoFlag, 'Should flag suspicious metadata');
    assert.ok(photoFlag.explanation.toLowerCase().includes('adobe photoshop'));
    assert.equal(photoFlag.humanReviewStatus, 'PENDING_HUMAN_REVIEW');
    assert.ok(report.disclaimer.includes('do NOT constitute proof of forgery'));
  });

  await t.test('2. Flags chronological date inversion (Issue date after Expiry date)', () => {
    const invertedDateDoc: DocumentRecord = {
      id: 'DOC-ANOM-2',
      applicationId: 'APP-1',
      institutionId: 'INST-001',
      category: 'FIRE_SAFETY_CERTIFICATE',
      categoryLabel: 'Fire Safety NOC',
      originalFilename: 'inversion_fire.pdf',
      storageKey: 'key2',
      mimeType: 'application/pdf',
      fileSizeBytes: 10240,
      sha256Checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      uploadedById: 'user-1',
      uploadedByName: 'Registrar',
      uploadTimestamp: new Date().toISOString(),
      version: 1,
      extractionStatus: 'EXTRACTED',
      extractedData: {
        documentId: 'DOC-ANOM-2',
        engineVersion: 'PyMuPDF-v1.24',
        confidenceScore: 92,
        referenceNumber: 'NOC-FS-2026-90',
        issueDate: '2026-08-15',
        expiryDate: '2026-01-10', // Impossible: expiry before issuance
        rawTextPreview: 'Issued on 15 Aug 2026, valid until 10 Jan 2026',
      },
      validationResults: [],
      duplicateMatches: [],
      isVerified: false,
      verificationStatus: 'PENDING',
    };

    const report = analyzeDocumentAnomalies(invertedDateDoc, sampleInst, sampleApp);
    assert.equal(report.overallRiskLevel, 'HIGH');
    const dateFlag = report.flags.find(f => f.category === 'CONFLICTING_DATES');
    assert.ok(dateFlag);
    assert.ok(dateFlag.flagTitle.includes('Chronological Inversion'));
  });

  await t.test('3. Flags cross-institution exact hash collision with distinct institution name', () => {
    const crossInstDoc: DocumentRecord = {
      id: 'DOC-ANOM-3',
      applicationId: 'APP-1',
      institutionId: 'INST-001',
      category: 'LAND_TITLE_DEED',
      categoryLabel: 'Land Title Deed',
      originalFilename: 'reused_land_deed.pdf',
      storageKey: 'key3',
      mimeType: 'application/pdf',
      fileSizeBytes: 50000,
      sha256Checksum: '99b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b899',
      uploadedById: 'user-1',
      uploadedByName: 'Registrar',
      uploadTimestamp: new Date().toISOString(),
      version: 1,
      extractionStatus: 'EXTRACTED',
      extractedData: {
        documentId: 'DOC-ANOM-3',
        engineVersion: 'PyMuPDF-v1.24',
        confidenceScore: 96,
        referenceNumber: 'DEED-2020-001',
        rawTextPreview: 'Registered sale deed for 5 acres in survey 104',
      },
      validationResults: [],
      duplicateMatches: [
        {
          matchedDocumentId: 'DOC-OTHER-INST',
          matchedApplicationId: 'APP-OTHER-2026',
          matchedInstitutionId: 'INST-OTHER-999', // Different institution
          matchedInstitutionName: 'Sunrise College of Pharmacy',
          matchType: 'EXACT_HASH',
          similarityScore: 100,
          detectedTimestamp: new Date().toISOString(),
        },
      ],
      isVerified: false,
      verificationStatus: 'PENDING',
    };

    const report = analyzeDocumentAnomalies(crossInstDoc, sampleInst, sampleApp);
    assert.equal(report.overallRiskLevel, 'HIGH');
    const dupFlag = report.flags.find(f => f.category === 'CROSS_INSTITUTION_COLLISION');
    assert.ok(dupFlag);
    assert.ok(dupFlag.explanation.includes('Sunrise College of Pharmacy'));
  });
});
