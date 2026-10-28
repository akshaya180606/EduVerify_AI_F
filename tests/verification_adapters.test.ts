import test from 'node:test';
import assert from 'node:assert/strict';
import {
  QRCodeVerificationAdapter,
  StatutoryReferenceAdapter,
  DigiLockerNADAdapter,
  executeAdapterVerification,
} from '../server/services/verificationAdapters.js';
import { DocumentRecord, Institution } from '../src/types/index.js';

test('Issuing-Authority Verification Adapter Architecture', async t => {
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
    affiliationUniversity: 'Savitribai Phule Pune University',
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

  await t.test('1. QR Code adapter returns VERIFIED when payload matches reference number', async () => {
    const docWithQR: DocumentRecord = {
      id: 'DOC-QR-VALID',
      applicationId: 'APP-1',
      institutionId: 'INST-001',
      category: 'FIRE_SAFETY_CERTIFICATE',
      categoryLabel: 'Fire Safety NOC',
      originalFilename: 'qr_fire_noc.pdf',
      storageKey: 'key-qr',
      mimeType: 'application/pdf',
      fileSizeBytes: 10240,
      sha256Checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      uploadedById: 'user-1',
      uploadedByName: 'Officer',
      uploadTimestamp: new Date().toISOString(),
      version: 1,
      extractionStatus: 'EXTRACTED',
      extractedData: {
        documentId: 'DOC-QR-VALID',
        engineVersion: 'PyMuPDF-v1.24',
        confidenceScore: 98,
        referenceNumber: 'NOC-FS-2026-8819',
        qrPayload: 'https://fireservices.maha.gov.in/verify?ref=NOC-FS-2026-8819&auth=CFOPune',
        rawTextPreview: 'Fire safety certificate with digital QR seal',
      },
      validationResults: [],
      duplicateMatches: [],
      isVerified: false,
      verificationStatus: 'PENDING',
    };

    const res = await QRCodeVerificationAdapter.verify(docWithQR, sampleInst);
    assert.equal(res.outcome, 'VERIFIED');
    assert.ok(res.evidence.includes('NOC-FS-2026-8819'));
  });

  await t.test('2. QR Code adapter flags MISMATCH_DETECTED when QR payload ref differs from printed ref', async () => {
    const tamperedDoc: DocumentRecord = {
      id: 'DOC-QR-TAMPER',
      applicationId: 'APP-1',
      institutionId: 'INST-001',
      category: 'FIRE_SAFETY_CERTIFICATE',
      categoryLabel: 'Fire Safety NOC',
      originalFilename: 'tampered_fire_noc.pdf',
      storageKey: 'key-tamper',
      mimeType: 'application/pdf',
      fileSizeBytes: 10240,
      sha256Checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      uploadedById: 'user-1',
      uploadedByName: 'Officer',
      uploadTimestamp: new Date().toISOString(),
      version: 1,
      extractionStatus: 'EXTRACTED',
      extractedData: {
        documentId: 'DOC-QR-TAMPER',
        engineVersion: 'PyMuPDF-v1.24',
        confidenceScore: 98,
        referenceNumber: 'NOC-FS-2026-9999', // Printed
        qrPayload: 'https://fireservices.maha.gov.in/verify?ref=NOC-FS-2024-1111', // Conflicting QR payload
        rawTextPreview: 'Fire safety certificate with altered printed reference',
      },
      validationResults: [],
      duplicateMatches: [],
      isVerified: false,
      verificationStatus: 'PENDING',
    };

    const res = await QRCodeVerificationAdapter.verify(tamperedDoc, sampleInst);
    assert.equal(res.outcome, 'MISMATCH_DETECTED');
    assert.ok(res.evidence.includes('does NOT match'));
    assert.ok(res.guidanceForOfficer?.includes('Escalate to Scrutiny Officer'));
  });

  await t.test('3. Unconfigured G2G DigiLocker adapter explicitly returns NOT_CONFIGURED without fabricating success', async () => {
    const doc: DocumentRecord = {
      id: 'DOC-DIGI',
      applicationId: 'APP-1',
      institutionId: 'INST-001',
      category: 'AFFILIATION_ORDER',
      categoryLabel: 'Affiliation Order',
      originalFilename: 'affiliation.pdf',
      storageKey: 'key-digi',
      mimeType: 'application/pdf',
      fileSizeBytes: 10240,
      sha256Checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      uploadedById: 'user-1',
      uploadedByName: 'Officer',
      uploadTimestamp: new Date().toISOString(),
      version: 1,
      extractionStatus: 'EXTRACTED',
      extractedData: {
        documentId: 'DOC-DIGI',
        engineVersion: 'PyMuPDF-v1.24',
        confidenceScore: 95,
        referenceNumber: 'AFF-SPPU-2026-102',
        rawTextPreview: 'Affiliation order',
      },
      validationResults: [],
      duplicateMatches: [],
      isVerified: false,
      verificationStatus: 'PENDING',
    };

    const res = await DigiLockerNADAdapter.verify(doc, sampleInst);
    if (!process.env.DIGILOCKER_API_KEY) {
      assert.equal(res.outcome, 'NOT_CONFIGURED');
      assert.ok(res.evidence.includes('not configured'));
      assert.ok(res.guidanceForOfficer?.includes('manual verification'));
    }
  });

  await t.test('4. Statutory reference adapter validates official series syntax', async () => {
    const validRefDoc: DocumentRecord = {
      id: 'DOC-STAT-REF',
      applicationId: 'APP-1',
      institutionId: 'INST-001',
      category: 'FIRE_SAFETY_CERTIFICATE',
      categoryLabel: 'Fire Safety NOC',
      originalFilename: 'fire_cert.pdf',
      storageKey: 'key-ref',
      mimeType: 'application/pdf',
      fileSizeBytes: 10240,
      sha256Checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      uploadedById: 'user-1',
      uploadedByName: 'Officer',
      uploadTimestamp: new Date().toISOString(),
      version: 1,
      extractionStatus: 'EXTRACTED',
      extractedData: {
        documentId: 'DOC-STAT-REF',
        engineVersion: 'PyMuPDF-v1.24',
        confidenceScore: 98,
        referenceNumber: 'NOC-FS-2026-7841',
        rawTextPreview: 'Office of CFO, NOC-FS-2026-7841',
      },
      validationResults: [],
      duplicateMatches: [],
      isVerified: false,
      verificationStatus: 'PENDING',
    };

    const res = await StatutoryReferenceAdapter.verify(validRefDoc, sampleInst);
    assert.equal(res.outcome, 'VERIFIED');
    assert.ok(res.evidence.includes('conforms to the statutory issuance series'));
  });
});
