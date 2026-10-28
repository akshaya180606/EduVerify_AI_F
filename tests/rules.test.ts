import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateTextSimilarity,
  normalizeText,
  executeDocumentValidation,
  STANDARD_RULES
} from '../src/utils/validationRules.js';
import { DocumentRecord } from '../src/types/index.js';

test('normalizeText cleans punctuation and downcases', () => {
  const result = normalizeText('National Institute of Tech, & Sci. (Deemed)');
  assert.equal(result, 'national institute of tech sci deemed');
});

test('calculateTextSimilarity accurately measures token overlap', () => {
  const simHigh = calculateTextSimilarity(
    'National Institute of Technology Karnataka',
    'National Institute of Technology, Surathkal'
  );
  assert.ok(simHigh >= 60, `Expected similarity >= 60, got ${simHigh}`);

  const simLow = calculateTextSimilarity(
    'Apollo Medical College',
    'National Institute of Technology'
  );
  assert.ok(simLow < 25, `Expected low similarity < 25, got ${simLow}`);
});

test('executeDocumentValidation catches corrupted or empty file checksum', () => {
  const invalidDoc: DocumentRecord = {
    id: 'doc-1',
    applicationId: 'app-1',
    institutionId: 'inst-1',
    category: 'LAND_TITLE_DEED',
    categoryLabel: 'Land Title Deed',
    originalFilename: 'deed.pdf',
    storageKey: 'key/deed.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 0,
    sha256Checksum: 'short',
    uploadedById: 'user-1',
    uploadedByName: 'John Principal',
    uploadTimestamp: new Date().toISOString(),
    version: 1,
    extractionStatus: 'UPLOADED',
    validationResults: [],
    duplicateMatches: [],
    isVerified: false,
    verificationStatus: 'PENDING',
  };

  const results = executeDocumentValidation(invalidDoc, 'National Institute', '2026-2027');
  const integrityResult = results.find(r => r.ruleId === 'RULE-INT-001');
  assert.ok(integrityResult, 'RULE-INT-001 must be evaluated');
  assert.equal(integrityResult.outcome, 'FAIL');
});

test('executeDocumentValidation handles expired certificate correctly', () => {
  const expiredDoc: DocumentRecord = {
    id: 'doc-2',
    applicationId: 'app-1',
    institutionId: 'inst-1',
    category: 'FIRE_SAFETY_CERTIFICATE',
    categoryLabel: 'Fire Safety Certificate',
    originalFilename: 'fire_cert.pdf',
    storageKey: 'key/fire.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 500000,
    sha256Checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    uploadedById: 'user-1',
    uploadedByName: 'John Principal',
    uploadTimestamp: new Date().toISOString(),
    version: 1,
    extractionStatus: 'EXTRACTED',
    extractedData: {
      documentId: 'doc-2',
      engineVersion: 'v2.1',
      confidenceScore: 92,
      institutionName: 'Apex Institute of Technology',
      referenceNumber: 'FS-2024-89',
      issueDate: '2024-01-10',
      expiryDate: '2025-01-10', // Clearly expired in 2026
      rawTextPreview: 'Fire safety certificate valid until January 2025',
    },
    validationResults: [],
    duplicateMatches: [],
    isVerified: false,
    verificationStatus: 'PENDING',
  };

  const results = executeDocumentValidation(expiredDoc, 'Apex Institute of Technology', '2026-2027');
  const expiryResult = results.find(r => r.ruleId === 'RULE-VAL-004');
  assert.ok(expiryResult);
  assert.equal(expiryResult.outcome, 'FAIL');
});
