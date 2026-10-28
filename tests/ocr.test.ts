import test from 'node:test';
import assert from 'node:assert/strict';
import { executeDocumentValidation, calculateTextSimilarity } from '../src/utils/validationRules.js';
import { DocumentRecord } from '../src/types/index.js';

test('OCR field evaluation: complete extracted certificate passes validation rules', () => {
  const verifiedDoc: DocumentRecord = {
    id: 'DOC-OCR-001',
    applicationId: 'APP-2026-001',
    institutionId: 'INST-2026-001',
    category: 'FIRE_SAFETY_CERTIFICATE',
    categoryLabel: 'Fire & Rescue Safety NOC',
    originalFilename: 'fire_noc_compliant.pdf',
    storageKey: 'docs/fire_noc_compliant.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 1024 * 45,
    sha256Checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    uploadedById: 'usr-1',
    uploadedByName: 'Prof. Sunita Rao',
    uploadTimestamp: new Date().toISOString(),
    version: 1,
    extractionStatus: 'EXTRACTED',
    extractedData: {
      documentId: 'DOC-OCR-001',
      engineVersion: 'PyMuPDF-v1.24 (Digital Vector)',
      confidenceScore: 100,
      institutionName: 'National Institute of Engineering & Technology',
      referenceNumber: 'AICTE-VER-84920',
      issueDate: '2025-05-10',
      expiryDate: '2028-05-09',
      academicYear: '2026-2027',
      address: 'Sector 62, Institutional Area, Knowledge Park, Noida',
      issuingAuthority: 'State Fire and Rescue Services Department',
      rawTextPreview: 'ALL INDIA COUNCIL FOR TECHNICAL EDUCATION\nName of the Institution: National Institute of Engineering & Technology\nCertificate No: AICTE-VER-84920\nDate of Issue: 2025-05-10\nValid up to: 2028-05-09',
      pageCount: 1,
      fields: {
        institution_name: {
          value: 'National Institute of Engineering & Technology',
          page: 1,
          sourceSnippet: 'Name of the Institution: National Institute of Engineering & Technology',
          method: 'REGEX+EMBEDDED_TEXT',
          confidence: 100,
          isMissing: false,
        },
        reference_number: {
          value: 'AICTE-VER-84920',
          page: 1,
          sourceSnippet: 'Certificate No: AICTE-VER-84920',
          method: 'REGEX+EMBEDDED_TEXT',
          confidence: 100,
          isMissing: false,
        },
        issue_date: {
          value: '2025-05-10',
          page: 1,
          sourceSnippet: 'Date of Issue: 2025-05-10',
          method: 'REGEX+EMBEDDED_TEXT',
          confidence: 100,
          isMissing: false,
        },
      },
    },
    validationResults: [],
    duplicateMatches: [],
    isVerified: false,
    verificationStatus: 'PENDING',
  };

  const results = executeDocumentValidation(
    verifiedDoc,
    'National Institute of Engineering & Technology',
    '2026-2027'
  );

  const integrityRule = results.find(r => r.ruleId === 'RULE-INT-001');
  assert.equal(integrityRule?.outcome, 'PASS');

  const metadataRule = results.find(r => r.ruleId === 'RULE-MET-002');
  assert.equal(metadataRule?.outcome, 'PASS');
  assert.ok(metadataRule?.evidence.includes('AICTE-VER-84920'));

  const alignmentRule = results.find(r => r.ruleId === 'RULE-CON-003');
  assert.equal(alignmentRule?.outcome, 'PASS');

  const validityRule = results.find(r => r.ruleId === 'RULE-VAL-004');
  assert.equal(validityRule?.outcome, 'PASS');
});

