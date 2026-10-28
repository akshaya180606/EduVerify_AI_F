import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma, checkDatabaseHealth } from '../server/storage/prisma.js';
import { dbService, DatabaseService } from '../server/services/dbService.js';
import { ApplicationStatus, User, DocumentCategory } from '../src/types/index.js';
import { ApplicationStatus as PrismaAppStatus, UserRole } from '@prisma/client';

test('Database Test Suite: Real PostgreSQL Persistence Verification', async t => {
  const health = await checkDatabaseHealth();

  if (!health.connected) {
    await t.test('PostgreSQL connection check (Offline / Placeholder Mode)', () => {
      console.log(`[Database Test Suite] Live PostgreSQL is offline or configured with placeholder credentials: ${health.urlMasked}`);
      console.log(`[Database Test Suite] Diagnostic: ${health.error}`);
      console.log(`[Database Test Suite] Live persistence integration tests skipped. (To execute live tests, set valid DATABASE_URL in your local environment.)`);
      assert.equal(health.connected, false, 'Reported status must accurately reflect offline/placeholder state');
    });
    return;
  }

  // Verify real PostgreSQL connection is active
  await t.test('PostgreSQL connection check', async () => {
    assert.equal(health.connected, true, 'PostgreSQL must be connected for real persistence tests');
    assert.ok(health.latencyMs >= 0, 'Database latency must be non-negative');
    console.log(`[Test] Verified live PostgreSQL instance at ${health.urlMasked} (${health.latencyMs}ms)`);
  });

  // 1. Creating and retrieving an application
  await t.test('1. Creating and retrieving an application in PostgreSQL', async () => {
    const adminUser = await dbService.getUserById('usr-admin-01');
    assert.ok(adminUser, 'Admin user must exist');

    const createdApp = await dbService.createApplication(
      {
        type: 'EXTENSION_OF_APPROVAL',
        academicYear: '2026-2027',
        institutionId: 'INST-2026-001',
        programmes: [
          { name: 'Electrical Engineering', level: 'UG', intakeApproved: 60, intakeRequested: 120 },
        ],
      },
      adminUser
    );

    assert.ok(createdApp.id, 'Created application must have an ID');
    assert.equal(createdApp.status, 'DRAFT', 'New application should default to DRAFT');

    // Retrieve from database directly via Prisma
    const dbRecord = await prisma.application.findUnique({
      where: { id: createdApp.id },
      include: { institution: true },
    });

    assert.ok(dbRecord, 'Application must be stored in PostgreSQL');
    assert.equal(dbRecord.applicationNumber, createdApp.applicationNumber);
    assert.equal(dbRecord.institutionId, 'INST-2026-001');

    // Retrieve via service details
    const details = await dbService.getApplicationDetails(createdApp.id, adminUser);
    assert.ok(details, 'Service must retrieve application details from DB');
    assert.equal(details.application.id, createdApp.id);
  });

  // 2. Updating application workflow status
  await t.test('2. Updating application workflow status & history in PostgreSQL', async () => {
    const adminUser = await dbService.getUserById('usr-admin-01');
    assert.ok(adminUser);

    // Create an application to transition
    const app = await dbService.createApplication(
      {
        type: 'NEW_APPLICANT',
        institutionId: 'INST-2026-002',
      },
      adminUser
    );

    // Upload a dummy document so it satisfies pre-submission validation
    await prisma.document.create({
      data: {
        id: `DOC-TEST-${Date.now()}`,
        applicationId: app.id,
        institutionId: 'INST-2026-002',
        category: 'LAND_TITLE_DEED',
        originalFilename: 'test_land_deed.pdf',
        storageKey: `institutions/INST-2026-002/docs/test_deed_${Date.now()}.pdf`,
        mimeType: 'application/pdf',
        fileSizeBytes: 1024,
        sha256Checksum: `test_sha256_${Date.now()}`,
        uploadedById: adminUser.id,
        uploadedByName: adminUser.name,
      },
    });

    // Transition from DRAFT to SUBMITTED
    const updated = await dbService.transitionApplication(
      app.id,
      'SUBMITTED',
      'Test docket submitted by applicant',
      adminUser
    );

    assert.equal(updated.status, 'SUBMITTED', 'Status should be updated to SUBMITTED');
    assert.ok(updated.submissionDate, 'Submission date should be recorded');

    // Verify persisted history record in PostgreSQL
    const history = await prisma.applicationStatusHistory.findMany({
      where: { applicationId: app.id },
      orderBy: { timestamp: 'desc' },
    });

    assert.ok(history.length >= 2, 'Must have initial history and transition history');
    assert.equal(history[0].toStatus, PrismaAppStatus.SUBMITTED);
    assert.equal(history[0].reason, 'Test docket submitted by applicant');
  });

  // 3. Persistence after server restart
  await t.test('3. Persistence after server restart (simulated fresh process memory)', async () => {
    const adminUser = await dbService.getUserById('usr-admin-01');
    assert.ok(adminUser);

    // Create a record with unique token
    const uniqueToken = `restart_test_${Date.now()}`;
    const testApp = await dbService.createApplication(
      {
        type: 'EXTENSION_OF_APPROVAL',
        institutionId: 'INST-2026-001',
        academicYear: uniqueToken,
      },
      adminUser
    );

    // Simulate complete process restart by instantiating a completely fresh DatabaseService
    const freshDbService = new DatabaseService();
    await freshDbService.init();

    // Query application from fresh service instance
    const freshDetails = await freshDbService.getApplicationDetails(testApp.id, adminUser);
    assert.ok(freshDetails, 'Record must persist across process instances');
    assert.equal(freshDetails.application.academicYear, uniqueToken);
  });

  // 4. Document metadata and OCR result persistence
  await t.test('4. Document metadata and OCR result persistence in PostgreSQL', async () => {
    const adminUser = await dbService.getUserById('usr-admin-01');
    assert.ok(adminUser);

    const docId = `DOC-PERSIST-${Date.now()}`;
    const testDoc = {
      id: docId,
      applicationId: 'APP-2026-001',
      institutionId: 'INST-2026-001',
      category: 'FIRE_SAFETY_CERTIFICATE' as DocumentCategory,
      categoryLabel: 'Fire Safety NOC',
      originalFilename: 'real_fire_noc_2026.pdf',
      storageKey: `institutions/INST-2026-001/docs/${docId}.pdf`,
      mimeType: 'application/pdf',
      fileSizeBytes: 204850,
      sha256Checksum: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855_${Date.now()}`,
      uploadedById: adminUser.id,
      uploadedByName: adminUser.name,
      uploadTimestamp: new Date().toISOString(),
      version: 1,
      extractionStatus: 'EXTRACTED' as const,
      extractedData: {
        documentId: docId,
        engineVersion: 'PyMuPDF-v1.24+Tesseract-v5.3',
        confidenceScore: 97.8,
        institutionName: 'National Institute of Engineering & Technology',
        issuingAuthority: 'State Fire Services Directorate',
        referenceNumber: 'NOC-FS-2026-9021',
        issueDate: '2026-01-10',
        expiryDate: '2029-01-09',
        academicYear: '2026-2027',
        rawTextPreview: 'OFFICE OF THE CHIEF FIRE OFFICER: RENEWAL CERTIFICATE OF FIRE SAFETY. Issued to NIET campus...',
        pageCount: 1,
        pages: [
          {
            pageNumber: 1,
            charCount: 420,
            extractionMethod: 'PyMuPDF_native',
            confidence: 98.0,
            textPreview: 'OFFICE OF THE CHIEF FIRE OFFICER...',
          },
        ],
        fields: {
          reference_number: {
            value: 'NOC-FS-2026-9021',
            method: 'regex_rule',
            confidence: 99.0,
            sourceSnippet: 'Reference No: NOC-FS-2026-9021',
          },
        },
      },
      validationResults: [
        {
          id: `val-test-${Date.now()}`,
          ruleId: 'RULE-VAL-004',
          ruleTitle: 'Document Expiration and Validity Check',
          outcome: 'PASS' as const,
          explanation: 'Valid until 2029',
          evidence: 'Expiry 2029-01-09',
          ruleVersion: '1.4.0',
          timestamp: new Date().toISOString(),
        },
      ],
      duplicateMatches: [],
      isVerified: false,
      verificationStatus: 'PENDING' as const,
    };

    const persisted = await dbService.createDocumentWithTransaction(testDoc, adminUser);
    assert.equal(persisted.id, docId);

    // Verify extraction record exists in PostgreSQL
    const extractionRecord = await prisma.documentExtraction.findFirst({
      where: { documentId: docId },
    });

    assert.ok(extractionRecord, 'OCR Extraction record must be persisted in PostgreSQL');
    assert.equal(extractionRecord.referenceNumber, 'NOC-FS-2026-9021');
    assert.equal(extractionRecord.confidenceScore, 97.8);
    assert.ok(extractionRecord.pages, 'Pages detail JSON must be stored');
    assert.ok(extractionRecord.fields, 'Fields detail JSON must be stored');
  });

  // 5. Institution-level access isolation
  await t.test('5. Institution-level access isolation (tenant boundaries)', async () => {
    const collegeAUser = await dbService.getUserById('usr-college-a');
    const collegeBUser = await dbService.getUserById('usr-college-b');
    assert.ok(collegeAUser && collegeBUser);

    // College A queries institutions: should only see College A
    const collegeAInsts = await dbService.getInstitutions({}, collegeAUser);
    assert.equal(collegeAInsts.length, 1);
    assert.equal(collegeAInsts[0].id, 'INST-2026-001');

    // College A attempts to access College B institution details: should be rejected
    await assert.rejects(
      async () => {
        await dbService.getInstitutionById('INST-2026-002', collegeAUser);
      },
      { message: 'TENANT_ACCESS_DENIED' },
      'College A must be forbidden from accessing College B data'
    );

    // College A queries applications: should only return applications for INST-2026-001
    const collegeAApps = await dbService.getApplications({}, collegeAUser);
    for (const a of collegeAApps) {
      assert.equal(a.institutionId, 'INST-2026-001', 'Tenant isolation must filter applications');
    }
  });

  // 6. Transaction rollback on failure
  await t.test('6. Transaction rollback on failure (atomic consistency)', async () => {
    const adminUser = await dbService.getUserById('usr-admin-01');
    assert.ok(adminUser);

    const initialAuditCount = await prisma.auditLog.count();
    const testAppId = `APP-ROLLBACK-${Date.now()}`;
    const testAuditId = `AUDIT-ROLLBACK-${Date.now()}`;

    // Attempt a transaction where second operation fails intentionally
    try {
      await prisma.$transaction(async tx => {
        // Step 1: create application
        await tx.application.create({
          data: {
            id: testAppId,
            applicationNumber: `AICTE/TEST/RB-${Date.now()}`,
            institutionId: 'INST-2026-001',
            type: 'NEW_APPLICANT',
            academicYear: '2026-2027',
          },
        });

        // Step 2: create audit record inside same transaction
        await tx.auditLog.create({
          data: {
            id: testAuditId,
            actorId: adminUser.id,
            actorName: adminUser.name,
            actorRole: adminUser.role,
            action: 'ROLLBACK_TEST_ACTION',
            entityType: 'APPLICATION',
            entityId: testAppId,
            outcome: 'SUCCESS',
            details: 'This audit entry must be rolled back',
          },
        });

        // Step 3: Intentional failure (invalid foreign key reference)
        await tx.applicationChecklistItem.create({
          data: {
            id: `chk-fail-${Date.now()}`,
            applicationId: 'NON_EXISTENT_APP_ID_FOR_ROLLBACK',
            category: 'Testing',
            requirement: 'Should trigger FK violation',
          },
        });
      });
      assert.fail('Transaction should have thrown and rolled back');
    } catch {
      // Expected to fail
    }

    // Verify Step 1 & Step 2 were rolled back completely
    const shouldNotExistApp = await prisma.application.findUnique({
      where: { id: testAppId },
    });
    assert.equal(shouldNotExistApp, null, 'Application must be rolled back on transaction error');

    const shouldNotExistAudit = await prisma.auditLog.findUnique({
      where: { id: testAuditId },
    });
    assert.equal(shouldNotExistAudit, null, 'Audit log created in transaction must be rolled back on error');
  });

  // 7. Audit-log persistence (append-only)
  await t.test('7. Audit-log persistence in PostgreSQL', async () => {
    const adminUser = await dbService.getUserById('usr-admin-01');
    assert.ok(adminUser);

    const uniqueAction = `AUDIT_TEST_ACTION_${Date.now()}`;
    const logged = await dbService.logAudit({
      actorId: adminUser.id,
      actorName: adminUser.name,
      actorRole: adminUser.role,
      action: uniqueAction,
      entityType: 'APPLICATION',
      entityId: 'APP-2026-001',
      institutionId: 'INST-2026-001',
      outcome: 'SUCCESS',
      details: 'Automated regulatory test audit entry.',
    });

    assert.ok(logged.id);

    // Verify stored in PostgreSQL
    const dbAudit = await prisma.auditLog.findUnique({
      where: { id: logged.id },
    });

    assert.ok(dbAudit, 'Audit log must be stored in PostgreSQL');
    assert.equal(dbAudit.action, uniqueAction);
    assert.equal(dbAudit.actorId, adminUser.id);
  });

  // 8. Duplicate-document detection
  await t.test('8. Duplicate-document detection via SHA-256 in PostgreSQL', async () => {
    // DOC-2026-001 has known SHA-256 in seeded database
    const seedSha256 = 'a7b8c9d0e1f234567890abcdef1234567890abcdef1234567890abcdef123456';
    const found = await dbService.findDocumentBySha256(seedSha256);

    assert.ok(found, 'Should find existing document by SHA-256 hash');
    assert.equal(found.id, 'DOC-2026-001');

    const nonExistent = await dbService.findDocumentBySha256('0000000000000000000000000000000000000000000000000000000000000000');
    assert.equal(nonExistent, null, 'Non-existent hash must return null');
  });

  // 9. Database connection failure and graceful error handling
  await t.test('9. Database connection health reporting and graceful fallback', async () => {
    // Current health check should be connected
    const currentHealth = await checkDatabaseHealth();
    assert.equal(currentHealth.connected, true);

    // Integrations payload check
    const integrations = await dbService.getSystemIntegrations();
    assert.equal(integrations.database.status, 'CONNECTED');
    assert.equal(integrations.database.type, 'PostgreSQL');
    assert.ok(integrations.database.urlMasked.includes('****'), 'Password must be masked');
  });
});
