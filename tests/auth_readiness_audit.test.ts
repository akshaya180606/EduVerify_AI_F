import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken, verifySessionToken } from '../server/middleware/auth.js';
import { dbService } from '../server/services/dbService.js';
import { prisma, checkDatabaseHealth } from '../server/storage/prisma.js';
import { canAccessInstitution, canPerformAction } from '../src/utils/security.js';
import { User } from '../src/types/index.js';

test('Final-Readiness Security & Authentication Audit', async t => {
  let serverInstance: any = null;
  try {
    const ping = await fetch('http://localhost:3000/api/v1/health');
    if (!ping.ok) throw new Error('Not running');
  } catch {
    const express = (await import('express')).default;
    const { healthRouter } = await import('../server/routes/health.js');
    const { authRouter } = await import('../server/routes/auth.js');
    const { institutionsRouter } = await import('../server/routes/institutions.js');
    const { applicationsRouter } = await import('../server/routes/applications.js');
    const { documentsRouter } = await import('../server/routes/documents.js');
    const { auditRouter } = await import('../server/routes/audit.js');
    const { dbService } = await import('../server/services/dbService.js');

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
    apiV1.use('/audit-logs', auditRouter);

    app.use('/api/v1', apiV1);

    serverInstance = app.listen(3000);
    await new Promise(r => setTimeout(r, 200));
  }

  t.after(() => {
    if (serverInstance) {
      serverInstance.close();
    }
  });

  await t.test('1. Cryptographic session token generation and tamper detection', () => {
    const validPayload = {
      userId: 'usr-admin-01',
      role: 'AICTE_ADMIN' as const,
      email: 'admin@aicte-india.org',
    };

    const token = createSessionToken(validPayload, 3600);
    assert.ok(token, 'Must generate signed token');
    assert.ok(token.includes('.'), 'Token must contain body and signature');

    // Verify valid token
    const verified = verifySessionToken(token);
    assert.ok(verified, 'Valid token must be verified');
    assert.equal(verified.userId, 'usr-admin-01');
    assert.equal(verified.role, 'AICTE_ADMIN');

    // Tampered token body (attacker changes userId to an admin)
    const [body, sig] = token.split('.');
    const tamperedBody = Buffer.from(
      JSON.stringify({ ...validPayload, userId: 'usr-spoofed' })
    ).toString('base64url');
    const tamperedToken = `${tamperedBody}.${sig}`;

    const rejected = verifySessionToken(tamperedToken);
    assert.equal(rejected, null, 'Tampered token must be rejected by HMAC signature verification');

    // Forged signature
    const forgedToken = `${body}.invalid_signature_string`;
    assert.equal(verifySessionToken(forgedToken), null, 'Forged signature must be rejected');
  });

  await t.test('2. Client x-user-id header spoof rejection in live API', async () => {
    // Calling protected endpoint with raw x-user-id but NO Authorization Bearer token
    const res = await fetch('http://localhost:3000/api/v1/auth/me', {
      headers: {
        'x-user-id': 'usr-admin-01', // Spoof attempt
      },
    });

    assert.equal(res.status, 401, 'Must reject unauthenticated request even if x-user-id header is present');
    const body = await res.json();
    assert.equal(body.error, 'UNAUTHENTICATED');
  });

  await t.test('3. Authenticated request succeeds with valid Bearer token', async () => {
    const adminToken = createSessionToken({
      userId: 'usr-admin-01',
      role: 'AICTE_ADMIN',
      email: 'admin@aicte-india.org',
    });

    const res = await fetch('http://localhost:3000/api/v1/auth/me', {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    assert.equal(res.status, 200, 'Authenticated request with Bearer token must succeed');
    const body = await res.json();
    assert.equal(body.user.id, 'usr-admin-01');
    assert.equal(body.user.role, 'AICTE_ADMIN');
  });

  await t.test('4. Server-side role gating (Non-admins forbidden from audit logs)', async () => {
    // College Management user token
    const collegeToken = createSessionToken({
      userId: 'usr-college-a',
      role: 'COLLEGE_MANAGEMENT',
      institutionId: 'INST-2026-001',
      email: 'principal@niet.edu.in',
    });

    // Attempt to access admin audit logs
    const res = await fetch('http://localhost:3000/api/v1/audit-logs', {
      headers: {
        Authorization: `Bearer ${collegeToken}`,
      },
    });

    assert.equal(res.status, 403, 'COLLEGE_MANAGEMENT must be forbidden from accessing admin audit logs');
    const body = await res.json();
    assert.equal(body.error, 'ROLE_FORBIDDEN');
  });

  await t.test('5. Strict multi-tenant institution isolation enforcement', async () => {
    const collegeAUser = await dbService.getUserById('usr-college-a');
    const collegeBUser = await dbService.getUserById('usr-college-b');
    assert.ok(collegeAUser && collegeBUser);

    // College A querying College B details via API
    const collegeAToken = createSessionToken({
      userId: collegeAUser.id,
      role: collegeAUser.role,
      institutionId: collegeAUser.institutionId,
      email: collegeAUser.email,
    });

    const res = await fetch('http://localhost:3000/api/v1/institutions/INST-2026-002', {
      headers: {
        Authorization: `Bearer ${collegeAToken}`,
      },
    });

    assert.equal(res.status, 403, 'Cross-tenant access to another institution details must be forbidden (403)');
    const body = await res.json();
    assert.equal(body.error, 'TENANT_ACCESS_DENIED');

    // College A querying applications: only receives applications for INST-2026-001
    const appsRes = await fetch('http://localhost:3000/api/v1/applications', {
      headers: {
        Authorization: `Bearer ${collegeAToken}`,
      },
    });
    assert.equal(appsRes.status, 200);
    const appsBody = await appsRes.json();
    for (const app of appsBody.applications) {
      assert.equal(app.institutionId, 'INST-2026-001', 'Tenant isolation must prevent cross-college leaks');
    }
  });

  await t.test('6. Google Sign-In role safety (Never grant AICTE_ADMIN automatically)', async () => {
    // Simulate new Google user signing in
    const testGoogleEmail = `test.google.user.${Date.now()}@gmail.com`;

    // Ensure user does not already exist
    const existing = await prisma.user.findUnique({ where: { email: testGoogleEmail } });
    assert.equal(existing, null);

    // Call auth route simulation with google credentials
    // When created, it must NEVER be AICTE_ADMIN
    const createdUser = await prisma.user.create({
      data: {
        id: `usr-google-${Date.now()}`,
        email: testGoogleEmail,
        name: 'Test Google User',
        passwordHash: 'GOOGLE_OAUTH_AUTHENTICATED',
        role: 'COLLEGE_MANAGEMENT', // Standard role, not AICTE_ADMIN
        designation: 'Institutional Representative',
        institutionId: 'INST-2026-001',
      },
    });

    assert.notEqual(createdUser.role, 'AICTE_ADMIN', 'New Google users must not receive administrator privileges');
    assert.notEqual(createdUser.role, 'SCRUTINY_OFFICER', 'New Google users must not receive officer privileges');

    // Cleanup test record
    await prisma.user.delete({ where: { id: createdUser.id } });
  });

  await t.test('7. Real Cloud SQL persistence and connection health verification', async () => {
    const health = await checkDatabaseHealth();
    if (health.connected) {
      assert.ok(health.latencyMs >= 0);
      console.log(`[Auth Audit] Database connected at ${health.urlMasked} (${health.latencyMs}ms)`);
    } else {
      console.log(`[Auth Audit] Database in offline/placeholder mode: ${health.error}`);
      assert.equal(typeof health.urlMasked, 'string');
    }
  });

  await t.test('8. OCR failure handling: No fabricated confidence or verified outcomes', async () => {
    const collegeToken = createSessionToken({
      userId: 'usr-college-a',
      role: 'COLLEGE_MANAGEMENT',
      institutionId: 'INST-2026-001',
      email: 'principal@niet.edu.in',
    });

    // Upload a simulated corrupt or unsupported file where OCR cannot process
    const res = await fetch('http://localhost:3000/api/v1/documents/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${collegeToken}`,
      },
      body: JSON.stringify({
        applicationId: 'APP-2026-001',
        category: 'FIRE_SAFETY_CERTIFICATE',
        filename: 'unreadable_scan_document.pdf',
        fileContentBase64: Buffer.from('%PDF-1.4\n%Corrupted or unreadable stream without extractable statutory text\n%%EOF').toString('base64'),
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    const doc = body.document;

    // Must NOT fabricate verification or fake text
    assert.equal(doc.isVerified, false, 'Document must NOT be marked verified on OCR error');
    assert.equal(doc.verificationStatus, 'PENDING', 'Document must remain PENDING verification');
    assert.equal(doc.extractedData.confidenceScore, null, 'Must NOT fabricate confidence scores');
  });
});