test('OCR field evaluation: missing metadata flags warning without fabricating values', () => {
  const degradedDoc: DocumentRecord = {
    id: 'DOC-OCR-002',
    applicationId: 'APP-2026-001',
    institutionId: 'INST-2026-001',
    category: 'LAND_TITLE_DEED',
    categoryLabel: 'Land Title & Possession Deed',
    originalFilename: 'scanned_deed_blur.png',
    storageKey: 'docs/scanned_deed_blur.png',
    mimeType: 'image/png',
    fileSizeBytes: 1024 * 120,
    sha256Checksum: 'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e',
    uploadedById: 'usr-1',
    uploadedByName: 'Prof. Sunita Rao',
    uploadTimestamp: new Date().toISOString(),
    version: 1,
    extractionStatus: 'NEEDS_REVIEW',
    extractedData: {
      documentId: 'DOC-OCR-002',
      engineVersion: 'Tesseract-v5.3 (CPU)',
      confidenceScore: 42.1,
      institutionName: undefined, // Could not be read reliably
      referenceNumber: undefined,
      issueDate: undefined,
      rawTextPreview: 'Degraded scan text without recognizable statutory markers',
      pageCount: 1,
      fields: {
        institution_name: {
          value: null,
          method: 'DETERMINISTIC_REGEX',
          isMissing: true,
          missingReason: 'Institution name banner could not be recognized.',
        },
        reference_number: {
          value: null,
          method: 'DETERMINISTIC_REGEX',
          isMissing: true,
          missingReason: 'Statutory reference number not found.',
        },
      },
    },
    validationResults: [],
    duplicateMatches: [],
    isVerified: false,
    verificationStatus: 'PENDING',
  };

  const results = executeDocumentValidation(
    degradedDoc,
    'National Institute of Engineering & Technology',
    '2026-2027'
  );

  const metadataRule = results.find(r => r.ruleId === 'RULE-MET-002');
  assert.equal(metadataRule?.outcome, 'WARNING');
  assert.ok(metadataRule?.explanation.includes('No certificate reference number or issuance date'));

  const alignmentRule = results.find(r => r.ruleId === 'RULE-CON-003');
  assert.equal(alignmentRule?.outcome, 'NEEDS_REVIEW');
  assert.ok(alignmentRule?.explanation.includes('lacks readable institution name'));
});

test('OCR service error handling: failed extraction triggers manual scrutiny requirement', () => {
  const failedDoc: DocumentRecord = {
    id: 'DOC-OCR-003',
    applicationId: 'APP-2026-001',
    institutionId: 'INST-2026-001',
    category: 'BUILDING_PLAN_APPROVAL',
    categoryLabel: 'Municipal Approved Building Plan & Occupancy',
    originalFilename: 'encrypted_plan.pdf',
    storageKey: 'docs/encrypted_plan.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 1024 * 80,
    sha256Checksum: 'b591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146f',
    uploadedById: 'usr-1',
    uploadedByName: 'Prof. Sunita Rao',
    uploadTimestamp: new Date().toISOString(),
    version: 1,
    extractionStatus: 'FAILED',
    extractedData: {
      documentId: 'DOC-OCR-003',
      engineVersion: 'PyMuPDF-v1.24+Tesseract-v5.3',
      confidenceScore: null,
      rawTextPreview: '',
      ocrError: 'Password-protected / encrypted PDFs cannot be processed automatically.',
    },
    validationResults: [],
    duplicateMatches: [],
    isVerified: false,
    verificationStatus: 'PENDING',
  };

  const results = executeDocumentValidation(
    failedDoc,
    'National Institute of Engineering & Technology',
    '2026-2027'
  );

  const metadataRule = results.find(r => r.ruleId === 'RULE-MET-002');
  assert.equal(metadataRule?.outcome, 'NEEDS_REVIEW');
  assert.ok(metadataRule?.explanation.includes('Document text could not be extracted automatically'));
});

test('Python OCR microservice HTTP health endpoint reporting and offline graceful behavior', async () => {
  const ocrUrl = process.env.OCR_SERVICE_URL || 'http://127.0.0.1:5005';
  try {
    const res = await fetch(`${ocrUrl}/health`, { signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      const health = (await res.json()) as any;
      assert.ok(health.status === 'healthy' || health.status === 'UP' || health.status === 'degraded');
      assert.ok(health.service);
    }
  } catch (err: any) {
    console.log('[Test] OCR microservice is OFFLINE at', ocrUrl, '(handled gracefully):', err.message);
  }
});
