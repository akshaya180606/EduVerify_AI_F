import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateInfrastructureCompliance, AICTE_INFRASTRUCTURE_NORMS } from '../server/services/infrastructureComplianceService.js';
import { Application, DocumentRecord, Institution } from '../src/types/index.js';

test('AICTE Infrastructure Compliance Assistance & EVC Routing', async t => {
  const sampleInst: Institution = {
    id: 'INST-001',
    code: '1-100200',
    name: 'National College of Engineering',
    type: 'ENGINEERING_TECHNOLOGY',
    address: 'Campus Road',
    district: 'Pune',
    state: 'Maharashtra',
    pincode: '411001',
    website: 'https://nce.edu.in',
    establishedYear: 2010,
    affiliationUniversity: 'SPPU',
    status: 'ACTIVE',
    authorizedContactName: 'Dr. Ramesh Joshi',
    authorizedContactEmail: 'ramesh@nce.edu.in',
    authorizedContactPhone: '+91 9822000000',
    profileCompleteness: 90,
    totalFacultyCount: 60,
    totalStudentCapacity: 960,
    campusAreaAcres: 5.0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const existingApp: Application = {
    id: 'APP-1',
    applicationNumber: 'AICTE/2026/001',
    institutionId: 'INST-001',
    institutionName: 'National College of Engineering',
    type: 'EXTENSION_OF_APPROVAL',
    academicYear: '2026-2027',
    status: 'UNDER_SCRUTINY',
    programmes: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await t.test('1. Application with comprehensive blueprint schedule satisfies documentary checklist', () => {
    const docs: DocumentRecord[] = [
      {
        id: 'DOC-BLDG-1',
        applicationId: 'APP-1',
        institutionId: 'INST-001',
        category: 'BUILDING_PLAN_APPROVAL',
        categoryLabel: 'Building Plan Approval',
        originalFilename: 'master_plan_approved.pdf',
        storageKey: 'key1',
        mimeType: 'application/pdf',
        fileSizeBytes: 20480,
        sha256Checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        uploadedById: 'user-1',
        uploadedByName: 'Principal',
        uploadTimestamp: new Date().toISOString(),
        version: 1,
        extractionStatus: 'EXTRACTED',
        extractedData: {
          documentId: 'DOC-BLDG-1',
          engineVersion: 'PyMuPDF-v1.24',
          confidenceScore: 95,
          referenceNumber: 'PMC/BP/2024/9102',
          rawTextPreview: 'Municipal Sanctioned Building Plan. Schedule: 24 Classrooms (66 sqm each), 12 Engineering Labs, Computer Center (180 sqm), Central Library and Reading Room (450 sqm), Barrier-free Ramp and Accessible Toilets.',
        },
        validationResults: [],
        duplicateMatches: [],
        isVerified: false,
        verificationStatus: 'PENDING',
      },
      {
        id: 'DOC-FIRE-1',
        applicationId: 'APP-1',
        institutionId: 'INST-001',
        category: 'FIRE_SAFETY_CERTIFICATE',
        categoryLabel: 'Fire Safety NOC',
        originalFilename: 'fire_noc.pdf',
        storageKey: 'key2',
        mimeType: 'application/pdf',
        fileSizeBytes: 10240,
        sha256Checksum: 'a3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        uploadedById: 'user-1',
        uploadedByName: 'Principal',
        uploadTimestamp: new Date().toISOString(),
        version: 1,
        extractionStatus: 'EXTRACTED',
        extractedData: {
          documentId: 'DOC-FIRE-1',
          engineVersion: 'PyMuPDF-v1.24',
          confidenceScore: 98,
          referenceNumber: 'NOC-FS-2026-88',
          rawTextPreview: 'Fire safety NOC with dual emergency staircases',
        },
        validationResults: [],
        duplicateMatches: [],
        isVerified: false,
        verificationStatus: 'PENDING',
      },
    ];

    const report = evaluateInfrastructureCompliance(existingApp, docs, sampleInst);
    assert.ok(report.satisfiedCount >= 4, `Expected at least 4 satisfied requirements, got ${report.satisfiedCount}`);
    assert.ok(report.regulatoryDisclaimer.includes('Physical infrastructure compliance cannot be determined from photographs or scans alone'));
  });

  await t.test('2. Missing building plan marks deficient documentary evidence', () => {
    const report = evaluateInfrastructureCompliance(existingApp, [], sampleInst);
    assert.equal(report.satisfiedCount, 0);
    assert.equal(report.deficientCount, AICTE_INFRASTRUCTURE_NORMS.length);
    assert.equal(report.requiresEvcOnSiteVisit, true);
  });

  await t.test('3. New Technical Institution applicant always routes for mandatory EVC on-site inspection', () => {
    const newApp: Application = {
      ...existingApp,
      type: 'NEW_APPLICANT',
    };

    const report = evaluateInfrastructureCompliance(newApp, [], sampleInst);
    assert.equal(report.requiresEvcOnSiteVisit, true);
    assert.ok(report.evcRoutingReason?.includes('New Technical Institution applicants'));
  });
});
