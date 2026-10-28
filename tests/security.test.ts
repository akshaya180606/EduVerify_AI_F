import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeCsvField,
  generateSafeCsv,
  canAccessInstitution,
  canPerformAction,
  computeSHA256,
  generateSafeStorageKey
} from '../src/utils/security.js';
import { User } from '../src/types/index.js';

test('sanitizeCsvField escapes formula injection prefixes', () => {
  assert.equal(sanitizeCsvField('=SUM(A1:B1)'), "'=SUM(A1:B1)");
  assert.equal(sanitizeCsvField('+cmd|/c calc'), "'+cmd|/c calc");
  assert.equal(sanitizeCsvField('-500'), "'-500");
  assert.equal(sanitizeCsvField('@alert'), "'@alert");
  assert.equal(sanitizeCsvField('Normal Text'), 'Normal Text');
});

test('generateSafeCsv produces well-escaped CSV rows', () => {
  const csv = generateSafeCsv(
    ['Institution', 'Intake', 'Formula'],
    [['College A', 120, '=cmd|'], ['College B, Inc.', 300, 'safe']]
  );
  assert.ok(csv.includes("'=cmd|"));
  assert.ok(csv.includes('"College B, Inc."'));
});

test('canAccessInstitution enforces strict multi-tenant isolation', () => {
  const collegeAUser: User = {
    id: 'user-a',
    name: 'Admin College A',
    email: 'admin@college-a.edu',
    role: 'COLLEGE_MANAGEMENT',
    institutionId: 'inst-college-a',
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  const collegeBUser: User = {
    id: 'user-b',
    name: 'Admin College B',
    email: 'admin@college-b.edu',
    role: 'COLLEGE_MANAGEMENT',
    institutionId: 'inst-college-b',
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  const aicteAdmin: User = {
    id: 'user-admin',
    name: 'AICTE Central Admin',
    email: 'admin@aicte-india.org',
    role: 'AICTE_ADMIN',
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  // College A CAN access College A
  assert.equal(canAccessInstitution(collegeAUser, 'inst-college-a'), true);
  // College A CANNOT access College B
  assert.equal(canAccessInstitution(collegeAUser, 'inst-college-b'), false);
  // College B CANNOT access College A
  assert.equal(canAccessInstitution(collegeBUser, 'inst-college-a'), false);
  // AICTE Admin CAN access both
  assert.equal(canAccessInstitution(aicteAdmin, 'inst-college-a'), true);
  assert.equal(canAccessInstitution(aicteAdmin, 'inst-college-b'), true);
});

test('canPerformAction ensures role privilege gating', () => {
  const officerUser: User = {
    id: 'scrutiny-1',
    name: 'Dr. Officer',
    email: 'officer@aicte.gov.in',
    role: 'SCRUTINY_OFFICER',
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  const collegeUser: User = {
    id: 'college-1',
    name: 'College Dean',
    email: 'dean@college.edu',
    role: 'COLLEGE_MANAGEMENT',
    institutionId: 'inst-1',
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  assert.equal(canPerformAction(officerUser, 'SCRUTINIZE'), true);
  assert.equal(canPerformAction(collegeUser, 'SCRUTINIZE'), false);
  assert.equal(canPerformAction(collegeUser, 'CREATE_APPLICATION'), true);
  assert.equal(canPerformAction(officerUser, 'CREATE_APPLICATION'), false);
});

test('computeSHA256 returns valid 64-char hex string', async () => {
  const hash = await computeSHA256('EduVerify-AI Test File Content');
  assert.equal(typeof hash, 'string');
  assert.equal(hash.length, 64);
});
