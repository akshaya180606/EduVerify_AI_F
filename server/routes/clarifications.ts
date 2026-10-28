import { Router } from 'express';
import { dbService } from '../services/dbService.js';
import { db } from '../storage/db.js';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth.js';
import { canAccessInstitution } from '../../src/utils/security.js';
import { Clarification } from '../../src/types/index.js';

export const clarificationsRouter = Router();

// List clarifications
clarificationsRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  let list = [...db.clarifications];
  if (user.role === 'COLLEGE_MANAGEMENT') {
    list = list.filter(c => c.institutionId === user.institutionId);
  }

  const { applicationId } = req.query;
  if (applicationId) list = list.filter(c => c.applicationId === applicationId);

  return res.json({ clarifications: list });
});

// Create clarification request (Officer)
clarificationsRouter.post('/', requireAuth, requireRole('SCRUTINY_OFFICER', 'VERIFICATION_OFFICER', 'AICTE_ADMIN'), async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const { applicationId, requestedItem, detailedReason, dueDateDays } = req.body;
  const apps = await dbService.getApplications({}, user);
  const app = apps.find(a => a.id === applicationId);
  if (!app) return res.status(404).json({ error: 'Application not found' });

  const due = new Date();
  due.setDate(due.getDate() + (Number(dueDateDays) || 14));

  const newClarification: Clarification = {
    id: `CLAR-2026-${Math.floor(1000 + Math.random() * 9000)}`,
    applicationId: app.id,
    institutionId: app.institutionId,
    institutionName: app.institutionName,
    issuedByOfficerId: user.id,
    issuedByOfficerName: user.name,
    requestedItem,
    detailedReason,
    issuedAt: new Date().toISOString(),
    dueDate: due.toISOString(),
    status: 'PENDING_RESPONSE',
  };

  db.clarifications.unshift(newClarification);

  // Transition application to CLARIFICATION_REQUIRED
  let updatedApp;
  try {
    updatedApp = await dbService.transitionApplication(
      app.id,
      'CLARIFICATION_REQUIRED',
      `Clarification issued by ${user.name}: ${requestedItem}`,
      user
    );
  } catch {
    // fallback
  }

  // Create notification for College
  db.notifications.unshift({
    id: `NOTIF-${Date.now().toString(36)}`,
    recipientRole: 'COLLEGE_MANAGEMENT',
    institutionId: app.institutionId,
    title: `Clarification Required: ${requestedItem}`,
    message: `${user.name} requested clarification for application ${app.applicationNumber}. Response due by ${due.toLocaleDateString()}.`,
    link: '/clarifications',
    isRead: false,
    timestamp: new Date().toISOString(),
    type: 'ACTION_REQUIRED',
  });

  await dbService.logAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: 'CREATE_CLARIFICATION_REQUEST',
    entityType: 'CLARIFICATION',
    entityId: newClarification.id,
    institutionId: app.institutionId,
    institutionName: app.institutionName,
    outcome: 'SUCCESS',
    details: `Clarification issued: "${requestedItem}". Due: ${due.toISOString()}`,
  });

  return res.status(201).json({ clarification: newClarification, application: updatedApp || app });
});

// Submit clarification response (College)
clarificationsRouter.post('/:id/respond', requireAuth, requireRole('COLLEGE_MANAGEMENT', 'AICTE_ADMIN'), async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const clar = db.clarifications.find(c => c.id === req.params.id);
  if (!clar) return res.status(404).json({ error: 'Clarification not found' });

  if (!canAccessInstitution(user, clar.institutionId)) {
    return res.status(403).json({ error: 'TENANT_ACCESS_DENIED' });
  }

  const { responseText, responseDocumentId, responseDocumentName } = req.body;
  clar.status = 'SUBMITTED';
  clar.responseDate = new Date().toISOString();
  clar.responseText = responseText;
  clar.responseDocumentId = responseDocumentId;
  clar.responseDocumentName = responseDocumentName;

  // Move application to RESUBMITTED
  let updatedApp;
  try {
    updatedApp = await dbService.transitionApplication(
      clar.applicationId,
      'RESUBMITTED',
      `Clarification response submitted by ${user.name}`,
      user
    );
  } catch {
    // fallback
  }

  await dbService.logAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: 'SUBMIT_CLARIFICATION_RESPONSE',
    entityType: 'CLARIFICATION',
    entityId: clar.id,
    institutionId: clar.institutionId,
    institutionName: clar.institutionName,
    outcome: 'SUCCESS',
    details: `Response submitted for clarification ${clar.id}. Text length: ${responseText?.length || 0} chars.`,
  });

  return res.json({ clarification: clar, application: updatedApp });
});

// Resolve clarification (Officer)
clarificationsRouter.post('/:id/resolve', requireAuth, requireRole('SCRUTINY_OFFICER', 'VERIFICATION_OFFICER', 'AICTE_ADMIN'), async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const clar = db.clarifications.find(c => c.id === req.params.id);
  if (!clar) return res.status(404).json({ error: 'Clarification not found' });

  const { resolutionNotes, isAccepted } = req.body;
  clar.status = isAccepted ? 'RESOLVED' : 'REJECTED';
  clar.resolutionNotes = resolutionNotes;

  await dbService.logAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: 'RESOLVE_CLARIFICATION',
    entityType: 'CLARIFICATION',
    entityId: clar.id,
    institutionId: clar.institutionId,
    institutionName: clar.institutionName,
    outcome: isAccepted ? 'SUCCESS' : 'DENIED',
    details: `Clarification resolved as ${clar.status}. Notes: ${resolutionNotes || 'N/A'}`,
  });

  return res.json({ clarification: clar });
});
