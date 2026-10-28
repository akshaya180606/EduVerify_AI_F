import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken, verifySessionToken } from '../server/middleware/auth.js';
import { dbService } from '../server/services/dbService.js';
import { UserRole } from '../src/types/index.js';

test('Comprehensive Role Authorization & Workflow Integration Tests', async t => {
  let serverInstance: any = null;
  const baseUrl = 'http://localhost:3000/api/v1';

  try {
    const ping = await fetch(`${baseUrl}/health`);
    if (!ping.ok) throw new Error('Not running');
  } catch {
    const express = (await import('express')).default;
    const { healthRouter } = await import('../server/routes/health.js');
    const { authRouter } = await import('../server/routes/auth.js');
    const { institutionsRouter } = await import('../server/routes/institutions.js');
    const { applicationsRouter } = await import('../server/routes/applications.js');
    const { documentsRouter } = await import('../server/routes/documents.js');
    const { scrutinyRouter } = await import('../server/routes/scrutiny.js');
    const { verificationRouter } = await import('../server/routes/verification.js');
    const { inspectionsRouter } = await import('../server/routes/inspections.js');
    const { clarificationsRouter } = await import('../server/routes/clarifications.js');
    const { notificationsRouter } = await import('../server/routes/notifications.js');
    const { reportsRouter } = await import('../server/routes/reports.js');
    const { auditRouter } = await import('../server/routes/audit.js');
    const { rulesRouter } = await import('../server/routes/rules.js');

    await dbService.init();

    const app = express();
    app.use(express.json({ limit: '25mb' }));
    app.use(express.urlencoded({ extended: true, limit: '25mb' }));

    const apiV1 = express.Router();
    apiV1.use('/health', healthRouter);
    apiV1.use('/auth', authRouter);
    apiV1.use('/institutions', institutionsRouter);
    apiV1.use('/applications', applicationsRouter);
    apiV1.use('/documents', documentsRouter);
    apiV1.use('/scrutiny', scrutinyRouter);
    apiV1.use('/verification', verificationRouter);
    apiV1.use('/inspections', inspectionsRouter);
    apiV1.use('/clarifications', clarificationsRouter);
    apiV1.use('/notifications', notificationsRouter);
    apiV1.use('/reports', reportsRouter);
    apiV1.use('/audit-logs', auditRouter);
    apiV1.use('/rules', rulesRouter);

    app.use('/api/v1', apiV1);

    await new Promise<void>(resolve => {
      serverInstance = app.listen(3000, () => resolve());
    });
  }

  t.after(() => {
    if (serverInstance) {
      serverInstance.close();
    }
  });

  // Helper token generator
  const getToken = (userId: string, role: UserRole, email: string, institutionId?: string) => {
    return createSessionToken({ userId, role, email, institutionId });
  };

  const adminToken = getToken('usr-admin-01', 'AICTE_ADMIN', 'admin@aicte-india.org');
  const collegeAToken = getToken('usr-college-a', 'COLLEGE_MANAGEMENT', 'principal@niet.edu.in', 'INST-2026-001');
  const collegeBToken = getToken('usr-college-b', 'COLLEGE_MANAGEMENT', 'director@apex.edu.in', 'INST-2026-002');
  const scrutinyToken = getToken('usr-scrutiny-01', 'SCRUTINY_OFFICER', 'scrutiny1@aicte-india.org');
  const verificationToken = getToken('usr-verify-01', 'VERIFICATION_OFFICER', 'verify1@aicte-india.org');
  const inspectionToken = getToken('usr-inspect-01', 'INSPECTION_OFFICER', 'evc1@aicte-india.org');

  // ----------------------------------------------------
  // SECTION 1: AUTHENTICATION & HEADER SPOOFING REJECTION
  // ----------------------------------------------------
  await t.test('1. Unauthenticated request without Bearer token is rejected (401)', async () => {
    const res = await fetch(`${baseUrl}/documents`);
    assert.equal(res.status, 401, 'Should reject unauthenticated access to /documents');
  });

  await t.test('2. Spoofed x-user-id header without Bearer token is rejected (401)', async () => {
    const res = await fetch(`${baseUrl}/documents`, {
      headers: {
        'x-user-id': 'usr-admin-01',
      },
    });
    assert.equal(res.status, 401, 'Should reject spoofed header without valid Bearer signature');
  });

  await t.test('3. Forged Bearer token is rejected (401)', async () => {
    const res = await fetch(`${baseUrl}/auth/me`, {
      headers: {
        Authorization: 'Bearer invalid.tampered.token',
      },
    });
    assert.equal(res.status, 401, 'Should reject invalid signature');
  });

  // ----------------------------------------------------
  // SECTION 2: ROLE 1 - AICTE ADMIN RESPONSIBILITIES
  // ----------------------------------------------------
  await t.test('4. AICTE Admin can query audit logs (200)', async () => {
    const res = await fetch(`${baseUrl}/audit-logs`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.logs));
  });

  await t.test('5. AICTE Admin can initiate an application docket for target institution (201)', async () => {
    const res = await fetch(`${baseUrl}/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        type: 'EXTENSION_OF_APPROVAL',
        academicYear: '2026-2027',
        institutionId: 'INST-2026-001',
        programmes: [
          { name: 'Artificial Intelligence & Data Science', level: 'UG', intakeApproved: 60, intakeRequested: 120 },
        ],
      }),
    });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.application.id);
    assert.equal(data.application.institutionId, 'INST-2026-001');
  });

  await t.test('6. AICTE Admin can upload regulatory certificates / test evidence (201)', async () => {
    const res = await fetch(`${baseUrl}/documents/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        applicationId: 'APP-2026-001',
        category: 'AFFILIATION_ORDER',
        filename: 'admin_verified_affiliation_order.pdf',
        fileContentBase64: Buffer.from('%PDF-1.4\nAICTE Admin Uploaded Test Affiliation Document\n%%EOF').toString('base64'),
      }),
    });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.document.id);
    assert.equal(data.document.category, 'AFFILIATION_ORDER');
  });

  await t.test('7. AICTE Admin can update institutional profile (200)', async () => {
    const res = await fetch(`${baseUrl}/institutions/INST-2026-001`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        totalFacultyCount: 165,
      }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.institution.totalFacultyCount, 165);
  });

  // ----------------------------------------------------
  // SECTION 3: ROLE 2 - COLLEGE MANAGEMENT BOUNDARIES
  // ----------------------------------------------------
  await t.test('8. College Management accessing own institution succeeds (200)', async () => {
    const res = await fetch(`${baseUrl}/institutions/INST-2026-001`, {
      headers: { Authorization: `Bearer ${collegeAToken}` },
    });
    assert.equal(res.status, 200);
  });

  await t.test('9. College Management cross-tenant access is blocked with 403 TENANT_ACCESS_DENIED', async () => {
    const res = await fetch(`${baseUrl}/institutions/INST-2026-002`, {
      headers: { Authorization: `Bearer ${collegeAToken}` },
    });
    assert.equal(res.status, 403);
    const data = await res.json();
    assert.equal(data.error, 'TENANT_ACCESS_DENIED');
  });

  await t.test('10. College Management is forbidden from accessing audit logs (403 ROLE_FORBIDDEN)', async () => {
    const res = await fetch(`${baseUrl}/audit-logs`, {
      headers: { Authorization: `Bearer ${collegeAToken}` },
    });
    assert.equal(res.status, 403);
    const data = await res.json();
    assert.equal(data.error, 'ROLE_FORBIDDEN');
  });

  await t.test('11. College Management can upload document for its own application docket (201)', async () => {
    const res = await fetch(`${baseUrl}/documents/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${collegeAToken}`,
      },
      body: JSON.stringify({
        applicationId: 'APP-2026-001',
        category: 'FIRE_SAFETY_CERTIFICATE',
        filename: 'niet_fire_noc_2026.pdf',
        fileContentBase64: Buffer.from('%PDF-1.4\nState Fire Department NOC for NIET\n%%EOF').toString('base64'),
      }),
    });
    assert.equal(res.status, 201);
  });

  await t.test('12. College Management cannot upload document to another college docket (403 TENANT_ACCESS_DENIED)', async () => {
    // Attempting upload for College B application APP-2026-002 using College A credentials
    const res = await fetch(`${baseUrl}/documents/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${collegeAToken}`,
      },
      body: JSON.stringify({
        applicationId: 'APP-2026-002',
        category: 'LAND_TITLE_DEED',
        filename: 'malicious_cross_tenant_upload.pdf',
      }),
    });
    assert.equal(res.status, 403);
  });

  // ----------------------------------------------------
  // SECTION 4: ROLE 3 - SCRUTINY OFFICER RESPONSIBILITIES
  // ----------------------------------------------------
  await t.test('13. Scrutiny Officer can access scrutiny work queue (200)', async () => {
    const res = await fetch(`${baseUrl}/scrutiny/queue`, {
      headers: { Authorization: `Bearer ${scrutinyToken}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.queue));
  });

  await t.test('14. Scrutiny Officer can request clarification (201)', async () => {
    const res = await fetch(`${baseUrl}/clarifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${scrutinyToken}`,
      },
      body: JSON.stringify({
        applicationId: 'APP-2026-001',
        requestedItem: 'Approved Building Plan Stamp Legibility',
        detailedReason: 'Municipal seal on page 2 requires higher resolution scan with visible gazette date.',
        dueDateDays: 14,
      }),
    });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.clarification.id);
  });

  await t.test('15. Scrutiny Officer is forbidden from audit logs (403 ROLE_FORBIDDEN)', async () => {
    const res = await fetch(`${baseUrl}/audit-logs`, {
      headers: { Authorization: `Bearer ${scrutinyToken}` },
    });
    assert.equal(res.status, 403);
  });

  await t.test('16. Scrutiny Officer cannot upload institutional application filings (403 ROLE_FORBIDDEN)', async () => {
    const res = await fetch(`${baseUrl}/documents/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${scrutinyToken}`,
      },
      body: JSON.stringify({
        applicationId: 'APP-2026-001',
        category: 'LAND_TITLE_DEED',
        filename: 'officer_tamper.pdf',
      }),
    });
    assert.equal(res.status, 403);
  });

  // ----------------------------------------------------
  // SECTION 5: ROLE 4 - VERIFICATION OFFICER RESPONSIBILITIES
  // ----------------------------------------------------
  await t.test('17. Verification Officer can access verification desk tasks (200)', async () => {
    const res = await fetch(`${baseUrl}/verification/tasks`, {
      headers: { Authorization: `Bearer ${verificationToken}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.tasks));
  });

  await t.test('18. Verification Officer can run external issuer check (200)', async () => {
    const res = await fetch(`${baseUrl}/verification/tasks/VT-2026-001/verify-external`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${verificationToken}`,
      },
      body: JSON.stringify({
        adapterId: 'ADAPTER-FIRE-NOC-UP',
      }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.task);
  });

  await t.test('19. Verification Officer can record official manual verification dossier (200)', async () => {
    const res = await fetch(`${baseUrl}/verification/tasks/VT-2026-001/record-manual`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${verificationToken}`,
      },
      body: JSON.stringify({
        officialAuthorityContacted: 'Sub-Divisional Fire Headquarters, Lucknow',
        verificationMode: 'DIRECT_DEPARTMENT_COMMUNICATION',
        officialReferenceReceiptNumber: 'FS/LKO/VERIF/2026/089',
        verificationOutcome: 'VERIFIED',
        findingsSummary: 'Official confirmed certificate registration validity in statutory register.',
      }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.task.status, 'VERIFIED');
  });

  await t.test('20. Verification Officer is forbidden from audit logs (403 ROLE_FORBIDDEN)', async () => {
    const res = await fetch(`${baseUrl}/audit-logs`, {
      headers: { Authorization: `Bearer ${verificationToken}` },
    });
    assert.equal(res.status, 403);
  });

  // ----------------------------------------------------
  // SECTION 6: ROLE 5 - INSPECTION OFFICER RESPONSIBILITIES
  // ----------------------------------------------------
  await t.test('21. Inspection Officer can list assigned inspections (200)', async () => {
    const res = await fetch(`${baseUrl}/inspections`, {
      headers: { Authorization: `Bearer ${inspectionToken}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.inspections));
  });

  await t.test('22. Inspection Officer can update category finding (200)', async () => {
    const res = await fetch(`${baseUrl}/inspections/INSP-2026-001/category`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${inspectionToken}`,
      },
      body: JSON.stringify({
        category: 'COMPUTING_FACILITIES',
        verifiedCapacity: 600,
        status: 'VERIFIED',
        observations: 'All 600 terminals operational with 1 Gbps lease line.',
      }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.inspection);
  });

  await t.test('23. Inspection Officer is forbidden from updating scrutiny checklists (403)', async () => {
    const res = await fetch(`${baseUrl}/scrutiny/checklist/chk-1`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${inspectionToken}`,
      },
      body: JSON.stringify({
        status: 'VERIFIED',
      }),
    });
    assert.equal(res.status, 403);
  });

  await t.test('24. Inspection Officer is forbidden from audit logs (403)', async () => {
    const res = await fetch(`${baseUrl}/audit-logs`, {
      headers: { Authorization: `Bearer ${inspectionToken}` },
    });
    assert.equal(res.status, 403);
  });
});
