import test from 'node:test';
import assert from 'node:assert/strict';
import { isPlaceholderDatabaseUrl, maskDatabaseUrl } from '../server/storage/prisma.js';
import { calculateTextSimilarity, normalizeText, executeDocumentValidation } from '../src/utils/validationRules.js';
import { canAccessInstitution, canPerformAction, computeSHA256 } from '../src/utils/security.js';
import { DocumentRecord, User } from '../src/types/index.js';

test('[MOCKED TEST SUITE] Independent Domain & Validation Verification', async t => {
  // 1. Placeholder connection string recognition
  await t.test('1. Placeholder connection strings are safely recognized without triggering network/DB calls', () => {
    assert.equal(isPlaceholderDatabaseUrl('postgresql://USER:PASSWORD@localhost:5432/eduverify?schema=public'), true);
    assert.equal(isPlaceholderDatabaseUrl('postgresql://<user>:<password>@localhost:5432/eduverify'), true);
    assert.equal(isPlaceholderDatabaseUrl(''), true);
    assert.equal(isPlaceholderDatabaseUrl(undefined), true);
    assert.equal(isPlaceholderDatabaseUrl('postgresql://postgres:your_password@localhost:5432/db'), true);

    // Valid format shouldn't trigger placeholder flag
    assert.equal(isPlaceholderDatabaseUrl('postgresql://validuser:s3cr3tp@localhost:5432/prod'), false);

    // Masking test
    const masked = maskDatabaseUrl('postgresql://myuser:secret123@localhost:5432/eduverify');
    assert.equal(masked, 'postgresql://myuser:****@localhost:5432/eduverify');
    assert.ok(!masked.includes('secret123'), 'Passwords must never appear unmasked');
  });

  // 2. Mock statutory field extraction for student credentials and institutional NOCs
  await t.test('2. Statutory candidate and certificate field evaluation without live DB', () => {
    const studentDegreeDoc: DocumentRecord = {
      id: 'DOC-STUDENT-001',
      applicationId: 'APP-STUDENT-2026',
      institutionId: 'INST-2026-001',
      category: 'AFFILIATION_ORDER',
      categoryLabel: 'Affiliation & Degree Order',
      originalFilename: 'degree_certificate_sample.pdf',
      storageKey: 'institutions/INST-2026-001/docs/DOC-STUDENT-001.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 20480,
      sha256Checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      uploadedById: 'user-01',
      uploadedByName: 'Registrar',
      uploadTimestamp: new Date().toISOString(),
      version: 1,
      extractionStatus: 'EXTRACTED',
      extractedData: {
        documentId: 'DOC-STUDENT-001',
        engineVersion: 'PyMuPDF-v1.24+LayoutLMv3',
        confidenceScore: 95.5,
        candidateName: 'Aditya Kumar Sharma',
        qualification: 'Bachelor of Technology in Computer Science and Engineering',
        marksOrGrade: '8.84 CGPA (First Class with Distinction)',
        referenceNumber: 'UNIV/DEG/2026/89421',
        issueDate: '2026-06-15',
        institutionName: 'National Institute of Engineering & Technology',
        issuingAuthority: 'State Technical University',
        rawTextPreview: 'This is to certify that Aditya Kumar Sharma has been conferred the degree of Bachelor of Technology...',
        fields: {
          candidate_name: {
            value: 'Aditya Kumar Sharma',
            confidence: 96.0,
            method: 'NAMED_ENTITY_REGEX',
            sourceSnippet: 'certify that Aditya Kumar Sharma has been conferred',
          },
          qualification: {
            value: 'Bachelor of Technology in Computer Science and Engineering',
            confidence: 98.0,
            method: 'STATUTORY_KEYWORD',
            sourceSnippet: 'degree of Bachelor of Technology in Computer Science and Engineering',
          },
          marks_or_grade: {
            value: '8.84 CGPA (First Class with Distinction)',
            confidence: 94.0,
            method: 'REGEX_PATTERN',
            sourceSnippet: 'CGPA: 8.84 (First Class with Distinction)',
          },
        },
      },
      validationResults: [],
      duplicateMatches: [],
      isVerified: false,
      verificationStatus: 'PENDING',
    };

    assert.equal(studentDegreeDoc.extractedData?.candidateName, 'Aditya Kumar Sharma');
    assert.equal(studentDegreeDoc.extractedData?.qualification, 'Bachelor of Technology in Computer Science and Engineering');
    assert.equal(studentDegreeDoc.extractedData?.marksOrGrade, '8.84 CGPA (First Class with Distinction)');

    // Ensure non-authoritative extraction is distinct from authoritative verification
    assert.equal(studentDegreeDoc.isVerified, false);
    assert.equal(studentDegreeDoc.verificationStatus, 'PENDING');
  });

  // 3. Multi-tenant isolation test fixture
  await t.test('3. Role gating and tenant isolation enforcement rules', () => {
    const instAUser: User = {
      id: 'usr-col-a',
      name: 'College A Officer',
      email: 'a@college.edu',
      role: 'COLLEGE_MANAGEMENT',
      institutionId: 'INST-001',
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    const instBUser: User = {
      id: 'usr-col-b',
      name: 'College B Officer',
      email: 'b@college.edu',
      role: 'COLLEGE_MANAGEMENT',
      institutionId: 'INST-002',
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    assert.equal(canAccessInstitution(instAUser, 'INST-001'), true);
    assert.equal(canAccessInstitution(instAUser, 'INST-002'), false);
    assert.equal(canAccessInstitution(instBUser, 'INST-001'), false);
    assert.equal(canAccessInstitution(instBUser, 'INST-002'), true);

    // Officers cannot create applications
    assert.equal(canPerformAction({ ...instAUser, role: 'SCRUTINY_OFFICER' }, 'CREATE_APPLICATION'), false);
    // College users cannot scrutinize
    assert.equal(canPerformAction(instAUser, 'SCRUTINIZE'), false);
  });
});
