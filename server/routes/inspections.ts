import { Router } from 'express';
import { dbService } from '../services/dbService.js';
import { db } from '../storage/db.js';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth.js';

export const inspectionsRouter = Router();

// List inspections
inspectionsRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  let list = [...db.inspections];
  if (user.role === 'COLLEGE_MANAGEMENT') {
    list = list.filter(i => i.institutionId === user.institutionId);
  } else if (user.role === 'INSPECTION_OFFICER') {
    list = list.filter(i => i.officerId === user.id || i.status === 'SCHEDULED');
  }

  return res.json({ inspections: list });
});

// Update category finding
inspectionsRouter.put('/:id/category', requireAuth, requireRole('INSPECTION_OFFICER', 'AICTE_ADMIN'), async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const insp = db.inspections.find(i => i.id === req.params.id);
  if (!insp) return res.status(404).json({ error: 'Inspection not found' });

  const { category, verifiedCapacity, status, observations } = req.body;
  const catIndex = insp.categories.findIndex(c => c.category === category);
  if (catIndex !== -1) {
    insp.categories[catIndex] = {
      ...insp.categories[catIndex],
      verifiedCapacity: verifiedCapacity || insp.categories[catIndex].verifiedCapacity,
      status: status || insp.categories[catIndex].status,
      observations: observations || insp.categories[catIndex].observations,
    };
  }

  return res.json({ inspection: insp });
});

// Submit final inspection report
inspectionsRouter.post('/:id/submit-report', requireAuth, requireRole('INSPECTION_OFFICER', 'AICTE_ADMIN'), async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const insp = db.inspections.find(i => i.id === req.params.id);
  if (!insp) return res.status(404).json({ error: 'Inspection not found' });

  const { overallRecommendation, summaryFindings } = req.body;
  insp.status = 'COMPLETED';
  insp.overallRecommendation = overallRecommendation;
  insp.summaryFindings = summaryFindings;
  insp.actualDate = new Date().toISOString();
  insp.reportSubmittedAt = new Date().toISOString();

  // Transition application via dbService
  let updatedApp;
  try {
    updatedApp = await dbService.transitionApplication(
      insp.applicationId,
      'RECOMMENDATION_SUBMITTED',
      `Inspection report filed by EVC Committee (${overallRecommendation}).`,
      user
    );
  } catch {
    // If already in that state or direct update
  }

  await dbService.logAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: 'SUBMIT_INSPECTION_REPORT',
    entityType: 'INSPECTION',
    entityId: insp.id,
    institutionId: insp.institutionId,
    institutionName: insp.institutionName,
    outcome: 'SUCCESS',
    details: `Inspection completed with recommendation: ${overallRecommendation}. Findings: ${summaryFindings?.substring(0, 80)}...`,
  });

  return res.json({ inspection: insp, application: updatedApp });
});
