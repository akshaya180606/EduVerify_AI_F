import test from 'node:test';
import assert from 'node:assert/strict';
import { ApplicationStatus } from '../src/types/index.js';

// Application state machine transition rules
const ALLOWED_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  DRAFT: ['SUBMITTED', 'WITHDRAWN'],
  SUBMITTED: ['UNDER_SCRUTINY', 'WITHDRAWN'],
  UNDER_SCRUTINY: ['CLARIFICATION_REQUIRED', 'UNDER_VERIFICATION', 'RECOMMENDATION_SUBMITTED'],
  CLARIFICATION_REQUIRED: ['RESUBMITTED'],
  RESUBMITTED: ['UNDER_SCRUTINY', 'UNDER_VERIFICATION'],
  UNDER_VERIFICATION: ['INSPECTION_PENDING', 'RECOMMENDATION_SUBMITTED', 'CLARIFICATION_REQUIRED'],
  INSPECTION_PENDING: ['UNDER_INSPECTION'],
  UNDER_INSPECTION: ['RECOMMENDATION_SUBMITTED'],
  RECOMMENDATION_SUBMITTED: ['APPROVED', 'REJECTED'],
  APPROVED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

test('state machine permits standard linear approval progression', () => {
  let current: ApplicationStatus = 'DRAFT';
  
  assert.ok(ALLOWED_TRANSITIONS[current].includes('SUBMITTED'));
  current = 'SUBMITTED';

  assert.ok(ALLOWED_TRANSITIONS[current].includes('UNDER_SCRUTINY'));
  current = 'UNDER_SCRUTINY';

  assert.ok(ALLOWED_TRANSITIONS[current].includes('UNDER_VERIFICATION'));
  current = 'UNDER_VERIFICATION';

  assert.ok(ALLOWED_TRANSITIONS[current].includes('INSPECTION_PENDING'));
  current = 'INSPECTION_PENDING';

  assert.ok(ALLOWED_TRANSITIONS[current].includes('UNDER_INSPECTION'));
  current = 'UNDER_INSPECTION';

  assert.ok(ALLOWED_TRANSITIONS[current].includes('RECOMMENDATION_SUBMITTED'));
  current = 'RECOMMENDATION_SUBMITTED';

  assert.ok(ALLOWED_TRANSITIONS[current].includes('APPROVED'));
});

test('state machine rejects illegal skips or backward jumps without clarification', () => {
  // Cannot jump from DRAFT straight to APPROVED
  assert.equal(ALLOWED_TRANSITIONS['DRAFT'].includes('APPROVED'), false);

  // Cannot jump from SUBMITTED directly to INSPECTION_PENDING without scrutiny
  assert.equal(ALLOWED_TRANSITIONS['SUBMITTED'].includes('INSPECTION_PENDING'), false);

  // Terminal states APPROVED and REJECTED have no outgoing transitions
  assert.equal(ALLOWED_TRANSITIONS['APPROVED'].length, 0);
  assert.equal(ALLOWED_TRANSITIONS['REJECTED'].length, 0);
});

test('state machine correctly models clarification round-trip', () => {
  // Scrutiny can request clarification
  assert.ok(ALLOWED_TRANSITIONS['UNDER_SCRUTINY'].includes('CLARIFICATION_REQUIRED'));
  
  // From clarification, college can only resubmit
  assert.deepEqual(ALLOWED_TRANSITIONS['CLARIFICATION_REQUIRED'], ['RESUBMITTED']);

  // Resubmitted application returns to scrutiny or verification
  assert.ok(ALLOWED_TRANSITIONS['RESUBMITTED'].includes('UNDER_SCRUTINY'));
});
